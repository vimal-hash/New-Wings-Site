"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color,Matrix4, PerspectiveCamera, Quaternion, Vector3 } from "three";
import reference from "./reference-camera.json";
import route from "./scene-route.json";
import projector from "./projector-assets.json";
import { createJourneySampler } from "./journey";
import { projectorControls } from "./projector-controls";
import { journeyControls, type JourneyPhase } from "./journey-controls";
import type { MetricsStore } from "./metrics";
import { createLogoReveal, LOGO_FOV } from "./logo-reveal";
import { revealScrollTarget } from "./reveal-scroll";
import { createExitStages } from "./exit-stages";
import logoBounds from "./logo-reveal.json";
import layout from "./blender-layout.json";
import { traceMark } from "./loading-trace";
import {createTheatreOpeningClock,OPENING_CAMERA_START,OPENING_CAMERA_END,theatreOpening,theatreOpeningShot,openingReviewTime} from './theatre-opening-state';
import { updateStageLighting } from "./stage-lighting";
import {pupilFillProgress,pupilFillState} from "./pupil-fill";
import {cinemaShot} from './cinema-controls';
import {diagonalTransition,diagonalEyeZoom} from './diagonal-transition';
import {lensControls} from './lens-controls';
import {createViewOneLens} from './view-one-lens';
import {viewOneLensWeight} from './lens-motion';


const smooth = (t: number) => t*t*t*(t*(t*6-15)+10);
const screensIndex = route.samples.findIndex(sample => sample.position[2] <= -55 + reference.stop[2] + 14.2);
const passage = createJourneySampler(route.samples.slice(screensIndex), route.up);
export const PAGE_POSE = (() => {
  const position = new Vector3(), rotation = new Quaternion();
  passage.sample(1, position, rotation);
  position.y=projector.centre_blender[2]+.1;
  return { position: position.toArray() as [number,number,number], target: new Vector3(0,0,-1).applyQuaternion(rotation).multiplyScalar(14).add(position).toArray() as [number,number,number] };
})();

