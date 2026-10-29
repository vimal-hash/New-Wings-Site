import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {Matrix4,Vector3} from 'three';
const base='D:/New folio/new site code/new_si_two/node_modules/.pnpm/';
const load=p=>import(pathToFileURL(base+p).href);
const {NodeIO}=await load('@gltf-transform+core@4.5.0/node_modules/@gltf-transform/core/dist/index.js');
const {ALL_EXTENSIONS}=await load('@gltf-transform+extensions@4.5.0/node_modules/@gltf-transform/extensions/dist/index.js');
const {weld,prune}=await load('@gltf-transform+functions@4.5.0_@types+node@20.19.43/node_modules/@gltf-transform/functions/dist/index.js');
const {default:draco}=await load('draco3dgltf@1.5.7/node_modules/draco3dgltf/draco3dgltf.js');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco.createDecoderModule(),'draco3d.encoder':await draco.createEncoderModule()});
const doc=await io.read('D:/CodexOutputs/Theatre_Ceiling_PBR_20261023/ceiling.glb'),buffer=doc.getRoot().listBuffers()[0];
const ref=JSON.parse(fs.readFileSync('D:/CodexOutputs/Theatre_Ceiling_PBR_20261023/cove-uv-refinement.json'));
const key=points=>points.map(p=>p.map(x=>x.toFixed(3)).join(',')).sort().join('|');
const refs=ref.triangles.map(t=>({vertices:t.vertices.map((i,k)=>{const [x,y,z]=ref.vertices[i];return {p:[x+.010995,z+.02,26-y],uv:[ref.new[t.loops[k]][0],1-ref.new[t.loops[k]][1]]};})}));
const cells=new Map();for(const t of refs){const k=key(t.vertices.map(v=>v.p));if(!cells.has(k))cells.set(k,[]);cells.get(k).push(t);}
let matched=0,maxPositionError=0,untouchedTriangles=0;
for(const node of doc.getRoot().listNodes().filter(n=>n.getMesh())){
 const world=new Matrix4().fromArray(node.getWorldMatrix());
 for(const primitive of node.getMesh().listPrimitives()){
  const indices=primitive.getIndices().getArray(),pos=primitive.getAttribute('POSITION');
  const uv=new Float32Array(indices.length*2);
  for(let i=0;i<indices.length;i+=3){
   const points=[0,1,2].map(k=>new Vector3().fromArray(pos.getElement(indices[i+k],[])).applyMatrix4(world));
   const candidates=cells.get(key(points.map(p=>p.toArray())))??[];let best,score=Infinity;
   for(const t of candidates){const d=points.reduce((sum,p)=>sum+Math.min(...t.vertices.map(v=>p.distanceToSquared(new Vector3(...v.p)))),0);if(d<score){score=d;best=t;}}
   if(score>=1e-8)for(const t of refs){const d=points.reduce((sum,p)=>sum+Math.min(...t.vertices.map(v=>p.distanceToSquared(new Vector3(...v.p)))),0);if(d<score){score=d;best=t;}}
   if(best&&score<1e-8){
    matched++;
    for(let k=0;k<3;k++){
     const p=points[k],v=best.vertices.reduce((a,b)=>p.distanceToSquared(new Vector3(...a.p))<p.distanceToSquared(new Vector3(...b.p))?a:b);
     maxPositionError=Math.max(maxPositionError,p.distanceTo(new Vector3(...v.p)));uv.set(v.uv,(i+k)*2);
    }
   }else{untouchedTriangles++;for(let k=0;k<3;k++)uv.set(primitive.getAttribute('TEXCOORD_0').getElement(indices[i+k],[]),(i+k)*2);}
  }
  for(const semantic of primitive.listSemantics()){
   const old=primitive.getAttribute(semantic),size=old.getElementSize(),array=new (old.getArray().constructor)(indices.length*size);
   for(let i=0;i<indices.length;i++)for(let k=0;k<size;k++)array[i*size+k]=old.getArray()[indices[i]*size+k];
   primitive.setAttribute(semantic,doc.createAccessor().setBuffer(buffer).setType(old.getType()).setNormalized(old.getNormalized()).setArray(semantic.startsWith('TEXCOORD_')?uv.slice():array));
  }
  primitive.setIndices(doc.createAccessor().setBuffer(buffer).setType('SCALAR').setArray(Uint32Array.from(indices,(_,i)=>i)));
 }
}
if(matched!==2688)throw Error('Cove triangle match failed: '+matched);
const ext=doc.getRoot().listExtensionsUsed().find(e=>e.extensionName==='KHR_draco_mesh_compression');
ext?.setEncoderOptions({method:1,encodeSpeed:0,decodeSpeed:0,quantizationBits:{POSITION:24,NORMAL:12,TEX_COORD:20},quantizationVolume:'mesh'});
await doc.transform(weld(),prune({keepAttributes:true}));
await io.write('public/models/theatre/ceiling-uv-fixed.glb',doc);
const report={matchedCoveTriangles:matched,untouchedOtherCeilingTriangles:untouchedTriangles,maxPositionError,bytes:fs.statSync('public/models/theatre/ceiling-uv-fixed.glb').size};
fs.writeFileSync('docs/theatre-ceiling-audit/cove-uv-export.json',JSON.stringify(report,null,2));console.log(report);
