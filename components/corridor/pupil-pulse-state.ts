import {Vector3} from 'three';

/** Trace starts one second before settle and hands directly to the first release. */
export const PUPIL_PULSE={pause:0,traceLead:1,trace:1.65,hold:0,attack:.10,decay:.9,flashGain:1.8,travel:5,tail:.8,interval:2,width:.26,rayWidth:.016,borderWidth:9,bloomGain:.58,bloomRadius:.65} as const;
export const PUPIL_GLOW={core:[.92,.98,1],halo:[.42,.76,1]} as const;
export const PULSE_RELEASE=PUPIL_PULSE.pause+PUPIL_PULSE.trace+PUPIL_PULSE.hold;
export const PULSE_END=PULSE_RELEASE+PUPIL_PULSE.travel+PUPIL_PULSE.tail;
export const PULSE_CYCLE=PUPIL_PULSE.interval;
export const PUPIL_WAVE_SLOTS=3;
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(x:number)=>{const t=clamp(x);return t*t*(3-2*t);};

export function samplePupilPulse(seconds:number,flashGain:number=PUPIL_PULSE.flashGain){
  const t=Math.max(0,seconds),trace=smooth((t-PUPIL_PULSE.pause)/PUPIL_PULSE.trace),age=t-PULSE_RELEASE;
  const flash=age<0?0:(1-Math.exp(-age/PUPIL_PULSE.attack))*Math.exp(-age/PUPIL_PULSE.decay)*1.34;
  const wave=age<0?0:1-smooth((age-PUPIL_PULSE.travel)/PUPIL_PULSE.tail);
  const borderBase=1.25+(.075-1.25)*smooth((age-1.4)/2);
  // Only the launch flash is restrained; the completed trace and ray energy stay intact.
  return {trace,flash,border:t>=PUPIL_PULSE.pause?borderBase+flash*flashGain:0,
    travel:clamp(age/PUPIL_PULSE.travel),wave,moving:t<PULSE_END};
}

/** Each release has its own age/radius/tail; new releases never reset older fronts. */
export function samplePupilFronts(seconds:number){
  const elapsed=Math.max(0,seconds)-PULSE_RELEASE;
  if(elapsed<0)return [];
  const cycle=Math.floor((elapsed+1e-9)/PULSE_CYCLE),latest=Math.max(0,elapsed-cycle*PULSE_CYCLE);
  return Array.from({length:Math.min(PUPIL_WAVE_SLOTS,cycle+1)},(_,index)=>{
    const age=latest+index*PULSE_CYCLE;
    return {age,travel:clamp(age/PUPIL_PULSE.travel),strength:age>=PUPIL_PULSE.travel+PUPIL_PULSE.tail?0:1-smooth((age-PUPIL_PULSE.travel)/PUPIL_PULSE.tail)};
  });
}

/** One continuous border trace, then overlapping complete waves every two seconds. */
export function samplePupilLoop(seconds:number,flashGain:number=PUPIL_PULSE.flashGain){
  const t=Math.max(0,seconds);
  const fronts=samplePupilFronts(t),cycle=Math.max(0,Math.floor((t-PULSE_RELEASE+1e-9)/PULSE_CYCLE));
  const pulse=samplePupilPulse(t<PULSE_RELEASE?t:PULSE_RELEASE+(fronts[0]?.age??0),flashGain);
  let border=t<PULSE_RELEASE?pulse.border:.075,flash=0,wave=0;
  fronts.forEach((front,index)=>{
    const envelope=samplePupilPulse(PULSE_RELEASE+front.age,flashGain);
    // Earlier emission envelopes continue under the new attack: no hard drop or accumulated overexposure.
    const rise=cycle===index?1:smooth(front.age/PUPIL_PULSE.attack);
    border=Math.max(border,.075+(envelope.border-.075)*rise);
    flash=Math.max(flash,envelope.flash);wave=Math.max(wave,front.strength);
  });
  return {...pulse,border,flash,wave,moving:true,cycle,fronts};
}

