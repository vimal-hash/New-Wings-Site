/** Browser cadence includes long foreground pauses; idle WebGL is measured separately. */
export function createFrameStatistics() {
  const samples:number[]=[];
  let last=0,worst=0,stalls=0,freezes=0;
  return {
    resetClock(){last=0;},
    sample(time:number){
      const gap=last?time-last:0;last=time;
      if(gap<=0)return null;
      samples.push(gap);if(samples.length>120)samples.shift();
      worst=Math.max(worst,gap);if(gap>50)stalls++;if(gap>=250)freezes++;
      const sorted=[...samples].sort((a,b)=>a-b),mean=samples.reduce((a,b)=>a+b,0)/samples.length;
      return {gap,fps:1000/mean,frameMs:mean,p95:sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)],worstFrame:worst,stalls,freezes};
    },
  };
}
