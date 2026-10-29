const fs=require('node:fs');
const path='components/corridor/theatre-ceiling-assets.json';
const m=JSON.parse(fs.readFileSync(path));
m.model='/models/theatre/ceiling-uv-fixed.glb';
m.geometryBytes=fs.statSync('public'+m.model).size;
m.textures=Object.fromEntries(['irradiance-uv-fixed.ktx2','normal-uv-fixed.ktx2','environment.ktx2','specular-uv-fixed.ktx2','display-lut.png','opening-wide.webp'].map(name=>[name,fs.statSync('public/textures/theatre/ceiling/'+name).size]));
m.bytes=m.geometryBytes+Object.values(m.textures).reduce((a,b)=>a+b,0);
fs.writeFileSync(path,JSON.stringify(m,null,2)+'\n');console.log(m);
