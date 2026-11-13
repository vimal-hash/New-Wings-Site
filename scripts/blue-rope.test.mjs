import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inflateSync} from 'node:zlib';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
import * as flight from '../components/rope-model/rope-flight.ts';
import {BLUE_FLIGHT,BLUE_START,FLIGHT,GREEN,blueMatrix,blueBox,greenMatrix,flightAtStop,flightZ,createFlightCamera,SECTION_WHITE_SCREENS,sectionWhiteShare,sectionFlightShare} from '../components/rope-model/rope-flight.ts';
import {Vector3} from 'three';
import {createSectionFade} from '../components/rope-model/section-fade.ts';
// Compile this module as Next does: its bundler resolves extensionless TS imports.
const portalFixture={exports:{}},nativeRequire=createRequire(import.meta.url);
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../components/rope-model/rope-portal.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:portalFixture,exports:portalFixture.exports,require:name=>name==='./rope-flight'?flight:nativeRequire(name)});
const {BLUE_PORTAL,PORTAL,portalFade,portalMaterial,placePortal}=portalFixture.exports;

test('both sections finish their white handoff after the same physical scroll distance',()=>{
  for(const height of [768,900,1080]){
    for(const screens of [0,.1,.25,.5,SECTION_WHITE_SCREENS]){
      const pixels=screens*height;
      const progress=profile=>pixels/((profile.scrollScreens-1)*height)/sectionWhiteShare(profile);
      assert.ok(Math.abs(progress(FLIGHT)-progress(BLUE_FLIGHT))<1e-12);
    }
  }
  assert.ok(Math.abs(sectionWhiteShare(FLIGHT)-.022)<1e-12);
  for(const profile of [FLIGHT,BLUE_FLIGHT]){
    const white=sectionWhiteShare(profile);
    assert.equal(sectionFlightShare(white,profile),0);
    assert.equal(flightZ(sectionFlightShare(white,profile),profile),-profile.travel);
    assert.equal(sectionFlightShare(profile.holdFrom,profile),profile.holdFrom);
    let previous=-Infinity;
    for(let i=0;i<=10000;i++){
      const at=i/10000,value=sectionFlightShare(at,profile);
      assert.ok(value>=previous);previous=value;
      if(at<=white)assert.equal(value,0);
      if(at>=profile.holdFrom)assert.equal(value,at);
    }
  }
});

test('blue portal has the first portal perspective and closing curve in its own scale',()=>{
  const scale=BLUE_PORTAL.radius/PORTAL.radius,first=portalMaterial(),blue=portalMaterial(true);
  const up=.46875,aspect=1.6;
  const sample=(material,z,isBlue)=>{let result;placePortal(material,null,(...args)=>result=args,z,up,aspect,isBlue);return result;};
  try{
    for(let distance=0;distance<=59.6;distance+=.1){
      const z=-59.6+distance,blueZ=BLUE_START+distance*scale;
      const a=sample(first,z,false),b=sample(blue,blueZ,true);
      for(let i=0;i<a.length;i++)assert.ok(Math.abs(a[i]-b[i])<1e-10);
      assert.ok(Math.abs(portalFade(z)-portalFade(blueZ,true))<1e-12);
    }
    // A single short tunnel does not move far enough away to close the opening
    // at its middle. It must recede in depth instead of pinching into a coin.
    assert.equal(portalFade(-12,true),1);
    assert.equal(portalFade(-23),1);
    assert.equal(portalFade(-12),0);
  }finally{first.dispose();blue.dispose();}
});

test('blue backs through one tunnel and holds at its middle in both directions',()=>{
  assert.equal(flightZ(0,BLUE_FLIGHT),BLUE_START);
  assert.equal(flightZ(1,BLUE_FLIGHT),0);
  for(const at of [.48,.49,.5,.51,.52]){
    assert.equal(flightZ(at,BLUE_FLIGHT),-12);
    assert.equal(flightAtStop(at,-12,BLUE_FLIGHT),true);
  }
  assert.equal(flightAtStop(.5,-11.98,BLUE_FLIGHT),false);
  assert.equal(flightAtStop(.6,-12,BLUE_FLIGHT),false);
  let last=-Infinity;
  for(let i=0;i<=10000;i++){const z=flightZ(i/10000,BLUE_FLIGHT);assert.ok(z>=last);last=z;}
});

test('the existing green/red camera endpoints and stop stay exact',()=>{
  assert.equal(flightZ(0),-59.6);
  assert.ok(Math.abs(flightZ(FLIGHT.holdFrom)+9)<1e-12);
  assert.equal(flightZ(FLIGHT.holdTo),-9);
  assert.equal(flightZ(1),0);
});

