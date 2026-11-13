"use client";
import dynamic from "next/dynamic";
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from "react";
import type {ReelHandle} from "../film-reel/film-reel";
import {journeyControls} from "./journey-controls";
import {pageAtBottom,pageReturn} from "./page-exit";
import {traceMark} from "./loading-trace";
import {ropeFlightDevice} from "./effect-quality";
import SectionFlight,{type FlightControl} from "./section-flight";
import AboutCard,{type AboutHandle} from "./about-card";
import {WALL} from "./about-film";
import OwnerCard,{OWNER_WALL,type OwnerHandle} from "./owner-card";
import SectionWhite,{type WhiteHandle} from "./section-white";
import FeedbackScene,{FEEDBACK_WALL,whenCalm,type FeedbackHandle} from "./feedback-scene";

// Section 1's reel can prepare while the page is still covered.
const FilmReel=dynamic(()=>import("../film-reel/film-reel"),{ssr:false});

const SECTION_COLOURS=["#ffffff",WALL,OWNER_WALL,FEEDBACK_WALL];
const SECTION_COPY=[
  {title:"Products",body:"Projection, screens, sound, seating and finishes: everything a theatre needs, chosen to work together."},
  {title:"About Us",body:"A cinema is many parts from many makers. We bring them into one plan, so the room works as one."},
  {title:"Team",body:"The people who plan, fit and tune each room, and care how every film looks and sounds."},
  {title:"Testimonials",body:"Theatre owners and partners, in their own words."},
];

/** A departing copy of the fourth section (a still of its HD scene), sampled from the camera's clock. */
export function PageReturnCover(){
  const sheet=useRef<HTMLDivElement>(null),copy=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const node=sheet.current,text=copy.current;
    if(!node||!text)return;
    let frame=0;
    const paint=()=>{
      const shot=pageReturn.read();
      node.style.transform=`scale(${shot.scale})`;
      node.style.opacity=String(shot.opacity);
      node.style.setProperty("--page-return-glow",String(shot.glow));
      text.style.opacity=String(shot.copy);
      text.style.visibility=shot.copy>0?"":"hidden";
      node.hidden=shot.opacity<=0;
      if(shot.moving&&shot.opacity>0)frame=requestAnimationFrame(paint);
    };
    paint();return()=>cancelAnimationFrame(frame);
  },[]);
  return <div className="page-return-cover" ref={sheet} aria-hidden="true">
    <div className="page-return-surface" style={{backgroundColor:`color-mix(in srgb, ${FEEDBACK_WALL}, white calc(var(--page-return-glow, 0) * 82%))`}}>
      <div ref={copy} style={{position:"absolute",inset:0}}><FeedbackScene card={2}/></div>
    </div>
  </div>;
}

