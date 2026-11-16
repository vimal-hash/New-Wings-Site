/** Corridor display walls: pure panel/arc/transition logic (no Three.js objects). */
export const SCREEN_WALL={
  split:30.1,         // arc where the projector floor ends: small panels beside it, one big screen per wall after
  smallPanels:6,      // small panels beside the projector floor
  bottom:.3,          // small panels: plinth top, world y
  top:7.46,           // small panels: just below the existing roof datum at y 7.68
  litTop:28.2,        // big screen: lit to just below the wall cap (y 28.33), so the whole wall is white
  bigSections:8,      // the big screen opens part by part, like the small panels, in 8 wide sections
  bigLength:226,      // measured big-screen arc: split (30.1) to the longer wall's end (256.1)
  bigTrigger:.5,      // fraction of a big section the camera passes before it powers on
  openSeconds:1.05,   // centre line, vertical opening and settle
  stagger:.14,        // per-screen random start delay
  triggerInset:.15,   // fraction of a small panel the camera passes before a screen powers on
} as const;
/** Arc length of one small panel. Screens k < smallPanels are small; the rest are big-screen sections. */
export const SMALL_PANEL=SCREEN_WALL.split/SCREEN_WALL.smallPanels;
/** Arc length of one big-screen section (no mullion: a soft seam in the shader). */
export const BIG_SECTION=SCREEN_WALL.bigLength/SCREEN_WALL.bigSections;
export const SCREEN_COUNT=SCREEN_WALL.smallPanels+SCREEN_WALL.bigSections;
/** Arc where screen k begins. */
export const screenStart=(k:number)=>k<=SCREEN_WALL.smallPanels?k*SMALL_PANEL:SCREEN_WALL.split+(k-SCREEN_WALL.smallPanels)*BIG_SECTION;
/** Camera arc at which screen k powers on. */
export const screenTrigger=(k:number)=>screenStart(k)+(k<SCREEN_WALL.smallPanels?SCREEN_WALL.triggerInset*SMALL_PANEL:SCREEN_WALL.bigTrigger*BIG_SECTION);

/** Where the corridor walk's two legs meet (no stop), by route arc from the theatre stop. */
export const CORRIDOR_STOP={arc:132} as const;
/** Phases where the camera is in the corridor and may switch panels on. */
const LIVE=new Set(['screens','corridor','panel','page','pageReturnLoading']);

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
        for(let side=0;side<2;side++)for(let i=0;i<count&&cameraArc>=screenTrigger(i);i++){
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

const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};

/** Leaving the corridor: the panels stay open and white all the way back up to View 1 (the user, 2026-11-16: they used
 *  to close as the camera climbed the slide). They close back to their centre line early in the turn to View 2, while
 *  the camera still looks up, so View 2 and the final eye keep their approved look. The walls stay closed display glass;
 *  no baked wall texture returns. */
export function screenTransition(phase:string,stage:string,progress:number){
  if(phase==='logoDone')return {off:1};
  if(phase!=='logoReveal')return {off:0};
  // Open on the climb, the hold, the turn and at View 2 (the corridor is out of sight there); they close in the first
  // ~0.8 s of the pullback, before the camera looks down into the logo's slit, so the final eye is unchanged.
  if(stage==='pullback')return {off:smooth(0,.18,progress)};
  if(stage==='done')return {off:1};
  return {off:0};
}