/** Original deliberate-shot timings; the curved leg uses the audited Blender centreline. */
export default function FullJourney({ metrics, orbit }: { metrics: MetricsStore; orbit: boolean }) {
  const { camera, invalidate, size,scene } = useThree();
  const livingLens=useMemo(()=>createViewOneLens(),[]),lensTouch=useRef(false);
  useEffect(()=>{
    const touch=matchMedia('(hover: none)');
    const changed=()=>{lensTouch.current=touch.matches;livingLens.reset();invalidate();};changed();
    const pointer=(event:PointerEvent)=>{if(event.pointerType!=='mouse'){lensTouch.current=true;livingLens.pointer(0,0);return;}if(journeyControls.read().phase!=='logoReveal'||viewOneLensWeight(cinemaShot.stage,cinemaShot.progress)===0)return;lensTouch.current=false;const ui=event.target instanceof Element&&event.target.closest('[data-cinema-controls]');livingLens.pointer(ui?0:event.clientX/innerWidth*2-1,ui?0:event.clientY/innerHeight*2-1);invalidate();};
    const leave=()=>{livingLens.pointer(0,0);invalidate();};
    const unsubscribe=lensControls.subscribe(invalidate);
    window.addEventListener('pointermove',pointer,{passive:true});window.addEventListener('blur',leave);document.documentElement.addEventListener('pointerleave',leave);touch.addEventListener('change',changed);
    return()=>{unsubscribe();window.removeEventListener('pointermove',pointer);window.removeEventListener('blur',leave);document.documentElement.removeEventListener('pointerleave',leave);touch.removeEventListener('change',changed);};
  },[invalidate,livingLens]);
  useEffect(()=>diagonalTransition.subscribe(invalidate),[invalidate]);
  const corridorBackground=useMemo(()=>new Color("#11151a"),[]);
  const reveal = useMemo(()=>{
    const initialRotation=new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(new Vector3(...PAGE_POSE.position),new Vector3(...PAGE_POSE.target),new Vector3(0,1,0)));
    return createLogoReveal(logoBounds.blenderBounds,layout.slides[1],PAGE_POSE.position[1],size.width/Math.max(1,size.height),new Vector3(...PAGE_POSE.position),initialRotation);
  },[size.width,size.height]);
  const exitStages=useRef(createExitStages());
  const openingClock=useRef(createTheatreOpeningClock());

  const openingReview=useMemo(()=>typeof window==='undefined'?undefined:openingReviewTime(location.search,location.hostname),[]);
  const openingEnd=useMemo(()=>new Vector3(...OPENING_CAMERA_END),[]);
  const state = useRef({ phase: (journeyControls.read().pageAtEnd ? "panel" : "intro") as JourneyPhase, pendingReveal:0,revealFov:40, resumeCamera: journeyControls.read().pageAtEnd, pendingScreens:false, elapsed: 0, last: 0, leg: 0, queuedLeg: false, amount: 0, lastInput: 0, lockedUntil: 0, touchY: 0, reduce: false, panelStage: 0,
    pendingProjector:false,introQueued:false,openingPreparedSeen:false,from: new Vector3(), fromFocus: new Vector3(...reference.screenCentre), focus: new Vector3(...reference.screenCentre), to: new Vector3(), q: new Quaternion() });
  const points = useMemo(() => {
    const [x,y,z] = projector.centre_blender;
    const centre = new Vector3(x,z,-y);
    return { centre, stop: new Vector3(...reference.stop), wide: centre.clone().add(new Vector3(0,.25,-9.5)), close: centre.clone().add(new Vector3(-2.7,1.8,-2.7)), returned: centre.clone().add(new Vector3(0,.1,-6)), screens: new Vector3().fromArray(route.samples[screensIndex].position).setY(centre.y+.1), position: new Vector3(), rotation: new Quaternion() };
  }, []);
  useEffect(() => {
    const s = state.current;
    let previousPhase=journeyControls.read().phase;
    const unsubscribeJourney=journeyControls.subscribe(()=>{
      const next=journeyControls.read().phase;
      if(previousPhase==="pageReturning" && next==="panel") {
        s.amount=0;s.panelStage=0;s.lastInput=performance.now();s.last=s.lastInput;
        s.revealFov=camera instanceof PerspectiveCamera?camera.fov:40;
        exitStages.current.reset(Math.min(.3,s.pendingReveal));s.pendingReveal=0;
        s.phase="logoReveal";invalidate();
        // Avoid nesting store notifications while the page return is completing.
        queueMicrotask(()=>journeyControls.update({phase:"logoReveal"}));
      }
      previousPhase=next;
    });

    const phase = (next: JourneyPhase) => { s.phase=next;s.elapsed=0;s.last=performance.now();journeyControls.update({phase:next});invalidate(); };
    const begin = (next: JourneyPhase, target: Vector3) => { s.from.copy(camera.position);s.fromFocus.copy(s.focus);s.to.copy(target);phase(next); };
    // Temporary buttons reuse the authored samplers and end-of-journey lighting.
    const preview=(event:Event)=>{
      const view=(event as CustomEvent).detail;if(view!=="slide"&&view!=="turned"&&view!=="final")return;
      theatreOpening.house.value=1;
      s.phase=view==='final'?'logoDone':"logoReveal";s.resumeCamera=false;s.pendingProjector=false;s.pendingScreens=false;s.pendingReveal=0;
      s.amount=0;s.elapsed=0;s.last=performance.now();s.lockedUntil=0;s.revealFov=LOGO_FOV;
      exitStages.current.preview(view==='final'?'done':view);updateStageLighting(576,true);
      metrics.update({progress:1,waitingForProjector:false,waitingForCorridor:false});
      journeyControls.update({phase:s.phase,revealStage:view==='final'?'done':view,reviewCamera:true,openingMoving:false,cinemaStage:'clear'});invalidate();
    };
    window.addEventListener("eye-camera-view",preview);
    const unsubscribe = projectorControls.subscribe(() => {
      const p = projectorControls.read();
      if(p.ready && s.pendingProjector)invalidate();
      if(s.phase==="reveal" && p.phase==="exploded") { s.amount=0;phase("awaitAssembly"); }
      if(s.phase==="awaitAssembly" && p.phase==="assembling") phase("returnHold");
    });
    const advance = (distance: number) => {
      const now=performance.now(), previous=s.lastInput;s.lastInput=now;
      const pagePhase=journeyControls.read().phase;
      if(pagePhase==="pageReturnLoading" || pagePhase==="pageReturning"){
        s.pendingReveal=revealScrollTarget(s.pendingReveal,distance,innerHeight);s.amount=0;return;
      }
      if(!orbit && (s.phase==="logoReveal" || s.phase==="logoDone")){
        if(journeyControls.read().reviewCamera)journeyControls.update({reviewCamera:false});
        exitStages.current.input(distance,now,innerHeight);
        invalidate();return;
      }
      if(orbit || distance<=0 || now<s.lockedUntil || (previous<s.lockedUntil && now-previous<180)) return;
      if(s.phase==="intro"){
        return;
      }
      const canQueue=s.phase==="pullback" && s.leg===1 && !s.queuedLeg;
      if(!["idle","awaitAssembly","done","screensDone","panel"].includes(s.phase) && !canQueue) return;
      s.amount+=Math.min(distance,100);if(s.amount<100)return;s.amount=0;
      // The first pullback remains usable while the offscreen projector loads.
      // Preserve the next scroll intent and start it when the effect is ready.
      if((canQueue || (s.phase==="idle"&&s.leg===1))&&!projectorControls.read().ready){
        s.pendingProjector=true;metrics.update({waitingForProjector:true});invalidate();return;
      }
      if(canQueue) s.queuedLeg=true;
      else if(s.phase==="idle") { s.leg++;begin("pullback",points.stop.clone().lerp(points.wide,s.leg===1?.72:1)); }
      else if(s.phase==="awaitAssembly") projectorControls.play("assembling");
      else if(s.phase==="done") {
        if(!metrics.read().corridorReady) {s.pendingScreens=true;metrics.update({waitingForCorridor:true});invalidate();return;}
        begin("screens",points.screens);
      }
      else if(s.phase==="screensDone") { s.from.copy(camera.position);s.q.copy(camera.quaternion);phase("corridor"); }
      else if(s.phase==="panel" && journeyControls.read().panelReady) {
        if(journeyControls.read().pageAtEnd){s.revealFov=camera instanceof PerspectiveCamera?camera.fov:40;exitStages.current.reset();phase("logoReveal");}
        else {s.panelStage=Math.min(2,s.panelStage+1);s.lockedUntil=now+1100;journeyControls.update({panelStage:s.panelStage,panelReady:false});}
      }
      s.lockedUntil=Math.max(s.lockedUntil,now+220);
    };
    const tuningInput=(e:Event)=>e.target instanceof Element&&!!e.target.closest('[data-cinema-controls]');
    const wheel=(e:WheelEvent)=>{ if(tuningInput(e)||orbit || journeyControls.read().phase==="page" || e.ctrlKey || e.metaKey)return;e.preventDefault();advance(e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?innerHeight:1)); };
    const touchStart=(e:TouchEvent)=>{if(e.touches.length===1)s.touchY=e.touches[0].clientY;};
    const touchMove=(e:TouchEvent)=>{if(tuningInput(e)||orbit||journeyControls.read().phase==="page"||e.touches.length!==1)return;e.preventDefault();const y=e.touches[0].clientY;advance(s.touchY-y);s.touchY=y;};
    const key=(e:KeyboardEvent)=>{if(tuningInput(e)||orbit||journeyControls.read().phase==="page")return;if(e.key===" "&&(e.target instanceof HTMLButtonElement||e.target instanceof HTMLAnchorElement))return;if(["ArrowDown","PageDown"," ","ArrowUp","PageUp"].includes(e.key)){e.preventDefault();advance(e.key==="ArrowUp"||e.key==="PageUp"?-180:180);}};
    const query=matchMedia("(prefers-reduced-motion: reduce)");
    const preference=()=>{s.reduce=query.matches;};preference();
    const visibility=()=>{s.last=performance.now();if(!document.hidden)invalidate();};
    window.addEventListener("wheel",wheel,{passive:false});window.addEventListener("touchstart",touchStart,{passive:true});window.addEventListener("touchmove",touchMove,{passive:false});window.addEventListener("keydown",key);
    document.addEventListener("visibilitychange",visibility);query.addEventListener("change",preference);
    return()=>{unsubscribe();unsubscribeJourney();window.removeEventListener("eye-camera-view",preview);window.removeEventListener("wheel",wheel);window.removeEventListener("touchstart",touchStart);window.removeEventListener("touchmove",touchMove);window.removeEventListener("keydown",key);document.removeEventListener("visibilitychange",visibility);query.removeEventListener("change",preference);};
  },[camera,invalidate,orbit,points,metrics]);

  /* eslint-disable react-hooks/immutability -- Camera projection/clipping are imperative Three.js state. */
  useFrame(()=>{
    const s=state.current, now=performance.now();
    theatreOpening.active.value=s.phase==='intro'?1:0;
    if(s.phase!=='intro')theatreOpening.room.value=1;
    if(s.phase!=="logoReveal"&&s.phase!=="logoDone")pupilFillState.value=0;
    const dt=s.last?Math.max(0,(now-s.last)/1000):0;s.last=now;
    if(s.resumeCamera){camera.position.fromArray(PAGE_POSE.position);camera.lookAt(...PAGE_POSE.target);metrics.update({progress:1});s.resumeCamera=false;}
    const houseTarget=s.phase==='intro'||s.phase==='idle'?0:1;
    theatreOpening.house.value+=(houseTarget-theatreOpening.house.value)*(1-Math.exp(-Math.min(.05,dt)*3));
    if(Math.abs(houseTarget-theatreOpening.house.value)>.001)invalidate();
    if(orbit || document.hidden)return;
    const change=(phase:JourneyPhase)=>{s.phase=phase;s.elapsed=0;queueMicrotask(()=>journeyControls.update({phase}));};
    if(s.pendingProjector&&s.phase==="idle"&&projectorControls.read().ready){
      s.pendingProjector=false;s.leg=2;s.from.copy(camera.position);s.fromFocus.copy(s.focus);s.to.copy(points.wide);
      metrics.update({waitingForProjector:false});change("pullback");
    }
    if(s.pendingScreens && metrics.read().corridorReady) {
      s.pendingScreens=false;metrics.update({waitingForCorridor:false});
      s.from.copy(camera.position);s.fromFocus.copy(s.focus);s.to.copy(points.screens);change("screens");
    }
    if(s.phase==="logoReveal" || s.phase==="logoDone") {
      const shot=exitStages.current.tick(dt,now,s.reduce);
      cinemaShot.stage=shot.stage;cinemaShot.progress=shot.progress;
      pupilFillState.value=pupilFillProgress(shot.stage,shot.progress);
      if(shot.stage==="slide"||shot.stage==="top")reveal.sampleSlide(shot.progress,points.position,points.rotation);
      else if(shot.stage==="turn"||shot.stage==="turned")reveal.sampleTurn(shot.progress,points.position,points.rotation);
      else reveal.samplePullback(shot.progress,points.position,points.rotation);
      const t=shot.stage==="slide"||shot.stage==="top"?0:shot.stage==="turn"||shot.stage==="turned"?.25*smooth(shot.progress):.25+.75*smooth(shot.progress);
      if(scene.background instanceof Color)scene.background.copy(corridorBackground).multiplyScalar(1-smooth(Math.min(1,t/.25)));
      camera.position.copy(points.position);camera.quaternion.copy(points.rotation);camera.up.set(0,1,0).applyQuaternion(points.rotation);
      if(camera instanceof PerspectiveCamera){camera.setFocalLength(camera.getFilmHeight()/(2*Math.tan((s.revealFov+(LOGO_FOV-s.revealFov)*smooth(t))*Math.PI/360)));camera.far=reveal.far;camera.updateProjectionMatrix();}
      if(shot.stage==='done'&&camera instanceof PerspectiveCamera){
        // The existing final shot stays centred. Change only its magnification
        // during the following section, rendering native-resolution grains.
        const tangent=Math.tan(camera.fov*Math.PI/360);
        const diameter=(logoBounds.blenderBounds[0][1]-logoBounds.blenderBounds[0][0])*size.height/(2*tangent*(reveal.finalPosition.y-logoBounds.blenderBounds[2][1]));
        diagonalTransition.setPupilDiameter(diameter);
        camera.fov=2*Math.atan(tangent/diagonalEyeZoom(diagonalTransition.progress))*180/Math.PI;
        camera.updateProjectionMatrix();
      }
      if(camera instanceof PerspectiveCamera&&livingLens.apply(camera,shot.stage,shot.progress,Math.min(.05,dt),s.reduce||lensTouch.current,camera.position.distanceTo(reveal.centre)))invalidate();
      if(shot.moving)invalidate();
      if(shot.stage!==journeyControls.read().revealStage)queueMicrotask(()=>journeyControls.update({revealStage:shot.stage}));
      if(shot.stage==="done" && s.phase!=="logoDone")change("logoDone");
      return;
    }
    if(s.phase==="intro") {
      // Enforce the screen-facing pose even before assets/FX are ready.
      if(!metrics.read().firstFrame){theatreOpening.room.value=0;camera.position.fromArray(OPENING_CAMERA_START);camera.lookAt(...reference.screenCentre as [number,number,number]);invalidate();return;}
      const prepared=journeyControls.read().openingPrepared;
      const shot=openingReview===undefined?openingClock.current.tick(dt,theatreOpening.geometryReady,prepared,s.reduce):{...theatreOpeningShot(prepared&&theatreOpening.geometryReady?openingReview:0),elapsed:prepared&&theatreOpening.geometryReady?openingReview:0};
      theatreOpening.room.value=shot.room;theatreOpening.trace.value=shot.trace;theatreOpening.white.value=shot.white;theatreOpening.lineOpacity.value=shot.lineOpacity;
      theatreOpening.stage=shot.stage;theatreOpening.elapsed=shot.elapsed;
      if(journeyControls.read().openingStage!==shot.stage)queueMicrotask(()=>journeyControls.update({openingStage:shot.stage}));
      if(shot.progress>0&&!journeyControls.read().openingMoving){traceMark("Opening motion started");queueMicrotask(()=>journeyControls.update({openingMoving:true}));}
      camera.position.fromArray(OPENING_CAMERA_START).lerp(openingEnd,shot.position);
      s.focus.set(reference.screenCentre[0],OPENING_CAMERA_START[1]+(OPENING_CAMERA_END[1]-OPENING_CAMERA_START[1])*shot.position,reference.screenCentre[2]);
      camera.lookAt(s.focus);
      if(openingReview!==undefined&&prepared&&theatreOpening.geometryReady)return;
      if(shot.done){
        traceMark("Opening camera settled");
        s.amount=0;s.lockedUntil=now+240;change("idle");
      }else invalidate();return;
    }
    if(["idle","reveal","awaitAssembly","done","screensDone","panel","page"].includes(s.phase))return;
    s.elapsed+=dt;
    if(s.phase==="hold") {if(s.elapsed<.3){invalidate();return;}s.from.copy(camera.position);s.fromFocus.copy(s.focus);s.to.copy(points.close);change("approach");}
    if(s.phase==="returnHold") {if(s.elapsed<1){invalidate();return;}s.from.copy(camera.position);s.fromFocus.copy(s.focus);s.to.copy(points.returned);change("return");}
    const duration=s.phase==="approach"?1.4:s.phase==="corridor"?1.8:s.phase==="return"||s.phase==="screens"?.9:.5;
    const t=s.reduce?1:Math.min(1,s.elapsed/duration), eased=s.phase==="corridor"?1-(1-t)**4:smooth(t);
    if(s.phase==="corridor") {
      passage.sample(eased,points.position,points.rotation);camera.position.copy(points.position).setY(points.returned.y);
      // Blend only the starting pose, then use one centreline sample for position and view.
      camera.quaternion.copy(s.q).slerp(points.rotation,smooth(Math.min(1,eased/.15)));
      metrics.update({progress:eased});
    } else {
      camera.position.lerpVectors(s.from,s.to,eased);
      if(s.phase==="pullback"&&s.leg===1)camera.position.setY(camera.position.y+Math.sin(Math.PI*eased)*3.2);
      const target=s.phase==="screens"?points.position.copy(points.screens).setZ(points.screens.z+20):points.centre;
      s.focus.lerpVectors(s.fromFocus,target,eased);camera.lookAt(s.focus);
    }
    invalidate();
    if(t===1){
      if(s.phase==="pullback") {
        if(s.leg===1 && s.queuedLeg){s.leg=2;s.queuedLeg=false;s.from.copy(camera.position);s.fromFocus.copy(s.focus);s.to.copy(points.wide);change("pullback");}
        else change(s.leg===2?"hold":"idle");
      }
      else if(s.phase==="approach"){change("reveal");queueMicrotask(()=>projectorControls.play("particles"));}
      else if(s.phase==="return")change("done");
      else if(s.phase==="screens")change("screensDone");
      else if(s.phase==="corridor")change("panel");
    }
  },-1);
  /* eslint-enable react-hooks/immutability */
  return null;
}

