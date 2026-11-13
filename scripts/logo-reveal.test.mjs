import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PerspectiveCamera,Quaternion,Vector3} from 'three';
import {createLogoReveal,LOGO_FOV,LOGO_SLIDE_SPLIT} from '../components/corridor/logo-reveal.ts';
import {createJourneySampler} from '../components/corridor/journey.ts';
const json=name=>JSON.parse(fs.readFileSync(new URL('../components/corridor/'+name,import.meta.url)));
const b=json('logo-reveal.json').blenderBounds,layout=json('blender-layout.json'),route=json('scene-route.json'),reference=json('reference-camera.json');
const index=route.samples.findIndex(s=>s.position[2]<=-55+reference.stop[2]+14.2);
const p=new Vector3(),q=new Quaternion();createJourneySampler(route.samples.slice(index),route.up).sample(1,p,q);p.y=json('projector-assets.json').centre_blender[2]+.1;
const make=aspect=>createLogoReveal(b,layout.slides[1],p.y,aspect,p,q);

test('exit begins at the corridor stop and follows the authored slide with head clearance',()=>{
 const path=make(2),pos=new Vector3(),rot=new Quaternion();path.sample(0,pos,rot);assert.ok(pos.distanceTo(p)<1e-8);assert.ok(rot.angleTo(q)<1e-7);
 const slide=layout.slides[1],base=new Vector3(slide.base[0],0,-slide.base[1]);
 for(let i=0;i<=460;i++){path.sample(i/1000,pos,rot);assert.ok(Math.abs(pos.distanceTo(base.clone().setY(slide.height))-(slide.height-p.y))<.0001);assert.ok(Number.isFinite(rot.w));}
});
test('slide and exterior meet without a position or velocity jump',()=>{
 const path=make(2),a=new Vector3(),b=new Vector3(),c=new Vector3(),rot=new Quaternion(),epsilon=1e-6;
 path.sample(LOGO_SLIDE_SPLIT-epsilon,a,rot);path.sample(LOGO_SLIDE_SPLIT,b,rot);path.sample(LOGO_SLIDE_SPLIT+epsilon,c,rot);
 const before=b.clone().sub(a).divideScalar(epsilon),after=c.clone().sub(b).divideScalar(epsilon);
 assert.ok(before.distanceTo(after)<.05);assert.ok(before.dot(after)>0);
});
test('pitch speed stays continuous at the slide lip',()=>{
 const path=make(2),pos=new Vector3(),a=new Quaternion(),b=new Quaternion(),c=new Quaternion(),e=1e-5;
 path.sample(LOGO_SLIDE_SPLIT-e,pos,a);path.sample(LOGO_SLIDE_SPLIT,pos,b);path.sample(LOGO_SLIDE_SPLIT+e,pos,c);
 const before=b.clone().multiply(a.clone().invert()),after=c.clone().multiply(b.clone().invert());
 if(before.w<0)before.set(-before.x,-before.y,-before.z,-before.w);
 if(after.w<0)after.set(-after.x,-after.y,-after.z,-after.w);
 assert.ok(new Vector3(before.x,before.y,before.z).sub(new Vector3(after.x,after.y,after.z)).multiplyScalar(2/e).length()<.02);
});
test('slide aim lifts above the incoming view instead of looking down at the floor',()=>{
 const path=make(2),rot=new Quaternion();path.sample(LOGO_SLIDE_SPLIT,new Vector3(),rot);
 const initial=new Vector3(0,0,-1).applyQuaternion(q),lifted=new Vector3(0,0,-1).applyQuaternion(rot);
 assert.ok(lifted.y>initial.y+.05);
});
test('higher View 1 joins View 2 continuously and preserves the next camera mark',()=>{
 const path=make(2),a=new Vector3(),b=new Vector3(),qa=new Quaternion(),qb=new Quaternion();
 path.sampleSlide(1,a,qa);path.sampleTurn(0,b,qb);
 assert.ok(a.distanceTo(b)<1e-8);assert.ok(qa.angleTo(qb)<1e-7);
 const forward=new Vector3(0,0,-1).applyQuaternion(qa),initial=new Vector3(0,0,-1).applyQuaternion(q);
 assert.ok(forward.y>initial.y+.3);
 path.sampleTurn(1,a,qa);path.sample(LOGO_SLIDE_SPLIT+(1-LOGO_SLIDE_SPLIT)*.12,b,qb);
 assert.ok(a.distanceTo(b)<1e-8);assert.ok(qa.angleTo(qb)<1e-7);
});
test('dense sampling has no orientation cuts',()=>{
 const path=make(2),pos=new Vector3(),rot=new Quaternion(),previous=new Quaternion();
 path.sample(0,pos,previous);
 for(let i=1;i<=4000;i++){
  path.sample(i/4000,pos,rot);assert.ok(previous.angleTo(rot)<.01);previous.copy(rot);

 }
});
test('the exterior turn keeps the logo centre in view rather than empty sky',()=>{
 const path=make(2),pos=new Vector3(),rot=new Quaternion();
 for(let i=0;i<=1000;i++){
  path.sample(LOGO_SLIDE_SPLIT+(1-LOGO_SLIDE_SPLIT)*i/1000,pos,rot);
  const aim=path.centre.clone().sub(pos).normalize(),forward=new Vector3(0,0,-1).applyQuaternion(rot);
  assert.ok(aim.dot(forward)>.94);
 }
});
test('final logo is upright, centred and fully framed on portrait and wide screens',()=>{
 for(const aspect of [.462,1,2.05,3]){
  const path=make(aspect),camera=new PerspectiveCamera(LOGO_FOV,aspect,.05,path.far);path.sample(1,camera.position,camera.quaternion);camera.updateMatrixWorld(true);
  const facing=path.finalPosition.clone().sub(path.centre).normalize();
  const tilt=Math.acos(facing.dot(new Vector3(0,1,0)));assert.ok(tilt<1e-7);
  const screenUp=new Vector3(0,1,0).applyQuaternion(camera.quaternion),expectedUp=new Vector3(-Math.sin(Math.PI/18),0,-Math.cos(Math.PI/18));expectedUp.addScaledVector(facing,-expectedUp.dot(facing)).normalize();assert.ok(screenUp.distanceTo(expectedUp)<1e-6);
  const centre=path.centre.clone().project(camera);assert.ok(Math.abs(centre.x)<1e-8&&Math.abs(centre.y)<1e-8);
  for(const x of b[0])for(const y of b[1])for(const z of b[2]){const v=new Vector3(x,z,-y).project(camera);assert.ok(Math.abs(v.x)<.9&&Math.abs(v.y)<.9&&v.z<1);}
 }
});
const paths=[2.05,.462].map(aspect=>{const path=make(aspect),pos=new Vector3(),rot=new Quaternion();return {aspect,positions:Array.from({length:2001},(_,i)=>{path.sample(i/2000,pos,rot);return pos.toArray();})};});
fs.writeFileSync('D:/CodexOutputs/Approved_Theatre_Corridor_20261020/logo-reveal-paths.json',JSON.stringify(paths));




