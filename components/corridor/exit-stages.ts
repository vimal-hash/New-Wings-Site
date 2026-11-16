import { revealScrollTarget, settleReveal } from "./reveal-scroll";
export type ExitStage = "slide" | "top" | "turn" | "turned" | "pullback" | "done";
/** View 1 is the top of the climb. Coming back from the page sections the camera holds there this long, then turns to
 *  View 2 by itself (the user, 2026-11-16: no scroll for the turn). */
export const TOP_HOLD=1;
/** The slide flows into the turn; a fresh gesture starts the final pullback. */
export function createExitStages() {
  let stage: ExitStage="slide",progress=0,target=0,elapsed=0,lastInput=-Infinity,wokeAt=-Infinity,autoTurn=false;
  return {
    reset(seed=0,start=0){stage="slide";progress=Math.min(1,start);target=Math.min(1,seed);elapsed=0;lastInput=-Infinity;wokeAt=-Infinity;autoTurn=false;},
    // Temporary review shortcuts; scrolling continues from the selected stop. View 1 rests at the top (no automatic turn).
    preview(view:"slide"|"turned"|"done"){stage=view==="slide"?"top":view;progress=target=1;elapsed=0;lastInput=-Infinity;wokeAt=-Infinity;autoTurn=false;},
    /** The return from the page sections has reached the top: hold, then turn to View 2 without any input. */
    arrive(){stage="top";progress=target=1;elapsed=0;wokeAt=-Infinity;autoTurn=true;},
    input(delta:number,now:number,height:number){
      const fresh=now-lastInput>=220;lastInput=now;
      if(stage==="slide"){
        if(progress===target)wokeAt=now;
        target=revealScrollTarget(target,delta,height);
      }
      else if(delta>0 && fresh){
        // The hold and the automatic turn ignore input, so nothing is skipped.
        if(stage==="top"&&!autoTurn){stage="turn";elapsed=0;progress=0;wokeAt=now;}
        else if(stage==="turned"){stage="pullback";elapsed=0;progress=0;wokeAt=now;}
      }
    },
    tick(seconds:number,now:number,reduce=false){
      // The first demand frame may arrive after seconds of resting. Only time
      // since the input that woke this shot belongs to its animation clock.
      seconds=Math.min(seconds,Math.max(0,(now-wokeAt)/1000));wokeAt=-Infinity;
      if(stage==="slide"){
        progress=reduce?target:settleReveal(progress,target,seconds);
        // sampleSlide(1) and sampleTurn(0) are the identical camera pose.
        // No idle frame, timeout or extra gesture at this boundary.
        if(progress===1){stage="turn";progress=0;elapsed=0;}
      } else if(stage==="top"&&autoTurn){
        // The turn begins exactly at the end of the hold; any time past it already belongs to the turn.
        elapsed+=seconds;
        if(elapsed>=TOP_HOLD){stage="turn";progress=0;autoTurn=false;elapsed-=TOP_HOLD;progress=reduce?1:Math.min(1,elapsed/1.4);if(progress===1)stage="turned";}
      } else if(stage==="turn" || stage==="pullback"){
        elapsed+=seconds;progress=reduce?1:Math.min(1,elapsed/(stage==="turn"?1.4:4.5));
        if(progress===1)stage=stage==="turn"?"turned":"done";
      }
      return {stage,progress,moving:stage==="turn"||stage==="pullback"||(stage==="slide"&&progress!==target)||(stage==="top"&&autoTurn)};
    },
  };
}


