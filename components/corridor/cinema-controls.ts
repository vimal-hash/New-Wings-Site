/** Temporary, removable eye-look presets. No camera or particle data lives here. */
export const CINEMA_STORAGE_KEY='eye-cinema-tuning-v1';
export const CINEMA_STORAGE_VERSION=2;
export const CINEMA_STOPS=['view1','view2','final'] as const;
export type CinemaStop=typeof CINEMA_STOPS[number];
export const CINEMA_LABELS={view1:'View 1 · silver dune',view2:'View 2 · diagonal stream',final:'Final eye'} as const;
export const CINEMA_RANGES={
  starBloom:[0,1.5,.01],starRadius:[0,1,.01],heroBloom:[0,1.5,.01],heroRadius:[0,1,.01],
  logoGlow:[0,2,.01],logoPeak:[0,6,.05],rayStrength:[0,2,.01],particleReaction:[0,3,.01],
  nebulaStrength:[0,3,.01],pools:[0,.8,.01],contrast:[0,.6,.01],shadowToe:[0,.18,.001],
  silver:[0,1,.01],shadowCool:[0,.5,.01],vignette:[0,.6,.005],grain:[0,3,.05],
  focusDistance:[.1,6000,.1],focusRange:[.1,3000,.1],bokeh:[0,12,.1],
} as const;
export type CinemaNumber=keyof typeof CINEMA_RANGES;
export type CinemaValues=Record<CinemaNumber,number>&{post:boolean;grade:boolean;bloom:boolean;dof:boolean;autofocus:boolean;gradeMix?:number;autofocusMix?:number};
export const CINEMA_DEFAULTS:Readonly<CinemaValues>=Object.freeze({
  post:true,grade:true,bloom:true,dof:false,autofocus:true,
  starBloom:.24,starRadius:.35,heroBloom:.58,heroRadius:.65,logoGlow:1,logoPeak:1.8,rayStrength:1,particleReaction:1.3,
  nebulaStrength:1,pools:.20,contrast:.12,shadowToe:.028,silver:.55,shadowCool:.12,vignette:.105,grain:1,
  focusDistance:600,focusRange:120,bokeh:4,
});
type Presets=Record<CinemaStop,CinemaValues>;
type Snapshot={presets:Presets;baseline:boolean;loaded:boolean};
type StorageLike=Pick<Storage,'getItem'|'setItem'>;
/** Promoted directly from the user's three approved panel screenshots. */
export const CINEMA_APPROVED={
  view1:{dof:true,autofocus:false,focusDistance:3000,focusRange:3000,bokeh:4},
  view2:{dof:true,autofocus:false,focusDistance:2070,focusRange:2800,bokeh:12},
  final:{bloom:true,heroBloom:.58,heroRadius:.65,logoGlow:1,logoPeak:1,rayStrength:1,particleReaction:1.5},
} as const;
export const CINEMA_PRESETS:Readonly<Record<CinemaStop,Readonly<CinemaValues>>>=Object.freeze({
  view1:Object.freeze({...CINEMA_DEFAULTS,...CINEMA_APPROVED.view1}),
  view2:Object.freeze({...CINEMA_DEFAULTS,...CINEMA_APPROVED.view2}),
  final:Object.freeze({...CINEMA_DEFAULTS,...CINEMA_APPROVED.final}),
});
const fresh=():Presets=>({view1:{...CINEMA_PRESETS.view1},view2:{...CINEMA_PRESETS.view2},final:{...CINEMA_PRESETS.final}});
const initial:Snapshot={presets:fresh(),baseline:false,loaded:false};
const numeric=Object.keys(CINEMA_RANGES) as CinemaNumber[];
const flags=['post','grade','bloom','dof','autofocus'] as const;

export function cleanCinemaValues(input:unknown,defaults:Readonly<CinemaValues>=CINEMA_DEFAULTS):CinemaValues{
  const result={...defaults};
  if(!input||typeof input!=='object')return result;
  const values=input as Record<string,unknown>;
  for(const key of numeric){const value=values[key];if(typeof value==='number'&&Number.isFinite(value))result[key]=Math.max(CINEMA_RANGES[key][0],Math.min(CINEMA_RANGES[key][1],value));}
  for(const key of flags)if(typeof values[key]==='boolean')result[key]=values[key];
  return result;
}

