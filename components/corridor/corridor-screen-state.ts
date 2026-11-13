/** Corridor display walls: pure panel/arc/transition logic (no Three.js objects). */
export const SCREEN_WALL={
  split:30.1,         // arc where the projector floor ends: small panels beside it, one big screen per wall after
  smallPanels:6,      // small panels beside the projector floor
  bottom:.3,          // small panels: plinth top, world y
  top:7.46,           // small panels: just below the existing roof datum at y 7.68
  litTop:20,          // big screen: lit display top (user-marked level); its glass fills the whole wall
  openSeconds:1.05,   // centre line, vertical opening and settle
  stagger:.14,        // per-screen random start delay
  triggerInset:.15,   // fraction of a small panel the camera passes before a screen powers on
} as const;
/** Arc length of one small panel. Screen k < smallPanels is small; the last screen is the big one. */
export const SMALL_PANEL=SCREEN_WALL.split/SCREEN_WALL.smallPanels;
export const SCREEN_COUNT=SCREEN_WALL.smallPanels+1;
/** Arc where screen k begins. */
export const screenStart=(k:number)=>Math.min(k,SCREEN_WALL.smallPanels)*SMALL_PANEL;

/** Mid-corridor stop, by route arc from the theatre stop. The camera keeps facing down the
 *  corridor and looks up a little over the last `approach` units of travel. */
export const CORRIDOR_STOP={arc:132,yaw:0,pitch:5,approach:34} as const;
/** The original two film areas: rocket farther away, car nearer the corridor stop.
 *  Transparent films sit directly on the lit wall, without black display backdrops. */
export const FEATURE_DISPLAYS=[
  {arc:CORRIDOR_STOP.arc-36,width:16,bottom:.4,top:11.4,bezel:0},
  {arc:CORRIDOR_STOP.arc-18,width:16,bottom:.4,top:11.4,bezel:0},
] as const;

/** Phases where the camera is in the corridor and may switch panels on. */
const LIVE=new Set(['screens','screensDone','corridor','panel','page','pageReturnLoading']);

/** Arc length of the nearest point on an xz polyline; extends linearly past both ends. */
export function createArcProjector(points:readonly (readonly [number,number])[]){
  const lengths=[0];
  const segments=points.slice(0,-1).map(([x,z],i)=>{
    const dx=points[i+1][0]-x,dz=points[i+1][1]-z,length=Math.hypot(dx,dz);
    lengths.push(lengths[i]+length);
    return {x,z,dx,dz,lengthSquared:dx*dx+dz*dz||1e-9};
  });
  const last=points.length-2;
  return {
    length:lengths[lengths.length-1],
    /** Returns [arc, distance, segment, t]. */
    project(x:number,z:number):[number,number,number,number]{
      let best=Infinity,segment=0,param=0;
      for(let i=0;i<=last;i++){
        const edge=segments[i],dx=x-edge.x,dz=z-edge.z;
        let t=(dx*edge.dx+dz*edge.dz)/edge.lengthSquared;
        if(i>0)t=Math.max(0,t);if(i<last)t=Math.min(1,t);
        const rx=dx-edge.dx*t,rz=dz-edge.dz*t,d=rx*rx+rz*rz;
        if(d<best){best=d;segment=i;param=t;}
      }
      const arc=segments.length?lengths[segment]+param*Math.sqrt(segments[segment].lengthSquared):0;
      return [arc,Math.sqrt(best),segment,param];
    },
    /** Centreline xz point at an arc length (clamped). */
    point(arc:number):[number,number]{
      let i=0;while(i<last&&lengths[i+1]<arc)i++;
      const len=lengths[i+1]-lengths[i]||1e-9,t=Math.max(0,Math.min(1,(arc-lengths[i])/len));
      return [points[i][0]+(points[i+1][0]-points[i][0])*t,points[i][1]+(points[i+1][1]-points[i][1])*t];
    },
  };
}

