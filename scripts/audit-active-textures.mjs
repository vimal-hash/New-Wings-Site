// Read-only audit of the runtime mappings, including decoded Draco attributes and UV sidecars.
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { BufferGeometry,Float32BufferAttribute,Matrix4,Mesh,MeshBasicMaterial,Vector3 } from 'three';
import loadRuntime from './load-runtime-ts.cjs';
const {extractSurface,concatenateMeshes,applySurfaceUV}=loadRuntime('components/corridor/baked-surface-geometry.ts');
import { io } from 'file:///D:/CodexOutputs/Scene_Fixes_20261025/inspect-assets.mjs';
const manifest=JSON.parse(fs.readFileSync('components/corridor/baked-surfaces.json'));
const config=JSON.parse(fs.readFileSync('scripts/surface-bake/items.json'));
const output=process.argv[2]??'D:/CodexOutputs/Scene_Performance_20261025/texture-audit.json';
function geometry(primitive){
  const g=new BufferGeometry();
  for(const [from,to]of [['POSITION','position'],['NORMAL','normal'],['COLOR_0','color'],['TEXCOORD_0','uv'],['TEXCOORD_1','uv1']]){
    const a=primitive.getAttribute(from);if(!a)continue;const data=new Float32Array(a.getCount()*a.getElementSize()),element=[];
    for(let i=0;i<a.getCount();i++){a.getElement(i,element);data.set(element,i*a.getElementSize());}g.setAttribute(to,new Float32BufferAttribute(data,a.getElementSize()));
  }
  if(primitive.getIndices())g.setIndex(Array.from(primitive.getIndices().getArray()));return g;
}
const sources={};
for(const source of Object.keys(manifest.sources)){
  const doc=await io.read(config.sources[source].glb),meshes=[];
  for(const node of doc.getRoot().listNodes())if(node.getMesh())for(const p of node.getMesh().listPrimitives()){
    const material=new MeshBasicMaterial();material.name=p.getMaterial()?.getName()??'';const mesh=new Mesh(geometry(p),material);mesh.matrixAutoUpdate=false;mesh.matrix.fromArray(node.getWorldMatrix());mesh.updateMatrixWorld(true);meshes.push(mesh);
  }sources[source]=meshes;
}
function measure(g,width,height){
  const p=g.getAttribute('position'),q=g.getAttribute('uv'),idx=g.getIndex(),count=idx?.count??p.count;
  let invalid=0,outside=0,collapsed=0,collapsedArea=0,area=0,minimum=Infinity,maximum=-Infinity;const rows=[];
  for(let i=0;i<q.count;i++)for(const c of [q.getX(i),q.getY(i)]){if(!Number.isFinite(c))invalid++;if(c<-.00001||c>1.00001)outside++;minimum=Math.min(minimum,c);maximum=Math.max(maximum,c);}
  for(let i=0;i<count;i+=3){
    const ids=[0,1,2].map(k=>idx?idx.getX(i+k):i+k),v=ids.map(j=>new Vector3().fromBufferAttribute(p,j));
    const e=v[1].clone().sub(v[0]),f=v[2].clone().sub(v[0]),length=e.length(),x=f.dot(e)/length,y=Math.sqrt(Math.max(0,f.lengthSq()-x*x));if(y<1e-9)continue;
    const uv=ids.map(j=>[q.getX(j)*width,q.getY(j)*height]),a=(uv[1][0]-uv[0][0])/length,c=(uv[1][1]-uv[0][1])/length,b=(uv[2][0]-uv[0][0]-a*x)/y,d=(uv[2][1]-uv[0][1]-c*x)/y;
    const det=a*d-b*c,triangleArea=length*y/2;area+=triangleArea;
    if(Math.abs(det)<1e-10){collapsed++;collapsedArea+=triangleArea;continue;}
    const tr=a*a+b*b+c*c+d*d,disc=Math.sqrt(Math.max(0,tr*tr-4*det*det)),largest=Math.sqrt((tr+disc)/2),smallest=Math.abs(det)/largest;
    rows.push({ratio:largest/smallest,area:triangleArea});
  }
  rows.sort((a,b)=>a.ratio-b.ratio);const weighted=t=>{let sum=0;for(const row of rows){sum+=row.area;if(sum>=area*t)return row.ratio;}return rows.at(-1)?.ratio??0;};
  return {triangles:count/3,invalidUVValues:invalid,outsideAtlasValues:outside,collapsedTriangles:collapsed,collapsedSurfacePercent:100*collapsedArea/Math.max(area,1e-20),uvRange:[minimum,maximum],chartStretchMedian:weighted(.5),chartStretchP95:weighted(.95),chartStretchMax:rows.at(-1)?.ratio??0};
}
const rows=[];
// Execute the runtime mapper unchanged; CommonJS transpilation only resolves its JSON import in Node.
const wallModule={exports:{}};
const wallPath=new URL('../components/corridor/left-wall-uv.ts',import.meta.url);
const compiled=ts.transpileModule(fs.readFileSync(wallPath,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
vm.runInNewContext(compiled,{exports:wallModule.exports,module:wallModule,require:createRequire(wallPath)});
const left=wallModule.exports.leftWallGeometry(sources.theatre[0].geometry);
rows.push({item:'theatre-left-wall',mapping:'Actual runtime flat charts',...measure(left,4096,2048)});left.dispose();
for(const item of manifest.items.filter(x=>x.active)){
  const meshes=sources[item.source];let g;
  if(item.source==='theatre')g=extractSurface(meshes[0].geometry,item.ids);
  else g=concatenateMeshes(item.ids.map(id=>{const mesh=meshes.find(m=>m.material.name===id.material);if(!mesh)throw Error('Missing '+id.material);return mesh;}),item.ids.map(id=>id.expectedTriangles));
  const bytes=fs.readFileSync('public'+item.uv),buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),header=new Uint32Array(buffer,0,5);
  applySurfaceUV(g,buffer,manifest.sources[item.source].runtimeToBlender);
  const chart=measure(g,header[3],header[4]);
  rows.push({item:item.item,texture:item.texture,mapping:'Bake-matched projected charts; chart metric uses original layout dimensions',...chart});g.dispose();
}
const sofa=JSON.parse(fs.readFileSync('components/corridor/sofa-assets.json'));
for(const [label,path,channel]of [['sofas',sofa.model,'uv'],['ceiling',JSON.parse(fs.readFileSync('components/corridor/theatre-ceiling-assets.json')).model,'uv1']]){
  const doc=await io.read('public'+path);for(const node of doc.getRoot().listNodes())if(node.getMesh())for(const p of node.getMesh().listPrimitives()){
    const g=geometry(p);g.applyMatrix4(new Matrix4().fromArray(node.getWorldMatrix()));if(channel==='uv1')g.setAttribute('uv',g.getAttribute('uv1'));
    rows.push({item:label+': '+node.getName(),mapping:'Exported UVs',...measure(g,1,1)});g.dispose();
  }
}
const errors=rows.filter(r=>r.invalidUVValues||r.outsideAtlasValues||r.collapsedSurfacePercent>.01);
const projector=JSON.parse(fs.readFileSync('components/corridor/projector-animation.json'));
const projectorDoc=await io.read('public'+projector.modelUrl);const brushed=[];
for(const mesh of projectorDoc.getRoot().listMeshes())for(const primitive of mesh.listPrimitives()){
 const g=geometry(primitive),surface=primitive.getAttribute('_SURFACE'),indices=primitive.getIndices(),selection=[];
 for(let i=0;i<indices.getCount();i+=3)if(Math.round(surface.getScalar(indices.getScalar(i)))===58)selection.push(indices.getScalar(i),indices.getScalar(i+1),indices.getScalar(i+2));
 g.setIndex(selection);brushed.push({item:'projector-brushed-map',...measure(g,1,1)});g.dispose();
}
const report={rows,errors,projectorImageMaps:brushed,notes:[
  'Chart anisotropy is not automatically visible stretching. Procedural material detail baked through these same charts compensates for the projection.',
  'Texture aspect/resolution changes do not change the normalized UV mapping. Different texel density along two atlas axes is reported separately from physical source grain.',
  'Projector image maps apply only to the source brushed material; zero UVs on constant-material parts are intentional. Original sofa UV correspondence was independently verified.',
  'Finite mappings cannot prove source lighting is noise-free or that all reflections match at every viewpoint.'
]};fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({surfaces:rows.length,errors:errors.map(x=>({item:x.item,collapsedSurfacePercent:x.collapsedSurfacePercent})),corridor:rows.filter(r=>r.item.includes('corridor-wall')).map(r=>({item:r.item,p95:r.chartStretchP95,max:r.chartStretchMax}))},null,2));