export function createCinemaControls(){
  let state:Snapshot={...initial,presets:fresh()};const listeners=new Set<()=>void>();
  const publish=(next:Snapshot)=>{state=next;listeners.forEach(fn=>fn());};
  return {
    read:()=>state,serverRead:()=>initial,
    subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},
    set(stop:CinemaStop,key:keyof CinemaValues,value:number|boolean){
      const preset=cleanCinemaValues({...state.presets[stop],[key]:value},CINEMA_PRESETS[stop]);
      publish({...state,presets:{...state.presets,[stop]:preset}});
    },
    baseline(value:boolean){publish({...state,baseline:value});},
    reset(stop:CinemaStop){publish({...state,presets:{...state.presets,[stop]:{...CINEMA_PRESETS[stop]}}});},
    resetAll(){publish({...state,presets:fresh(),baseline:false});},
    load(storage:StorageLike){
      const presets=fresh();
      try{const raw=storage.getItem(CINEMA_STORAGE_KEY);if(raw){const parsed=JSON.parse(raw);if((parsed.version===1||parsed.version===CINEMA_STORAGE_VERSION)&&parsed.presets)for(const stop of CINEMA_STOPS){
        const draft=cleanCinemaValues(parsed.presets[stop],CINEMA_PRESETS[stop]);
        // Promote only the requested fields once; retain unrelated colour/star drafts.
        presets[stop]=parsed.version===1?{...draft,...CINEMA_APPROVED[stop]}:draft;
      }}}
      catch{/* A blocked/corrupt browser store must not prevent the scene loading. */}
      publish({presets,baseline:false,loaded:true});
    },
    export(){return JSON.stringify({version:CINEMA_STORAGE_VERSION,presets:state.presets},null,2);},
    save(storage:StorageLike){try{storage.setItem(CINEMA_STORAGE_KEY,this.export());return true;}catch{return false;}},
  };
}
export const cinemaControls=createCinemaControls();

/** Authored shot progress only. FullJourney writes this without React updates. */
export const cinemaShot={stage:'slide',progress:0};
export function cinemaStopFor(phase:string,stage:string):CinemaStop{
  if(phase==='logoDone'||stage==='done')return 'final';
  return stage==='turn'||stage==='turned'||stage==='pullback'?'view2':'view1';
}
const smooth=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
/** Direct shot-based blending; no lag, new animation or camera changes. */
export function resolveCinemaValues(snapshot:Snapshot,stage:string,progress:number,out:CinemaValues):CinemaValues{
  const start=stage==='turn'?'view1':stage==='pullback'?'view2':stage==='done'?'final':stage==='turned'?'view2':'view1';
  const end=stage==='turn'?'view2':stage==='pullback'?'final':start,t=smooth(progress);
  const presets=snapshot.baseline?CINEMA_PRESETS:snapshot.presets;
  const a=presets[start],b=presets[end];
  for(const key of numeric)out[key]=a[key]+(b[key]-a[key])*t;
  for(const key of flags)out[key]=t<.5?a[key]:b[key];
  // Optional effects enter/leave continuously along the authored camera travel.
  const mix=(a:number,b:number)=>a+(b-a)*t;
  out.post=a.post||b.post;out.bloom=(a.post&&a.bloom)||(b.post&&b.bloom);out.grade=(a.post&&a.grade)||(b.post&&b.grade);
  out.starBloom=mix(a.post&&a.bloom?a.starBloom:0,b.post&&b.bloom?b.starBloom:0);
  out.heroBloom=mix(a.post&&a.bloom?a.heroBloom:0,b.post&&b.bloom?b.heroBloom:0);
  out.gradeMix=mix(a.post&&a.grade?1:0,b.post&&b.grade?1:0);
  out.dof=(t<1&&a.post&&a.dof)||(t>0&&b.post&&b.dof);
  out.bokeh=mix(a.post&&a.dof?a.bokeh:0,b.post&&b.dof?b.bokeh:0);
  out.autofocus=a.autofocus||b.autofocus;out.autofocusMix=mix(a.autofocus?1:0,b.autofocus?1:0);
  return out;
}
