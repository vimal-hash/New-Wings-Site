import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const previews=JSON.parse(fs.readFileSync('components/corridor/first-paint-textures.json'));
const revisions=JSON.parse(fs.readFileSync('components/corridor/asset-revisions.json'));
const compiled=ts.transpileModule(fs.readFileSync('components/corridor/asset-url.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const fixture={exports:{}};vm.runInNewContext(compiled,{module:fixture,exports:fixture.exports,URLSearchParams,require:name=>name.includes('asset-revisions')?revisions:previews});const {assetURL}=fixture.exports;
test('all first-paint textures reuse the approved compressed mip bytes exactly',()=>{
 for(const [full,preview]of Object.entries(previews)){
  const a=fs.readFileSync('public'+full),b=fs.readFileSync('public'+preview);assert.equal(a.readUInt32LE(20)>>1,b.readUInt32LE(20));assert.equal(a.readUInt32LE(24)>>1,b.readUInt32LE(24));
  for(let i=0;i<b.readUInt32LE(40);i++){const x=80+(i+1)*24,y=80+i*24;const ao=Number(a.readBigUInt64LE(x)),bo=Number(b.readBigUInt64LE(y)),size=Number(b.readBigUInt64LE(y+8));assert.deepEqual(b.subarray(bo,bo+size),a.subarray(ao,ao+size));}
 }
});
test('first-paint and full-detail requests have distinct content versions and stable repeated resolution',()=>{
 for(const full of Object.keys(previews)){const first=assetURL(full),detail=assetURL(full+'?detail=1');assert.ok(first.startsWith(previews[full]+'?v='));assert.ok(detail.startsWith(full+'?v='));assert.equal(assetURL(first),first);assert.equal(assetURL(detail),detail);assert.notEqual(first,detail);}
 assert.equal(assetURL('data:example'),'data:example');assert.equal(assetURL('/unrelated.png'),'/unrelated.png');
});