/** Existing pullback is 4.5 seconds; use its raw progress without another clock. */
export function samplePupilPreTrace(stage:string,progress:number){
  if(stage!=='pullback')return null;
  const elapsed=Math.max(0,Math.min(1,progress))*4.5-(4.5-PUPIL_PULSE.traceLead);
  if(elapsed<-1e-9)return null;
  return {trace:smooth(Math.max(0,elapsed)/PUPIL_PULSE.trace),border:1.25,flash:0,wave:0,travel:0,moving:false,cycle:0,fronts:[] as ReturnType<typeof samplePupilFronts>};
}

/** Visible final waves animate continuously; hidden time is never charged to the clock. */
export function createPupilPulseClock(){
  let elapsed=0,last:number|null=null,entered=false;
  const still=(gain:number)=>({...samplePupilPulse(PULSE_END,gain),wave:0,flash:0,border:.075,moving:false,cycle:0,fronts:[] as ReturnType<typeof samplePupilFronts>});
  return {restart(){elapsed=0;last=null;entered=false;},pause(){last=null;},tick(active:boolean,now:number,hidden=false,reduce=false,flashGain:number=PUPIL_PULSE.flashGain,initialSeconds=0){
    if(!active){elapsed=0;last=null;entered=false;return null;}
    if(hidden){last=null;return still(flashGain);}
    // Continue the trace already shown during the pullback, on this same clock.
    if(!entered){entered=true;last=now;elapsed=Math.max(0,initialSeconds);}
    if(reduce)elapsed=PULSE_END;
    else if(last!==null)elapsed+=Math.min(.05,Math.max(0,(now-last)/1000));
    last=now;
    return reduce?still(flashGain):samplePupilLoop(elapsed,flashGain);
  }};
}

export const pupilPulseUniforms={
  uHeroOrigin:{value:new Vector3()},uHeroRadius:{value:0},uHeroWidth:{value:80},uHeroStrength:{value:0},
  uHeroTrace:{value:0},uHeroBorder:{value:0},uHeroRight:{value:new Vector3(1,0,0)},uHeroUp:{value:new Vector3(0,0,-1)},
  uHeroCore:{value:new Vector3(...PUPIL_GLOW.core)},uHeroHalo:{value:new Vector3(...PUPIL_GLOW.halo)},
  uHeroRayWidth:{value:3},
  uHeroRayGain:{value:1},
  uHeroRadii:{value:new Vector3()},uHeroWaves:{value:new Vector3()},
};
export function resetPupilPulse(){pupilPulseUniforms.uHeroStrength.value=0;pupilPulseUniforms.uHeroTrace.value=0;pupilPulseUniforms.uHeroBorder.value=0;pupilPulseUniforms.uHeroRadii.value.setScalar(0);pupilPulseUniforms.uHeroWaves.value.setScalar(0);}

/** Same 3D wavefront in the ray, grain lighting and HDR extraction. */
export const HERO_WAVE_GLSL=/* glsl */`
uniform vec3 uHeroOrigin;
uniform vec3 uHeroRadii,uHeroWaves;
uniform float uHeroRadius,uHeroWidth,uHeroStrength;
float heroWave(float distanceFromPupil){
  float received=0.;
  for(int i=0;i<3;i++){
    float behind=(uHeroRadii[i]-distanceFromPupil)/max(.001,uHeroWidth);
    received=max(received,smoothstep(-.23,.02,behind)*exp(-max(0.,behind)*1.8)*uHeroWaves[i]);
  }
  return received;
}`;

/** CPU reference for spatial regression tests. Distance includes authored depth. */
export function pupilWaveAt(distance:number,radius:number,width:number,strength=1){
  const behind=(radius-distance)/width;
  return smooth((behind+.23)/.25)*Math.exp(-Math.max(0,behind)*1.8)*strength;
}
