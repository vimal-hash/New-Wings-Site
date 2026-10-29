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
import { scheduleSceneIdle } from "./scene-idle";
import { traceMark,traceSpan } from "./loading-trace";
import { pageCoverScale,pageEase } from "./liquid-page-motion";

const visiblePhases=new Set<JourneyPhase>(["panel","pageReturnLoading","pageReturning","logoReveal"]);

/** A closed liquid surface becomes the existing page; the journey/input contract is unchanged. */
export default function CorridorPage({stage,phase}:{stage:number;phase:JourneyPhase}){
  const {camera,size,invalidate,gl}=useThree();
  const mesh=useRef<LiquidPearlMesh>(null),ready=useRef(false);
  const motion=useRef({started:0,from:14,distance:14,complete:false,reduce:false,returned:false,lastStage:-1,flow:0,fromFlow:0,spin:0,fromSpin:0,fromTilt:0,fromMorph:0,fromFlat:0});
  const fov=camera instanceof PerspectiveCamera?camera.fov:40;
  const width=Math.min(6,2*Math.tan(fov*Math.PI/360)*14*size.width/Math.max(1,size.height)*.35);
  const visible=visiblePhases.has(phase);
  const mobile=effectQuality(gl)==="mobile";
  const placement=useMemo(()=>{
    const origin=new Vector3(...PAGE_POSE.position),direction=new Vector3(...PAGE_POSE.target).sub(origin).normalize();
    const facing=new Object3D();facing.position.copy(origin).addScaledVector(direction,14);facing.lookAt(origin);
    const right=new Vector3(1,0,0).applyQuaternion(facing.quaternion);
    const light=right.clone().multiplyScalar(-.65).add(new Vector3(0,.8,0)).addScaledVector(direction,-.45).normalize();
    return {origin,direction,rotation:facing.quaternion.clone(),right,light};
  },[]);

  useEffect(()=>{mesh.current?.material.uniforms.uLightDirection.value.copy(placement.light);},[placement]);

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
      if(!projectorControls.read().ready||!ready.current||frame||cancelled)return;
      invalidate();frame=requestAnimationFrame(()=>{nextFrame=requestAnimationFrame(()=>{if(!cancelled){traceMark("Page return animation started");journeyControls.update({phase:"pageReturning"});}});});
    };
    // The liquid material and projector warm independently; either can finish last.
    const unsubscribe=projectorControls.subscribe(release),timer=setInterval(release,80);release();
    return()=>{cancelled=true;clearInterval(timer);unsubscribe();cancelAnimationFrame(frame);cancelAnimationFrame(nextFrame);};
  },[phase,invalidate]);

  useEffect(()=>{
    if(!visible)return;
    const s=motion.current;
    if(phase==="panel"&&(s.lastStage===stage||(stage===0&&s.returned)))return;
    s.lastStage=stage;s.from=s.distance;s.started=0;s.complete=false;s.fromFlow=s.flow;
    s.fromSpin=Math.atan2(Math.sin(s.spin),Math.cos(s.spin));s.fromTilt=.06*Math.sin(s.spin*.6);
    s.fromMorph=mesh.current?.material.uniforms.uMorph.value??0;
    s.fromFlat=mesh.current?.material.uniforms.uFlat.value??0;
    s.reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;invalidate();
  },[stage,phase,visible,invalidate]);

  useFrame((_,delta)=>{
    const object=mesh.current,s=motion.current;
    if(!object||!visible||!ready.current||document.hidden)return;
    const u=object.material.uniforms,now=performance.now();
    if(s.complete){
      // The pearl stays alive only at its own stop. Page/rectangle phases remain idle.
      if(phase==="panel"&&stage===0&&!s.returned&&!s.reduce){
        const step=Math.min(delta,.05);s.flow+=step*.70;s.spin+=step*.20;u.uTime.value=s.flow;
        object.quaternion.copy(placement.rotation);object.rotateY(s.spin);object.rotateX(.06*Math.sin(s.spin*.6));invalidate();
      }
      return;
    }
    if(!s.started){s.started=now;if(phase==="panel")traceMark(stage===0?"Liquid sphere entrance started":stage===1?"Liquid page morph started":"Liquid page cover started");}
    if(phase==="logoReveal"){
      const t=s.reduce?1:Math.min(1,(now-s.started)/500);u.uOpacity.value=1-pageEase(t);
      if(t<1)invalidate();else s.complete=true;return;
    }
    if(phase==="pageReturnLoading"||phase==="pageReturning"){
      const t=phase==="pageReturnLoading"?0:s.reduce?1:Math.min(1,(now-s.started)/1500),e=pageEase(t);
      const fullHeight=2*Math.tan(fov*Math.PI/360)*.6;
      s.distance=.6+(14-.6)*e;
      object.position.copy(placement.origin).addScaledVector(placement.direction,s.distance);object.quaternion.copy(placement.rotation);
      const startX=fullHeight*size.width/size.height/width*1.002,startY=fullHeight/(width/1.5)*1.002;
      object.scale.set((startX+(1-startX)*e)*width/2,(startY+(1-startY)*e)*width/2,width/2);
      u.uMorph.value=1;u.uFlat.value=1;u.uOpacity.value=1;
      if(phase==="pageReturning")invalidate();
      if(t===1){s.complete=true;s.returned=true;queueMicrotask(()=>journeyControls.update({phase:"panel",panelStage:0,panelReady:true}));}
      return;
    }
    const t=s.reduce?1:Math.min(1,(now-s.started)/(stage===0?1300:1100)),e=pageEase(t);
    const destination=stage===0?14:stage===1?6:.6;
    s.distance=s.from+(destination-s.from)*e;
    object.position.copy(placement.origin).addScaledVector(placement.direction,s.distance);
    object.quaternion.copy(placement.rotation);
    if(stage===1){object.rotateY(s.fromSpin*(1-e));object.rotateX(s.fromTilt*(1-e));}
    object.rotateZ(stage===1?-.09*Math.sin(Math.PI*e):0);
    const cover=stage===2?pageCoverScale(size.width/size.height,fov,.6,width):1;
    object.scale.setScalar(width/2*(stage===0?.72:stage===1?.72+.28*e:1+(cover-1)*e));
    u.uMorph.value=stage===0?0:s.fromMorph+(1-s.fromMorph)*e;
    u.uFlat.value=stage===2?s.fromFlat+(1-s.fromFlat)*e:0;
    s.flow=s.fromFlow+(stage===0?1.2:1.4)*e;u.uTime.value=s.flow;
    u.uOpacity.value=stage===0?pageEase(Math.min(1,t*3)):1;
    invalidate();
    if(t===1){s.complete=true;traceMark(stage===0?"Liquid sphere settled":stage===1?"Liquid rectangle settled":"Liquid page covers viewport");queueMicrotask(()=>journeyControls.update(stage===2?{phase:"page"}:{panelReady:true}));}
  });
  return <group visible={visible}><LiquidPearl ref={mesh} mobile={mobile} pageColour={journeyControls.read().pageAtEnd?"#c8b6aa":"white"}/></group>;
}
