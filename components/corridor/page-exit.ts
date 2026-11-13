/** Four native viewport sections; fractional mobile scroll positions count as the bottom. */
export function pageAtBottom(scrollTop:number,scrollHeight:number,clientHeight:number){
  return clientHeight>0&&scrollHeight>clientHeight+2&&scrollHeight-clientHeight-scrollTop<=2;
}

export const PAGE_LAST_COLOUR='#bbc5cf';
const unit=(x:number)=>Math.max(0,Math.min(1,x));
const ease=(x:number)=>{const t=unit(x);return t*t*t*(t*(t*6-15)+10);};
const COVER_LEAD=.4;
/** The return to View 1 used to be a sub-second dash; this floor keeps it a slow glide. */
export const RETURN_TRAVEL_MIN=3.4;
const COVER_SECONDS=1.35;
/** One clock for the retreating section and the overlapping camera move. */
export function createPageReturn(){
  let elapsed=0;
  const initial={scale:1,opacity:1,copy:1,glow:0,travel:0,moving:true};
  let shot=initial;
  return {
    prepared:false,
    warming:false,
    reset(){elapsed=0;shot=initial;this.prepared=false;this.warming=false;},
    read(){return shot;},
    tick(delta:number,authored:number,reduced=false){
      const travelSeconds=Math.max(RETURN_TRAVEL_MIN,authored),total=COVER_LEAD+travelSeconds;
      elapsed=reduced?total:Math.min(total,elapsed+Math.min(.05,Math.max(0,delta)));
      const cover=elapsed/Math.min(COVER_SECONDS,total);
      const travel=elapsed===total?1:unit((elapsed-COVER_LEAD)/travelSeconds);
      shot={
        scale:1/(1+2.8*ease(cover)),
        opacity:1-ease((cover-.24)/.76),
        copy:1-ease(cover/.48),
        glow:Math.sin(Math.PI*unit(cover))**2,
        travel,
        moving:travel<1,
      };
      return shot;
    },
  };
}
export const pageReturn=createPageReturn();
