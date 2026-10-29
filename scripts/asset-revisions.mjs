import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const revisions={};
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())walk(file);else if(/\.(?:glb|ktx2|bin|gz|wasm|js)$/.test(item.name)){const url='/'+path.relative('public',file).replaceAll('\\','/');revisions[url]=createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0,12);}}}
for(const dir of ['models','textures','basis','draco'])walk(path.join('public',dir));
fs.writeFileSync('components/corridor/asset-revisions.json',JSON.stringify(revisions,null,2)+'\n');console.log('Versioned assets:',Object.keys(revisions).length);
