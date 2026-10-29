import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compiled=ts.transpileModule(fs.readFileSync('components/corridor/texture-quality.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const url='/textures/theatre/ceiling/ceiling-light-2k.ktx2';
function select(navigator,maxTextureSize=16384,location){const fixture={exports:{}};vm.runInNewContext(compiled,{module:fixture,exports:fixture.exports,URLSearchParams,...(navigator?{navigator}:{}),...(location?{location}:{})});return fixture.exports.textureForDevice(url,{capabilities:{maxTextureSize}});}
test('phones, tablets and unsupported GPUs never select a 6K atlas',()=>{
 for(const navigator of [{userAgent:'Android Mobile',platform:'Linux',maxTouchPoints:5},{userAgent:'iPhone',platform:'iPhone',maxTouchPoints:5},{userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:5},{userAgent:'Windows',userAgentData:{mobile:true},maxTouchPoints:0}])assert.equal(select(navigator),url);
 const desktop={userAgent:'Windows',platform:'Win32',maxTouchPoints:0};
 assert.equal(select(desktop,4096),url);assert.equal(select(undefined),url);assert.equal(select(desktop),'/textures/theatre/ceiling/ceiling-compressed-6k.ktx2');
});
test('the local phone diagnostic also blocks 6K; it cannot override another host',()=>{
 const desktop={userAgent:'Windows',platform:'Win32',maxTouchPoints:0};
 assert.equal(select(desktop,16384,{hostname:'127.0.0.5',search:'?diagnostics=1&fx-test=mobile'}),url);
 assert.notEqual(select(desktop,16384,{hostname:'example.test',search:'?diagnostics=1&fx-test=mobile'}),url);
 assert.notEqual(select(desktop,16384,{hostname:'localhost',search:'?fx-test=mobile'}),url);
});
