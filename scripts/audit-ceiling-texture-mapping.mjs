// Read-only asset audit: measure local UV distortion on the actual exported GLB.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {Matrix4,Vector3} from 'three';
const base='D:/New folio/new site code/new_si_two/node_modules/.pnpm/';
const load=p=>import(pathToFileURL(base+p).href);
const {NodeIO}=await load('@gltf-transform+core@4.5.0/node_modules/@gltf-transform/core/dist/index.js');
const {ALL_EXTENSIONS}=await load('@gltf-transform+extensions@4.5.0/node_modules/@gltf-transform/extensions/dist/index.js');
const {default:draco}=await load('draco3dgltf@1.5.7/node_modules/draco3dgltf/draco3dgltf.js');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco.createDecoderModule()});
const manifest=JSON.parse(fs.readFileSync('components/corridor/theatre-ceiling-assets.json'));
const doc=await io.read(process.argv[2]??'public'+manifest.model);
const rows=[];
const referencePath='D:/CodexOutputs/Theatre_Ceiling_PBR_20261023/cove-uv-refinement.json';
const coveCells=new Map();
if(fs.existsSync(referencePath)){
 const ref=JSON.parse(fs.readFileSync(referencePath));
 for(const t of ref.triangles){const c=t.vertices.map(i=>{const [x,y,z]=ref.vertices[i];return new Vector3(x+.010995,z+.02,26-y);}).reduce((a,b)=>a.add(b),new Vector3()).divideScalar(3);const k=c.toArray().map(v=>Math.floor(v*100)).join(',');if(!coveCells.has(k))coveCells.set(k,[]);coveCells.get(k).push(c);}
}
for(const node of doc.getRoot().listNodes().filter(n=>n.getMesh())){
  const matrix=new Matrix4().fromArray(node.getWorldMatrix());
  const samples=[];let invalid=0,degenerateUV=0,channelDifference=0,min=Infinity,max=-Infinity;
  for(const primitive of node.getMesh().listPrimitives()){
    const pos=primitive.getAttribute('POSITION'),uv=primitive.getAttribute('TEXCOORD_0'),light=primitive.getAttribute('TEXCOORD_1'),indices=primitive.getIndices();
    if(!uv||!light)throw new Error('Missing UV channel: '+node.getName());
    for(let i=0;i<uv.getCount();i++){
      const a=uv.getElement(i,[]),b=light.getElement(i,[]);
      for(let c=0;c<2;c++){if(!Number.isFinite(a[c]))invalid++;min=Math.min(min,a[c]);max=Math.max(max,a[c]);channelDifference=Math.max(channelDifference,Math.abs(a[c]-b[c]));}
    }
    for(let t=0;t<indices.getCount();t+=3){
      const ids=[0,1,2].map(k=>indices.getScalar(t+k));
      const p=ids.map(i=>new Vector3().fromArray(pos.getElement(i,[])).applyMatrix4(matrix));
      const q=ids.map(i=>uv.getElement(i,[]));
      const e=p[1].clone().sub(p[0]),f=p[2].clone().sub(p[0]);
      const length=e.length(),x=f.dot(e)/length,y=Math.sqrt(Math.max(0,f.lengthSq()-x*x));
      if(y<1e-10)continue;
      const a=(q[1][0]-q[0][0])/length,c=(q[1][1]-q[0][1])/length;
      const b=(q[2][0]-q[0][0]-a*x)/y,d=(q[2][1]-q[0][1]-c*x)/y;
      const trace=a*a+b*b+c*c+d*d,det=a*d-b*c;
      if(Math.abs(det)<1e-12){degenerateUV++;continue;}
      const disc=Math.sqrt(Math.max(0,trace*trace-4*det*det));
      const largest=Math.sqrt((trace+disc)/2),smallest=Math.abs(det)/largest;
      const centroid=p[0].clone().add(p[1]).add(p[2]).divideScalar(3),cell=centroid.toArray().map(v=>Math.floor(v*100));let isCove=false;
      for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const c of coveCells.get([cell[0]+x,cell[1]+y,cell[2]+z].join(','))??[])if(c.distanceToSquared(centroid)<1e-8)isCove=true;
      samples.push({ratio:largest/smallest,area:length*y/2,density:Math.sqrt(Math.abs(det))*2048,centroid:centroid.toArray(),isCove});
    }
  }
  const weighted=(field,quantile)=>{const sorted=[...samples].sort((a,b)=>a[field]-b[field]);const target=samples.reduce((s,v)=>s+v.area,0)*quantile;let sum=0;for(const v of sorted){sum+=v.area;if(sum>=target)return v[field];}return 0;};
  const totalArea=samples.reduce((s,v)=>s+v.area,0);
  const worst=samples.reduce((a,b)=>a.ratio>b.ratio?a:b);
  rows.push({object:node.getName(),triangles:samples.length,invalidUVValues:invalid,degenerateUVTriangles:degenerateUV,uvRange:[min,max],maxChannelDifference:channelDifference,areaWeightedStretchMedian:weighted('ratio',.5),areaWeightedStretchP95:weighted('ratio',.95),maximumStretch:worst.ratio,worstTriangleCentroid:worst.centroid,surfacePercentOver5PercentStretch:100*samples.filter(v=>v.ratio>1.05).reduce((s,v)=>s+v.area,0)/totalArea,medianTexelsPerMetre:weighted('density',.5)});
  const cove=samples.filter(v=>v.isCove);if(cove.length)rows.at(-1).cove={triangles:cove.length,maximumStretch:Math.max(...cove.map(v=>v.ratio)),trianglesOver5PercentStretch:cove.filter(v=>v.ratio>1.05).length};
}
const report={objects:rows,notes:['Stretch is the ratio of the UV Jacobian singular values: 1 is locally isotropic.','Lighting atlases may have nonuniform texel density between objects; this is separate from image stretching.','This checks the actual exported model. It does not prove that every baked lighting pixel matches Cycles.']};
fs.writeFileSync(process.argv[3]??'docs/theatre-ceiling-audit/texture-mapping-check.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
