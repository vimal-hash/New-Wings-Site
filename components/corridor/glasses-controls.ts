export const GLASSES_DEFAULTS={distance:8,width:80,gap:8,blur:40,tint:.55,bridge:1,lockWidth:false};
export type GlassesValues=typeof GLASSES_DEFAULTS;
export const GLASSES_RANGES={distance:[8,80,1],width:[40,140,1],gap:[2,100,1],blur:[0,40,1],tint:[0,.8,.01],bridge:[.05,1,.01]} as const;
let values={...GLASSES_DEFAULTS};const listeners=new Set<()=>void>();const key='cinema-glasses-v1';
export const glassesControls={
 read:()=>values,serverRead:()=>GLASSES_DEFAULTS,
 subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},
 set(field:keyof GlassesValues,value:number|boolean){
  if(field==='lockWidth'){if(typeof value!=='boolean')return;values={...values,lockWidth:value};}
  else{if(typeof value!=='number'||!Number.isFinite(value))return;const [min,max]=GLASSES_RANGES[field];values={...values,[field]:Math.max(min,Math.min(max,value))};}
  listeners.forEach(fn=>fn());
 },
 reset(){values={...GLASSES_DEFAULTS};listeners.forEach(fn=>fn());},
 load(storage:Pick<Storage,'getItem'>){try{const raw=storage.getItem(key);if(raw){const saved=JSON.parse(raw);for(const field of Object.keys(GLASSES_DEFAULTS) as (keyof GlassesValues)[])if(field in saved)this.set(field,saved[field]);}}catch{/* Defaults remain usable. */}},
 save(storage:Pick<Storage,'setItem'>){try{storage.setItem(key,JSON.stringify(values));return true;}catch{return false;}},
};
