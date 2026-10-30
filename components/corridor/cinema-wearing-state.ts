/** The first fresh gesture removes the viewer's glasses; it cannot also move the camera. */
export function createCinemaWearingGate() {
  let stage: 'wearing' | 'removing' | 'clear' = 'wearing';
  let elapsed = 0, lastInput = -Infinity, awaitFresh = true;
  const ease = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t*t*t*(t*(t*6-15)+10); };
  return {
    get stage() { return stage; },
    input(distance: number, now: number, ready: boolean) {
      const fresh = now-lastInput>240;
      lastInput=now;
      if(stage==='clear'){
        if(!awaitFresh)return false;
        if(fresh){awaitFresh=false;return false;}
        return true;
      }
      if(stage==='wearing'&&ready&&fresh&&distance>0){stage='removing';elapsed=0;}
      return true;
    },
    tick(delta: number, reduced = false) {
      if(stage==='removing'){
        elapsed=reduced?1.5:Math.min(1.5,elapsed+Math.max(0,delta));
        if(elapsed===1.5)stage='clear';
      }
      return {stage,glasses:stage==='wearing'?1:1-ease(elapsed/1.15),house:stage==='wearing'?0:ease((elapsed-.12)/1.38)};
    },
    skip(){stage='clear';elapsed=1.5;awaitFresh=false;},
  };
}
