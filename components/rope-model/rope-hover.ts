import type {BufferGeometry,InterleavedBufferAttribute,Matrix4,PerspectiveCamera,ShaderMaterial} from "three";
import {WHITE} from "./rope-materials";

/** White spreading along a rope from the point under the mouse. Distances are in world units; the tunnel is about 32 long. */
export const SPREAD={
  paceBase:.05, // a far rope spreads faster in the world, so it looks about as fast on screen: around 100 pixels a second at 1920 wide
  pacePerDepth:.06,
  paceFastest:2.2,
  speedUp:.12, // the longer it runs, the faster it goes, by this share per second, so a long rope does not take minutes
  fadeIn:.25, // seconds
  fadeOut:.6,
  reachScreen:.19, // the white stops this far from the mouse, as a share of the screen width, on ropes up to reachDepth away
  reachDepth:3, // further than this it keeps the same real length and looks smaller, so a far rope does not curl around the hole
  settle:.45, // the white slows to a stop over this last share of its length, and starts drawing back the same way
  settleLeast:.02, // near the very end of that stretch it keeps this share of it as its pace, so it always arrives
  backLeast:.5, // drawing back never goes slower than this speed setting, so the white still leaves when the speed control is at 0
  samplesPerRope:3000,
  nearest:.3,
  catchWorld:.12, // how close to a rope the mouse must be, in the world or on screen, whichever is wider
  catchPixels:12,
};

// Constant slowing over the last stretch: full pace until then, and close to nothing at the end. Used forwards to stop and backwards to start drawing back.
const easedPace=(distance:number,limit:number)=>{
  const stretch=limit*SPREAD.settle;
  return Math.min(1,Math.sqrt(Math.max(distance,stretch*SPREAD.settleLeast)/stretch));
};
// Each thread's front runs up to half the jitter ahead, so the last white has gone only when the radius is that far below zero.
const FULLY_BACK=-WHITE.jitter/2;

const HOLD_SPOTS=[[.55,.3],[-.55,.3],[.55,-.3],[-.55,-.3],[.3,.6],[-.3,-.6]];
type Spread={samples:Float32Array;x:number;y:number;z:number;radius:number;limit:number;amount:number;pace:number;wanted:boolean};
export type RopePointer={x:number;y:number;on:boolean;moved:boolean};
export type RopeSource={index:number;geometry:BufferGeometry;matrix:Matrix4;stored?:Int16Array};

// Only some of a rope's points are kept on the processor: enough to find the rope under the mouse, without touching the graphics card.
// A file that had its unseen threads removed carries these points from before the removal, so the mouse finds exactly the same places.
function readSamples(geometry:BufferGeometry,matrix:Matrix4,stored?:Int16Array){
  const position=geometry.getAttribute("position") as unknown as InterleavedBufferAttribute;
  const step=Math.max(1,Math.floor(position.count/SPREAD.samplesPerRope)),count=stored?stored.length/3:Math.floor(position.count/step),samples=new Float32Array(count*3),m=matrix.elements;
  for(let i=0;i<count;i++){
    const at=i*step,x=stored?stored[i*3]/32767:position.getX(at),y=stored?stored[i*3+1]/32767:position.getY(at),z=stored?stored[i*3+2]/32767:position.getZ(at);
    samples[i*3]=m[0]*x+m[4]*y+m[8]*z+m[12];
    samples[i*3+1]=m[1]*x+m[5]*y+m[9]*z+m[13];
    samples[i*3+2]=m[2]*x+m[6]*y+m[10]*z+m[14];
  }
  return samples;
}