function firstSection(){
  const jumped=journeyControls.read().pageSection;
  if(jumped)return jumped; // opened from the menu
  if(journeyControls.read().pageAtEnd)return 4;
  if(typeof location!=="undefined"&&location.pathname==="/sections")return Math.max(1,Math.min(4,Number(new URLSearchParams(location.search).get("section"))||1));
  return 1;
}
export default function NormalPage({returnToCorridor=false,active=true}:{returnToCorridor?:boolean;active?:boolean}){
  const panel=useRef<HTMLDivElement>(null),lastInput=useRef(0);
  const interactive=useRef(active);
  useLayoutEffect(()=>{interactive.current=active;},[active]);
  const [device]=useState(ropeFlightDevice),[initialSection]=useState(firstSection);
  const [flightUnavailable,setFlightUnavailable]=useState(false);
  const flying=device!=="mobile"&&!flightUnavailable;
  const control=useRef<FlightControl>({where:initialSection===1&&flying?"flight":"rest"});
  const [flight,setFlight]=useState({index:0,startAtEnd:initialSection>1,autoEnter:false,entry:0,entryDistance:0});
  const film=useRef<ReelHandle>(null),flightIndex=useRef(0),about=useRef<AboutHandle>(null),owner=useRef<OwnerHandle>(null),feedback=useRef<FeedbackHandle>(null),whites=useRef<(WhiteHandle|null)[]>([]),covering=useRef(false);
  // The reel has burnt to white: carry the same scroll straight on, so frame 6, the white and the portal are one movement.
  const filmDone=useCallback(()=>{
    const node=panel.current;if(!node||journeyControls.read().phase!=="page")return;
    if(flying&&control.current.where==="flight"&&flightIndex.current===0){
      const scroller=node.querySelector<HTMLElement>("[data-rope-scroller]");
      if(scroller&&scroller.scrollTop<=1)scroller.scrollTop+=4; // the flight then glides on to its first stop by itself
    }else if(flying&&control.current.where==="rest"&&node.scrollTop<=2){
      control.current.where="flight";node.style.overflow="hidden";
      setFlight(old=>({index:0,startAtEnd:false,autoEnter:true,entry:old.entry+1,entryDistance:4}));
    }else if(!flying&&node.scrollTop<=2)node.scrollTo({top:node.clientHeight,behavior:"smooth"});
  },[flying,setFlight]);
  useLayoutEffect(()=>{flightIndex.current=flight.index;},[flight.index]);
  const arrived=useCallback((side:"start"|"end",inWhite:boolean)=>{
    const node=panel.current;if(!node)return;
    node.scrollTop=(flight.index+(side==="end"?1:0))*node.clientHeight;
    // Arriving in About Us from Section 1's white portal, the white lifts off the old film and the print is cleaned in
    // front of the visitor. Back in Section 1, it waits worn again.
    if(flight.index===0){if(side==="end")about.current?.reveal();else about.current?.wait();}
    // Every section is reached from above through a white portal. In Section 3 the old film already runs under the white;
    // once the white has lifted it is cleaned, then colour soaks in. Back above it, it waits as old film again.
    // Flying back up, the flight lands in the section's white too, and it lifts the same way (the section is not replayed).
    const landed=flight.index+(side==="end"?1:0);
    if(side==="start"&&inWhite&&landed===1)about.current?.uncover();
    if(landed===2){owner.current?.run(true);if(inWhite)whites.current[2]?.reveal(()=>owner.current?.open());}
    else if(landed<2)owner.current?.close();
    else{owner.current?.run(false);feedback.current?.run(true);if(side==="end")whites.current[3]?.reveal(()=>feedback.current?.play());}
    // Section 4 waits in Section 3's faded colour until it is reached again; its white has already risen over it.
    if(landed<3){feedback.current?.reset();feedback.current?.run(false);}
    node.style.overflow="";node.focus({preventScroll:true});lastInput.current=performance.now();
  },[flight.index]);
  const flightFailed=useCallback(()=>{
    const node=panel.current;
    if(control.current.where==="flight"&&flight.autoEnter&&flight.startAtEnd&&flight.index===0)about.current?.uncover();
    control.current.where="rest";covering.current=false;
    if(node)node.style.overflow="";
    traceMark("Section flight unavailable; native scroll restored");
    setFlightUnavailable(true);
  },[flight.autoEnter,flight.startAtEnd,flight.index]);
  // With native scrolling, About Us is cleaned as it comes into view from above.
  useEffect(()=>{
    const handle=about.current,card=handle?.root?.closest("section");
    if(flying||!active||!handle||!card)return;
    const watch=new IntersectionObserver(([entry])=>{
      if(entry.intersectionRatio>=.5&&handle.waiting())handle.play();
      else if(entry.isIntersecting&&handle.waiting())handle.idle(); // the old film is already running as it comes into view
      else if(!entry.isIntersecting&&entry.boundingClientRect.top>0)handle.wait();
    },{root:panel.current,threshold:[0,.5]});
    watch.observe(card);return()=>watch.disconnect();
  },[flying,active]);
  // Section 3's old film plays into colour as it scrolls into view from above.
  useEffect(()=>{
    const handle=owner.current,card=handle?.root?.closest("section");
    if(flying||!active||!handle||!card)return;
    const watch=new IntersectionObserver(([entry])=>{
      if(entry.intersectionRatio>=.5)handle.open();
      else if(!entry.isIntersecting){if(entry.boundingClientRect.top>0)handle.close();else handle.run(false);}
    },{root:panel.current,threshold:[0,.5]});
    watch.observe(card);return()=>watch.disconnect();
  },[flying,active]);
  // Section 4 animates its dust only while the page is shown.
  useEffect(()=>{if(!active)feedback.current?.run(false);},[active]);
  // Section 4 plays its eras as it scrolls into view and waits as old film again once it has left upwards.
  useEffect(()=>{
    const handle=feedback.current,card=handle?.root?.closest("section"),scroll=panel.current;
    if(flying||!active||!handle||!card||!scroll)return;
    // Opened straight onto it, the eras wait (as old film) until the page has finished loading, so they never stutter.
    let calm=false,waiting=false,timer=0;
    const playWhenSettled=()=>{
      clearTimeout(timer);
      if(calm&&waiting)timer=window.setTimeout(()=>{waiting=false;handle.play();},150);
    };
    const cancel=whenCalm(()=>{calm=true;playWhenSettled();});
    const watch=new IntersectionObserver(([entry])=>{
      waiting=entry.intersectionRatio>=.5;
      if(!entry.isIntersecting){handle.run(false);if(entry.boundingClientRect.top>0)handle.reset();}
      playWhenSettled();
    },{root:scroll,threshold:[0,.5]});
    scroll.addEventListener("scroll",playWhenSettled,{passive:true});
    watch.observe(card);return()=>{cancel();clearTimeout(timer);scroll.removeEventListener("scroll",playWhenSettled);watch.disconnect();};
  },[flying,active]);
  useLayoutEffect(()=>{
    const node=panel.current;
    if(node&&active)node.scrollTop=(initialSection-1)*node.clientHeight;
  },[active,initialSection]);
  useEffect(()=>{
    if(!active||!flying)return;
    if(initialSection===3){owner.current?.run(true);whites.current[2]?.reveal(()=>owner.current?.open());}
    if(initialSection===4){
      feedback.current?.run(true);
      return whenCalm(()=>whites.current[3]?.reveal(()=>feedback.current?.play()));
    }
  },[active,flying,initialSection]);
  useEffect(()=>{
    const node=panel.current;if(!node||!active)return;
    if(flying&&control.current.where==="flight")node.style.overflow="hidden";
    const scroller=flying?node.querySelector<HTMLElement>('[data-rope-scroller]'):null;
    (scroller??node).focus({preventScroll:true});
    let touchY=0;
    // True while the visitor is at the very start of Section 1: resting on it, or in the first connection before any of it has been flown.
    const atFilm=()=>{
      if(journeyControls.read().phase!=="page")return false;
      if(control.current.where==="rest")return node.scrollTop<=2;
      const scroller=flightIndex.current===0?node.querySelector<HTMLElement>("[data-rope-scroller]"):null;
      return !!scroller&&scroller.scrollTop<=1;
    };
    // The reel takes the scroll first while it is on screen; once it has burnt to white the page carries on to the white portal.
    // Scrolling back up at the start of Section 1 brings the reel back.
    const toFilm=(distance:number)=>{
      const reel=film.current;if(!reel||!atFilm())return false;
      if(reel.showing())return reel.input(distance);
      return distance<0&&reel.input(distance);
    };
    const advance=(distance:number)=>{
      const now=performance.now(),fresh=now-lastInput.current>220;lastInput.current=now;
      if(toFilm(distance))return true;
      if(control.current.where==="flight"||journeyControls.read().phase!=="page")return false;
      const height=node.clientHeight,at=Math.round(node.scrollTop/height),onBoundary=Math.abs(node.scrollTop-at*height)<=2;
      // Section 4's cards take the scroll first, one card per gesture, like Section 1's reel.
      if(at===3&&onBoundary&&feedback.current?.input(distance))return true;
      const next=distance>0&&at<3?at:distance<0&&at>0&&at<=3?at-1:-1;
      if(flying&&onBoundary&&next>=0){
        if(covering.current)return true;
        const fly=()=>{covering.current=false;if(at===3)feedback.current?.run(false);if(at===2)owner.current?.run(false); /* the section left is under the flight now: its dust and films rest */ control.current.where="flight";node.style.overflow="hidden";setFlight(old=>({index:next,startAtEnd:distance<0,autoEnter:true,entry:old.entry+1,entryDistance:distance}));};
        // Leaving a section upwards: the white rises over it first, so the flight back starts from the same white portal.
        const portal=distance<0?(next===0?about.current:whites.current[at]):null;
        if(fresh&&portal){covering.current=true;node.style.overflow="hidden";portal.cover(fly);}
        else if(fresh)fly();
        return true;
      }
      if(!returnToCorridor||distance<=0||!fresh||!pageAtBottom(node.scrollTop,node.scrollHeight,height))return false;
      traceMark("Final page section reached");pageReturn.reset();
      journeyControls.update({phase:"pageReturnLoading",panelStage:0,pageAtEnd:true});
      return true;
    };
    const wheel=(event:WheelEvent)=>{if(event.ctrlKey||event.metaKey)return;const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?node.clientHeight:1);if(advance(pixels))event.preventDefault();};
    const start=(event:TouchEvent)=>{touchY=event.touches[0]?.clientY??0;};
    const move=(event:TouchEvent)=>{const y=event.touches[0]?.clientY??touchY;if(advance(touchY-y))event.preventDefault();touchY=y;};
    const key=(event:KeyboardEvent)=>{const direction=['ArrowDown','PageDown',' '].includes(event.key)?100:['ArrowUp','PageUp'].includes(event.key)?-100:0;if(direction&&advance(direction))event.preventDefault();};
    node.addEventListener("wheel",wheel,{passive:false});node.addEventListener("touchstart",start,{passive:true});node.addEventListener("touchmove",move,{passive:false});node.addEventListener("keydown",key);
    return()=>{node.removeEventListener("wheel",wheel);node.removeEventListener("touchstart",start);node.removeEventListener("touchmove",move);node.removeEventListener("keydown",key);};
  },[active,flying,returnToCorridor]);
  return <div ref={panel} className="normal-page" data-snap={flying?undefined:""} tabIndex={-1} aria-label="Page sections" inert={!active} style={active?undefined:{visibility:"hidden",opacity:0,pointerEvents:"none"}}>
    {/* isolate: a section's own layers (its white portal is z-index 5) stay inside it. Flying back, the page still rests on
        the section being left, and its white used to be drawn over the whole flight, so the tunnel was never seen. */}
    {SECTION_COLOURS.map((colour,index)=><section key={index} aria-label={SECTION_COPY[index].title} style={{background:colour,isolation:"isolate"}}>{index===1?<AboutCard ref={about} live start={initialSection<=1?"wait":initialSection===2?"reveal":"clean"}/>:index===2?<OwnerCard ref={owner} live start={initialSection<=2||(flying&&initialSection===3)?"old":initialSection===3?"play":"done"}/>:index===3?<FeedbackScene ref={feedback} live start={initialSection<=3||flying?"old":"play"}/>:null}{flying&&index>=2?<SectionWhite ref={white=>{whites.current[index]=white;}} covered={index>=2&&index===initialSection-1}/>:null}</section>)}
    {flying?<SectionFlight device={device} interactive={interactive} blue={flight.index===1} yellow={flight.index===2} first={SECTION_COLOURS[flight.index]} second="#ffffff" startAtEnd={flight.startAtEnd} autoEnter={flight.autoEnter} entry={flight.entry} entryDistance={flight.entryDistance} control={control} onArrive={arrived} onFailure={flightFailed} destination={null}>
      {flight.index===1?<AboutCard/>:flight.index===2?<OwnerCard/>:null}
    </SectionFlight>:null}
    <FilmReel handle={film} running={active} ended={initialSection>1} onExit={filmDone}/>
  </div>;
}
