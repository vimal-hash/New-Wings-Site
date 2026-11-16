import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pageAtBottom,createPageReturn,WHITE_SECONDS,HANDOVER} from '../components/corridor/page-exit.ts';

test('the first and second page sections do not trigger a return',()=>{
 assert.equal(pageAtBottom(0,2400,800),false);assert.equal(pageAtBottom(800,2400,800),false);
});
test('the fourth section has a native, measurable bottom',()=>{
 assert.equal(pageAtBottom(1600,3200,800),false);
 assert.equal(pageAtBottom(2400,3200,800),true);
 assert.equal(pageAtBottom(1600,2400,800),true);assert.equal(pageAtBottom(1688,2532,844),true);
});

test('the screen white starts exact and hands over before the camera glides to View 1',()=>{
 const exit=createPageReturn(),start=exit.read();
 assert.equal(start.scale,1);assert.equal(start.opacity,1);assert.equal(start.copy,1);assert.equal(start.white,0);assert.equal(start.travel,0);
 let previous=start,frames=0;
 while(previous.moving&&frames++<400){
   const shot=exit.tick(1/60,.82);
   assert.ok(shot.travel>=previous.travel&&shot.white>=previous.white);
   assert.equal(shot.scale,1,'never resizes on screen');
   if(shot.travel>0)assert.equal(shot.opacity,0,'gone from the screen before the camera moves');
   previous=shot;
 }
 assert.equal(previous.travel,1);assert.equal(previous.moving,false);assert.equal(previous.opacity,0);
 assert.ok(frames>200&&frames<260,'a slow glide of about four seconds');
 exit.reset();assert.deepEqual(exit.read(),start);
});
test('reduced motion goes straight to View 1 with the screen white handed over',()=>{
 const exit=createPageReturn(),shot=exit.tick(0,.82,true);
 assert.equal(shot.travel,1);assert.equal(shot.moving,false);assert.equal(shot.opacity,0);
});
test('fractional mobile scroll rounding at the bottom cannot block return',()=>{
 assert.equal(pageAtBottom(1598.8,2400,800),true);assert.equal(pageAtBottom(1595,2400,800),false);
});
test('unmeasured or nonoverflowing content cannot accidentally exit on mount',()=>{
 assert.equal(pageAtBottom(0,0,0),false);assert.equal(pageAtBottom(0,800,800),false);
});
test('Section 4 turns plain white in .3 s on screen, then hands over at .4 s',()=>{
 assert.equal(WHITE_SECONDS,.3);assert.equal(HANDOVER,.4);
 const exit=createPageReturn();let shot=exit.read(),t=0;
 for(let i=0;i<40;i++){
   shot=exit.tick(1/60,.82);t+=1/60;
   if(t>=WHITE_SECONDS+1e-9)assert.ok(Math.abs(shot.white-1)<1e-9&&shot.copy<1e-9,'plain white');
   if(Math.abs(t-HANDOVER)>1e-6)assert.equal(shot.opacity,t<HANDOVER?1:0);
 }
});
test('the panel is placed at the first return frame and stays; menu jumps remove it',()=>{
 const page=readFileSync(new URL('../components/corridor/normal-page.tsx',import.meta.url),'utf8');
 const experience=readFileSync(new URL('../components/corridor/experience.tsx',import.meta.url),'utf8');
 const journey=readFileSync(new URL('../components/corridor/full-journey.tsx',import.meta.url),'utf8');
 assert.match(page,/phase:"pageReturnLoading",panelStage:0,pageAtEnd:true,pageEndBox:true/);
 assert.match(experience,/\{journey\.pageReturning&&<PageReturnCover\/>\}/);
 assert.match(journey,/if\(leaving&&!endBox\.visible&&journeyControls\.read\(\)\.pageEndBox\)endBox\.place\(camera\);/);
 assert.ok(!/arrive\(\);invalidate\(\);[\s\S]{0,200}endBox\.place/.test(journey),'not re-placed at View 1');
 assert.match(journey,/const jump=\(event:Event\)=>\{\s*endBox\.hide\(\);/);
 assert.match(journey,/const common=\{pageReturning:false,pageEndBox:false,/);
});
test('the corridor panel fills the view exactly at the liquid sphere spot, plain white with no glow',async()=>{
 const {createEndBox,END_BOX}=await import('../components/corridor/end-box.ts');
 const {PerspectiveCamera,Vector3}=await import('three');
 assert.equal(END_BOX.distance,14,'the liquid sphere sits 14 ahead of the page camera');
 const camera=new PerspectiveCamera(40,1920/940,.1,1000);camera.position.set(3,4,5);camera.lookAt(10,4,-20);camera.updateProjectionMatrix();
 const box=createEndBox();box.place(camera);
 const [core]=box.group.children;core.geometry.computeBoundingBox();const b=core.geometry.boundingBox;
 const corner=(x,y)=>core.localToWorld(new Vector3(x,y,0)).project(camera);
 const tr=corner(b.max.x,b.max.y),bl=corner(b.min.x,b.min.y);
 for(const [v,want] of [[tr.x,1],[tr.y,1],[bl.x,-1],[bl.y,-1]])assert.ok(Math.abs(v-want)<1e-6,'fills the view');
 assert.equal(box.group.children.length,1,'one plain white face, no glow');
 assert.equal(core.material.transparent,false);assert.equal(core.material.blending,1,'normal blending');
 const where=box.group.position.clone();camera.position.set(-40,30,60);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 assert.ok(box.group.position.equals(where),'does not follow the camera');
 box.hide();assert.equal(box.visible,false);box.dispose();
});
