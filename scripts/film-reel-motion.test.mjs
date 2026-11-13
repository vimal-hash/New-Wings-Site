import test from 'node:test';
import assert from 'node:assert/strict';
import {createReelMotion,REEL} from '../components/film-reel/reel-motion.ts';

const FRAMES=6;
const run=(motion,seconds)=>{let shot=motion.read(),landed=[];for(let t=0;t<seconds;t+=1/60){shot=motion.step(1/60);if(shot.landed>=0)landed.push(shot.landed);}return {shot,landed};};
const gesture=(motion,pixels,events=8)=>{for(let i=0;i<events;i++){motion.input(pixels/events);motion.step(1/60);}};
const ready=()=>{const motion=createReelMotion({frames:FRAMES});motion.begin();const {landed}=run(motion,REEL.lightsWait+REEL.lightsDown+1);return {motion,landed};};

test('house lights go down by themselves and frame 1 lands with a flash',()=>{
  const motion=createReelMotion({frames:FRAMES});
  assert.equal(motion.read().white,1);
  motion.begin();
  const {shot,landed}=run(motion,REEL.lightsWait+REEL.lightsDown+1);
  assert.equal(shot.white,0);assert.deepEqual(landed,[0]);assert.ok(shot.lamp>.9);assert.equal(shot.moving,false);
});

test('one long gesture moves the strip one frame, never two',()=>{
  const {motion}=ready();
  gesture(motion,REEL.perFrame*4,40);
  const {shot,landed}=run(motion,2);
  assert.equal(shot.position,1);assert.deepEqual(landed,[1]);
});

test('a small nudge settles back, a mouse-wheel notch goes on',()=>{
  const {motion}=ready();
  gesture(motion,REEL.perFrame*.05,2);assert.equal(run(motion,2).shot.position,0);
  run(motion,1);gesture(motion,100,1);assert.equal(run(motion,2).shot.position,1);
});

test('a wheel notch starts the move at once and the lamp holds steady while the strip travels',()=>{
  const {motion}=ready();
  run(motion,1);
  motion.input(100);motion.step(1/60);
  let travelled=0,lowest=2;
  for(let t=0;t<.15;t+=1/60){const shot=motion.step(1/60);travelled=shot.position;if(shot.position>.1&&shot.position<.9)lowest=Math.min(lowest,shot.lamp);}
  assert.ok(travelled>.2,'the strip is already well on its way before the scroll goes quiet');
  assert.ok(lowest>.95,'no dip in the light while it moves');
  assert.equal(run(motion,2).shot.position,1);
});

test('after the last frame one gesture burns to white, the next is handed to the page, and back runs in reverse',()=>{
  const {motion}=ready();
  for(let frame=1;frame<FRAMES;frame++){gesture(motion,REEL.perFrame);run(motion,2.5);}
  assert.equal(motion.read().position,FRAMES-1);
  gesture(motion,200);
  let exits=0;for(let t=0;t<REEL.exit+.5;t+=1/60){if(motion.step(1/60).exited)exits++;}
  let shot=motion.read();
  assert.equal(exits,1,'the page is told once, the moment the frame has burnt white');
  assert.equal(shot.burn,1);assert.equal(shot.white,1);assert.equal(shot.visible,false);
  assert.equal(motion.input(100),false);
  assert.equal(motion.input(-100),true);
  ({shot}=run(motion,REEL.exit+.5));
  assert.equal(shot.burn,0);assert.equal(shot.white,0);assert.equal(shot.visible,true);
});

test('arriving from the next section starts burnt white on the last frame',()=>{
  const motion=createReelMotion({frames:FRAMES});motion.atEnd();
  const {shot}=run(motion,1);
  assert.equal(shot.position,FRAMES-1);assert.equal(shot.white,1);assert.equal(shot.visible,false);
  assert.equal(motion.input(-120),true);
  assert.equal(run(motion,REEL.exit+.5).shot.white,0);
});
