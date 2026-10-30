/** Transient transition values; no React updates while scrolling. */
const frames=new Set<()=>void>(),layouts=new Set<()=>void>();
export const diagonalTransition={
  progress:0,
  pupilDiameter:0,
  setProgress(value:number){
    if(value===this.progress)return;
    this.progress=value;frames.forEach(listener=>listener());
  },
  setPupilDiameter(value:number){
    if(Math.abs(value-this.pupilDiameter)<.01)return;
    this.pupilDiameter=value;layouts.forEach(listener=>listener());
  },
  subscribe(listener:()=>void){frames.add(listener);return()=>{frames.delete(listener);};},
  subscribeLayout(listener:()=>void){layouts.add(listener);return()=>{layouts.delete(listener);};},
};

/** A restrained approach, complete before the white section finishes taking over. */
export function diagonalEyeZoom(progress:number){
  const t=Math.max(0,Math.min(1,progress/.8));
  return 1+.10*t*t*t*(t*(t*6-15)+10);
}
