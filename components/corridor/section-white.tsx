"use client";
import {forwardRef,useEffect,useImperativeHandle,useRef} from "react";

/**
 * The white portal on a section: arriving, the flight ends in white and it lifts off the section the way Section 1 is
 * revealed: .35 s of white, then 1.65 s on the same quintic ease, 2 s in all, as every section's portal; leaving upwards, it rises first so the flight back
 * starts from the same white. Section 2 has its own, tied to its film.
 */
export type WhiteHandle={reveal(done:()=>void):void;cover(done:()=>void):void};
const WAIT=.35,LIFT=1.65,COVER=1.1;
// Held white is a hair short of solid (invisible): a solid layer hides the section so completely that the browser skips
// drawing it, and would then draw all of it for the first time on the first frame of the lift, which stutters. Just
// short of solid, the section is drawn while the white still holds still.
const HOLD=.998;
const smoother=(x:number)=>{const t=Math.min(1,Math.max(0,x));return t*t*t*(t*(t*6-15)+10);};

const SectionWhite=forwardRef<WhiteHandle,{covered?:boolean}>(function SectionWhite({covered=false},ref){
  const node=useRef<HTMLDivElement>(null),frame=useRef(0);
  const set=(value:number)=>{if(node.current)node.current.style.opacity=value.toFixed(4);};
  const fade=(from:number,to:number,wait:number,seconds:number,done:()=>void)=>{
    cancelAnimationFrame(frame.current);
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){set(to);done();return;}
    set(from);
    const start=performance.now();
    const step=(now:number)=>{
      const t=((now-start)/1000-wait)/seconds;
      set(from+(to-from)*smoother(t));
      if(t<1){frame.current=requestAnimationFrame(step);return;}
      frame.current=0;done();
    };
    frame.current=requestAnimationFrame(step);
  };
  useImperativeHandle(ref,()=>({
    reveal(done){fade(HOLD,0,WAIT,LIFT,done);},
    cover(done){fade(Number(node.current?.style.opacity||0),1,0,COVER,done);},
  }));
  useEffect(()=>()=>cancelAnimationFrame(frame.current),[]);
  return <div ref={node} aria-hidden="true" style={{position:"absolute",inset:0,zIndex:5,background:"#fff",pointerEvents:"none",opacity:covered?HOLD:0}}/>;
});
export default SectionWhite;
