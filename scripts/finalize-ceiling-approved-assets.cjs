const fs=require('node:fs');
const path='components/corridor/theatre-ceiling-assets.json';
const m=JSON.parse(fs.readFileSync(path));
m.geometryBytes=fs.statSync('public'+m.model).size;
m.textures={'ceiling-surface-edges.ktx2':fs.statSync('public/textures/theatre/ceiling/ceiling-surface-edges.ktx2').size};
m.bytes=m.geometryBytes+m.textures['ceiling-surface-edges.ktx2'];
m.method='Direct Blender COMBINED surface bake at 4096px, active-camera glossy direction, source display transform, per-island seam cleanup and gutters; one fixed appearance without image projection or material switching';
fs.writeFileSync(path,JSON.stringify(m,null,2)+'\n');console.log(m);



