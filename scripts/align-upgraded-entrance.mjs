import fs from 'node:fs';import {Matrix4,Vector3,CatmullRomCurve3} from 'three';
const dir='components/corridor/';const P='D:/CodexOutputs/Theatre_Optimization_20261017/Web_Export_20261019/';
const review=JSON.parse(fs.readFileSync(P+'clear-passage-placement-review.json'));const T=new Matrix4().fromArray(review[0].matrix);const corridor=T.clone().invert();
fs.writeFileSync(dir+'corridor-placement.json',JSON.stringify({matrix:corridor.toArray(),source:'Entire upgraded logo/corridor assembly aligned together around the theatre: uniform scale, rotation and translation only. All relative logo/corridor positions and mesh geometry are unchanged.',uniformScale:1/review[0].scale,contact:'No intersections with corridor/logo surfaces above the walking datum; buried foundation/floor contact is allowed.'},null,2));
const C=new Matrix4().set(1,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,1);const a=JSON.parse(fs.readFileSync(P+'upgraded-coordinate-map.json')).blenderMatrix;const W=corridor.clone().multiply(C).multiply(new Matrix4().fromArray(a)).multiply(C.clone().invert());
const route=JSON.parse(fs.readFileSync(dir+'route.json'));const points=[new Vector3(0,3.22,-14.2),new Vector3(0,3.22,-26),new Vector3(0,3.22,-33.020546)];
for(const s of route.samples){const p=new Vector3(...s.position).applyMatrix4(W);p.y=3.22;if(p.z < -38)points.push(p);}
const curve=new CatmullRomCurve3(points,false,'centripetal');const samples=Array.from({length:641},(_,i)=>({position:curve.getPointAt(i/640).toArray()}));
fs.writeFileSync(dir+'scene-route.json',JSON.stringify({up:[0,1,0],samples,source:'Approved theatre stop through projector platform into our upgraded corridor centreline. Level eye height; no geometry changes.'}));
fs.writeFileSync(dir+'corridor-assets.json',JSON.stringify({bytes:619448,objects:56,triangles:49360},null,2));
console.log({uniformScale:1/review[0].scale,pathStart:samples[0],pathEnd:samples.at(-1)});


