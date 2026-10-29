import { journeyControls } from "./journey-controls";
import { projectorControls } from "./projector-controls";
const queue=new Map<()=>void,number>();let timer:ReturnType<typeof setTimeout>|undefined,lastInput=0,listening=false;
const input=(event:Event)=>{if(event.type!=="pointermove"||(event as PointerEvent).buttons)lastInput=performance.now();};
// The HTML page still covers the scene during pageReturnLoading. Critical mounts
// must run here: its transition waits for projector readiness before moving.
const settled=new Set(["idle","done","screensDone","awaitAssembly","panel","logoDone","pageReturnLoading"]);
function tick(){
  timer=undefined;if(!queue.size)return;
  const fx=projectorControls.read().phase;
  const shot=journeyControls.read(),holding=shot.phase==="intro"&&!shot.openingMoving;
  const reviewing=shot.reviewCamera&&shot.phase==="logoReveal"&&(shot.revealStage==="slide"||shot.revealStage==="turned");
  if(!document.hidden&&(settled.has(shot.phase)||holding||reviewing)&&fx!=="particles"&&fx!=="assembling"&&(holding||performance.now()-lastInput>450)){
    // Only the opening's own preflight belongs in this hold. Preparing the
    // projector here can overrun it on a slower device and stall the first move.
    const next=[...queue].filter(([,priority])=>(!holding||priority<=-100)&&(priority<20||["done","screensDone","panel","logoDone","pageReturnLoading"].includes(shot.phase))).sort((a,b)=>a[1]-b[1])[0];
    if(next){queue.delete(next[0]);next[0]();}
  }
  if(queue.size)timer=setTimeout(tick,80);
}
/** Serial background work only at authored resting stops, after input settles. */
export function scheduleSceneIdle(job:()=>void,priority=0){
  if(!listening){for(const name of ["wheel","touchmove","pointerdown","pointermove"])window.addEventListener(name,input,{passive:true});listening=true;}
  queue.set(job,priority);if(!timer)timer=setTimeout(tick,80);
  return()=>{queue.delete(job);};
}
