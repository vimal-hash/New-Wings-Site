const fs=require('node:fs');
const {createRequire}=require('node:module');
const r=createRequire(process.cwd()+'/package.json');
const sharp=r(r.resolve('sharp',{paths:[r.resolve('next')]}));
(async()=>{
  const filename='opening-wide.webp';
  const target='public/textures/theatre/ceiling/'+filename;
  await sharp('docs/theatre-ceiling-audit/blender-wide-matched.png')
    .extract({left:0,top:0,width:3072,height:360})
    .sharpen({sigma:.5,m1:.1,m2:.6})
    .webp({lossless:true,effort:6}).toFile(target);
  const path='components/corridor/theatre-ceiling-assets.json';
  const manifest=JSON.parse(fs.readFileSync(path));
  delete manifest.textures['opening-crisp.webp'];
  manifest.textures[filename]=fs.statSync(target).size;
  manifest.bytes=manifest.geometryBytes+Object.values(manifest.textures).reduce((a,b)=>a+b,0);
  fs.writeFileSync(path,JSON.stringify(manifest,null,2)+'\n');
  console.log({openingBytes:manifest.textures[filename],ceilingBytes:manifest.bytes});
})();
