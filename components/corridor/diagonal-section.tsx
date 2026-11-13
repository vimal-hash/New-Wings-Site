"use client";

import {useEffect,useRef} from 'react';
import {journeyControls} from './journey-controls';
import {createDiagonalSectionState,diagonalSectionClip,diagonalSectionMask} from './diagonal-section-state';
import {diagonalFeatherControls} from './diagonal-feather-controls';
import {diagonalTransition,diagonalEyeZoom} from './diagonal-transition';
import BrandArtwork from './brand-artwork';
import {brandRevealPoint} from './brand-reveal';
import {createBrandMotion} from './brand-motion';
import {createBrandCamera} from './brand-camera';

/** One shared feather reveals white and the colour mark across the silver pupil. */
export default function DiagonalSection(){
  const section=useRef<HTMLElement>(null);
  const logo=useRef<HTMLDivElement>(null);
  const artwork=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const element=section.current;if(!element)return;
    const motion=createDiagonalSectionState(),preference=matchMedia('(prefers-reduced-motion: reduce)');
    let frame=0,last=0,touchY:number|null=null;
    const artMotion=createBrandMotion(element,artwork.current!,preference);
    const brandCamera=createBrandCamera(element);
    const active=()=>journeyControls.read().phase==='logoDone';
    const typing=(event:Event)=>event.target instanceof Element&&!!event.target.closest('[data-cinema-controls],input,textarea,select,[contenteditable="true"]');
    function paint(progress:number){
      const feather=diagonalFeatherControls.read(),mask=diagonalSectionMask(progress,innerWidth,innerHeight,feather);
      element!.style.clipPath=diagonalSectionClip(progress,innerWidth,innerHeight,mask==='none'?0:feather);
      element!.style.maskImage=mask;element!.style.setProperty('-webkit-mask-image',mask);
      element!.style.visibility=progress>0?'visible':'hidden';
      element!.style.pointerEvents=progress>0?'auto':'none';
      element!.dataset.progress=progress.toFixed(5);
      element!.dataset.feather=String(feather);
      diagonalTransition.setProgress(progress);
      const zoom=diagonalEyeZoom(progress);
      element!.dataset.eyeZoom=zoom.toFixed(4);
      // The camera supplies the real, unzoomed projected pupil diameter. Keep
      // source pixels intact; the SVG viewBox removes only the PNG's margins.
      const diameter=diagonalTransition.pupilDiameter||Math.min(innerWidth,innerHeight)*.245;
      const logoWidth=diameter*zoom*1.17;
      if(logo.current)logo.current.style.width=`${logoWidth.toFixed(3)}px`;
      element!.style.setProperty('--brand-logo-width',`${logoWidth.toFixed(3)}px`);
      const entrancePoint=brandRevealPoint(innerWidth,innerHeight,logoWidth,feather);
      element!.dataset.brandEntrancePoint=entrancePoint.toFixed(5);
      artMotion.update(progress>=entrancePoint,progress>0);
      brandCamera.update(progress,entrancePoint);
      element!.setAttribute('aria-hidden',progress>0?'false':'true');
    }
    function publish(covered:boolean){if(journeyControls.read().finalCovered!==covered)journeyControls.update({finalCovered:covered});}
    function tick(now:number){
      frame=0;
      if(!active())return;
      const result=motion.tick(last?(now-last)/1000:1/60,preference.matches);last=now;
      paint(result.progress);publish(result.covered);
      if(result.moving)frame=requestAnimationFrame(tick);else last=0;
    }
    function wake(){if(!frame){last=0;frame=requestAnimationFrame(tick);}}
    function move(delta:number){motion.move(delta,innerHeight);wake();}
    function wheel(event:WheelEvent){
      if(!active()||typing(event)||event.ctrlKey||event.metaKey)return;
      event.preventDefault();event.stopImmediatePropagation();
      move(event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1));
    }
    function touchStart(event:TouchEvent){touchY=active()&&!typing(event)&&event.touches.length===1?event.touches[0].clientY:null;}
    function touchMove(event:TouchEvent){
      if(!active()||typing(event)||touchY===null||event.touches.length!==1)return;
      event.preventDefault();event.stopImmediatePropagation();
      const y=event.touches[0].clientY;move(touchY-y);touchY=y;
    }
    function touchEnd(){touchY=null;}
    function key(event:KeyboardEvent){
      if(!active()||typing(event)||event.ctrlKey||event.metaKey||event.altKey)return;
      if(event.code==='Space'&&event.target instanceof Element&&event.target.closest('button,a'))return;
      const delta=event.key==='ArrowDown'?80:event.key==='ArrowUp'?-80:event.key==='PageDown'||event.code==='Space'&&!event.shiftKey?innerHeight*.85:event.key==='PageUp'||event.code==='Space'&&event.shiftKey?-innerHeight*.85:0;
      if(!delta&&event.key!=='Home'&&event.key!=='End')return;
      event.preventDefault();event.stopImmediatePropagation();
      if(event.key==='Home'||event.key==='End'){motion.seek(event.key==='Home'?0:1);wake();}else move(delta);
    }
    function resize(){paint(motion.read().progress);}
    const unsubscribeFeather=diagonalFeatherControls.subscribe(resize);
    const unsubscribeLayout=diagonalTransition.subscribeLayout(resize);
    const preview=(event:Event)=>{
      if(!active())return;const detail=(event as CustomEvent).detail;
      // Menu jumps arrive as {value, instant}: land on the covered section without the sweep.
      if(detail&&typeof detail==='object'&&Number.isFinite(detail.value)){motion.seek(detail.value);const shot=motion.tick(0,true);paint(shot.progress);publish(shot.covered);return;}
      if(typeof detail==='number'&&Number.isFinite(detail)){motion.seek(detail);wake();}
    };
    window.addEventListener('eye-diagonal-preview',preview);
    const unsubscribe=journeyControls.subscribe(()=>{
      if(active())return;
      cancelAnimationFrame(frame);frame=0;last=0;touchY=null;motion.reset();paint(0);publish(false);
    });
    paint(0);
    window.addEventListener('wheel',wheel,{capture:true,passive:false});
    window.addEventListener('touchstart',touchStart,{capture:true,passive:true});
    window.addEventListener('touchmove',touchMove,{capture:true,passive:false});
    window.addEventListener('touchend',touchEnd,{passive:true});window.addEventListener('touchcancel',touchEnd,{passive:true});
    window.addEventListener('keydown',key,true);window.addEventListener('resize',resize);
    return()=>{unsubscribe();unsubscribeFeather();unsubscribeLayout();artMotion.dispose();brandCamera.dispose();cancelAnimationFrame(frame);window.removeEventListener('eye-diagonal-preview',preview);window.removeEventListener('wheel',wheel,true);window.removeEventListener('touchstart',touchStart,true);window.removeEventListener('touchmove',touchMove,true);window.removeEventListener('touchend',touchEnd);window.removeEventListener('touchcancel',touchEnd);window.removeEventListener('keydown',key,true);window.removeEventListener('resize',resize);diagonalTransition.setProgress(0);publish(false);};
  },[]);
  return <section ref={section} className="diagonal-next-section" aria-label="Next section" aria-hidden="true" data-progress="0">
    <BrandArtwork root={artwork}/>
    <div ref={logo} className="diagonal-colour-logo" data-lens-depth="0" data-brand-repel="logo"
      style={{position:'absolute',left:'50%',top:'50%',width:'29vmin',aspectRatio:'390 / 355',transform:'translate(-50%,-50%)',pointerEvents:'none'}}>
      <svg viewBox="864 398 390 355" role="img" aria-label="New Wings colour logo" style={{display:'block',width:'100%',height:'100%',overflow:'hidden'}}>
        <image href="/images/new-wings-logo-layer-2048x1152.png" width="2048" height="1152"/>
      </svg>
    </div>
  </section>;
}
