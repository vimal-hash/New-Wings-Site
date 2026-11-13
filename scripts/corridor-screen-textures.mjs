// Generates the corridor screen-glass PBR maps (tileable; roughness 512², normal 256²): a micro
// orange-peel normal map and a wiped/smudged roughness map. No downloads.
// Usage: node scripts/corridor-screen-textures.mjs
import fs from 'node:fs';import path from 'node:path';import zlib from 'node:zlib';

let SIZE=512;const OUT='public/textures/corridor/screen-glass';
function hash(x,y,seed){let h=(x*374761393+y*668265263+seed*2147483647)|0;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
// Periodic value noise: lattice wraps every `period` cells, so the map tiles.
function noise(u,v,period,seed){
  const x=u*period,y=v*period,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;
  const s=t=>t*t*t*(t*(t*6-15)+10),w=(a,b)=>hash(((a%period)+period)%period,((b%period)+period)%period,seed);
  const a=w(x0,y0),b=w(x0+1,y0),c=w(x0,y0+1),d=w(x0+1,y0+1),sx=s(fx),sy=s(fy);
  return a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy;
}
function fbm(u,v,base,octaves,seed){let sum=0,amp=.5,norm=0;for(let o=0;o<octaves;o++){sum+=amp*noise(u,v,base<<o,seed+o);norm+=amp;amp*=.5;}return sum/norm;}

function png(file,channels,pixel){
  const row=SIZE*channels+1,raw=Buffer.alloc(row*SIZE);
  for(let y=0;y<SIZE;y++){raw[y*row]=0;for(let x=0;x<SIZE;x++){const value=pixel(x/SIZE,y/SIZE);for(let c=0;c<channels;c++)raw[y*row+1+x*channels+c]=Math.max(0,Math.min(255,Math.round(value[c]*255)));}}
  const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
  const crc=buffer=>{let c=0xffffffff;for(const byte of buffer)c=crcTable[(c^byte)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
  const chunk=(type,data)=>{const length=Buffer.alloc(4);length.writeUInt32BE(data.length);const body=Buffer.concat([Buffer.from(type),data]);const sum=Buffer.alloc(4);sum.writeUInt32BE(crc(body));return Buffer.concat([length,body,sum]);};
  const header=Buffer.alloc(13);header.writeUInt32BE(SIZE,0);header.writeUInt32BE(SIZE,4);header[8]=8;header[9]=channels===1?0:2;header[10]=0;header[11]=0;header[12]=0;
  fs.writeFileSync(path.join(OUT,file),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]));
}

fs.mkdirSync(OUT,{recursive:true});
// Roughness: clean polished glass (~.35 of the material factor) with faint
// diagonal wipe streaks and a few soft smudge pools.
png('screen-glass-roughness.png',1,(u,v)=>{
  const smudge=fbm(u,v,3,4,11),wipe=fbm((u+v)%1,v,4,3,23),grain=noise(u,v,128,41);
  const pools=Math.max(0,smudge-.56)*2.6,streak=Math.max(0,wipe-.58)*1.4;
  return [.34+pools*.42+streak*.28+(grain-.5)*.05];
});
// Normal: very low-amplitude orange peel from a height field (central differences).
SIZE=256;
const height=(u,v)=>fbm(u,v,24,3,57)*.75+noise(u,v,96,71)*.25;
png('screen-glass-normal.png',3,(u,v)=>{
  const e=1/SIZE,strength=3.2;
  const dx=(height((u+e)%1,v)-height((u-e+1)%1,v))*strength,dy=(height(u,(v+e)%1)-height(u,(v-e+1)%1))*strength;
  const len=Math.hypot(dx,dy,1);return [(-dx/len)*.5+.5,(-dy/len)*.5+.5,(1/len)*.5+.5];
});
console.log('Corridor screen-glass maps written to',OUT);
