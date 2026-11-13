export const CINEMA_GLASSES='/models/cinema-glasses-slim.glb?v=slim-touching-4';
/** Where the viewer's glasses are: 0 worn, 1 lifted clear of the view. One eased move at a time. */
const listeners=new Set<()=>void>();
const smooth=(t:number)=>t*t*t*(t*(t*6-15)+10);
export const GLASSES_MOVE_SECONDS=1.25;
export const cinemaGlasses={
  position:0,from:0,target:0,elapsed:0,last:0,
  subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
  /** 1 lifts the glasses off, 0 puts them on. */
  toggle(target:number,reduce=false){
    if(target===this.target&&this.position===target)return;
    this.from=this.position;this.target=target;this.elapsed=reduce?GLASSES_MOVE_SECONDS:0;this.last=performance.now();
    listeners.forEach(listener=>listener());
  },
  /** Advances the move; returns true while it is still travelling. */
  tick(now:number){
    if(this.position===this.target){this.last=now;return false;}
    this.elapsed+=Math.min(.05,Math.max(0,(now-this.last)/1000));this.last=now;
    const t=Math.min(1,this.elapsed/GLASSES_MOVE_SECONDS);
    this.position=t===1?this.target:this.from+(this.target-this.from)*smooth(t);
    return t<1;
  },
};
