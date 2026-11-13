import test from 'node:test';
import assert from 'node:assert/strict';
import {CARD,createCardCount} from '../components/rope-model/rope-card-state.ts';

// Runs the rules frame by frame, as the page does.
function player(){
  const count=createCardCount();let now=1000;
  const hold=(rope,ms,{stop=true,over=false}={})=>{for(let t=0;t<=ms;t+=16){now+=16;count.update(now,rope,stop,over);}};
  return {count,hold,now:()=>now};
}
const SETTLE=CARD.leave+CARD.fadeOut+CARD.rest+50;

test('the first hover shows image 1 and the count runs 1 to 5, then starts again',()=>{
  const {count,hold}=player();
  const seen=[];
  for(let rope=0;rope<7;rope++){hold(rope,SETTLE);assert.equal(count.open,true);seen.push(count.number);}
  assert.deepEqual(seen,[1,2,3,4,5,1,2]);
});

test('a new page starts from image 1 again',()=>{
  const first=player();first.hold(0,SETTLE);first.hold(1,SETTLE);assert.equal(first.count.number,2);
  const second=player();second.hold(4,SETTLE);assert.equal(second.count.number,1);
});

test('the card waits for the mouse to rest on a rope',()=>{
  const {count,hold}=player();
  hold(0,CARD.rest-40);assert.equal(count.open,false);
  hold(0,60);assert.equal(count.open,true);
});

test('sweeping across ropes does not use up numbers',()=>{
  const {count,hold}=player();
  hold(0,SETTLE);assert.equal(count.number,1);
  for(let rope=1;rope<16;rope++)hold(rope,60);
  assert.equal(count.open,false);
  hold(16,SETTLE);assert.equal(count.number,2);
});

test('leaving the rope closes the card, and it stays through a very short slip',()=>{
  const {count,hold}=player();
  hold(0,SETTLE);
  hold(-1,CARD.leave-40);assert.equal(count.open,true);
  hold(0,100);assert.equal(count.open,true);assert.equal(count.number,1);
  hold(-1,CARD.leave+40);assert.equal(count.open,false);
});

test('coming back to the same rope is a new hover',()=>{
  const {count,hold}=player();
  hold(3,SETTLE);hold(-1,SETTLE);hold(3,SETTLE);
  assert.equal(count.open,true);assert.equal(count.number,2);
});

test('the next card waits until the last has fully gone',()=>{
  const {count,hold}=player();
  hold(0,SETTLE);
  hold(1,CARD.leave+CARD.fadeOut-60);assert.equal(count.open,false);assert.equal(count.number,1);
  hold(1,CARD.rest+80);assert.equal(count.open,true);assert.equal(count.number,2);
});

test('the mouse on the open card keeps it open, whatever rope lies behind',()=>{
  const {count,hold}=player();
  hold(0,SETTLE);hold(5,SETTLE,{over:true});
  assert.equal(count.open,true);assert.equal(count.number,1);
});

test('closing the card leaves only the white rope, and the count waits',()=>{
  const {count,hold,now}=player();
  hold(0,SETTLE);hold(1,SETTLE);assert.equal(count.number,2);
  count.dismiss(now());
  assert.equal(count.open,false);assert.equal(count.off,true);
  for(let rope=2;rope<8;rope++)hold(rope,SETTLE);
  assert.equal(count.open,false);assert.equal(count.number,2);
});

test('the corner button opens nothing by itself, and the next rope shows the next image',()=>{
  const {count,hold,now}=player();
  hold(0,SETTLE);hold(1,SETTLE);hold(2,SETTLE);assert.equal(count.number,3);
  count.dismiss(now());hold(2,SETTLE);
  count.enable();assert.equal(count.off,false);
  hold(2,SETTLE);assert.equal(count.open,false,'the mouse has not moved yet');
  count.moved();hold(4,SETTLE);
  assert.equal(count.open,true);assert.equal(count.number,4);
});

test('scrolling away turns cards back on, and the count carries on',()=>{
  const {count,hold,now}=player();
  hold(0,SETTLE);
  count.dismiss(now());hold(1,SETTLE);assert.equal(count.off,true);
  hold(1,100,{stop:false});assert.equal(count.off,false);
  hold(2,SETTLE);assert.equal(count.open,true);assert.equal(count.number,2);
});

test('closing when no card is open still turns cards off',()=>{
  const {count,hold,now}=player();
  count.dismiss(now());hold(0,SETTLE);
  assert.equal(count.open,false);assert.equal(count.number,1);
});

test('no card and no count away from the stop, and the count continues on return',()=>{
  const {count,hold}=player();
  hold(0,SETTLE,{stop:false});assert.equal(count.open,false);assert.equal(count.number,1);
  hold(0,SETTLE);assert.equal(count.number,1);assert.equal(count.open,true);
  hold(0,SETTLE,{stop:false});assert.equal(count.open,false);
  hold(0,SETTLE,{stop:false});hold(0,SETTLE);assert.equal(count.number,2);
});
