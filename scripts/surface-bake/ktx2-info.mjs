// Prints KTX2 header facts: size, mip levels, colour model (UASTC/ETC1S), transfer (sRGB/linear), supercompression.
// Usage: node scripts/surface-bake/ktx2-info.mjs <file.ktx2> [...]
import fs from 'node:fs';
for(const f of process.argv.slice(2)){
  const b=fs.readFileSync(f),u=o=>b.readUInt32LE(o),dfd=u(48);
  const model={160:'ETC1S',166:'UASTC'}[b[dfd+12]]??b[dfd+12],transfer={1:'linear',2:'sRGB'}[b[dfd+14]]??b[dfd+14];
  console.log(JSON.stringify({file:f.split('/').pop(),bytes:b.length,width:u(20),height:u(24),levels:u(40),model,transfer,supercompression:{0:'none',1:'BasisLZ',2:'zstd'}[u(44)]}));
}
