'use client';
import {useEffect,useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {useGLTF} from '@react-three/drei';
import {theatreOpening} from './theatre-opening-state';
import {traceGLTF} from './loading-trace';
import {createCinemaOptics} from './cinema-optics';
import {glassesControls} from './glasses-controls';
import {journeyControls} from './journey-controls';

export const CINEMA_GLASSES='/models/cinema-glasses-rigid.glb?v=close-nose-4';

/** Full front pair, fitted as a viewing overlay; proximity/presence motion remains deferred. */
export default function CinemaGlasses(){
  const source=useGLTF(CINEMA_GLASSES,'/draco/',false,traceGLTF);
  const gl=useThree(s=>s.gl),invalidate=useThree(s=>s.invalidate);
  const optics=useMemo(()=>createCinemaOptics(gl,source.scene),[gl,source]);
  useEffect(()=>glassesControls.subscribe(invalidate),[invalidate]);
  useEffect(()=>{invalidate();return()=>optics.dispose();},[optics,invalidate]);
  const motion=useRef({position:0,from:0,target:0,elapsed:0,last:0});
  useEffect(()=>{
    const toggle=(event:Event)=>{
      const m=motion.current;m.from=m.position;m.target=(event as CustomEvent).detail==='remove'?1:0;
      m.elapsed=0;m.last=performance.now();invalidate();
    };
    window.addEventListener('cinema-glasses-action',toggle);
    const unsubscribe=journeyControls.subscribe(invalidate);
    return()=>{window.removeEventListener('cinema-glasses-action',toggle);unsubscribe();};
  },[invalidate]);
  useFrame(({camera,scene})=>{
    const m=motion.current,now=performance.now();
    if(m.position!==m.target){
      m.elapsed+=Math.min(.05,Math.max(0,(now-m.last)/1000));
      const t=Math.min(1,m.elapsed/1.25),e=t*t*t*(t*(t*6-15)+10);
      m.position=m.from+(m.target-m.from)*e;
      if(t===1)m.position=m.target;else invalidate();
    }
    m.last=now;
    const allowed=!['panel','page','pageReturning','pageReturnLoading','logoReveal','logoDone'].includes(journeyControls.read().phase);
    // Opacity changes only once the entire pair has cleared the upper edge.
    const fade=Math.max(0,Math.min(1,(m.position-.82)/.18));
    const amount=allowed?1-fade*fade*(3-2*fade):0;
    theatreOpening.glasses.value=amount;
    optics.draw(camera,scene,amount,m.position*1.65);
  },2);
  return null;
}
