import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../components/corridor/exit-stages.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace('./reveal-scroll',new URL('../components/corridor/reveal-scroll.ts',import.meta.url).href);
const {createExitStages}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
test('a long demand-rendering rest cannot be counted as turn or pullback time',()=>{
 const c=createExitStages();c.tick(30,30000);c.input(10000,32000,800);
 let shot=c.tick(30,32013);
 assert.equal(shot.stage,'slide');assert.ok(shot.progress<.1);
 for(let i=1;i<=240;i++)shot=c.tick(1/60,32013+i*1000/60);
 assert.equal(shot.stage,'turned');
 c.input(100,64000,800);shot=c.tick(30,64013);
 assert.equal(shot.stage,'pullback');assert.ok(shot.progress<.01);
});

test('resuming a settled scroll-driven slide uses only time after the new input',()=>{
 const c=createExitStages();c.input(300,100,800);let shot;
 for(let i=1;i<=200;i++)shot=c.tick(.016,100+i*16);
 const before=shot.progress;c.input(200,30300,800);shot=c.tick(27,30313);
 assert.ok(shot.progress>before);assert.ok(shot.progress-before<.02);
});
test('one slide gesture flows into the turn without another input; fresh input immediately starts pullback',()=>{
 const c=createExitStages();let now=0,s;c.reset();c.input(10000,now,800);
 let boundary=false;
 for(let i=0;i<300;i++){now+=16;s=c.tick(.016,now);if(s.stage==='turn'&&!boundary){assert.equal(s.progress,0);assert.equal(s.moving,true);boundary=true;}if(s.stage==='turned')break;}
 assert.equal(boundary,true);assert.equal(s.stage,'turned');assert.equal(s.moving,false);
 // There is no extra 150 ms lock after the turn stops.
 now+=1;c.input(100,now,800);s=c.tick(1,now+1000);assert.equal(s.stage,'pullback');
 s=c.tick(3.5,now+4500);assert.equal(s.stage,'done');assert.equal(s.progress,1);
});
test('upward scroll reverses slide travel; turn input cannot skip the next stop',()=>{
 const c=createExitStages();c.input(600,0,800);let s;
 for(let i=0;i<100;i++)s=c.tick(.016,i*16);
 assert.ok(s.progress>0);c.input(-10000,2000,800);
 for(let i=0;i<150;i++)s=c.tick(.016,2000+i*16);
 assert.equal(s.progress,0);assert.equal(s.stage,'slide');
 c.input(10000,5000,800);s=c.tick(0,5000,true);assert.equal(s.stage,'turn');
 c.input(100,5400,800);c.input(10000,5500,800);s=c.tick(1.4,6800);assert.equal(s.stage,'turned');
 assert.equal(c.tick(10,16800).stage,'turned');
});
test('back from the page sections: the top holds one second, then turns to View 2 by itself; input cannot skip it',()=>{
 const c=createExitStages();let now=0,s;c.arrive();
 s=c.tick(1/60,now+=16);assert.equal(s.stage,'top');assert.equal(s.progress,1);assert.equal(s.moving,true);
 c.input(10000,now,800);c.input(100,now+400,800);
 for(let i=0;i<55;i++)s=c.tick(1/60,now+=16);
 assert.equal(s.stage,'top','still holding just before one second');
 for(let i=0;i<10;i++)s=c.tick(1/60,now+=16);
 assert.equal(s.stage,'turn');assert.ok(s.progress>0&&s.progress<.1,'the turn starts where the hold ends');
 c.input(10000,now+1000,800);
 for(let i=0;i<120&&s.stage!=='turned';i++)s=c.tick(1/60,now+=16);
 assert.equal(s.stage,'turned');assert.equal(s.moving,false);
 assert.equal(c.tick(5,now+=5000).stage,'turned','no pullback without a fresh gesture after View 2');
 c.input(100,now+=1000,800);assert.equal(c.tick(1/60,now+=16).stage,'pullback');
});
test('the View 1 review stop rests at the top until a fresh scroll turns it',()=>{
 const c=createExitStages();let now=0,s;c.preview('slide');
 s=c.tick(10,now+=10000);assert.equal(s.stage,'top');assert.equal(s.progress,1);assert.equal(s.moving,false);
 c.input(100,now+=1000,800);s=c.tick(1/60,now+=16);assert.equal(s.stage,'turn');
});
test('reduced motion still holds at the top, then lands on View 2',()=>{
 const c=createExitStages();c.arrive();
 assert.equal(c.tick(.5,500,true).stage,'top');
 assert.equal(c.tick(.6,1100,true).stage,'turned');
});

