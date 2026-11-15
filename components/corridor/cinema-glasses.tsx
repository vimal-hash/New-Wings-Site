'use client';
import {useEffect,useRef} from 'react';
import {useFrame,useLoader,useThree} from '@react-three/fiber';
import {useGLTF} from '@react-three/drei';
import {Mesh,PerspectiveCamera,TextureLoader,type WebGLRenderTarget} from 'three';
import {theatreOpening} from './theatre-opening-state';
import {traceGLTF} from './loading-trace';
import {createCinemaOptics} from './cinema-optics';
import {glassesControls} from './glasses-controls';
import {journeyControls} from './journey-controls';
import {createScreenDepth,SCREEN_LAYER_URLS} from './theatre-screen-depth';
import {cinemaGlasses,CINEMA_GLASSES} from './cinema-glasses-state';
import {theatreScreenCatalogue} from './theatre-screen-catalogue';

export { CINEMA_GLASSES } from './cinema-glasses-state';
const THEATRE_3D=new Set(['intro','idle','glassesExit']);
/** Local review only (?diagnostics=1): compare the theatre screen in 2D and 3D. */
const review={off:false};

/** Full front pair, fitted as a viewing overlay. Through the lenses the screen is seen in depth. */
export default function CinemaGlasses(){
  const source=useGLTF(CINEMA_GLASSES,'/draco/',false,traceGLTF);
  const layers=useLoader(TextureLoader,SCREEN_LAYER_URLS);
  const gl=useThree(s=>s.gl),invalidate=useThree(s=>s.invalidate),advance=useThree(s=>s.advance);
  const optics=useRef<ReturnType<typeof createCinemaOptics>|null>(null);
  // Owned by an effect, like the optics: Strict Mode and Fast Refresh re-run cleanup, which
  // must never leave a disposed (empty, all-white) depth view mounted.
  const depthRef=useRef<ReturnType<typeof createScreenDepth>|null>(null);
  useEffect(()=>{
    const instance=createScreenDepth(layers);depthRef.current=instance;invalidate();
    return()=>{if(depthRef.current===instance)depthRef.current=null;instance.dispose();};
  },[layers,invalidate]);
  useEffect(()=>glassesControls.subscribe(invalidate),[invalidate]);
  useEffect(()=>{
    if(!/^(localhost|127.)/.test(location.hostname)||!new URLSearchParams(location.search).has('diagnostics'))return;
    const hook=window as unknown as Record<string,unknown>;hook.__screenDepth={review,invalidate,glasses:cinemaGlasses,gl,advance};
    return()=>{delete hook.__screenDepth;};
  },[invalidate,gl,advance]);
  useEffect(()=>{
    // React development Strict Mode replays setup/cleanup. Each setup must own
    // a fresh renderer rather than reuse scenes emptied by the previous cleanup.
    const instance=createCinemaOptics(gl,source.scene);optics.current=instance;
    invalidate();
    return()=>{optics.current=null;instance.dispose();};
  },[gl,source,invalidate]);
  useEffect(()=>{
    const unsubscribe=journeyControls.subscribe(invalidate),unsubscribeGlasses=cinemaGlasses.subscribe(invalidate);
    return()=>{unsubscribe();unsubscribeGlasses();};
  },[invalidate]);
  useFrame(({camera,scene})=>{
    const now=performance.now();
    if(cinemaGlasses.tick(now))invalidate();
    const phase=journeyControls.read().phase,position=cinemaGlasses.position;
    const allowed=!['panel','page','pageReturnLoading','logoReveal','logoDone'].includes(phase);
    // Opacity changes only once the entire pair has cleared the upper edge.
    const fade=Math.max(0,Math.min(1,(position-.82)/.18));
    const amount=allowed?1-fade*fade*(3-2*fade):0;
    theatreOpening.glasses.value=amount;
    let view;const depth=depthRef.current;
    if(camera instanceof PerspectiveCamera&&amount>.001){
      if(depth&&THEATRE_3D.has(phase)&&!depth.built){const screen=scene.getObjectByName('Theatre screen | Full aspect artwork');if(screen instanceof Mesh)depth.build(screen);}
      const theatre=!!depth&&THEATRE_3D.has(phase)&&depth.built&&theatreOpening.screenPower.value>.001;
      view={
        amount:theatre&&!review.off?theatreOpening.screenPower.value*(1-theatreScreenCatalogue.cover.value):0,
        mask:true,warp:0,key:theatreOpening.house.value,render:(out:WebGLRenderTarget)=>depth?.render(gl,camera,out,1+.18*(1-theatreOpening.house.value)),
      };
    }
    optics.current?.draw(camera,scene,amount,position*1.65,view);
  },2);
  return null;
}
