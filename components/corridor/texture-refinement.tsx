"use client";
import { Component,Suspense,useCallback,useEffect,useMemo,useRef,useState,type ReactNode } from "react";
import { useLoader,useThree } from "@react-three/fiber";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import type { Texture,WebGLRenderer } from "three";
import { configureBakedTextureLoader } from "./baked-texture-loader";
import { textureForDevice } from "./texture-quality";
import { scheduleSceneIdle } from "./scene-idle";
import { createSerialIdleQueue } from "./serial-idle-queue";
import { traceSpan } from "./loading-trace";
import { hasFirstPaintMip } from "./asset-url";
import { effectQuality } from "./effect-quality";
import { journeyControls } from "./journey-controls";
import { projectorControls } from "./projector-controls";
type Target={url:string;base:Texture;materials:{map:Texture|null;emissiveMap?:Texture|null}[]};
type Queue=ReturnType<typeof createSerialIdleQueue>;
const queues=new WeakMap<WebGLRenderer,Queue>();
// Theatre atlases improve the seated view. On phones, defer them while the
// visitor is reading the page or viewing the eye, where the room is offscreen.
const atTheatre=()=>journeyControls.read().phase==="idle"&&projectorControls.read().ready;
const sceneIsUncovered=()=>!["page","pageReturnLoading","logoReveal","logoDone"].includes(journeyControls.read().phase);
function scheduleRefinement(gl:WebGLRenderer,job:()=>void){
 return effectQuality(gl)==="mobile"?scheduleSceneIdle(job,15,atTheatre):scheduleSceneIdle(job,20,sceneIsUncovered);
}
function rendererQueue(gl:WebGLRenderer){let queue=queues.get(gl);if(!queue){queue=createSerialIdleQueue(job=>scheduleRefinement(gl,job));queues.set(gl,queue);}return queue;}
class OptionalDetail extends Component<{children:ReactNode;finish:()=>void},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(){this.props.finish();}
 render(){return this.state.failed?null:this.props.children;}
}
function Detail({target,url,finish}:{target:Target;url:string;finish:()=>void}){
 const gl=useThree(s=>s.gl),invalidate=useThree(s=>s.invalidate);
 const texture=useLoader(KTX2Loader,url,l=>configureBakedTextureLoader(l,gl));
 useEffect(()=>{
  let map:Texture|undefined;
  const cancel=scheduleRefinement(gl,()=>{
   map=texture.clone();map.channel=target.base.channel;map.colorSpace=target.base.colorSpace;map.anisotropy=target.base.anisotropy;map.wrapS=target.base.wrapS;map.wrapT=target.base.wrapT;
   const end=traceSpan("High-detail texture upload","GPU resource submission",{url});
   try{gl.initTexture(map);target.materials.forEach(material=>{const linked=material.emissiveMap===material.map;material.map=map!;if(linked)material.emissiveMap=map!;});end();invalidate();}
   catch(error){map.dispose();map=undefined;end({error:String(error)});}
   finally{finish();}
  });
  return()=>{cancel();if(map){target.materials.forEach(material=>{if(material.map===map)material.map=target.base;if(material.emissiveMap===map)material.emissiveMap=target.base;});map.dispose();}};
 },[target,texture,url,gl,invalidate,finish]);
 return null;
}
function Item({target,url,queue}:{target:Target;url:string;queue:Queue}){
 const [started,setStarted]=useState(false),release=useRef(()=>{});
 const finish=useCallback(()=>release.current(),[]);
 useEffect(()=>queue.request(done=>{release.current=done;setStarted(true);}),[queue]);
 return started?<OptionalDetail finish={finish}><Suspense fallback={null}><Detail target={target} url={url} finish={finish}/></Suspense></OptionalDetail>:null;
}
/** One optional atlas at a time across the entire renderer, from fetch through upload. */
export default function TextureRefinement({targets}:{targets:Target[]}){
 const gl=useThree(s=>s.gl),queue=useMemo(()=>rendererQueue(gl),[gl]);
 const selected=useMemo(()=>[
   ...targets.filter(target=>hasFirstPaintMip(target.url)).map(target=>({target,url:target.url+"?detail=1"})),
   ...targets.map(target=>({target,url:textureForDevice(target.url,gl,effectQuality(gl)==="desktop")})).filter(t=>t.url!==t.target.url),
 ],[targets,gl]);
 return <>{selected.map(({target,url})=><Item key={url} target={target} url={url} queue={queue}/>)}</>;
}
