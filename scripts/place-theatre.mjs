import fs from 'node:fs';import {Matrix4,Vector3} from 'three';
const r=JSON.parse(fs.readFileSync('components/corridor/route.json'));const up=new Vector3(...r.up).normalize();
const end=new Vector3(...r.samples[50].position),front=new Vector3(...r.samples[20].position);
const back=end.clone().sub(front);back.addScaledVector(up,-back.dot(up)).normalize();
const z=back.clone().negate(),x=up.clone().cross(z).normalize();const scale=.009;
const M=new Matrix4().makeBasis(x.multiplyScalar(scale),up.clone().multiplyScalar(scale),z.multiplyScalar(scale));
// Floor surface at index 50 is measured from Blender below, not guessed at runtime.
const floor=end.clone().addScaledVector(up,-.118);
const datum=floor.clone().addScaledVector(up,.012);
M.setPosition(datum.clone().sub(new Vector3(0,0,-41.0205459595).applyMatrix4(M)));
const p={matrix:M.toArray(),source:'Uniform fit inside corridor; no clipping or camera-dependent hiding',scale,join:{routeIndex:50,corridorFloor:floor.toArray(),nativeFloorEnd:[0,1.5995212793,-41.0205459595]}};
fs.writeFileSync('components/corridor/placement.json',JSON.stringify(p,null,2));
const start=new Vector3(0,4.3,-18).applyMatrix4(M),samples=[];
for(let i=0;i<40;i++)samples.push({position:start.clone().lerp(end,i/40).toArray()});
fs.writeFileSync('components/corridor/scene-route.json',JSON.stringify({up:r.up,samples:[...samples,...r.samples.slice(50).map(({position})=>({position}))]}));
