import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ASSEMBLED_ENTRY,hoverMode,projectorGroups,projectorPartNames,ranges,theatreKey,wireParts} from '../components/corridor/hover-catalogue-state.ts';
const parts=projectorPartNames(JSON.parse(fs.readFileSync(new URL('../components/corridor/projector-formation-aligned.json',import.meta.url))));

test('inspection is offered only at the three resting stops',()=>{
  assert.equal(hoverMode('idle','hidden'),'theatre');
  assert.equal(hoverMode('idle','hidden',1),'theatre','glasses do not intercept catalogue picking');
  assert.equal(hoverMode('idle','hidden',.4),'theatre','the stationary theatre remains inspectable');
  assert.equal(hoverMode('awaitAssembly','exploded'),'exploded');
  assert.equal(hoverMode('done','assembled'),'assembled');
  for(const phase of ['intro','glassesExit','pullback','hold','approach','reveal','returnHold','return','screens','corridor','logoReveal'])assert.equal(hoverMode(phase,'assembled'),null,phase);
  assert.equal(hoverMode('awaitAssembly','assembling'),null);
});

test('theatre catalogue covers every requested object',()=>{
  const cases={'Clean source upholstery | 12 sofas':'seats',screen:'screen','floor-slab':'floor',terraces:'floor','acoustic-slats':'interior',speakers:'speakers','light-fixtures':'lights','Moon mirror | left':'moon','moon-steel-border':'moon','aisle-lights':'steps','step-nosings':'steps'};
  for(const [name,key] of Object.entries(cases))assert.equal(theatreKey(name,''),key,name);
  assert.equal(theatreKey('x','Ceiling | Approved baked appearance'),'ceiling');
  assert.equal(theatreKey('x','Left wall | Baked Blender appearance'),'interior');
  assert.equal(theatreKey('corridor-wall-red',''),null);
});

test('exploded view: lenses, boards, DMD chips and subsystems; wires are removed, the lens is kept',()=>{
  const groups=projectorGroups(parts),grouped=new Set([...groups.values()].flatMap(g=>g.parts));
  assert.equal(groups.get('processor').parts.length,3);
  assert.ok(groups.get('lens').parts.length>=16);
  assert.ok([...groups.values()].filter(g=>g.entry.category==='Electronics').length>=12);
  const wires=wireParts(parts);
  assert.equal(wires.length,27);
  assert.ok(wires.every(i=>/^(HARN|HOSE)_|^LP_DMD_flex_ribbon_/.test(parts[i])));
  assert.ok(wires.every(i=>!grouped.has(i)),'wires are never selectable');
  assert.ok(parts.every((name,i)=>!/^LENS_/.test(name)||!wires.includes(i)),'lens parts stay');
  assert.deepEqual(ranges([1,2,3,7,9,10]),[[1,3],[7,7],[9,10]]);
});

test('the projector and its parts are quote-only',()=>{
  for(const entry of [ASSEMBLED_ENTRY,...Array.from(projectorGroups(parts).values(),group=>group.entry)]){
    assert.deepEqual(Object.keys(entry).sort(),['category','name']);
  }
});
