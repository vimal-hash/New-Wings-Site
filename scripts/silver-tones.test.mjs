import test from 'node:test';
import assert from 'node:assert/strict';
import {ShaderMaterial,Vector3} from 'three';
import {createSilverToneControl,SILVER_TONES,silverToneAmount} from '../components/corridor/silver-tones.ts';
const make=()=>new ShaderMaterial({uniforms:{uLighting:{value:Array.from({length:16},(_,i)=>new Vector3(.7+i*.03,.8+i*.02,1+i*.01))}}});

test('silver tone calibration only darkens, preserves RGB ratios and never compounds across frames',()=>{
 const material=make(),values=material.uniforms.uLighting.value,base=values.map(v=>v.clone()),control=createSilverToneControl();
 control.apply(material,1);
 for(let frame=0;frame<120;frame++)control.apply(material,1);
 values.forEach((value,i)=>{
  assert.ok(value.distanceTo(base[i].clone().multiplyScalar(SILVER_TONES[i]))<1e-12);
  assert.ok(SILVER_TONES[i]>=.78&&SILVER_TONES[i]<=1);
  assert.ok(Math.abs(value.x/value.z-base[i].x/base[i].z)<1e-12);
 });
 assert.deepEqual(values[2],base[2]);assert.deepEqual(values[13],base[13]);
 control.apply(material,.5);
 values.forEach((value,i)=>assert.ok(value.distanceTo(base[i].clone().multiplyScalar((1+SILVER_TONES[i])*.5))<1e-12));
 control.dispose();assert.deepEqual(values,base);material.dispose();
});

test('restoration protects final eye, material replacement and cleanup without touching unrelated uniforms',()=>{
 const a=make(),b=make(),baseA=a.uniforms.uLighting.value.map(v=>v.clone()),baseB=b.uniforms.uLighting.value.map(v=>v.clone());
 a.uniforms.uTime={value:12};const control=createSilverToneControl();
 control.apply(a,1);control.apply(b,1);assert.deepEqual(a.uniforms.uLighting.value,baseA);
 control.apply(b,0);assert.deepEqual(b.uniforms.uLighting.value,baseB);assert.equal(a.uniforms.uTime.value,12);
 for(const phase of ['intro','corridor','page','logoDone'])assert.equal(silverToneAmount(phase,30),0);
 assert.equal(silverToneAmount('logoReveal',34),1);assert.equal(silverToneAmount('logoReveal',145),0);
 control.apply(a,1);control.dispose();assert.deepEqual(a.uniforms.uLighting.value,baseA);a.dispose();b.dispose();
});
