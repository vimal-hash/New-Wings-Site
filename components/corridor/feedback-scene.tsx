"use client";
import {forwardRef,useEffect,useImperativeHandle,useLayoutEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from "react";
import {createDust,type Dust} from "./feedback-dust";
import {ropeFlightDevice} from "./effect-quality";

/**
 * Section 4, Client Feedback: the whole history of the cinema image, ending in today's.
 *
 * Cards on a dark wall: the one in focus, and half of the next one waiting on the right. The scroll moves them like
 * Section 1's reel: each gesture moves at most one card, following the scroll, then settling softly. Before the first
 * card or after the last, a new gesture belongs to the page again.
 *
 * Arriving, the picture passes through every era, each blending into the next: Section 1's old film (black and white,
 * dark, grain, scratches, flicker) → Section 2's clean black and white → Section 3's faded colour (light grain, lines) →
 * full colour. Only then does the lens come in: real depth and field of view, the card in focus steps forward with a
 * white glow, the others step back, turn a little and soften, and white dust floats at every distance, out of focus in
 * front of the lens. The card in focus leans gently towards the mouse, its light sliding across it. Last, a deep red
 * light rises in the bottom right corner. None of that depth is present during the older eras.
 */
export type FeedbackHandle={play():void;reset():void;run(on:boolean):void;input(pixels:number):boolean;root:HTMLElement|null};
/** old: waits as old film. play: plays on mount. done: already in today's look (a still copy). */
type Start="old"|"play"|"done";

export const FEEDBACK_WALL="#0c0c0e";

/**
 * Runs once the page has settled: no new downloads and a run of steady frames for about two thirds of a second (five
 * seconds at most). Opening Section 4 directly, the rest of the page is still loading and preparing its graphics for a
 * moment; its white waits for that to pass, so nothing stutters once it starts to move. Returns a cancel.
 */
export function whenCalm(run:()=>void){
  let frame=0,last=0,steady=0,loaded=-1,nextResourceCheck=0;const start=performance.now();
  const check=(now:number)=>{
    // Frame cadence needs a per-frame sample. The growing resource list does not.
    const count=now>=nextResourceCheck?performance.getEntriesByType("resource").length:loaded;
    if(now>=nextResourceCheck)nextResourceCheck=now+150;
    steady=last&&now-last<24&&count===loaded?steady+1:0;
    last=now;loaded=count;
    if((steady>=40&&now-start>250)||now-start>5000){frame=0;run();return;}
    frame=requestAnimationFrame(check);
  };
  frame=requestAnimationFrame(check);
  return()=>cancelAnimationFrame(frame);
}

// Placeholders until the client's own testimonials arrive.
const QUOTES=[
  {text:"Placeholder — a theatre owner's words about their new screen and sound.",name:"Client name",place:"Cinema, City",colour:"#efb02e"},
  {text:"Placeholder — a project partner on planning and delivery with New Wings.",name:"Client name",place:"Company, City",colour:"#2a9fb3"},
  {text:"Placeholder — a cinema group on the seating and finishes in their halls.",name:"Client name",place:"Cinema group, City",colour:"#d4472f"},
];
const LAST=QUOTES.length-1;

// The scroll, as Section 1's reel answers it.
const PER_CARD=440,NUDGE=.12,SETTLE=.28,QUIET=140,GESTURE=220;
// The arrival, in seconds after the white has lifted: all four eras in three seconds, then the depth comes in, and with
// it the red light rises in the bottom right corner.
const ERA_END=3,DEPTH_WAIT=.01,DEPTH=1.5,RED_AT=ERA_END+.05,RED=1,END=Math.max(ERA_END+DEPTH_WAIT+DEPTH,RED_AT+RED);
// How much the motion slows on each era (1 would stop on it for an instant; less keeps it flowing).
const DWELL=.8;
// The card in focus leans gently towards the mouse (degrees), or sways very slowly without one.
const TILT_Y=6,TILT_X=4.5,SWAY=.22;
// The look of each era: 0 old film, 1 clean B&W, 2 faded colour, 3 today.
const LOOK={
  grey:[1,1,0,0],sepia:[0,0,.3,0],saturate:[1,1,.55,1],contrast:[1.15,1.3,.92,1],bright:[.8,1.08,.92,1],
  old:[1,0,0,0],vintage:[0,0,1,0],
};
// The lens once today's picture has arrived: field of view (degrees) without and with the depth.
const FOV_FLAT=44,FOV_DEEP=56;
// The glow, light and red layers never rest fully at zero: kept just above it (invisible), they are drawn once while the
// white still covers the section, instead of all at once on the frame the depth begins.
const REST=.003;
// The side cards go out of focus by fading in a copy of the card that is always blurred by the same amount. (Changing a
// blur's size every frame makes the browser rebuild it at every new size, which stalls frames; a fade costs nothing.)
const BLUR=2.4;

const TAU=Math.PI*2;
const clamp=(v:number,low:number,high:number)=>Math.min(high,Math.max(low,v));
const smoother=(x:number)=>{const t=clamp(x,0,1);return t*t*t*(t*(t*6-15)+10);};
/**
 * Seconds since the white lifted → era (0..3). One unbroken curve: it eases out of the old film and into today, and
 * slows as it passes each era, so every look is seen in turn, without ever stopping or jerking (its speed and
 * acceleration change smoothly everywhere).
 */
function eraAt(t:number){
  const u=clamp(t/ERA_END,0,1),x=3*(1-Math.cos(Math.PI*u))/2;
  return u>=1?3:clamp(x-DWELL*Math.sin(TAU*x)/TAU,0,3);
}
const look=(key:keyof typeof LOOK,era:number)=>{const k=LOOK[key],i=Math.min(2,Math.floor(era)),f=era-i;return k[i]+(k[i+1]-k[i])*f;};

// The red light in the bottom right corner: a deep cinema red, falling off smoothly into the dark wall.
const RED_LIGHT=(()=>{
  const stops=[];
  for(let k=0;k<=12;k++){
    const t=k/12,a=.9*Math.pow(1-t,2.3),m=Math.min(1,t*1.4);
    stops.push(`rgba(${Math.round(206-80*m)},${Math.round(28-16*m)},${Math.round(38-18*m)},${a.toFixed(3)}) ${(t*100).toFixed(1)}%`);
  }
  return `radial-gradient(ellipse 78% 88% at 100% 100%,${stops.join(",")})`;
})();

const CSS=`
.nw-fb{--w:min(50vw,(100dvh - 18dvh - 40px)*1.6,1500px);--h:calc(var(--w)/1.6);--gap:calc(var(--w)*.07);--left:max(24px,100vw - var(--w)*1.5 - var(--gap));position:absolute;inset:0;overflow:hidden;background:${FEEDBACK_WALL};color:#111214}
.nw-fb-dust{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.nw-fb-red{position:absolute;inset:0;pointer-events:none;opacity:.003;transform-origin:100% 100%;will-change:opacity,transform;background:${RED_LIGHT}}
/* Light on the card in focus: a soft highlight from the upper left and a little shade on the far side; both move as the card leans. */
/* Each is painted once; only its opacity and position change, so nothing is repainted while the card moves. */
.nw-fb-glow{position:absolute;inset:0;pointer-events:none;opacity:.003;will-change:opacity;box-shadow:0 0 0 1px rgba(255,255,255,.55),0 0 46px 4px rgba(255,255,255,.26),0 0 140px 12px rgba(255,255,255,.09)}
.nw-fb-light{position:absolute;inset:0;pointer-events:none;overflow:hidden;opacity:.003;will-change:opacity}
.nw-fb-light i{position:absolute;left:-50%;top:-50%;width:200%;height:200%;will-change:transform}
.nw-fb-light i:first-child{background:radial-gradient(42.5% 37.5% at 50% 50%,rgba(255,250,236,.3),rgba(255,250,236,.12) 30%,rgba(255,250,236,0) 62%)}
.nw-fb-light i:last-child{background:radial-gradient(45% 40% at 50% 50%,rgba(0,0,0,.12),rgba(0,0,0,.05) 32%,rgba(0,0,0,0) 66%)}
.nw-fb-stage{position:absolute;inset:0;perspective:900px}
.nw-fb[data-era="old"] .nw-fb-card{filter:grayscale(1) contrast(1.15) brightness(.8)}
.nw-fb-track{position:absolute;left:var(--left);top:calc(50% - var(--h)/2);display:flex;gap:var(--gap);transform-style:preserve-3d;will-change:transform}
.nw-fb-card{flex:none;position:relative;width:var(--w);height:var(--h);backface-visibility:hidden;will-change:transform}
.nw-fb-face{position:absolute;inset:0;box-sizing:border-box;margin:0;padding:clamp(12px,calc(var(--w)*.05),72px);display:grid;grid-template-rows:auto 1fr auto}
.nw-fb-soft{filter:blur(${BLUR}px);opacity:${REST};will-change:opacity}
.nw-fb-top,.nw-fb-who{display:flex;justify-content:space-between;align-items:baseline;gap:16px;font:500 clamp(9px,calc(var(--w)*.015),15px)/1.3 var(--font-geist-mono),monospace;letter-spacing:.16em;text-transform:uppercase}
.nw-fb-text{align-self:center;max-width:22ch;margin:0;font-size:clamp(13px,calc(var(--w)*.046),68px);font-weight:500;line-height:1.08;letter-spacing:-.03em}
.nw-fb-name{font:500 clamp(12px,calc(var(--w)*.024),30px)/1.2 var(--font-geist-sans),system-ui,sans-serif;letter-spacing:-.01em;text-transform:none}
/* The films of the older eras, over the whole picture. Each fades as a whole; its parts animate inside it. */
.nw-fb-film,.nw-fb-scratches{position:absolute;inset:0;overflow:hidden;pointer-events:none}
/* Their strength is written straight onto each layer (no custom properties: those would restyle every layer inside,
   grain image included, on every frame). */
.nw-fb-old,.nw-fb-scratches,.nw-fb-vintage{opacity:.003}
.nw-fb[data-era="old"] .nw-fb-old,.nw-fb[data-era="old"] .nw-fb-scratches{opacity:1}
.nw-fb[data-era="hd"] .nw-fb-film,.nw-fb[data-era="hd"] .nw-fb-scratches{display:none}
.nw-fb-film>*,.nw-fb-scratches>*{position:absolute}
.nw-fb-scratches i{inset:0;background:linear-gradient(90deg,transparent 12%,rgba(255,255,255,.784) 12%,rgba(255,255,255,.784) calc(12% + 1px),transparent calc(12% + 1px),transparent 44%,#fff 44%,#fff calc(44% + 1px),transparent calc(44% + 1px),transparent 71%,rgba(255,255,255,.659) 71%,rgba(255,255,255,.659) calc(71% + 1px),transparent calc(71% + 1px),transparent 89%,rgba(255,255,255,.878) 89%,rgba(255,255,255,.878) calc(89% + 1px),transparent calc(89% + 1px))}
.nw-fb-oldgrain{inset:-192px;opacity:.8}
.nw-fb-oldedge{inset:0;background:radial-gradient(80% 95% at 50% 50%,rgba(0,0,0,0) 45%,rgba(0,0,0,.773) 100%)}
.nw-fb-oldflicker{inset:0;background:#000;opacity:.1}
.nw-fb-grain{inset:-192px;opacity:.22}
.nw-fb-lines{inset:0;opacity:.3;background:linear-gradient(90deg,transparent 19%,rgba(0,0,0,.58) 19%,rgba(0,0,0,.58) calc(19% + 1px),transparent calc(19% + 1px),transparent 67%,rgba(0,0,0,.52) 67%,rgba(0,0,0,.52) calc(67% + 1px),transparent calc(67% + 1px))}
.nw-fb-flicker{inset:0;background:#0a0705;opacity:.04}
.nw-fb[data-run]:not([data-era="hd"]) .nw-fb-oldgrain{animation:nw-fb-grain .36s steps(1) infinite}
.nw-fb[data-run]:not([data-era="hd"]) .nw-fb-oldflicker{animation:nw-fb-oldflicker .29s steps(1) infinite}
.nw-fb[data-run]:not([data-era="hd"]) .nw-fb-scratches i{animation:nw-fb-scratch 1.1s steps(1) infinite}
.nw-fb[data-run]:not([data-era="hd"]) .nw-fb-grain{animation:nw-fb-grain .5s steps(1) infinite}
.nw-fb[data-run]:not([data-era="hd"]) .nw-fb-lines{animation:nw-fb-drift 7s steps(1) infinite}
.nw-fb[data-run]:not([data-era="hd"]) .nw-fb-flicker{animation:nw-fb-flicker .46s steps(1) infinite}
@keyframes nw-fb-oldflicker{0%{opacity:.06}25%{opacity:.18}50%{opacity:.03}75%{opacity:.14}}
@keyframes nw-fb-grain{0%{transform:translate(0,0)}17%{transform:translate(-71px,43px)}33%{transform:translate(38px,-97px)}50%{transform:translate(-113px,-29px)}67%{transform:translate(89px,67px)}83%{transform:translate(-23px,121px)}}
@keyframes nw-fb-scratch{0%{transform:translateX(0);opacity:.45}21%{transform:translateX(5px);opacity:.22}38%{transform:translateX(-9px);opacity:.5}62%{transform:translateX(14px);opacity:.28}83%{transform:translateX(-4px);opacity:.45}}
@keyframes nw-fb-drift{0%{transform:translateX(0);opacity:.3}25%{transform:translateX(2px);opacity:.2}50%{transform:translateX(1px);opacity:.32}75%{transform:translateX(-1px);opacity:.24}}
@keyframes nw-fb-flicker{0%{opacity:.03}20%{opacity:.08}40%{opacity:.02}60%{opacity:.1}80%{opacity:.05}}
@media (max-aspect-ratio:1/1){
  .nw-fb{--w:min(58vw,(100dvh - 22dvh - 40px)/1.45,520px);--h:calc(var(--w)*1.45);--left:max(16px,100vw - var(--w)*1.5 - var(--gap))}
  .nw-fb-face{padding:clamp(14px,calc(var(--w)*.07),28px)}
  .nw-fb-text{font-size:clamp(14px,calc(var(--w)*.078),36px)}
  .nw-fb-who{flex-direction:column;align-items:flex-start;gap:6px}
}
@media (orientation:landscape) and (max-height:500px){
  .corridor-study .nw-fb{--contact-space:calc(var(--contact-bottom) + var(--contact-icon-height) + 2 * var(--contact-padding) + 12px);--w:min(50vw,(100dvh - var(--contact-space) - 36px)*1.6,1500px)}
  .corridor-study .nw-fb-track{top:calc((100% - var(--contact-space) - var(--h))/2 + 8px)}
}
@media (prefers-reduced-motion:reduce){.nw-fb *{animation:none!important}}
`;

type Controller=FeedbackHandle&{settle(era:number,depth:number):void;dust(back:HTMLCanvasElement,front:HTMLCanvasElement):()=>void;aim(x:number,y:number):void};
type Parts={root:{current:HTMLDivElement|null};red:{current:HTMLDivElement|null};stage:{current:HTMLDivElement|null};track:{current:HTMLDivElement|null};cards:{current:(HTMLElement|null)[]};shown:(i:number)=>void;card:number};

function createController({root,red,stage,track,cards,shown,card}:Parts):Controller{
  const reduced=()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // One clock for the arrival, the cards and the dust. pos follows goal like a soft spring; while a gesture is held,
  // goal follows the scroll (at most one card from where it began); once the scroll is quiet, goal is a whole card.
  const c={frame:0,playing:false,start:0,era:0,depth:0,pos:card,vel:0,goal:card,origin:card,drag:0,held:false,mine:false,last:-1e9,time:0,dustTime:0,
    shown:card,drawnDepth:NaN,aim:[0,0],cam:[0,0],tilt:[0,0],sway:0,red:0,dust:null as Dust|null};
  const running=()=>root.current?.dataset.run!==undefined;
  const fov=()=>FOV_FLAT+(FOV_DEEP-FOV_FLAT)*c.depth;
  // Writes a style only when it changes (the cards are placed every frame while the lens is live).
  const written=new WeakMap<HTMLElement,Record<string,string>>();
  const put=(el:HTMLElement,name:string,value:string)=>{
    let seen=written.get(el);if(!seen){seen={};written.set(el,seen);}
    if(seen[name]===value)return;seen[name]=value;el.style.setProperty(name,value);
  };
  // The era's look on the picture and its films.
  const paintEra=()=>{
    const el=root.current;if(!el)return;
    const tint=(value:string)=>{for(const card of cards.current)if(card)put(card,"filter",value);};
    const film=(name:string)=>el.querySelector<HTMLElement>(name);
    const old=film(".nw-fb-old"),scratches=film(".nw-fb-scratches"),vintage=film(".nw-fb-vintage");
    const films=(o:number,v:number)=>{for(const layer of [old,scratches])if(layer)put(layer,"opacity",o.toFixed(3));if(vintage)put(vintage,"opacity",v.toFixed(3));};
    if(c.era>=3){tint("none");films(0,0);return;}
    const e=c.era;
    tint(`grayscale(${look("grey",e).toFixed(3)}) sepia(${look("sepia",e).toFixed(3)}) saturate(${look("saturate",e).toFixed(3)}) contrast(${look("contrast",e).toFixed(3)}) brightness(${look("bright",e).toFixed(3)})`);
    // Never quite zero while the eras run: each film is then already drawn before its era comes (see REST).
    films(Math.max(REST,look("old",e)),Math.max(REST,look("vintage",e)));
  };
  // The cards: where the strip is, and, with the depth, which card is in focus, and how it leans.
  const placeCards=()=>{
    const d=c.depth;
    if(track.current)put(track.current,"transform",`translateX(calc(${(-c.pos).toFixed(4)} * (var(--w) + var(--gap))))`);
    if(stage.current&&root.current&&c.depth!==c.drawnDepth){c.drawnDepth=c.depth;stage.current.style.perspective=`${(root.current.clientHeight/2/Math.tan(fov()*Math.PI/360)).toFixed(1)}px`;}
    cards.current.forEach((el,i)=>{
      if(!el)return;
      const k=clamp(i-c.pos,-1,1),a=Math.abs(k),focus=(1-a)*d;
      put(el,"opacity",(1-(.12+.18*d)*a).toFixed(3));
      put(el,"transform",d>0?`translateZ(${(((1-a)*34-a*70)*d).toFixed(2)}px) rotateY(${(-5*k*d).toFixed(3)}deg) rotateX(${(-c.tilt[1]*TILT_X*focus).toFixed(3)}deg) rotateY(${(c.tilt[0]*TILT_Y*focus).toFixed(3)}deg)`:"none");
      // Out of focus: the blurred copy fades in over the sharp card; the sharp one goes only once it is fully covered.
      const soft=a*d,face=el.children[1] as HTMLElement|undefined,copy=el.children[2] as HTMLElement|undefined;
      if(copy)put(copy,"opacity",Math.max(REST,soft).toFixed(3));
      if(face)put(face,"opacity",(1-smoother((soft-.9)/.1)).toFixed(3));
      const glow=el.firstElementChild as HTMLElement|null,light=el.lastElementChild as HTMLElement|null;
      if(glow)put(glow,"opacity",Math.max(REST,focus).toFixed(3));
      if(light){
        // The light on it: the highlight slides against the lean, as on a real tilted surface, the shade the other way.
        // (Each layer is twice the card, so it moves half as many of its own percent.)
        put(light,"opacity",Math.max(REST,.75*focus).toFixed(3));
        const hx=(30-c.tilt[0]*26-50)/2,hy=(22-c.tilt[1]*22-50)/2,high=light.firstElementChild as HTMLElement|null,shade=light.lastElementChild as HTMLElement|null;
        if(focus>.001){
          if(high)put(high,"transform",`translate(${hx.toFixed(2)}%,${hy.toFixed(2)}%)`);
          if(shade)put(shade,"transform",`translate(${(-hx).toFixed(2)}%,${(-hy).toFixed(2)}%)`);
        }
      }
    });
    const near=Math.round(c.pos);if(near!==c.shown){c.shown=near;shown(near);}
  };
  // The red light in the corner, last of all: it rises and opens out from the corner.
  const paintRed=()=>{
    const el=red.current;if(!el)return;
    const e=smoother(c.red);put(el,"opacity",Math.max(REST,e).toFixed(3));put(el,"transform",`scale(${(.82+.18*e).toFixed(4)})`);
  };
  const finish=()=>{
    c.playing=false;c.era=3;c.depth=1;c.red=1;
    const el=root.current;if(el)el.dataset.era="hd";
    paintEra();placeCards();paintRed();
  };
  const tick=(now:number)=>{
    c.frame=0;if(!root.current)return;
    const dt=c.time?Math.min(.05,(now-c.time)/1000):1/60;c.time=now;
    let busy=false;
    if(c.playing){
      const t=(now-c.start)/1000;
      if(t>=END)finish();
      else{
        busy=true;
        c.era=eraAt(t);c.depth=smoother((t-ERA_END-DEPTH_WAIT)/DEPTH);c.red=clamp((t-RED_AT)/RED,0,1);
        if(c.era>=3&&root.current.dataset.era!=="now")root.current.dataset.era="now";
        paintEra();paintRed();
      }
    }
    // The card in focus leans towards the mouse, or sways very slowly; it follows softly, never snapping.
    if(c.depth>0&&!reduced()){
      c.sway+=dt;
      const tx=c.aim[0]+SWAY*Math.sin(c.sway*.41),ty=c.aim[1]*.8+SWAY*.7*Math.sin(c.sway*.29+1.3),follow=Math.min(1,dt*3);
      c.tilt[0]+=(clamp(tx,-1,1)-c.tilt[0])*follow;c.tilt[1]+=(clamp(ty,-1,1)-c.tilt[1])*follow;
      busy=true;
    }
    if(c.held&&performance.now()-c.last>QUIET){
      c.held=false;const share=c.drag/PER_CARD;
      c.goal=clamp(Math.abs(share)>NUDGE?c.origin+Math.sign(share):c.origin,0,LAST);
    }
    if(reduced()){c.pos=Math.round(c.goal);c.vel=0;}
    else{
      // A critically damped spring towards the goal.
      const w=2/SETTLE,x=w*dt,e=1/(1+x+.48*x*x+.235*x*x*x),change=c.pos-c.goal,temp=(c.vel+w*change)*dt;
      c.vel=(c.vel-w*temp)*e;c.pos=c.goal+(change+temp)*e;
      if(Math.abs(c.pos-c.goal)<1e-4&&Math.abs(c.vel)<1e-4){c.pos=c.goal;c.vel=0;}
    }
    placeCards();
    if(c.held||c.pos!==c.goal)busy=true;
    // The dust: the camera breathes slowly and leans a little towards the mouse.
    if(c.dust){
      if(c.depth>0&&!reduced()){
        c.dustTime+=dt;
        c.cam[0]+=(c.aim[0]-c.cam[0])*Math.min(1,dt*2.2);c.cam[1]+=(c.aim[1]-c.cam[1])*Math.min(1,dt*2.2);
        c.dust.draw(c.dustTime,dt,{fov:fov(),camX:.016*Math.sin(c.dustTime*.071)+c.cam[0]*.03,camY:.01*Math.sin(c.dustTime*.053+1)+c.cam[1]*.018,strength:c.depth});
        busy=true;
      }else if(c.depth>0)c.dust.draw(c.dustTime,0,{fov:fov(),camX:0,camY:0,strength:c.depth}); // reduced motion: one still frame
      else c.dust.clear();
    }
    if(busy&&running())c.frame=requestAnimationFrame(tick);else c.time=0;
  };
  const wake=()=>{if(!c.frame&&running())c.frame=requestAnimationFrame(tick);};
  const made:Controller={
    run(on){
      const el=root.current;if(!el)return;
      if(on){el.dataset.run="";wake();}
      else{delete el.dataset.run;cancelAnimationFrame(c.frame);c.frame=0;c.time=0;}
    },
    // From the moment the white has lifted.
    play(){
      const el=root.current;if(!el)return;
      made.run(true);
      if(el.dataset.era!=="old"||c.playing)return;
      if(reduced()){finish();wake();return;}
      c.playing=true;c.start=performance.now();c.time=0;c.dust?.warm();wake();
    },
    reset(){
      const el=root.current;
      c.playing=false;c.era=0;c.depth=0;c.red=0;c.tilt=[0,0];c.pos=c.goal=c.origin=0;c.vel=0;c.drag=0;c.held=false;c.mine=false;
      if(el)el.dataset.era="old";
      paintEra();
      c.dust?.clear();placeCards();paintRed();
    },
    // One scroll event in pixels (down is positive). True when the cards used it; false when it belongs to the page.
    input(pixels){
      const now=performance.now();if(!root.current)return false;
      const fresh=now-c.last>GESTURE;c.last=now;
      if(fresh){
        c.origin=Math.round(c.goal);c.drag=0;
        // Before the first card or after the last, a new gesture goes on to the page (back up, or on to the end).
        c.mine=!((pixels<0&&c.origin<=0)||(pixels>0&&c.origin>=LAST));
      }
      if(!c.mine)return false;
      c.drag+=pixels;c.held=true;
      c.goal=clamp(c.origin+clamp(c.drag/PER_CARD,-1,1),0,LAST);
      wake();return true;
    },
    settle(era,depth){c.era=era;c.depth=depth;c.red=era>=3&&depth>=1?1:0;paintEra();placeCards();paintRed();},
    dust(back,front){
      const device=ropeFlightDevice();
      // Fewer specks and pixels on weaker devices; the look stays the same.
      const el=root.current,area=el?el.clientWidth*el.clientHeight/(1440*800):1,cores=navigator.hardwareConcurrency||4;
      const base=(device==="desktop"?560:device==="laptop"?340:170)*(cores<=4?.7:1);
      const dust=createDust(back,front,Math.round(base*clamp(area,.45,1.4)),device==="mobile"?1.25:1);
      const size=()=>{const el=root.current;if(el){dust.resize(el.clientWidth,el.clientHeight);c.drawnDepth=NaN;placeCards();wake();}};
      const watch=new ResizeObserver(size);if(root.current)watch.observe(root.current);
      c.dust=dust;size();
      dust.warm(); // its sprites are first drawn now, while the section is still hidden, not when the dust appears
      return()=>{watch.disconnect();dust.clear();c.dust=null;};
    },
    aim(x,y){c.aim=[x,y];},
    get root(){return root.current;},
  };
  return made;
}

const FeedbackScene=forwardRef<FeedbackHandle,{live?:boolean;start?:Start;card?:number}>(function FeedbackScene({live=false,start="done",card=0},ref){
  const root=useRef<HTMLDivElement>(null),red=useRef<HTMLDivElement>(null),stage=useRef<HTMLDivElement>(null),track=useRef<HTMLDivElement>(null),cards=useRef<(HTMLElement|null)[]>([]);
  const back=useRef<HTMLCanvasElement>(null),front=useRef<HTMLCanvasElement>(null),first=useRef(start),ctl=useRef<Controller|null>(null);
  const [shown,setShown]=useState(card);
  const ensure=()=>ctl.current??=createController({root,red,stage,track,cards,shown:setShown,card});
  useImperativeHandle(ref,()=>ensure(),[]); // eslint-disable-line react-hooks/exhaustive-deps -- one controller for the component's life
  useLayoutEffect(()=>{
    const made=ensure();
    if(first.current==="done")made.settle(3,1);else made.settle(0,0);
    return()=>made.run(false); // its frame is cancelled, so a remount (React's dev double mount) can start it again
  },[]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{
    const section=root.current;if(!live||!section)return;
    const tile=document.createElement("canvas");tile.width=tile.height=192;
    const paint=tile.getContext("2d");if(!paint)return;
    const image=paint.createImageData(192,192);
    for(let i=0;i<image.data.length;i+=4)image.data[i+3]=Math.round(255-(165+Math.random()*90));
    paint.putImageData(image,0,0);
    const layers=section.querySelectorAll<HTMLElement>(".nw-fb-oldgrain,.nw-fb-grain");
    let gone=false,link="";
    tile.toBlob(blob=>{
      if(!blob||gone)return;
      link=URL.createObjectURL(blob);
      layers.forEach(layer=>{layer.style.backgroundImage=`url("${link}")`;});
    },"image/png");
    return()=>{gone=true;if(link){layers.forEach(layer=>{layer.style.backgroundImage="";});URL.revokeObjectURL(link);}};
  },[live]);
  useEffect(()=>{
    if(!live||!back.current||!front.current)return;
    return ensure().dust(back.current,front.current);
  },[live]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{
    if(!live||first.current!=="play")return;
    const wait=requestAnimationFrame(()=>ensure().play());
    return()=>cancelAnimationFrame(wait);
  },[live]); // eslint-disable-line react-hooks/exhaustive-deps
  const aim=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(event.pointerType!=="mouse")return;
    const box=event.currentTarget.getBoundingClientRect();
    ctl.current?.aim((event.clientX-box.left)/box.width*2-1,(event.clientY-box.top)/box.height*2-1);
  };
  return <div ref={root} className="nw-fb" data-live={live||undefined} data-era={start==="done"?"hd":"old"}
    onPointerMove={live?aim:undefined} onPointerLeave={live?()=>ctl.current?.aim(0,0):undefined}>
    <style href="nw-feedback-scene" precedence="default">{CSS}</style>
    <div ref={red} className="nw-fb-red" aria-hidden="true"/>
    {live?<canvas ref={back} className="nw-fb-dust" aria-hidden="true"/>:null}
    <div ref={stage} className="nw-fb-stage" role="group" aria-roledescription="carousel" aria-label="Client feedback">
      <div ref={track} className="nw-fb-track">
        {QUOTES.map((q,i)=><div key={i} ref={el=>{cards.current[i]=el;}} className="nw-fb-card" aria-hidden={i!==shown}>
          <span className="nw-fb-glow" aria-hidden="true"/>
          <figure className="nw-fb-face" style={{background:q.colour}}>
            <div className="nw-fb-top"><span>Client feedback</span><span>{String(i+1).padStart(2,"0")} / {String(QUOTES.length).padStart(2,"0")}</span></div>
            <blockquote className="nw-fb-text">{q.text}</blockquote>
            <figcaption className="nw-fb-who"><span className="nw-fb-name">{q.name}</span><span>{q.place}</span></figcaption>
          </figure>
          <div className="nw-fb-face nw-fb-soft" style={{background:q.colour}} aria-hidden="true">
            <div className="nw-fb-top"><span>Client feedback</span><span>{String(i+1).padStart(2,"0")} / {String(QUOTES.length).padStart(2,"0")}</span></div>
            <div className="nw-fb-text">{q.text}</div>
            <div className="nw-fb-who"><span className="nw-fb-name">{q.name}</span><span>{q.place}</span></div>
          </div>
          <span className="nw-fb-light" aria-hidden="true"><i/><i/></span>
        </div>)}
      </div>
    </div>
    {live?<canvas ref={front} className="nw-fb-dust" aria-hidden="true"/>:null}
    <div className="nw-fb-film nw-fb-old" aria-hidden="true"><div className="nw-fb-oldgrain"/><div className="nw-fb-oldedge"/><div className="nw-fb-oldflicker"/></div>
    <div className="nw-fb-scratches" aria-hidden="true"><i/></div>
    <div className="nw-fb-film nw-fb-vintage" aria-hidden="true"><div className="nw-fb-grain"/><div className="nw-fb-lines"/><div className="nw-fb-flicker"/></div>
  </div>;
});
export default FeedbackScene;
