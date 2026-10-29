// 6K upgrade encoder: 16-bit display-referred master -> 8-bit (triangular dither) -> UASTC KTX2.
// sRGB, box mips stopping at 12x12 (every level stays 4x4-block aligned for WebGL compressed formats),
// light RDO, zstd 19. basisu -stats reports the encoded quality against the 8-bit master.
// Usage: node scripts/surface-bake/encode-6k.mjs <display.png> <out.ktx2> [rdo=0.25]
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const [master,output,rdo='0.25']=process.argv.slice(2);
const png=master.replace(/\.png$/,'-8.png');
execFileSync('C:/Program Files/Blender Foundation/Blender 5.2/blender.exe',['-b','--python','scripts/blender/surface-bake/to8.py','--',master,png],{stdio:'ignore'});
const log=execFileSync('D:/New folio/new site code/_tools/basisu/bin/basisu.exe',['-uastc','-uastc_level','3','-uastc_rdo_l',rdo,'-uastc_rdo_d','32768',
  '-mipmap','-mip_filter','box','-mip_smallest','12','-mip_srgb','-ktx2','-ktx2_zstandard_level','19','-max_threads','16','-stats','-file',png,'-output_file',output],{encoding:'utf8',maxBuffer:1<<26});
const psnr=[...log.matchAll(/(RGB|Luma)[^\n]*PSNR[^\n]*/gi)].map(m=>m[0].trim()).slice(0,4);
console.log('ENCODED6K',output,fs.statSync(output).size,JSON.stringify(psnr));
