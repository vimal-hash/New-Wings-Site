import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const bytes=readFileSync(new URL('../public/models/cinema-glasses-slim.glb',import.meta.url));
const end=20+bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,end)),binary=end+8;
function readAccessor(index){
 const a=json.accessors[index],v=json.bufferViews[a.bufferView],components=a.type==='VEC3'?3:1;
 const componentBytes=a.componentType===5123?2:4;
 return Array.from({length:a.count},(_,i)=>Array.from({length:components},(_,axis)=>{
  const offset=binary+(v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||componentBytes*components)+axis*componentBytes;
  return a.componentType===5126?bytes.readFloatLE(offset):a.componentType===5123?bytes.readUInt16LE(offset):bytes.readUInt32LE(offset);
 }));
}
test('front-only export has separate left/right rims, two lenses, no arms or cameras',()=>{
 assert.deepEqual(json.nodes.map(n=>n.name).sort(),['CinemaGlasses_Slim_Root','Frame_Left','Frame_Right','Lens_Left','Lens_Right'].sort());
 assert.equal(json.meshes.length,4);assert.equal(json.cameras,undefined);
 for(const n of json.nodes)assert.equal(n.scale,undefined);
});
for(const side of ['Left','Right'])test(`exported ${side} rim is one watertight solid`,()=>{
 const n=json.nodes.find(n=>n.name===`Frame_${side}`),p=json.meshes[n.mesh].primitives[0];
 const vertices=readAccessor(p.attributes.POSITION),indices=readAccessor(p.indices).flat();
 // glTF splits normal seams. Weld identical positions before auditing topology.
 const ids=new Map(),welded=vertices.map(v=>{const k=v.map(x=>x.toFixed(7)).join(',');if(!ids.has(k))ids.set(k,ids.size);return ids.get(k);});
 const edges=new Map(),adj=new Map();
 for(let i=0;i<indices.length;i+=3)for(let j=0;j<3;j++){
  const a=welded[indices[i+j]],b=welded[indices[i+(j+1)%3]];if(a===b)continue;
  const key=a<b?`${a},${b}`:`${b},${a}`;edges.set(key,(edges.get(key)||0)+1);
  if(!adj.has(a))adj.set(a,new Set());if(!adj.has(b))adj.set(b,new Set());adj.get(a).add(b);adj.get(b).add(a);
 }
 assert.equal([...edges.values()].filter(n=>n!==2).length,0,'no uncapped gaps or internal overlap faces');
 const seen=new Set(),queue=[0];while(queue.length){const v=queue.pop();if(seen.has(v))continue;seen.add(v);queue.push(...(adj.get(v)||[]));}
 assert.equal(seen.size,ids.size,'each rim must be one connected solid');
});
test('inner rims touch on the midplane without interpenetration or a welded mesh',()=>{
 const points=side=>{const node=json.nodes.find(n=>n.name===`Frame_${side}`);return readAccessor(json.meshes[node.mesh].primitives[0].attributes.POSITION);};
 const left=points('Left'),right=points('Right');
 assert.ok(left.every(p=>p[0]<=1e-7));assert.ok(right.every(p=>p[0]>=-1e-7));
 const contact=points=>new Set(points.filter(p=>Math.abs(p[0])<1e-8).map(p=>p.slice(1).map(x=>x.toFixed(7)).join(',')));
 assert.ok(contact(left).size>=45);assert.deepEqual(contact(left),contact(right));
 const heights=right.filter(p=>Math.abs(p[0])<1e-8).map(p=>p[1]);
 assert.ok(Math.min(...heights)>-.0181&&Math.min(...heights)<-.0179,'bottom curve starts at the raised authored height');
});
