import { revealScrollTarget, settleReveal } from "./reveal-scroll";
export type ExitStage = "slide" | "top" | "turn" | "turned" | "pullback" | "done";
/** The slide flows into the turn; a fresh gesture starts the final pullback. */
export function createExitStages() {
  let stage: ExitStage="slide",progress=0,target=0,elapsed=0,lastInput=-Infinity,wokeAt=-Infinity;
  return {
    reset(seed=0){stage="slide";progress=0;target=Math.min(1,seed);elapsed=0;lastInput=-Infinity;wokeAt=-Infinity;},
    // Temporary review shortcuts; scrolling continues from the selected stop.
    preview(view:"slide"|"turned"|"done"){stage=view;progress=target=view==="slide"?.985:1;elapsed=0;lastInput=-Infinity;wokeAt=-Infinity;},
    input(delta:number,now:number,height:number){
      const fresh=now-lastInput>=220;lastInput=now;
      if(stage==="slide"){
        if(progress===target)wokeAt=now;
        target=revealScrollTarget(target,delta,height);
      }
      else if(delta>0 && fresh){
        if(stage==="turned"){stage="pullback";elapsed=0;progress=0;wokeAt=now;}
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
      } else if(stage==="turn" || stage==="pullback"){
        elapsed+=seconds;progress=reduce?1:Math.min(1,elapsed/(stage==="turn"?1.4:4.5));
        if(progress===1)stage=stage==="turn"?"turned":"done";
      }
      return {stage,progress,moving:stage==="turn"||stage==="pullback"||(stage==="slide"&&progress!==target)};
    },
  };
}


