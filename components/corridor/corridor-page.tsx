"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Mesh, Object3D, PerspectiveCamera, Scene, Vector3 } from "three";
import { PAGE_POSE } from "./full-journey";
import { journeyControls, type JourneyPhase } from "./journey-controls";
import { projectorControls } from "./projector-controls";
import LiquidPearl,{type LiquidPearlMesh} from "./liquid-pearl";
import { effectQuality } from "./effect-quality";
import { compileHiddenGPU,prepareHiddenGPU } from "./hidden-gpu-preparation";
import { scheduleSceneIdle,sceneMotion } from "./scene-idle";
import { traceMark,traceSpan } from "./loading-trace";
import { pageReturn } from "./page-exit";
import { pageCoverScale,pageEase } from "./liquid-page-motion";

/** The pearl's steady turn (rad/s) and its slow, precessing tilt. */
const PEARL_SPIN=.42;
const MORPH_SECONDS=2;
const pearlTilt=(spin:number)=>.13*Math.sin(spin*.5);

const visiblePhases=new Set<JourneyPhase>(["screensDone","corridor","panel"]);

/** A single closed surface turns into the first section in one continuous shot. */
export default function CorridorPage({phase}:{phase:JourneyPhase}){
  const {camera,size,invalidate,gl}=useThree();
  const mesh=useRef<LiquidPearlMesh>(null),ready=useRef(false);
  const motion=useRef({elapsed:0,complete:false,flow:0,spin:0,startSpin:0});
  const reduce=useRef(false);
  const fov=camera instanceof PerspectiveCamera?camera.fov:40;
  const width=Math.min(6,2*Math.tan(fov*Math.PI/360)*14*size.width/Math.max(1,size.height)*.35);
  const visible=visiblePhases.has(phase);
  const mobile=effectQuality(gl)==="mobile";
  // Section 1's code, model and pictures load at a resting stop, not at the liquid handoff (a 0.5 s hitch on phones).
  useEffect(()=>scheduleSceneIdle(()=>{void import("../film-reel/film-reel").catch(()=>{});void import("../film-reel/film-strip").then(m=>m.preloadFilmStrip()).catch(()=>{});},30),[]);
  const placement=useMemo(()=>{
    const origin=new Vector3(...PAGE_POSE.position),direction=new Vector3(...PAGE_POSE.target).sub(origin).normalize();
    const facing=new Object3D();facing.position.copy(origin).addScaledVector(direction,14);facing.lookAt(origin);
    const right=new Vector3(1,0,0).applyQuaternion(facing.quaternion);
    const light=right.clone().multiplyScalar(-.65).add(new Vector3(0,.8,0)).addScaledVector(direction,-.45).normalize();
    return {origin,direction,rotation:facing.quaternion.clone(),light};
  },[]);

  useEffect(()=>{
    mesh.current?.material.uniforms.uLightDirection.value.copy(placement.light);
    const query=matchMedia("(prefers-reduced-motion: reduce)");
    const update=()=>{reduce.current=query.matches;invalidate();};
    update();query.addEventListener("change",update);
    return()=>query.removeEventListener("change",update);
  },[placement,invalidate]);

  // Prepare privately at an earlier stationary stop, never at the corridor entrance.
  useEffect(()=>{
    let active=true,cancelDraw=()=>{};
    const cancel=scheduleSceneIdle(()=>{
      if(!mesh.current)return;
      const probe=new Mesh(mesh.current.geometry,mesh.current.material),privateScene=new Scene();privateScene.add(probe);
      const end=traceSpan("Liquid page GPU preflight","shader/resource preparation",{triangles:probe.geometry.index!.count/3,mobile});
      void compileHiddenGPU(gl,privateScene,camera).then(()=>{
        if(!active)return;
        cancelDraw=scheduleSceneIdle(()=>{
          try{prepareHiddenGPU(gl,privateScene,camera,[probe]);ready.current=true;end();traceMark("Liquid page GPU ready");invalidate();}
          catch(error){end({error:String(error)});console.error("Liquid page preparation failed",error);}
        },10);
      }).catch(error=>{end({error:String(error)});console.error("Liquid page shader failed",error);});
    },10);
    return()=>{active=false;cancel();cancelDraw();};
  },[gl,camera,invalidate,mobile]);

  // Preserve the full-screen HTML cover until all remounted scene resources are warm.
  useEffect(()=>{
    if(phase!=="pageReturnLoading")return;
    let frame=0,nextFrame=0,cancelled=false;
    const release=()=>{
      if(!projectorControls.read().ready||!pageReturn.prepared||frame||cancelled)return;
      invalidate();frame=requestAnimationFrame(()=>{nextFrame=requestAnimationFrame(()=>{if(!cancelled){traceMark("Page return animation started");journeyControls.update({phase:"logoReveal",pageReturning:true,revealStage:"slide"});}});});
    };
    // The return post effects and projector warm independently under the section.
    const unsubscribe=projectorControls.subscribe(release),timer=setInterval(release,80);invalidate();release();
    return()=>{cancelled=true;clearInterval(timer);unsubscribe();cancelAnimationFrame(frame);cancelAnimationFrame(nextFrame);};
  },[phase,invalidate]);

  useFrame((_,delta)=>{
    const object=mesh.current,s=motion.current;
    if(!object||!visible||!ready.current||s.complete||document.hidden)return;
    const u=object.material.uniforms,step=reduce.current?0:Math.min(delta,.05);
    const playing=phase==="panel";
    if(playing){
      if(s.elapsed===0){
        s.startSpin=Math.atan2(Math.sin(s.spin),Math.cos(s.spin));
        traceMark("Liquid page morph started");
      }
      s.elapsed=reduce.current?MORPH_SECONDS:Math.min(MORPH_SECONDS,s.elapsed+step);
      // The morph is motion, not a rest: background loading and shader work must wait until it covers the screen.
      sceneMotion.at=performance.now();
    }
    s.spin+=step*PEARL_SPIN;s.flow+=step;
    const t=s.elapsed/MORPH_SECONDS,e=pageEase(t),morph=pageEase((t-.035)/.68),flat=pageEase((t-.36)/.64);
    const distance=14*(.6/14)**e;
    const cover=pageCoverScale(size.width/Math.max(1,size.height),fov,.6,width);
    // Ease the projected width itself so the plate fills the frame at the HTML handoff.
    const projected=.72+(cover*14/.6-.72)*e;
    object.position.copy(placement.origin).addScaledVector(placement.direction,distance);
    object.quaternion.copy(placement.rotation);
    object.rotateY(playing?(s.startSpin+s.elapsed*PEARL_SPIN)*(1-morph):s.spin);
    object.rotateX(pearlTilt(s.spin)*(1-morph)-.055*Math.sin(Math.PI*flat));
    object.scale.setScalar(width/2*distance/14*projected);
    u.uMorph.value=morph;u.uFlat.value=flat;
    u.uWave.value=.027*Math.sin(Math.PI*morph)*(1-flat);u.uWavePhase.value=t*9;
    u.uCurl.value=.06*Math.sin(Math.PI*flat);
    u.uTime.value=s.flow;u.uOpacity.value=1;
    if(t===1){
      s.complete=true;traceMark("Liquid page covers viewport");
      queueMicrotask(()=>{if(journeyControls.read().phase==="panel")journeyControls.update({phase:"page"});});
    }else if(playing||!reduce.current)invalidate();
  });
  return <group visible={visible}><LiquidPearl ref={mesh} mobile={mobile}/></group>;
}
