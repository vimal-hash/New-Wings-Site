import assert from 'node:assert/strict';
import test from 'node:test';
import {projectorControls as controls} from '../components/corridor/projector-controls.ts';

test('manual particle formation holds exploded until assemble, and replay rejects stale completion',()=>{
  assert.equal(controls.read().phase,'hidden');controls.ready(true);const hidden=controls.read();controls.play('assembling');assert.equal(controls.read(),hidden);
  controls.ready(false);const initial=controls.read();controls.play('particles');assert.equal(controls.read(),initial);
  controls.ready(true);controls.play('particles');const particles=controls.read();assert.equal(particles.phase,'particles');
  controls.finish(particles.command,'exploded');assert.equal(controls.read().phase,'exploded');
  controls.play('assembling');const assembly=controls.read();assert.equal(assembly.phase,'assembling');
  controls.finish(particles.command,'exploded');assert.equal(controls.read().phase,'assembling');
  controls.finish(assembly.command,'assembled');assert.equal(controls.read().phase,'assembled');
  controls.play('particles');assert.ok(controls.read().command>assembly.command);assert.equal(controls.read().phase,'particles');
  controls.finish(assembly.command,'assembled');assert.equal(controls.read().phase,'particles');
  controls.ready(false);
});

test('a preparation failure cannot be overwritten by a late ready signal',()=>{
  controls.fail();controls.ready(true);controls.set('assembled');
  assert.equal(controls.read().failed,true);
  assert.equal(controls.read().ready,false);
});
