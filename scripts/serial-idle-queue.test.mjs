import test from 'node:test';import assert from 'node:assert/strict';import {createSerialIdleQueue} from '../components/corridor/serial-idle-queue.ts';
test('refinement remains serial until asynchronous upload releases its lease, with safe cancellation',()=>{
 const jobs=[],seen=[];let finishFirst;const queue=createSerialIdleQueue(fn=>{const job={fn,cancelled:false};jobs.push(job);return()=>job.cancelled=true;});
 const flush=()=>{const job=jobs.shift();if(job&&!job.cancelled)job.fn();};
 const cancelFirst=queue.request(done=>{seen.push(1);finishFirst=done;});const cancelSecond=queue.request(done=>{seen.push(2);done();});
 flush();assert.deepEqual(seen,[1]);assert.equal(jobs.length,0);finishFirst();flush();assert.deepEqual(seen,[1,2]);cancelFirst();cancelSecond();
 const cancelThird=queue.request(()=>seen.push(3));queue.request(done=>{seen.push(4);done();});cancelThird();flush();flush();assert.deepEqual(seen,[1,2,4]);
});
