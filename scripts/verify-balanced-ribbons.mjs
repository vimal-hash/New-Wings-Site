import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const base='D:/New folio/new site code/new_si_two/node_modules/.pnpm/';
const load=p=>import(pathToFileURL(base+p).href);
const {NodeIO}=await load('@gltf-transform+core@4.5.0/node_modules/@gltf-transform/core/dist/index.js');
const {ALL_EXTENSIONS}=await load('@gltf-transform+extensions@4.5.0/node_modules/@gltf-transform/extensions/dist/index.js');
const {default:draco}=await load('draco3dgltf@1.5.7/node_modules/draco3dgltf/draco3dgltf.js');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco.createDecoderModule()});
const old=await io.read('public/models/corridor-ribbons-thin.glb'),next=await io.read('public/models/corridor-ribbons-balanced.glb');
const meshes=d=>new Map(d.getRoot().listNodes().filter(n=>n.getMesh()).map(n=>[n.getName(),n.getMesh()]));
const before=meshes(old),after=meshes(next);
assert.equal(after.size,before.size);
assert.ok(![...after.keys()].some(n=>n.startsWith('Emblem')));
for(const [name,m] of after){
 const a=before.get(name);assert.ok(a,name);
 const p=m.listPrimitives()[0],q=a.listPrimitives()[0];
 if(!name.startsWith('Swoosh • Red')){assert.equal(p.getIndices().getCount(),q.getIndices().getCount(),name);const x=p.getAttribute('POSITION').getArray(),y=q.getAttribute('POSITION').getArray();assert.equal(x.length,y.length);for(let i=0;i<x.length;i++)assert.ok(Math.abs(x[i]-y[i])<.0001,name);}
 if(!name.startsWith('Swoosh'))assert.deepEqual(p.getMaterial().getBaseColorFactor(),q.getMaterial().getBaseColorFactor(),name);
 else {assert.equal(p.getMaterial().getMetallicFactor(),.25);assert.ok(Math.abs(p.getMaterial().getRoughnessFactor()-.3)<1e-6);}
}
assert.equal(next.getRoot().listTextures().length,0);
console.log('Verified: only red placement changed; all other compressed meshes and materials preserved; no emblem or textures added.');




