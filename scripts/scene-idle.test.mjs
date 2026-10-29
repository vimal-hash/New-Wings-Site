import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('components/corridor/scene-idle.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
test('page-return loading runs critical mounts while movement still defers background work',()=>{
 let phase='pageReturnLoading',tick;const order=[],fixture={exports:{}};
 vm.runInNewContext(code,{module:fixture,exports:fixture.exports,Map,Set,document:{hidden:false},window:{addEventListener(){}},performance:{now:()=>1000},setTimeout:callback=>{tick=callback;return 1;},require:name=>name==='./journey-controls'?{journeyControls:{read:()=>({phase})}}:{projectorControls:{read:()=>({phase:'assembled'})}}});
 fixture.exports.scheduleSceneIdle(()=>order.push('detail'),20);fixture.exports.scheduleSceneIdle(()=>order.push('mount'),0);
 tick();assert.deepEqual(order,['mount']);phase='pageReturning';tick();assert.deepEqual(order,['mount']);phase='panel';tick();assert.deepEqual(order,['mount','detail']);
});

test('opening preflight runs in the hold while projector and detail preparation wait until after the first move',()=>{
 let moving=false,phase='intro',tick;const order=[],fixture={exports:{}};
 vm.runInNewContext(code,{module:fixture,exports:fixture.exports,Map,Set,document:{hidden:false},window:{addEventListener(){}},performance:{now:()=>1000},setTimeout:callback=>{tick=callback;return 1;},require:name=>name==='./journey-controls'?{journeyControls:{read:()=>({phase,openingMoving:moving})}}:{projectorControls:{read:()=>({phase:'hidden'})}}});
 fixture.exports.scheduleSceneIdle(()=>order.push('detail'),20);fixture.exports.scheduleSceneIdle(()=>order.push('projector'),0);fixture.exports.scheduleSceneIdle(()=>order.push('opening'),-100);tick();assert.deepEqual(order,['opening']);
 tick();assert.deepEqual(order,['opening']);moving=true;tick();assert.deepEqual(order,['opening']);phase='idle';tick();assert.deepEqual(order,['opening','projector']);tick();assert.deepEqual(order,['opening','projector']);phase='done';tick();assert.deepEqual(order,['opening','projector','detail']);
});
