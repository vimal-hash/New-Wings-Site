import test from 'node:test';import assert from 'node:assert/strict';
import {openingElapsed,openingMotion} from '../components/corridor/opening-motion.ts';
test('opening remains visibly in motion until its end and releases at the exact stop',()=>{
 assert.equal(openingMotion(2,2,2.5).position,0);
 assert.ok((1-openingMotion(4,2,2.5).position)*11.8>1);
 assert.equal(openingMotion(4.499,2,2.5).done,false);
 assert.deepEqual(openingMotion(4.5,2,2.5),{progress:1,position:1,done:true});
 assert.equal(openingMotion(0,2,2.5,true).done,true);
});
test('GPU readiness holds the initial pose before either ordinary or reduced-motion playback',()=>{
 for(const reduce of [false,true])assert.deepEqual(openingMotion(20,2,2.5,reduce,false),{progress:0,position:0,done:false});
 assert.equal(openingMotion(2,2,2.5,false,true).position,0);
});
test('a one-second GPU preparation stall cannot jump the first moving camera frame',()=>{
 const held=openingElapsed(1.99,1,2,false,false);assert.equal(held,2);
 const ready=openingElapsed(held,1,2,true,false);assert.equal(ready,2);assert.equal(openingMotion(ready,2,2.5).position,0);
 const next=openingElapsed(ready,1/60,2,true,true);assert.ok(openingMotion(next,2,2.5).position<.0002);
});
