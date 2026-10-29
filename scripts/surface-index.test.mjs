import test from 'node:test';import assert from 'node:assert/strict';
import { BufferGeometry,Float32BufferAttribute } from 'three';
import load from './load-runtime-ts.cjs';
const {extractSurface}=load('components/corridor/baked-surface-geometry.ts');
test('shared partition preserves original triangle order and rejects wrong counts',()=>{
 const g=new BufferGeometry(),p=[],n=[],c=[];for(let i=0;i<4;i++)for(let k=0;k<3;k++){p.push(i,k,0);n.push(0,0,1);c.push(i%2,.2,.3);}
 g.setIndex(Array.from({length:12},(_,i)=>i));g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('normal',new Float32BufferAttribute(n,3));g.setAttribute('color',new Float32BufferAttribute(c,3));
 const ids=[{name:'A',decodedColor:[1,.2,.3],expectedTriangles:2},{name:'B',decodedColor:[0,.2,.3],expectedTriangles:2}];
 assert.deepEqual(Array.from(extractSurface(g,ids).getAttribute('position').array),p);
 assert.throws(()=>extractSurface(g,[{...ids[0],expectedTriangles:3}]),/missing or duplicated/);
});
