import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BufferGeometry,Float32BufferAttribute} from 'three';
import {keepProjectorPart,blackProjectorHousing,orangeProjectorMaterial} from '../components/corridor/projector-edit.ts';
import {bakeProjectorPose} from '../components/corridor/projector-static-pose.ts';
const aligned=JSON.parse(fs.readFileSync(new URL('../components/corridor/projector-formation-aligned.json',import.meta.url)));
test('all wires are removed but every authored optical stack part remains',()=>{
  const names=aligned.names;
  assert.ok(names.filter(n=>/^(HARN|HOSE)_|^LP_DMD_flex_ribbon_/.test(n)).every(n=>!keepProjectorPart(n)));
  assert.ok(names.filter(n=>/^LENS_|^LPIPE_/.test(n)).every(keepProjectorPart));
  assert.equal(names.filter(n=>!keepProjectorPart(n)).length,119);
});
test('repeated internal screws are removed while representative fasteners and the main plates remain',()=>{
  for(const name of aligned.names.filter(n=>/^LS_.*(?:clamp_screw_1|bank_1_screw_1)$/.test(n)))assert.ok(keepProjectorPart(name));
  for(const name of aligned.names.filter(n=>/^LS_.*(?:clamp_screw_[2-4]|bank_[23]_screw_[12])$/.test(n)))assert.equal(keepProjectorPart(name),false);
});
test('representative cooling stays; duplicate fans and filters go',()=>{
  for(const n of ['COOL_LP_cooling_fan_1','COOL_Cooler_left_fan_1','COOL_Cooler_right_fan_1','FILT_Front_filter_washable','FILT_Cooler_filter_left_washable'])assert.ok(keepProjectorPart(n));
  for(const n of ['COOL_LP_cooling_fan_6','COOL_Cooler_right_fan_2','FILT_Cooler_filter_right_washable'])assert.equal(keepProjectorPart(n),false);
  assert.ok(blackProjectorHousing('SH_Top_cover'));assert.equal(blackProjectorHousing('LENS_Front'),false);
  assert.ok(orangeProjectorMaterial([.85,.1,.015]));assert.ok(orangeProjectorMaterial([.85,.45,.25]));assert.equal(orangeProjectorMaterial([.02,.02,.022]),false);
});
test('the phone projector bakes the final transform and preserves source UVs and part IDs',()=>{
  const geometry=new BufferGeometry(),part=new Float32BufferAttribute([0,1],1),uv=new Float32BufferAttribute([0,.5,1,1],2);
  const local=new Float32BufferAttribute([1,2,3,0,0,0],3);
  geometry.setAttribute('_part',part);geometry.setAttribute('uv',uv);geometry.setAttribute('position',local);
  geometry.setAttribute('normal',new Float32BufferAttribute([1,1,0,0,0,1],3));
  const poses=new Float32Array(48),q=Math.SQRT1_2;
  poses.set([5,6,7,1,0,0,q,q,2,4,.5,0, 0,0,0,0,0,0,0,1,1,1,1,0],24);
  assert.deepEqual([...bakeProjectorPose(geometry,poses,24)],[0,1]);
  assert.deepEqual([...geometry.getAttribute('position').array],[-3,8,8.5,0,0,0]);
  const normal=geometry.getAttribute('normal');
  assert.ok(Math.abs(normal.getX(0)+1/Math.sqrt(5))<1e-6);
  assert.ok(Math.abs(normal.getY(0)-2/Math.sqrt(5))<1e-6);
  assert.equal(geometry.getAttribute('uv'),uv);assert.equal(geometry.getAttribute('_part'),part);
  assert.deepEqual([...local.array],[1,2,3,0,0,0]);
});
