import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuality,firstStep,STEPS} from '../components/rope-laptop/laptop-quality.ts';

// A pretend graphics chip, run frame by frame in the page's own order. Its numbers are from the user's real laptop report.
const REPORT_CHIP=[28.1,22.4,17.3,11.1,13.2,9,7,5];
const CAPPED_30=()=>33.3;

function play({chip=REPORT_CHIP,frame=CAPPED_30,timer=true,watchingTimer=true,readEvery=1,sweep=false,fixed=false,start=0,seconds=120,silentWhileWatching=false}){
  let now=0,tick=0,step=start,settledAt=null,settledStep=null;
  const downs=[];
  let waiting=false,answerAt=Infinity,asked=0;
  const context={
    QUERY_RESULT_AVAILABLE:1,QUERY_RESULT:2,
    getExtension:()=>timer?{TIME_ELAPSED_EXT:10,GPU_DISJOINT_EXT:11}:null,
    createQuery:()=>({}),deleteQuery(){},
    beginQuery(){asked++;},
    endQuery(){waiting=true;answerAt=tick+2;},
    getQueryParameter(_,name){
      if(name===1)return tick>=answerAt;
      waiting=false;answerAt=Infinity;
      return chipAt(now)*1e6;
    },
    // A lost reading: the browser says the clock jumped. Some laptops do this for most frames.
    getParameter:()=>readEvery>1&&asked%readEvery!==0,
  };
  const chipAt=at=>typeof chip==='function'?chip(step,at):chip[step];
  const gl={getContext:()=>context};
  const quality=createQuality(gl,start,fixed,{
    onChange(_,index){step=index;},
    onSettled(index){settledAt=now;settledStep=index;},
    onStepDown(index){downs.push({at:Math.round((now-settledAt)/100)/10,to:index});},
  },{sweep,timerWhileWatching:watchingTimer});
  while(now<seconds*1000){
    tick++;
    const ms=frame(step,now);
    now+=ms;
    quality.frame(ms,now);
    if(!(silentWhileWatching&&settledAt!==null))quality.begin();
    quality.end();
  }
  return {settledStep,settledAt,downs,step};
}

test('the report: 30 fps with the chip to spare, on the report link, never lowers the picture',()=>{
  const r=play({sweep:true,watchingTimer:false});
  assert.equal(r.settledStep,3);
  assert.deepEqual(r.downs,[]);
  assert.equal(r.step,3);
});

test('the report: 30 fps with the chip to spare, on the normal link, never lowers the picture',()=>{
  const r=play({});
  assert.equal(r.settledStep,3);
  assert.deepEqual(r.downs,[]);
});

test('no chip readings while watching is no reason to lower the picture',()=>{
  const r=play({silentWhileWatching:true});
  assert.equal(r.settledStep,3);
  assert.deepEqual(r.downs,[]);
});

test('readings that are mostly lost still choose by the chip, not by a frame time that looks fine',()=>{
  const r=play({readEvery:6,frame:()=>16.7,seconds:40});
  assert.equal(r.settledStep,3,'the report chose too high here and dropped 3 s after showing');
  assert.deepEqual(r.downs,[]);
});

test('a chip that really gets too slow lowers the picture once, and only once',()=>{
  const hot=(step,at)=>at>30000?24:REPORT_CHIP[step];
  const r=play({chip:hot,frame:(step,at)=>at>30000?30:16.7});
  assert.equal(r.settledStep,3);
  assert.equal(r.downs.length,1);
  assert.equal(r.step,4);
});

test('one slow moment does not lower the picture',()=>{
  const spike=(step,at)=>at>30000&&at<31000?24:REPORT_CHIP[step];
  const r=play({chip:spike,frame:(step,at)=>at>30000&&at<31000?30:16.7});
  assert.deepEqual(r.downs,[]);
});

test('a browser with no chip timer, held at 30 fps, stays on a middle step',()=>{
  const r=play({timer:false});
  assert.equal(r.settledStep,3);
  assert.deepEqual(r.downs,[]);
});

test('a browser with no chip timer on a fast laptop stays at the top',()=>{
  const r=play({timer:false,frame:()=>16.7});
  assert.equal(r.settledStep,0);
  assert.deepEqual(r.downs,[]);
});

test('a browser with no chip timer that later turns slow lowers the picture once',()=>{
  const r=play({timer:false,frame:(step,at)=>at>30000?30:16.7});
  assert.equal(r.settledStep,0);
  assert.equal(r.downs.length,1);
});

test('a chip that gives no readings at all is found out without a long wait',()=>{
  const silent=play({readEvery:1e9,frame:()=>16.7});
  assert.equal(silent.settledStep,0);
  assert.ok(silent.settledAt<3000,`took ${silent.settledAt} ms`);
});

test('a truly weak chip still reaches the lightest step',()=>{
  const r=play({chip:[90,80,70,60,50,40,30,20],frame:()=>50});
  assert.equal(r.settledStep,STEPS.length-1);
  assert.deepEqual(r.downs,[]);
});

test('the wait before the first picture stays short on the report laptop',()=>{
  const r=play({seconds:20});
  assert.ok(r.settledAt<6000,`took ${r.settledAt} ms`);
});

test('a fixed step is never changed',()=>{
  const r=play({fixed:true,start:7,chip:()=>40,frame:()=>50});
  assert.equal(r.step,7);
  assert.deepEqual(r.downs,[]);
});

test('the widest screens begin lower down, as before',()=>{
  assert.equal(firstStep(1920),0);
  assert.equal(firstStep(2880),4);
});
