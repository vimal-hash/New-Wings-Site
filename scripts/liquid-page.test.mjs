import test from 'node:test';
import assert from 'node:assert/strict';
import { pageCoverScale,pageEase } from '../components/corridor/liquid-page-motion.ts';

test('the liquid sheet covers portrait phones and wide laptop screens before HTML handoff',()=>{
  for(const aspect of [9/21,9/16,3/4,1,16/9,21/9,32/9]){
    const fov=40,distance=.6,width=Math.min(6,2*Math.tan(fov*Math.PI/360)*14*aspect*.35);
    const scale=pageCoverScale(aspect,fov,distance,width),height=2*Math.tan(fov*Math.PI/360)*distance;
    assert.ok(width*scale>=height*aspect);assert.ok(width/1.5*scale>=height);
  }
});
test('the liquid arrival and morph have stationary exact endpoints and monotonic progress',()=>{
  assert.equal(pageEase(-1),0);assert.equal(pageEase(2),1);
  assert.ok(pageEase(.001)<.000001);assert.ok(1-pageEase(.999)<.000001);
  let previous=0;for(let i=0;i<=100;i++){const current=pageEase(i/100);assert.ok(current>=previous);previous=current;}
});
