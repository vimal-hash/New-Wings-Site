import test from 'node:test';
import assert from 'node:assert/strict';
import {revealScrollTarget,settleReveal} from '../components/corridor/reveal-scroll.ts';
test('scroll destination clamps and reverses from either end',()=>{
 assert.equal(revealScrollTarget(.9,10000,844),1);
 assert.equal(revealScrollTarget(.1,-10000,844),0);
 assert.ok(revealScrollTarget(1,-180,844)<1);
 assert.ok(revealScrollTarget(0,180,844)>0);
});
test('smoothing is independent of refresh rate and never overshoots',()=>{
 const run=hz=>{let p=0;for(let i=0;i<hz;i++)p=settleReveal(p,.8,1/hz);return p;};
 assert.ok(Math.abs(run(30)-run(120))<1e-10);
 let p=.8;for(let i=0;i<500;i++){p=settleReveal(p,.2,1/60);assert.ok(p>=.2&&p<=.8);}assert.equal(p,.2);
});
