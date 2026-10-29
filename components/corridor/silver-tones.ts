import {ShaderMaterial,Vector3} from 'three';

// A gentle, fixed light pattern on the existing 4 x 4 iris lighting lattice.
// Top/bottom shoulders darken; the two crest samples keep their original level.
// Every factor is <= 1: this cannot introduce a brighter highlight or iris glow.
export const SILVER_TONES=[
  .90,.96,1,.90,
  .78,.84,.94,.83,
  .83,.94,.84,.78,
  .90,1,.96,.90,
] as const;

export function silverToneAmount(phase:string,height:number){
  if(phase!=='logoReveal')return 0;
  const t=Math.max(0,Math.min(1,(height-45)/100));
  return 1-t*t*(3-2*t);
}

/** Borrow only the mounted iris's light uniforms; preserve its shader, LUT and buffers. */
export function createSilverToneControl(){
  let owner:ShaderMaterial|null=null,baseline:Vector3[]=[],lastAmount=-1;
  function restore(){
    const current=owner?.uniforms.uLighting?.value;
    if(Array.isArray(current)&&current.length===baseline.length)baseline.forEach((value,i)=>current[i].copy(value));
    owner=null;baseline=[];lastAmount=-1;
  }
  function apply(material:ShaderMaterial|null,amount:number){
    amount=Math.max(0,Math.min(1,amount));
    if(!material||amount===0){restore();return;}
    if(owner!==material){
      restore();
      const values=material.uniforms.uLighting?.value;
      if(!Array.isArray(values)||values.length!==16||!values.every(value=>value instanceof Vector3))return;
      owner=material;baseline=values.map(value=>value.clone());
    }
    if(lastAmount===amount)return;
    const values=material.uniforms.uLighting.value as Vector3[];
    baseline.forEach((value,i)=>values[i].copy(value).multiplyScalar(1-amount*(1-SILVER_TONES[i])));
    lastAmount=amount;
  }
  return {apply,dispose:restore};
}
