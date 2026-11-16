import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BIG_SECTION,createArcProjector,createScreenPanels,screenStart,screenTrigger,screenTransition,SCREEN_COUNT,SCREEN_WALL,SMALL_PANEL} from '../components/corridor/corridor-screen-state.ts';
const route=JSON.parse(fs.readFileSync(new URL('../components/corridor/scene-route.json',import.meta.url)));
const line=createArcProjector(route.samples.map(s=>[s.position[0],s.position[2]]));

test('centreline projection recovers arc length of its own points',()=>{
  for(const arc of [0,20,80,150,line.length-1]){
    const [x,z]=line.point(arc),[found,distance]=line.project(x,z);
    assert.ok(Math.abs(found-arc)<1e-6,`arc ${arc} -> ${found}`);assert.ok(distance<1e-6);
  }
});

test('small panels beside the projector floor, then the big screen in wide sections',()=>{
  assert.equal(SCREEN_COUNT,SCREEN_WALL.smallPanels+SCREEN_WALL.bigSections);
  assert.ok(Math.abs(SMALL_PANEL*SCREEN_WALL.smallPanels-SCREEN_WALL.split)<1e-9,'small panels end exactly where the projector floor ends');
  assert.equal(screenStart(SCREEN_WALL.smallPanels),SCREEN_WALL.split);
  assert.ok(BIG_SECTION>5*SMALL_PANEL,'big sections are much wider than the small panels');
  assert.ok(Math.abs(screenStart(SCREEN_COUNT)-(SCREEN_WALL.split+SCREEN_WALL.bigLength))<1e-9,'sections cover the big screen to the wall end');
  for(let k=1;k<SCREEN_COUNT;k++)assert.ok(screenTrigger(k)>screenTrigger(k-1),'screens power on in order along the corridor');
  assert.ok(SCREEN_WALL.litTop>SCREEN_WALL.top&&SCREEN_WALL.litTop>=28&&SCREEN_WALL.litTop<28.33,'big screen lights to just below the wall cap (y 28.33)');
});

test('screens switch on only behind the camera, in corridor phases, and reach full power',()=>{
  const panels=createScreenPanels(),n=SCREEN_COUNT;
  panels.advance('idle',40,true,.05,false);
  assert.ok(panels.values.every(v=>v===0),'theatre phases keep the walls off');
  const cameraArc=SMALL_PANEL*(3+SCREEN_WALL.triggerInset)+.01;
  for(let i=0;i<60;i++)panels.advance('corridor',cameraArc,true,.05,false);
  for(const side of [0,n])for(let i=0;i<n;i++)assert.equal(panels.values[side+i],i<=3?1:0,`panel ${i}`);
  const small=SCREEN_WALL.smallPanels,second=screenTrigger(small+1)+.01;
  for(let i=0;i<60;i++)panels.advance('corridor',second,true,.05,false);
  for(const side of [0,n])for(let i=small;i<n;i++)assert.equal(panels.values[side+i],i<=small+1?1:0,`big section ${i-small}: part by part as the camera passes`);
  for(let i=0;i<60;i++)panels.advance('corridor',screenTrigger(n-1)+.01,true,.05,false);
  for(const side of [0,n])assert.equal(panels.values[side+n-1],1,'last big section opens at the corridor end');
  const outside=createScreenPanels();outside.advance('corridor',90,false,.05,false);
  assert.ok(outside.values.every(v=>v===0),'camera outside the corridor triggers nothing');
});

test('opening is a finite, monotonic animation and reduced motion is instant',()=>{
  const panels=createScreenPanels(4);let last=0,frames=0;
  while(panels.advance('corridor',100,true,.016,false)&&frames<500){assert.ok(panels.values[0]>=last);last=panels.values[0];frames++;}
  assert.ok(frames<100,'settles to demand rendering');
  const quiet=createScreenPanels(4);
  assert.equal(quiet.advance('screens',100,true,.016,true),false);
  assert.ok(quiet.values.every(v=>v===1));
});

test('the panels stay open back up to View 1 and close early in the turn; no baked wall texture returns',()=>{
  assert.deepEqual(screenTransition('corridor','slide',0),{off:0});
  for(const progress of [0,.2,.6,.985,1])assert.deepEqual(screenTransition('logoReveal','slide',progress),{off:0});
  assert.deepEqual(screenTransition('logoReveal','top',1),{off:0});
  for(const progress of [0,.5,1])assert.deepEqual(screenTransition('logoReveal','turn',progress),{off:0},'open through the turn');
  assert.deepEqual(screenTransition('logoReveal','turned',1),{off:0},'open at View 2');
  assert.equal(screenTransition('logoReveal','pullback',0).off,0);
  const early=screenTransition('logoReveal','pullback',.09);assert.ok(early.off>0&&early.off<1,'panels close early in the pullback');
  assert.deepEqual(screenTransition('logoReveal','pullback',.18),{off:1});
  assert.deepEqual(screenTransition('logoReveal','done',1),{off:1});
  assert.deepEqual(screenTransition('logoDone','done',1),{off:1});
});
