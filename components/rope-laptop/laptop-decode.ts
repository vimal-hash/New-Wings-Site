import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type {RopeLook} from "../rope-model/rope-materials";

const Z_MIDDLE=-14; // positions are stored around here, so the long tunnel fits the small number type
const TIP_LONG=.25; // world units
const SLAB=1.5,SECTORS=8; // one group per stretch of tunnel and side of the ring, so what is behind or beside the camera is not sent

export type Meta={grid:number;coreGrid:number;grain:{width:number;height:number;gain:number;mean:number};runs:number;points:number;ropeRuns:number[];camera:{lens:number;sensor:number;near:number;far:number};ranges:{radius:[number,number];uv_u:[number,number];rope_hot:[number,number]};look:RopeLook;lightPeak:number;table:Record<string,[number,number,number]>;cores:{index:number;vertices:number;indices:number;i:[number,number];p:[number,number];c:[number,number]}[]};
export type RopeSamples={index:number;points:Float32Array};

async function gunzip(bytes:Uint8Array){
  const stream=new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

class Reader{
  at=0;
  constructor(public data:Uint8Array){}
  byte(){return this.data[this.at++];}
  varint(){
    let value=0,scale=1,b;
    do{b=this.data[this.at++];value+=(b&127)*scale;scale*=128;}while(b>127);
    return value;
  }
  signed(){const v=this.varint();return v%2===0?v/2:-(v+1)/2;}
}

/** Unpacks the file into what the graphics card draws: two corners for every thread point, sharing their corners along the thread. */
export async function decodeRope(file:Uint8Array){
  await MeshoptDecoder.ready;
  const head=new DataView(file.buffer,file.byteOffset,8),jsonLength=head.getUint32(4,true);
  const meta=JSON.parse(new TextDecoder().decode(file.subarray(8,8+jsonLength))) as Meta,base=8+jsonLength;
  const names=Object.keys(meta.table),opened=await Promise.all(names.map(name=>{const [o,l]=meta.table[name];return gunzip(file.subarray(base+o,base+o+l));}));
  const R=Object.fromEntries(names.map((name,i)=>[name,new Reader(opened[i])])) as Record<string,Reader>;

  const points=meta.points,grid=meta.grid;
  const P=new Int16Array(points*8),T=new Int8Array(points*8),G=new Uint8Array(points*8),L=new Uint8Array(points*8),M=new Uint8Array(points*8),E=new Uint8Array(points*8),F=new Uint8Array(points*4);
  const world=new Float32Array(points*3),segmentsBy=new Map<number,{rank:number;a:number}[]>();
  const samples:RopeSamples[]=[];
  const LIGHT=255/31,RAMP=255/63,FIVE=255/31,ALPHA=255/15;
  let point=0,x=0,y=0,z=0,segments=0;
  const boxes=new Map<number,{x0:number;x1:number;y0:number;y1:number;z0:number;z1:number}>();
  for(let rope=0;rope<meta.ropeRuns.length;rope++){
    const firstPoint=point;
    for(let r=0;r<meta.ropeRuns[rope];r++){
      const count=R.counts.varint(),step=1<<R.shift.byte();
      x+=R.startX.signed();y+=R.startY.signed();z+=R.startZ.signed();
      const rampR=R.rampR.byte()*RAMP,rampG=R.rampG.byte()*RAMP,rampB=R.rampB.byte()*RAMP,random=R.random.byte()*RAMP,alpha=R.alpha.byte()*ALPHA,radius=R.radius.byte()*FIVE,u0=R.u0Low.byte()+R.u0High.byte()*256,u1=u0+R.u1.signed(),rank=R.rank.byte()*8,tint=R.litTint.byte()*FIVE,throughTint=R.thrTint.byte()/31,amber=R.amber.byte(),hot=R.hot.byte();
      let px=x,py=y,pz=z,s=0,l=0,tr=0,length=0;
      const start=point;
      for(let k=0;k<count;k++){
        if(k>0){
          px+=R.dx.signed()*step;py+=R.dy.signed()*step;pz+=R.dz.signed()*step;
          const a=(point-1)*3;
          length+=Math.hypot(px*grid-world[a],py*grid-world[a+1],pz*grid-world[a+2]);
        }
        s+=R.strength.signed();l+=R.lit.signed();tr+=R.thrR.signed();
        const at=point*8;
        // What the light passes through, worked out once here instead of for every corner on every frame. Stored as a square root, for more steps in the dark.
        const filteredR=(tr*LIGHT/255)**2,filteredG=(tr*LIGHT*throughTint/255)**2,red=Math.max(filteredR,1e-4),seen=Math.min(red,1)**.7;
        const throughR=Math.sqrt(seen)*255,throughG=Math.sqrt(seen*Math.min(filteredG/red,1)**4.5)*255,throughB=Math.sqrt(seen*Math.min((filteredG+(filteredR-filteredG)*.069)/red,1)**3)*255;
        world[point*3]=px*grid;world[point*3+1]=py*grid;world[point*3+2]=pz*grid;
        for(let side=0;side<2;side++){
          const v=at+side*4;
          P[v]=px;P[v+1]=py;P[v+2]=Math.round((pz*grid-Z_MIDDLE)/(grid*2));P[v+3]=(side*2-1)*32767;
          G[v]=rampR;G[v+1]=rampG;G[v+2]=rampB;G[v+3]=s*LIGHT;
          L[v]=l*LIGHT;L[v+1]=throughG;L[v+2]=throughB;L[v+3]=alpha;
          M[v+2]=throughR;
          E[v]=tint;E[v+1]=amber;E[v+2]=hot;E[v+3]=random;
          M[v+3]=rope;
          // The thread's first and last points taper away, as in the file.
          T[v+3]=radius>>1;
        }
        point++;
      }
      // Length along the thread gives the light its place, from the run's two ends. Tangents from the neighbours.
      let along=0;
      for(let k=0;k<count;k++){
        const i=start+k,before=Math.max(k-1,0)+start,after=Math.min(k+1,count-1)+start;
        let tx=world[after*3]-world[before*3],ty=world[after*3+1]-world[before*3+1],tz=world[after*3+2]-world[before*3+2];
        const ll=Math.hypot(tx,ty,tz)||1;tx/=ll;ty/=ll;tz/=ll;
        if(k>0)along+=Math.hypot(world[i*3]-world[(i-1)*3],world[i*3+1]-world[(i-1)*3+1],world[i*3+2]-world[(i-1)*3+2]);
        const u=Math.round((u0+(u1-u0)*(length>0?along/length:0))*16);
        for(let side=0;side<2;side++){
          const v=i*8+side*4;
          T[v]=tx*127;T[v+1]=ty*127;T[v+2]=tz*127;
          if(count>2&&(k===0||k===count-1)){
            const other=k===0?i+1:i-1,piece=Math.hypot(world[i*3]-world[other*3],world[i*3+1]-world[other*3+1],world[i*3+2]-world[other*3+2]);
            T[v+3]=Math.round(T[v+3]*Math.min(piece/TIP_LONG,1));
          }
          M[v]=u>>8;M[v+1]=u&255;
          // How far this point is from each end of its piece of thread, so a piece fades out instead of stopping dead.
          const f=i*4+side*2;
          F[f]=Math.min(along/TIP_LONG,1)*255;F[f+1]=Math.min((length-along)/TIP_LONG,1)*255;
        }
        if(k<count-1){
          const mx=(world[i*3]+world[(i+1)*3])/2,my=(world[i*3+1]+world[(i+1)*3+1])/2,mz=(world[i*3+2]+world[(i+1)*3+2])/2;
          const slab=Math.floor((3-mz)/SLAB),sector=Math.floor((Math.atan2(my,mx)/Math.PI/2+.5)*SECTORS)%SECTORS,key=slab*SECTORS+sector;
          let list=segmentsBy.get(key);
          if(!list){list=[];segmentsBy.set(key,list);}
          list.push({rank,a:i});
          let box=boxes.get(key);
          if(!box){box={x0:Infinity,x1:-Infinity,y0:Infinity,y1:-Infinity,z0:Infinity,z1:-Infinity};boxes.set(key,box);}
          for(const e of [i,i+1]){
            box.x0=Math.min(box.x0,world[e*3]);box.x1=Math.max(box.x1,world[e*3]);box.y0=Math.min(box.y0,world[e*3+1]);box.y1=Math.max(box.y1,world[e*3+1]);box.z0=Math.min(box.z0,world[e*3+2]);box.z1=Math.max(box.z1,world[e*3+2]);
          }
          segments++;
        }
      }
    }
    if(rope<18){
      // Enough of each rope's points to find the rope under the mouse.
      const span=point-firstPoint,step=Math.max(1,Math.floor(span/3000)),n=Math.floor(span/step),out=new Float32Array(n*3);
      for(let i=0;i<n;i++){const a=(firstPoint+i*step)*3;out[i*3]=world[a];out[i*3+1]=world[a+1];out[i*3+2]=world[a+2];}
      samples.push({index:rope,points:out});
    }
  }

  const index=new Uint32Array(segments*6);
  // Points are only needed to fill the corners; the renderer keeps its own copy after upload.
  const chunks=[];
  let written=0;
  for(const key of [...segmentsBy.keys()].sort((a,b)=>a-b)){
    const list=segmentsBy.get(key)!;
    // Best first inside a group, so a far group can draw only its best.
    list.sort((a,b)=>a.rank-b.rank);
    const start=written,ranks=new Uint32Array(257);
    for(const {rank,a} of list){
      const v=a*2;
      index[written++]=v;index[written++]=v+1;index[written++]=v+2;index[written++]=v+2;index[written++]=v+1;index[written++]=v+3;
      ranks[rank+1]++;
    }
    for(let i=1;i<257;i++)ranks[i]+=ranks[i-1];
    chunks.push({start,...boxes.get(key)!,segments:list.length,ranks});
  }
  segmentsBy.clear();

  // The core: decoded and joined into one draw.
  const vertices=meta.cores.reduce((a,c)=>a+c.vertices,0),indices=meta.cores.reduce((a,c)=>a+c.indices,0);
  const coreP=new Int16Array(vertices*4),coreC=new Uint8Array(vertices*4),coreI=new Uint32Array(indices);
  let vb=0,ib=0;
  for(const c of meta.cores){
    const piece=(where:[number,number])=>file.subarray(base+where[0],base+where[0]+where[1]);
    const unpacked=await Promise.all([gunzip(piece(c.i)),gunzip(piece(c.p)),gunzip(piece(c.c))]);
    const ix=new Uint8Array(c.indices*4),pos=new Uint8Array(c.vertices*8),col=new Uint8Array(c.vertices*4);
    MeshoptDecoder.decodeIndexBuffer(ix,c.indices,4,unpacked[0]);
    MeshoptDecoder.decodeVertexBuffer(pos,c.vertices,8,unpacked[1]);
    MeshoptDecoder.decodeVertexBuffer(col,c.vertices,4,unpacked[2]);
    coreP.set(new Int16Array(pos.buffer),vb*4);
    coreC.set(col,vb*4);
    const ints=new Uint32Array(ix.buffer);
    for(let i=0;i<c.indices;i++)coreI[ib+i]=ints[i]+vb;
    vb+=c.vertices;ib+=c.indices;
  }
  return {meta,chunks,arrays:{P,T,G,L,M,E,F},index,coreP,coreC,coreI,grain:R.grain.data,grid,zMiddle:Z_MIDDLE,samples,segments};
}

export type DecodedRope=Awaited<ReturnType<typeof decodeRope>>;
