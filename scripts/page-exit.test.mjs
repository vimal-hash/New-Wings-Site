import test from 'node:test';
import assert from 'node:assert/strict';
import {pageAtBottom,createPageReturn} from '../components/corridor/page-exit.ts';

test('the first and second page sections do not trigger a return',()=>{
 assert.equal(pageAtBottom(0,2400,800),false);assert.equal(pageAtBottom(800,2400,800),false);
});
test('the fourth section has a native, measurable bottom',()=>{
 assert.equal(pageAtBottom(1600,3200,800),false);
 assert.equal(pageAtBottom(2400,3200,800),true);
 assert.equal(pageAtBottom(1600,2400,800),true);assert.equal(pageAtBottom(1688,2532,844),true);
});

test('the cover starts exact and retreats while the camera moves to View 1',()=>{
 const exit=createPageReturn(),start=exit.read();
 assert.equal(start.scale,1);assert.equal(start.opacity,1);assert.equal(start.copy,1);assert.equal(start.travel,0);
 let previous=start,overlap=false,frames=0;
 while(previous.moving&&frames++<400){
   const shot=exit.tick(1/60,.82);
   assert.ok(shot.travel>=previous.travel);
   assert.ok(shot.opacity<=previous.opacity&&shot.scale<=previous.scale);
   overlap||=shot.travel>0&&shot.opacity>0;
   previous=shot;
 }
 assert.ok(overlap);assert.equal(previous.travel,1);assert.equal(previous.opacity,0);assert.equal(previous.copy,0);
 assert.equal(previous.moving,false);assert.ok(frames>200&&frames<260,'a slow glide of about four seconds');
 exit.reset();assert.deepEqual(exit.read(),start);
});
test('reduced motion returns directly to the uncovered View 1',()=>{
 const exit=createPageReturn(),shot=exit.tick(0,.82,true);
 assert.equal(shot.travel,1);assert.equal(shot.opacity,0);assert.equal(shot.moving,false);
});
test('fractional mobile scroll rounding at the bottom cannot block return',()=>{
 assert.equal(pageAtBottom(1598.8,2400,800),true);assert.equal(pageAtBottom(1595,2400,800),false);
});
test('unmeasured or nonoverflowing content cannot accidentally exit on mount',()=>{
 assert.equal(pageAtBottom(0,0,0),false);assert.equal(pageAtBottom(0,800,800),false);
});
