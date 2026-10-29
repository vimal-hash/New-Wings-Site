"use client";
import { useEffect,useRef } from "react";
import { journeyControls } from "./journey-controls";
import { pageAtBottom } from "./page-exit";
import { traceMark } from "./loading-trace";

export default function NormalPage(){
  const panel=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const node=panel.current;if(!node)return;
    if(journeyControls.read().pageAtEnd)node.scrollTop=node.scrollHeight-node.clientHeight;
    node.focus({preventScroll:true});
    const check=()=>{
      if(journeyControls.read().phase!=="page"||!pageAtBottom(node.scrollTop,node.scrollHeight,node.clientHeight))return;
      traceMark("Final page section reached");
      // The original scene stays mounted and idle behind HTML, so return needs no reload.
      journeyControls.update({phase:"pageReturnLoading",panelStage:0,panelReady:false,pageAtEnd:true});
    };
    node.addEventListener("scroll",check,{passive:true});
    return()=>node.removeEventListener("scroll",check);
  },[]);
  return <div ref={panel} className="normal-page" tabIndex={-1} aria-label="Page sections">
    <section aria-label="First section" style={{background:"#ffffff"}}/>
    <section aria-label="Second section" style={{background:"#b8c8c4"}}/>
    <section aria-label="Third section" style={{background:"#c8b6aa"}}/>
  </div>;
}
