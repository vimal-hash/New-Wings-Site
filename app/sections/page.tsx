"use client";
import dynamic from "next/dynamic";
import { useEffect,useState } from "react";
import { journeyControls } from "@/components/corridor/journey-controls";

// Review link only: opens the real four sections straight away, without the journey before them.
const NormalPage=dynamic(()=>import("@/components/corridor/normal-page"),{ssr:false});
export default function Page(){
  // ?end comes in at section 4, as the page does when it is returned to.
  useState(()=>{if(typeof location!=="undefined"&&new URLSearchParams(location.search).has("end"))journeyControls.update({pageAtEnd:true});});
  useEffect(()=>{journeyControls.update({phase:"page"});},[]);
  return <NormalPage/>;
}
