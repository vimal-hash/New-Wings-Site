import test from 'node:test';
import assert from 'node:assert/strict';
import {pageAtBottom} from '../components/corridor/page-exit.ts';

test('the first and second page sections do not trigger a return',()=>{
 assert.equal(pageAtBottom(0,2400,800),false);assert.equal(pageAtBottom(800,2400,800),false);
});
test('reaching the third section triggers immediately without another wheel or swipe',()=>{
 assert.equal(pageAtBottom(1600,2400,800),true);assert.equal(pageAtBottom(1688,2532,844),true);
});
test('fractional mobile scroll rounding at the bottom cannot block return',()=>{
 assert.equal(pageAtBottom(1598.8,2400,800),true);assert.equal(pageAtBottom(1595,2400,800),false);
});
test('unmeasured or nonoverflowing content cannot accidentally exit on mount',()=>{
 assert.equal(pageAtBottom(0,0,0),false);assert.equal(pageAtBottom(0,800,800),false);
});
