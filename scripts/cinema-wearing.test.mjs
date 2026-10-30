import test from 'node:test';
import assert from 'node:assert/strict';
import {createCinemaWearingGate} from '../components/corridor/cinema-wearing-state.ts';

test('intro input cannot remove glasses or queue camera travel',()=>{
  const gate=createCinemaWearingGate();
  assert.equal(gate.input(500,0,false),true);
  assert.equal(gate.tick(20).house,0);
  assert.equal(gate.input(200,100,true),true);
  assert.equal(gate.stage,'wearing');
  gate.input(100,500,true);assert.equal(gate.stage,'removing');
});
test('a fresh first gesture fades optics and brings up house lights without passing through',()=>{
  const gate=createCinemaWearingGate();
  assert.equal(gate.input(180,1000,true),true);
  const middle=gate.tick(.75);
  assert.ok(middle.glasses>0&&middle.glasses<1);
  assert.ok(middle.house>0&&middle.house<1);
  for(let now=1100;now<=2600;now+=100)gate.input(80,now,true);
  const end=gate.tick(.75);assert.equal(end.stage,'clear');assert.equal(end.glasses,0);assert.equal(end.house,1);
  assert.equal(gate.input(100,2700,true),true);
  assert.equal(gate.input(20,3100,true),false);
  assert.equal(gate.input(20,3116,true),false); // Once released, normal wheel accumulation survives.
});
test('reduced motion and direct review shortcuts restore the existing journey',()=>{
  const gate=createCinemaWearingGate();gate.input(100,1000,true);
  assert.equal(gate.tick(0,true).stage,'clear');
  const review=createCinemaWearingGate();review.skip();
  assert.deepEqual(review.tick(0),{stage:'clear',glasses:0,house:1});
  assert.equal(review.input(100,0,true),false);
});
