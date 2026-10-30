import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

function glb(path){
 const bytes=readFileSync(new URL(path,import.meta.url));
 const end=20+bytes.readUInt32LE(12);
 return {bytes,json:JSON.parse(bytes.subarray(20,end)),binary:end+8};
}
function positions(asset,name){
 const node=asset.json.nodes.find(n=>n.name===name);
 const primitive=asset.json.meshes[node.mesh].primitives[0];
 const accessor=asset.json.accessors[primitive.attributes.POSITION];
 const view=asset.json.bufferViews[accessor.bufferView];
 return Array.from({length:accessor.count},(_,i)=>Array.from({length:3},(_,axis)=>
  asset.bytes.readFloatLE(asset.binary+(view.byteOffset||0)+(accessor.byteOffset||0)+i*(view.byteStride||12)+axis*4).toFixed(7)
 ).join(',')).sort();
}
const source=glb('../public/models/cinema-glasses-front.glb');
const result=glb('../public/models/cinema-glasses-rigid.glb');
for(const side of ['Left','Right'])test(`${side} nose contour extends inward while outer lens remains original`,()=>{
 const outer=points=>points.filter(p=>Math.abs(Number(p.split(',')[0]))>=.040);
 const current=positions(result,`Lens_${side}_Rigid`),original=positions(source,`Lens_${side}_Smoke`);
 assert.deepEqual(outer(current),outer(original));
 assert.notDeepEqual(current,original);
 const group=result.json.nodes.find(n=>n.name===`Glasses_${side}`);
 assert.equal(group.scale,undefined);
 assert.ok(Math.abs(Math.abs(group.translation[0])-.012)<1e-7);
});
test('export contains only the front-only glasses, including the reduced bridge',()=>{
 assert.equal(result.json.nodes.length,8);
 assert.equal(result.json.meshes.length,5);
 assert.ok(result.json.nodes.some(n=>n.name==='Bridge_Reduced'));
});
