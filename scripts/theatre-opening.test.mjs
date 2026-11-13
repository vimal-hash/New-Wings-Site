import test from 'node:test';
import assert from 'node:assert/strict';
import {createTheatreOpeningClock,theatreOpeningShot,THEATRE_OPENING,OPENING_CAMERA_START,OPENING_CAMERA_END,houseLightLevel} from '../components/corridor/theatre-opening-state.ts';

test('screen holds one second; silver-white draws immediately and holds before materials',()=>{
  assert.equal(theatreOpeningShot(.999).trace,0);
  assert.equal(theatreOpeningShot(2.8).trace,1);
  for(const time of [1.01,1.8,2.8])assert.equal(theatreOpeningShot(time).white,1);
  for(const time of [3.4,3.7,4.149]){
    const shot=theatreOpeningShot(time);assert.equal(shot.trace,1);assert.equal(shot.white,1);assert.equal(shot.lineOpacity,1);assert.equal(shot.room,0);assert.equal(shot.position,0);
  }
  assert.equal(theatreOpeningShot(5.75).room,1);
  assert.equal(theatreOpeningShot(6.05).position,0);
  assert.equal(theatreOpeningShot(8.55).position,1);
});

test('house cue is monotonic, smooth at both ends and finishes exactly',()=>{
  let previous=0;
  for(let i=0;i<=320;i++){const v=houseLightLevel(i/100);assert.ok(v>=previous&&v<=1);previous=v;}
  assert.equal(previous,1);assert.equal(houseLightLevel(20),1);
  assert.ok(houseLightLevel(.001)<1e-8);assert.ok(1-houseLightLevel(3.199)<1e-8);
  assert.equal(houseLightLevel(0,true),1);
});
test('slow geometry/material preparation cannot reveal missing assets or jump the camera',()=>{
  const clock=createTheatreOpeningClock();clock.tick(100,false,false);
  assert.equal(clock.tick(1,false,false).elapsed,1);
  assert.equal(clock.tick(1,true,false).elapsed,1);
  const white=clock.tick(100,true,false);assert.equal(white.stage,'materials');assert.equal(white.room,0);assert.equal(white.white,1);
  const ready=clock.tick(3,true,true);assert.equal(ready.elapsed,THEATRE_OPENING.materialStart);assert.equal(ready.room,0);
  assert.ok(clock.tick(.1,true,true).room>0);
});
test('reduced motion still waits for resources; no cold-load jump into an empty theatre',()=>{
  const clock=createTheatreOpeningClock();assert.equal(clock.tick(1,true,false,true).done,false);
  assert.equal(clock.tick(1,true,true,true).done,true);
});
test('only camera distance and height change, with a continuous flat-ended move',()=>{
  assert.equal(OPENING_CAMERA_START[0],OPENING_CAMERA_END[0]);assert.ok(OPENING_CAMERA_START[2]>OPENING_CAMERA_END[2]);
  assert.ok(theatreOpeningShot(6.0501).position<1e-8);
  assert.ok(1-theatreOpeningShot(8.5499).position<1e-8);
});
