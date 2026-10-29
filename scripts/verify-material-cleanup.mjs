import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const root='public/textures/theatre/ceiling/';
const manifest=JSON.parse(fs.readFileSync('components/corridor/theatre-ceiling-assets.json'));
assert.deepEqual(fs.readdirSync(root).sort(),Object.keys(manifest.textures).sort(),'Ceiling folder contains missing or obsolete textures');
assert.deepEqual(fs.readdirSync('public/models/theatre').sort(),[manifest.model.split('/').at(-1)],'Obsolete ceiling models remain');
let bytes=fs.statSync('public'+manifest.model).size;
const hashes={};
for(const [name,size] of Object.entries(manifest.textures)){const file=root+name;assert.equal(fs.statSync(file).size,size);bytes+=size;hashes[file]=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
assert.equal(bytes,manifest.bytes);
for(const path of ['public/textures/theatre-floor','public/textures/theatre-floor-quality','public/models/theatre-floor.glb','public/models/theatre-floor-detail.glb','components/corridor/theatre-floor.tsx'])assert(!fs.existsSync(path),'Obsolete floor asset remains: '+path);
const cleanup=JSON.parse(fs.readFileSync('docs/theatre-ceiling-audit/cleanup-report.json'));
assert.equal(cleanup.status,'deleted');assert.equal(cleanup.remainingDeletedFiles,0);
for(const file of cleanup.files)assert(!fs.existsSync(file.path),'Deleted file reappeared: '+file.path);
const result={ceilingFiles:Object.keys(manifest.textures).length+1,ceilingBytes:bytes,deletedFiles:cleanup.fileCount,freedBytes:cleanup.bytes,hashes};
fs.writeFileSync('docs/theatre-ceiling-audit/cleanup-verification.json',JSON.stringify(result,null,2));console.log(result);
