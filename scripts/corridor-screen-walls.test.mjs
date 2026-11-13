import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createArcProjector,createDisplayPower,createScreenPanels,CORRIDOR_STOP,FEATURE_DISPLAYS,screenStart,screenTransition,SCREEN_COUNT,SCREEN_WALL,SMALL_PANEL} from '../components/corridor/corridor-screen-state.ts';
const route=JSON.parse(fs.readFileSync(new URL('../components/corridor/scene-route.json',import.meta.url)));
const line=createArcProjector(route.samples.map(s=>[s.position[0],s.position[2]]));

test('centreline projection recovers arc length of its own points',()=>{
  for(const arc of [0,20,80,150,line.length-1]){
    const [x,z]=line.point(arc),[found,distance]=line.project(x,z);
    assert.ok(Math.abs(found-arc)<1e-6,`arc ${arc} -> ${found}`);assert.ok(distance<1e-6);
  }
});

test('small panels beside the projector floor, then one big screen per wall',()=>{
  assert.equal(SCREEN_COUNT,SCREEN_WALL.smallPanels+1);
  assert.ok(Math.abs(SMALL_PANEL*SCREEN_WALL.smallPanels-SCREEN_WALL.split)<1e-9,'small panels end exactly where the projector floor ends');
  assert.equal(screenStart(SCREEN_WALL.smallPanels),SCREEN_WALL.split);
  assert.ok(SCREEN_WALL.litTop>SCREEN_WALL.top,'big screen lights higher than the small panels');
});

test('screens switch on only behind the camera, in corridor phases, and reach full power',()=>{
  const panels=createScreenPanels(),n=SCREEN_COUNT;
  panels.advance('idle',40,true,.05,false);
  assert.ok(panels.values.every(v=>v===0),'theatre phases keep the walls off');
  const cameraArc=SMALL_PANEL*(3+SCREEN_WALL.triggerInset)+.01;
  for(let i=0;i<60;i++)panels.advance('corridor',cameraArc,true,.05,false);
  for(const side of [0,n])for(let i=0;i<n;i++)assert.equal(panels.values[side+i],i<=3?1:0,`panel ${i}`);
  const past=SCREEN_WALL.split+SCREEN_WALL.triggerInset*SMALL_PANEL+.01;
  for(let i=0;i<60;i++)panels.advance('corridor',past,true,.05,false);
  for(const side of [0,n])assert.equal(panels.values[side+n-1],1,'big screen opens once the camera passes the projector floor');
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

test('leaving for the logo returns the approved baked walls before View 1',()=>{
  assert.deepEqual(screenTransition('corridor','slide',0),{off:0,baked:0});
  const early=screenTransition('logoReveal','slide',.2);assert.ok(early.off>0&&early.baked===0,'panels close first');
  assert.deepEqual(screenTransition('logoReveal','slide',.6),{off:1,baked:1});
  assert.deepEqual(screenTransition('logoReveal','slide',.985),{off:1,baked:1});
  for(const stage of ['turn','turned','pullback','done'])assert.deepEqual(screenTransition('logoReveal',stage,0),{off:1,baked:1});
  assert.deepEqual(screenTransition('logoDone','done',1),{off:1,baked:1});
});

test('mid-corridor displays: the far one opens as the camera passes, the near one only at the stop',()=>{
  const [far,near]=FEATURE_DISPLAYS;
  assert.ok(far.arc<near.arc&&near.arc<CORRIDOR_STOP.arc,'both displays lie behind the stop, in the backward view');
  for(const display of FEATURE_DISPLAYS)assert.ok(display.bottom>=0&&display.top<=SCREEN_WALL.litTop&&display.width>display.top-display.bottom,'film area sits within the lit wall');
  const power=createDisplayPower();
  power.advance('screens',far.arc-display0Half(),false,.016,false);
  assert.deepEqual(power.values,[0,0],'nothing before the far display');
  for(let i=0;i<80;i++)power.advance('screens',far.arc,false,.05,false);
  assert.equal(power.values[0],1,'far display fully open while still travelling');
  assert.equal(power.values[1],0,'near display waits for the stop');
  for(let i=0;i<2;i++)power.advance('screensDone',CORRIDOR_STOP.arc,true,.05,false);
  assert.ok(power.values[1]>0&&power.values[1]<1,'near display opens at the stop');
  assert.equal(power.advance('done',0,false,.016,false),false);
  assert.deepEqual(power.values,[0,0],'outside the corridor both reset');
  power.advance('screensDone',CORRIDOR_STOP.arc,true,.016,true);
  assert.deepEqual(power.values,[1,1],'reduced motion opens without animation');
  function display0Half(){return far.width/2+.1;}
});
