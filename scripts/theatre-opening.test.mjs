import test from 'node:test';
import assert from 'node:assert/strict';
import {createTheatreOpeningClock,theatreOpeningShot,THEATRE_OPENING,OPENING_CAMERA_START,OPENING_CAMERA_END} from '../components/corridor/theatre-opening-state.ts';

test('screen holds one second; blue completes before white; white remains before any room appears',()=>{
  assert.equal(theatreOpeningShot(.999).trace,0);
  assert.equal(theatreOpeningShot(2.8).trace,1);
  assert.equal(theatreOpeningShot(2.8).white,0);
  for(const time of [3.4,3.7,4.149]){
    const shot=theatreOpeningShot(time);assert.equal(shot.trace,1);assert.equal(shot.white,1);assert.equal(shot.lineOpacity,1);assert.equal(shot.room,0);assert.equal(shot.position,0);
  }
  assert.equal(theatreOpeningShot(5.75).room,1);
  assert.equal(theatreOpeningShot(6.05).position,0);
  assert.equal(theatreOpeningShot(8.55).position,1);
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
