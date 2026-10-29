/** Keep a lease until asynchronous loading AND its deferred upload have finished. */
export function createSerialIdleQueue(schedule:(job:()=>void)=>()=>void){
 type Job={run:(finish:()=>void)=>void;cancelled:boolean;released:boolean;cancelStart:()=>void};
 const queue:Job[]=[];let current:Job|undefined;
 function release(job:Job){if(job.released)return;job.released=true;if(current===job){current=undefined;pump();}}
 function pump(){
  if(current)return;let job:Job|undefined;
  while((job=queue.shift())&&job.cancelled){}if(!job)return;
  const next=job;current=next;next.cancelStart=schedule(()=>{if(next.cancelled)release(next);else next.run(()=>release(next));});
 }
 return {request(run:Job['run']){const job:Job={run,cancelled:false,released:false,cancelStart:()=>{}};queue.push(job);pump();
  return()=>{job.cancelled=true;job.cancelStart();if(current===job)release(job);};}};
}
