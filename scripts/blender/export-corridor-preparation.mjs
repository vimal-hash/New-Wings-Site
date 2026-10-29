import fs from 'node:fs';import crypto from 'node:crypto';import {pathToFileURL} from 'node:url';
const base='D:/New folio/new site code/new_si_two/node_modules/.pnpm/';const load=p=>import(pathToFileURL(base+p).href);
const {NodeIO}=await load('@gltf-transform+core@4.5.0/node_modules/@gltf-transform/core/dist/index.js');const {ALL_EXTENSIONS}=await load('@gltf-transform+extensions@4.5.0/node_modules/@gltf-transform/extensions/dist/index.js');const {default:draco}=await load('draco3dgltf@1.5.7/node_modules/draco3dgltf/draco3dgltf.js');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco.createDecoderModule()});const doc=await io.read('public/models/corridor-ribbons-balanced.glb');
const objects=[];for(const node of doc.getRoot().listNodes()){if(!node.getMesh())continue;const M=node.getWorldMatrix();for(const p of node.getMesh().listPrimitives()){
const P=p.getAttribute('POSITION'),N=p.getAttribute('NORMAL');const positions=[],normals=[];
for(let i=0;i<P.getCount();i++){const q=P.getElement(i,[]),n=N.getElement(i,[]);const v=[0,1,2].map(r=>M[r]*q[0]+M[4+r]*q[1]+M[8+r]*q[2]+M[12+r]);const w=[0,1,2].map(r=>M[r]*n[0]+M[4+r]*n[1]+M[8+r]*n[2]);positions.push([v[0],-v[2],v[1]]);normals.push([w[0],-w[2],w[1]]);}
objects.push({name:node.getName(),material:p.getMaterial()?.getName(),positions,normals,indices:Array.from(p.getIndices().getArray())});}}
fs.writeFileSync('D:/CodexOutputs/Corridor_Bake_Preparation_20261024/runtime-meshes.json',JSON.stringify(objects));
const files=['public','components','app'].flatMap(d=>fs.readdirSync(d,{recursive:true}).map(f=>d+'/'+f.replaceAll('\\','/')).filter(f=>fs.statSync(f).isFile()));
const sources=['D:/CodexOutputs/Approved_Theatre_Corridor_20261020/Logo_balanced_ribbon_gaps.blend','D:/CodexOutputs/Corridor_Optimization_20261018/Blue_Centre_Placement/Final_Geometry_Audit/Corridor_Logo_final_optimized_4K.blend'];
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');fs.writeFileSync('docs/corridor-preparation/baseline.json',JSON.stringify(Object.fromEntries([...files,...sources].map(p=>[p,sha(p)])),null,2));console.log({objects:objects.length,triangles:objects.reduce((n,o)=>n+o.indices.length/3,0),protectedFiles:files.length});
