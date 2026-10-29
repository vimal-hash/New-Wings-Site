// Records (or with --check, verifies) hashes of every runtime model plus the accepted ceiling and left-wall files.
// Re-recorded for the 6K upgrade (2026-10-24); the pre-upgrade record is docs/restoration/baseline-hashes.pre-6k.json.
import fs from 'node:fs';
import crypto from 'node:crypto';
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const accepted=['components/corridor/theatre-ceiling.tsx','components/corridor/theatre-ceiling-assets.json','components/corridor/theatre-ceiling-ids.json','components/corridor/theatre-ceiling-geometry.ts',
 'components/corridor/theatre-left-wall.tsx','components/corridor/theatre-left-wall-assets.json','components/corridor/left-wall-uv.ts','components/corridor/left-wall-uv.json',
 'public/textures/theatre/ceiling/ceiling-surface-edges-6k.ktx2','public/textures/theatre/left-wall/left-wall-surface-6k.ktx2'];
const models=fs.readdirSync('public/models',{recursive:true}).map(f=>'public/models/'+f.split(String.fromCharCode(92)).join('/')).filter(f=>fs.statSync(f).isFile());
const files=[...models,...accepted].sort();
const path='docs/restoration/baseline-hashes.json';
if(process.argv.includes('--check')){
  const base=JSON.parse(fs.readFileSync(path));let bad=0;
  for(const [f,h] of Object.entries(base.files)){const ok=fs.existsSync(f)&&sha(f)===h;if(!ok){bad++;console.log('CHANGED',f);}}
  const extra=models.filter(f=>!(f in base.files));extra.forEach(f=>{bad++;console.log('NEW MODEL',f);});
  console.log(bad?`BASELINE FAILED ${bad}`:`BASELINE OK ${Object.keys(base.files).length} files`);process.exit(bad?1:0);
}
fs.writeFileSync(path,JSON.stringify({recorded:new Date().toISOString(),files:Object.fromEntries(files.map(f=>[f,sha(f)]))},null,1));
console.log('BASELINE RECORDED',files.length);
