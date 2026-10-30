import test from 'node:test';
import assert from 'node:assert/strict';
import {glassesControls as controls,GLASSES_DEFAULTS} from '../components/corridor/glasses-controls.ts';
test('glasses controls clamp distances outside the camera near plane and reject invalid input',()=>{
 controls.reset();controls.set('distance',0);assert.equal(controls.read().distance,8);
 controls.set('distance',1000);assert.equal(controls.read().distance,80);
 controls.set('distance',NaN);assert.equal(controls.read().distance,80);
 controls.set('width',200);assert.equal(controls.read().width,140);
 controls.set('width',0);assert.equal(controls.read().width,40);
 controls.set('gap',0);assert.equal(controls.read().gap,2);
 controls.set('gap',200);assert.equal(controls.read().gap,100);
 controls.set('tint',-1);assert.equal(controls.read().tint,0);
 controls.set('lockWidth',false);assert.equal(controls.read().lockWidth,false);
 controls.reset();assert.deepEqual(controls.read(),GLASSES_DEFAULTS);
});
test('glasses drafts survive reload, including independent blur, bridge and width settings',()=>{
 let saved='';const storage={setItem:(_,v)=>{saved=v;},getItem:()=>saved};
 controls.set('distance',35);controls.set('width',110);controls.set('gap',12);controls.set('blur',24);controls.set('bridge',.16);controls.set('tint',.5);controls.set('lockWidth',false);
 const expected={...controls.read()};assert.equal(controls.save(storage),true);
 controls.reset();controls.load(storage);assert.deepEqual(controls.read(),expected);controls.reset();
});
test('older glasses drafts keep the approved width default',()=>{
 controls.reset();controls.load({getItem:()=>JSON.stringify({distance:20,blur:16})});
 assert.equal(controls.read().width,80);assert.equal(controls.read().gap,8);assert.equal(controls.read().distance,20);controls.reset();
});
