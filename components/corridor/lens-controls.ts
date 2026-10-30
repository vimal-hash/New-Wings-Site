export type LensTarget='view1'|'brand';
export const LENS_LABELS={view1:'View 1',brand:'White brand section'} as const;
export const LENS_RANGES={fov:[22,65,.5],squeeze:[.75,1.6,.01],parallax:[0,2,.05],sway:[0,1,.01],response:[.06,1,.01],roll:[0,1,.01],depth:[0,2,.05]} as const;
export type LensNumber=keyof typeof LENS_RANGES;
export type LensValues=Record<LensNumber,number>&{enabled:boolean;living:boolean};
export const LENS_DEFAULTS:Readonly<LensValues>=Object.freeze({enabled:true,living:true,fov:40,squeeze:1,parallax:.45,sway:.08,response:.28,roll:.12,depth:1});
export const LENS_PRESETS:Readonly<Record<LensTarget,Readonly<LensValues>>>=Object.freeze({view1:Object.freeze({...LENS_DEFAULTS,fov:65,squeeze:1.05}),brand:LENS_DEFAULTS});
export const LENS_STORAGE_VERSION=2;
type StorageLike=Pick<Storage,'getItem'|'setItem'>;
const fresh=()=>({view1:{...LENS_PRESETS.view1},brand:{...LENS_PRESETS.brand}});
const initial={presets:fresh(),loaded:false};
export function cleanLensValues(input:unknown,defaults:Readonly<LensValues>=LENS_DEFAULTS):LensValues{
  const out={...defaults};if(!input||typeof input!=='object')return out;
  const source=input as Record<string,unknown>;
  for(const key of Object.keys(LENS_RANGES) as LensNumber[]){const value=source[key];if(typeof value==='number'&&Number.isFinite(value))out[key]=Math.max(LENS_RANGES[key][0],Math.min(LENS_RANGES[key][1],value));}
  for(const key of ['enabled','living'] as const)if(typeof source[key]==='boolean')out[key]=source[key];
  return out;
}
export function createLensControls(){
  let state={presets:fresh(),loaded:false};const listeners=new Set<()=>void>();
  const publish=()=>listeners.forEach(listener=>listener());
  return {
    read:()=>state,serverRead:()=>initial,
    subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
    set(target:LensTarget,key:keyof LensValues,value:number|boolean){state={...state,presets:{...state.presets,[target]:cleanLensValues({...state.presets[target],[key]:value},LENS_PRESETS[target])}};publish();},
    reset(target:LensTarget){state={...state,presets:{...state.presets,[target]:{...LENS_PRESETS[target]}}};publish();},
    load(storage:StorageLike){const presets=fresh();try{const raw=JSON.parse(storage.getItem('eye-lens-controls-v1')||'null');if(raw?.version===1||raw?.version===LENS_STORAGE_VERSION)for(const key of ['view1','brand'] as const){presets[key]=cleanLensValues(raw.presets?.[key],LENS_PRESETS[key]);if(raw.version===1&&key==='view1'){presets[key].fov=65;presets[key].squeeze=1.05;}}}catch{/* Browser persistence is optional. */}state={presets,loaded:true};publish();},
    export(){return {version:LENS_STORAGE_VERSION,presets:state.presets};},
    save(storage:StorageLike){try{storage.setItem('eye-lens-controls-v1',JSON.stringify(this.export()));return true;}catch{return false;}},
  };
}
export const lensControls=createLensControls();
