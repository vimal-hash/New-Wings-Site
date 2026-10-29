import fs from 'node:fs';import {Matrix4,Vector3} from 'three';
const p=JSON.parse(fs.readFileSync('components/corridor/placement.json'));const r=JSON.parse(fs.readFileSync('components/corridor/route.json'));const M=new Matrix4().fromArray(p.matrix);const samples=[];
for(let i=0;i<40;i++)samples.push({position:new Vector3(0,4.3,-(25+(41.0205459595-25)*i/40)).applyMatrix4(M).toArray()});
const floorEnd=new Vector3(0,4.3,-41.0205459595).applyMatrix4(M),end=new Vector3(...r.samples[50].position);
for(let i=0;i<20;i++)samples.push({position:floorEnd.clone().lerp(end,i/20).toArray()});
samples.push(...r.samples.slice(50).map(({position})=>({position})));
fs.writeFileSync('components/corridor/scene-route.json',JSON.stringify({up:r.up,samples}));
const e=M.elements,s=[new Vector3(e[0],e[1],e[2]).length(),new Vector3(e[4],e[5],e[6]).length(),new Vector3(e[8],e[9],e[10]).length()];if(Math.max(...s)-Math.min(...s)>1e-8)throw Error('Nonuniform scaling');console.log('Uniform scale verified:',s);