const hash=(i:number,side:number)=>{const v=Math.sin(i*127.1+side*311.7)*43758.5453;return v-Math.floor(v);};

/** Per-screen power state for both walls. `values` is uploaded as a 2-row float texture. */
export function createScreenPanels(count:number=SCREEN_COUNT){
  const values=new Float32Array(count*2),starts=new Float64Array(count*2).fill(Infinity);
  let clock=0,dirty=true;
  return {
    count,values,
    get dirty(){return dirty;},
    clean(){dirty=false;},
    reset(){if(starts.some(Number.isFinite)||values.some(v=>v>0)){starts.fill(Infinity);values.fill(0);dirty=true;}},
    /** Phones: every panel held at one steady value, with no per-panel opening. */
    setAll(value:number){if(values.some(v=>v!==value)){values.fill(value);dirty=true;}},
    /** cameraArc is relative to panel zero. Returns true while any panel is still animating. */
    advance(phase:string,cameraArc:number,inside:boolean,seconds:number,reduce:boolean){
      if(!LIVE.has(phase)&&phase!=='logoReveal'&&phase!=='logoDone'){this.reset();return false;}
      clock+=Math.max(0,Math.min(.05,seconds));
      if(LIVE.has(phase)&&inside){
        for(let side=0;side<2;side++)for(let i=0;i<count&&cameraArc>=screenStart(i)+SCREEN_WALL.triggerInset*SMALL_PANEL;i++){
          const k=side*count+i;if(Number.isFinite(starts[k]))continue;
          starts[k]=clock+(reduce?-SCREEN_WALL.openSeconds:hash(i,side)*SCREEN_WALL.stagger);
        }
      }
      let animating=false;
      for(let k=0;k<values.length;k++){
        if(!Number.isFinite(starts[k]))continue;
        const value=Math.max(0,Math.min(1,(clock-starts[k])/SCREEN_WALL.openSeconds));
        if(value!==values[k]){values[k]=value;dirty=true;}
        if(value<1)animating=true;
      }
      return animating;
    },
  };
}

/** Lit fraction of a display's height for power p: matches the shader's vertical opening. */
export function displayOpen(p:number){
  if(p<=0)return 0;
  const open=Math.max(0,Math.min(1,(p-.14)/.62));
  return 1-(1-open)**3;
}

/** Power of the two feature displays (0..1 opening progress). They stay on while the camera is in the corridor. */
export function createDisplayPower(){
  const values=[0,0],starts=[Infinity,Infinity];let clock=0;
  return {
    values,
    reset(){starts.fill(Infinity);values.fill(0);},
    /** routeArc is the camera's absolute route arc; `stopped` once the camera rests at the stop or beyond. */
    advance(phase:string,routeArc:number,stopped:boolean,seconds:number,reduce:boolean){
      if(!LIVE.has(phase)&&phase!=='logoReveal'&&phase!=='logoDone'){this.reset();return false;}
      clock+=Math.max(0,Math.min(.05,seconds));
      if(LIVE.has(phase))FEATURE_DISPLAYS.forEach((display,k)=>{
        if(starts[k]!==Infinity)return;
        if(k===0?routeArc>=display.arc-display.width/2:stopped)starts[k]=reduce?-Infinity:clock;
      });
      let animating=false;
      starts.forEach((start,k)=>{if(start===Infinity)return;values[k]=Math.min(1,(clock-start)/SCREEN_WALL.openSeconds);if(values[k]<1)animating=true;});
      return animating;
    },
  };
}

const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};

/** Leaving the corridor: panels close back to their centre line, then the
 *  approved baked wall returns well before View 1 (slide .985). */
export function screenTransition(phase:string,stage:string,progress:number){
  if(phase==='logoDone')return {off:1,baked:1};
  if(phase!=='logoReveal')return {off:0,baked:0};
  if(stage!=='slide')return {off:1,baked:1};
  return {off:smooth(.04,.36,progress),baked:smooth(.34,.6,progress)};
}
