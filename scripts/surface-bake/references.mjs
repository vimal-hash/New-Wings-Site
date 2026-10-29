// Renders every configured pose of one item (Blender beauty + target mask). Usage: node scripts/surface-bake/references.mjs <item> [pose]
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const [name,only]=process.argv.slice(2),spec=JSON.parse(fs.readFileSync('scripts/surface-bake/items.json')).items[name];
for(const [pose,[eye,target,fov,w,h]] of Object.entries(spec.poses)){
  if(only&&pose!==only)continue;
  execFileSync('C:/Program Files/Blender Foundation/Blender 5.2/blender.exe',['-b','--python','scripts/blender/surface-bake/render-reference.py','--',name,pose,...eye,...target,fov,w,h].map(String),{stdio:'ignore'});
  console.log('REFERENCE',name,pose);
}
