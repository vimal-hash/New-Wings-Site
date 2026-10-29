// Same-pose R3F captures without the browser pane: headless Chrome (throwaway profile) over the DevTools protocol.
// Needs a build that exposes the temporary camera hook (window.__SB_TEMP, marked SB_TEMP_REMOVE in scene.tsx).
// Job JSON: {url, width, height, out, poses:[{name, eye, target | quaternion, fov}], journeyHold?: true}
// Usage: node scripts/surface-bake/cdp-capture.mjs <job.json>
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const job=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'sb-cdp-'));
const port=9300+Math.floor(Math.random()*400);
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',[`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'--headless=new',
  '--no-first-run','--no-default-browser-check','--ignore-gpu-blocklist','--enable-gpu-rasterization',`--window-size=${job.width},${job.height}`,'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let target;
for(let i=0;i<50&&!target;i++){await sleep(200);try{target=(await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t=>t.type==='page');}catch{}}
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map();
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
const send=(method,params={})=>new Promise(r=>{const i=++id;pending.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.result?.exceptionDetails)throw new Error(JSON.stringify(r.result.exceptionDetails));return r.result?.result?.value;};
try{
  await send('Emulation.setDeviceMetricsOverride',{width:job.width,height:job.height,deviceScaleFactor:1,mobile:false});
  await send('Page.enable');await send('Page.navigate',{url:job.url});
  const ready=await evaluate(`(async()=>{for(let i=0;i<120&&!(window.__SB_TEMP&&document.body.textContent.includes('Paused'));i++)await new Promise(r=>setTimeout(r,1000));
    const g=document.createElement('canvas').getContext('webgl2'),d=g.getExtension('WEBGL_debug_renderer_info');
    return {ready:!!window.__SB_TEMP,renderer:d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):'',maxTex:g.getParameter(g.MAX_TEXTURE_SIZE),
      textures:performance.getEntriesByType('resource').filter(e=>/ktx2$/.test(e.name)).map(e=>e.name.split('/').pop()),
      errors:window.__sbErrors||[]};})()`);
  console.log('CDP_READY',JSON.stringify(ready));
  if(!ready.ready)throw new Error('page not ready');
  await evaluate(`document.head.appendChild(Object.assign(document.createElement('style'),{textContent:'body *:not(canvas){visibility:hidden!important} canvas, canvas *{visibility:visible!important}'}))`);
  fs.mkdirSync(job.out,{recursive:true});
  for(const p of job.poses){
    await evaluate(`(async()=>{const t=window.__SB_TEMP,c=t.camera;c.position.set(...${JSON.stringify(p.eye)});c.fov=${p.fov};c.updateProjectionMatrix();
      ${p.quaternion?`c.quaternion.set(...${JSON.stringify(p.quaternion)});`:`c.lookAt(...${JSON.stringify(p.target)});`}t.invalidate();await new Promise(r=>setTimeout(r,1500));})()`);
    const shot=await send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:job.width,height:job.height,scale:1}});
    fs.writeFileSync(path.join(job.out,p.name+'.png'),Buffer.from(shot.result.data,'base64'));console.log('CDP_SHOT',p.name);
  }
}finally{ws.close();chrome.kill();await sleep(500);fs.rmSync(profile,{recursive:true,force:true});}