test('blue camera settles from either direction without overshooting the hover stop',()=>{
  for(const start of [BLUE_START,0]){
    const camera=createFlightCamera(),position={z:start};camera.move(position,start,1/60);
    for(let i=0;i<600;i++){
      camera.move(position,-12,1/60);
      assert.ok(start< -12?position.z<=-12:position.z>=-12);
    }
    assert.equal(position.z,-12);
  }
});

test('a reused camera starts from the covered pose rather than jumping to a large gesture target',()=>{
  const camera=createFlightCamera(),position={z:0};camera.place(BLUE_START);
  camera.move(position,-12,1/60);
  assert.ok(position.z>BLUE_START&&position.z<BLUE_START+.1);
  let previous=position.z;
  for(let i=0;i<600;i++){camera.move(position,-12,1/60);assert.ok(position.z>=previous&&position.z<=-12);previous=position.z;}
  assert.equal(position.z,-12);
});

test('white reveal and reversal are finite and smooth across sparse wheel steps',()=>{
  const fade=createSectionFade(0);
  let previous=0,active=true;
  for(let i=0;i<180;i++){
    active=fade.move(1,1/60);assert.ok(fade.value>=previous&&fade.value<=1);assert.ok(fade.value-previous<.08);previous=fade.value;
  }
  assert.equal(active,false);assert.equal(fade.value,1);
  for(let i=0;i<180;i++){active=fade.move(0,1/60);assert.ok(fade.value<=previous&&fade.value>=0);previous=fade.value;}
  assert.equal(active,false);assert.equal(fade.value,0);
});

test('the short blue entry retains the first flight acceleration while its exit stays unchanged',()=>{
  const a=FLIGHT.holdFrom*(FLIGHT.scrollScreens-1),b=BLUE_FLIGHT.holdFrom*(BLUE_FLIGHT.scrollScreens-1);
  const ta=flight.flightGlideTime(a,FLIGHT,true),tb=flight.flightGlideTime(b,BLUE_FLIGHT,true);
  assert.ok(Math.abs(a/(ta*ta)-b/(tb*tb))<1e-12);
  assert.equal(flight.flightGlideTime(5,FLIGHT,true),2000);
  assert.equal(flight.flightGlideTime(5,BLUE_FLIGHT,false),2000);
});

test('the blue entry sees the same original strands and all rotated bounds contain them',()=>{
  const green=greenMatrix(),blue=blueMatrix();
  for(const z of [-21.5,-20,-18,-16]){
    const cameraGreen=z*GREEN.scale+GREEN.shift;
    for(const p of [[1,2,-26],[-3,1,-25],[2,-1,-24],[-2,-3,-27]]){
      const a=new Vector3(...p).applyMatrix4(green),b=new Vector3(...p).applyMatrix4(blue);
      assert.ok(Math.abs(a.x/(cameraGreen-a.z)-b.x/(z-b.z))<1e-12);
      assert.ok(Math.abs(a.y/(cameraGreen-a.z)-b.y/(z-b.z))<1e-12);
      assert.ok(Math.abs(b.length()-new Vector3(...p).length())<1e-12);
    }
  }
  const bounds=blueBox(-2,3,-4,1,-30,0);
  for(const x of [-2,3])for(const y of [-4,1])for(const z of [-30,0]){
    const p=new Vector3(x,y,z).applyMatrix4(blue);
    assert.ok(p.x>=bounds.x0-1e-12&&p.x<=bounds.x1+1e-12);
    assert.ok(p.y>=bounds.y0-1e-12&&p.y<=bounds.y1+1e-12);
    assert.ok(p.z>=bounds.z0&&p.z<=bounds.z1);
  }
});

test('both no-glow blue palette exports reproduce the source Blender colour stops',()=>{
  const look=JSON.parse(fs.readFileSync(new URL('../components/rope-model/blue-look.json',import.meta.url)));
  const encode=v=>v<=.0031308?v*12.92:1.055*v**(1/2.4)-.055;
  for(const [file,width] of [['palette-desktop.png',1024],['palette-laptop.png',256]]){
    const b=fs.readFileSync(new URL('../public/rope-model/blue/'+file,import.meta.url));
    assert.equal(b.readUInt32BE(16),width);assert.equal(b.readUInt32BE(20),1);
    let at=8;const chunks=[];
    while(at<b.length){const n=b.readUInt32BE(at);if(b.toString('ascii',at+4,at+8)==='IDAT')chunks.push(b.subarray(at+8,at+8+n));at+=n+12;}
    const pixels=inflateSync(Buffer.concat(chunks));assert.equal(pixels[0],0);
    for(let stop=0;stop<look.redHue[1].length;stop++){
      const x=Math.round(look.redHue[1][stop][0]*(width-1));
      for(let channel=0;channel<3;channel++)assert.ok(Math.abs(pixels[1+x*3+channel]/255-encode(look.blueHue[1][stop][channel]))<.015);
    }
  }
});