export function createHover(sources:RopeSource[],ropeCount:number){
  const spreads:Spread[]=[];
  for(const {index,geometry,matrix,stored} of sources)spreads[index]={samples:readSamples(geometry,matrix,stored),x:0,y:0,z:0,radius:0,limit:0,amount:0,pace:0,wanted:false};
  let current=-1,kept=-1,lastZ=Infinity,lastRope=-2,lastOn=false,active=false,hitX=0,hitY=0,hitZ=0,hitDepth=0,cameraZ=0;

  // Nearest rope under the mouse. The rope already under it stays chosen unless another is clearly in front, so neighbours don't fight along their edge.
  function pick(pointer:RopePointer,across:number,up:number,width:number,camera:PerspectiveCamera){
    const dx=pointer.x*across,dy=pointer.y*up,z=camera.position.z,perPixel=across*2/width;
    let best=-1,bestDepth=Infinity,keepDepth=Infinity;
    let bx=0,by=0,bz=0,kx=0,ky=0,kz=0;
    for(let rope=0;rope<ropeCount;rope++){
      const samples=spreads[rope].samples;
      let depthHere=Infinity,sx=0,sy=0,sz=0;
      for(let i=0;i<samples.length;i+=3){
        const depth=z-samples[i+2];
        if(depth<SPREAD.nearest||depth>=depthHere)continue;
        const ex=samples[i]-dx*depth,ey=samples[i+1]-dy*depth,reach=Math.max(SPREAD.catchWorld,SPREAD.catchPixels*perPixel*depth);
        if(ex*ex+ey*ey>reach*reach)continue;
        depthHere=depth;sx=samples[i];sy=samples[i+1];sz=samples[i+2];
      }
      if(depthHere<bestDepth){best=rope;bestDepth=depthHere;bx=sx;by=sy;bz=sz;}
      if(rope===current){keepDepth=depthHere;kx=sx;ky=sy;kz=sz;}
    }
    if(best>=0&&keepDepth<=bestDepth*1.15+.3){best=current;bestDepth=keepDepth;bx=kx;by=ky;bz=kz;}
    hitX=bx;hitY=by;hitZ=bz;hitDepth=bestDepth;
    return best;
  }

  return {
    /** The rope under the mouse, or -1. */
    get rope(){return current;},
    /** Moves everything on by one frame. Returns true while more frames are needed. */
    update(delta:number,pointer:RopePointer,camera:PerspectiveCamera,across:number,up:number,width:number,calm:boolean,material:ShaderMaterial,speed:number,hold:boolean){
      cameraZ=camera.position.z;
      let busy=false;
      // A new spread starts where the mouse is. One still fading carries on from where it was.
      const begin=()=>{
        const spread=spreads[current];
        if(spread.amount===0){spread.x=hitX;spread.y=hitY;spread.z=hitZ;spread.radius=0;spread.limit=SPREAD.reachScreen*across*2*Math.min(hitDepth,SPREAD.reachDepth);spread.pace=Math.min(SPREAD.paceFastest,SPREAD.paceBase+hitDepth*SPREAD.pacePerDepth);}
      };
      if(pointer.on&&(pointer.moved||cameraZ!==lastZ)){
        current=pick(pointer,across,up,width,camera);
        if(current>=0){begin();kept=current;}
      }else if(!pointer.on){
        current=-1;
        // Adjusting the white from the control panel: the last rope stays white. If there has been none yet, one is chosen.
        if(hold){
          if(kept<0){
            for(const [x,y] of HOLD_SPOTS){
              const found=pick({x,y,on:true,moved:false},across,up,width,camera);
              if(found>=0){current=found;begin();kept=found;break;}
            }
          }else current=kept;
        }
      }
      pointer.moved=false;
      lastZ=cameraZ;
      let anyOn=false;
      for(let rope=0;rope<ropeCount;rope++){
        const spread=spreads[rope];
        spread.wanted=rope===current;
        if(spread.wanted){
          if(spread.amount<1){spread.amount=Math.min(1,spread.amount+delta/SPREAD.fadeIn);busy=true;}
          // Asking for less motion: the same length turns white gently, with no creeping.
          if(calm)spread.radius=spread.limit;
          else if(spread.radius<spread.limit){spread.pace=Math.min(SPREAD.paceFastest,spread.pace*(1+SPREAD.speedUp*delta));spread.radius=Math.min(spread.limit,spread.radius+spread.pace*speed*delta*easedPace(spread.limit-spread.radius,spread.limit));busy=busy||speed>0;}
        }else if(spread.amount>0){
          // Asking for less motion: a gentle fade. Otherwise the white draws back to where it started, the spread played in reverse.
          if(calm)spread.amount=Math.max(0,spread.amount-delta/SPREAD.fadeOut);
          else{
            spread.radius-=spread.pace*Math.max(speed,SPREAD.backLeast)*delta*easedPace(spread.limit-spread.radius,spread.limit);
            if(spread.radius<=FULLY_BACK)spread.amount=0;
          }
          busy=true;
        }
        if(spread.amount>0)anyOn=true;
      }
      // The frame after the last white has gone, the shader is told once that there is none.
      if(active&&!anyOn){material.uniforms.uSpreadAmount.value=0;material.uniformsNeedUpdate=true;}
      active=anyOn;
      lastRope=-2;
      lastOn=true;
      return busy;
    },
    /** Called just before each stretch of thread is drawn: gives the shader that rope's spread. Does nothing while no rope is white. */
    apply(material:ShaderMaterial,rope:number){
      if(!active||rope===lastRope)return;
      lastRope=rope;
      const spread=rope>=0?spreads[rope]:null,on=!!spread&&spread.amount>0;
      if(!on&&!lastOn)return;
      lastOn=on;
      material.uniforms.uSpreadAmount.value=on?spread.amount:0;
      if(on)material.uniforms.uSpread.value.set(spread.x,spread.y,spread.z-cameraZ,spread.radius);
      material.uniformsNeedUpdate=true;
    },
  };
}
