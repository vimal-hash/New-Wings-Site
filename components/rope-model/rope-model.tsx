"use client";
/* eslint-disable react-hooks/immutability -- This R3F owner updates Three.js uniforms, camera and DOM scroll state from frame/effect/input callbacks. */
import {Suspense,useCallback,useEffect,useMemo,useRef,useState} from "react";
import {Canvas,useFrame,useGraph,useLoader,useThree} from "@react-three/fiber";
import {BufferGeometry,ImageBitmapLoader,Line,LinearFilter,LinearMipmapLinearFilter,Matrix4,Mesh,NoColorSpace,PerspectiveCamera,RepeatWrapping,RGFormat,ShaderMaterial,Texture,TextureLoader,Vector4} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {createFinish} from "./rope-finish";
import {compileFlight} from "./prepare-flight";
import {createHover,type RopePointer} from "./rope-hover";
import type {RopeLink} from "./rope-link";
import {placePortal,portalMaterial} from "./rope-portal";
import {threadGeometries,type RopeChunk} from "./rope-geometry";
import {coreMaterial,farHoleMaterial,FLOW,greenTunnelMaterial,setThreadFlow,setThreadTuning,setThreadView,threadMaterial,whiteStored,type RopeLook,type RopeMaps,type RopeRanges} from "./rope-materials";
import {RopeTuningPanel,TUNING_BASE,type RopeTuningView} from "./rope-tuning";
import {createRopeMeter,RopeReportPanel,type RopeMeter} from "./rope-report";
import {traceGLTF,traceMark} from "../corridor/loading-trace";
import {assetURL} from "../corridor/asset-url";
import {BLUE_FLIGHT,YELLOW_FLIGHT,blueBox,blueMatrix,createFlightCamera,createFlightGlide,createFlightScroll,curvesRed,flightAtStop,flightZ,FLIGHT,GREEN,greenBox,greenDim,greenMatrix,greenWidth,holeOnScreen} from "./rope-flight";
import {BLUE_PALETTE,blueRopeLook,prepareBluePalette} from "./rope-blue";
import {YELLOW_PALETTE} from "./rope-yellow";
import {createRopeCard,RopeCard,type RopeCardControl} from "./rope-card";

export const ROPE_MODEL=assetURL("/rope-model/rope-red.glb");
const MAPS=[assetURL("/rope-model/maps/grain.png")];
const SCROLL_SCREENS=14;
const TRAVEL=24; // how far forward the last scroll takes the camera; the ropes end at 30, so walls still fill the view here
const SETTLE=.14; // seconds, only smooths the steps of a mouse wheel

type Extras={camera:{lens:number;sensor:number;near:number;far:number};ranges:RopeRanges&{radius:[number,number]};look:RopeLook;chunks:Record<string,RopeChunk[]>;hoverSamples?:Record<string,string>};
const storedSamples=(text?:string)=>text?new Int16Array(Uint8Array.from(atob(text),letter=>letter.charCodeAt(0)).buffer):undefined;
type Part={name:string;matrix:Matrix4;geometry:BufferGeometry;material:ShaderMaterial;isThread:boolean;order:number;rope:number;chunk?:RopeChunk;green?:boolean;mesh?:Mesh|null};
const CULL_MARGIN=.05; // a little more than the thickest thread

// The Blender lens holds the horizontal view, whatever shape the window is. The camera only ever looks straight ahead down the middle.
function fitLens(camera:PerspectiveCamera,extras:Extras,aspect:number){
  camera.fov=2*Math.atan(extras.camera.sensor/2/extras.camera.lens/aspect)*180/Math.PI;
  camera.near=extras.camera.near;
  camera.far=extras.camera.far;
  camera.position.x=camera.position.y=0;
  camera.rotation.set(0,0,0);
  camera.updateProjectionMatrix();
}

function loadMaps(images:ImageBitmap[]):RopeMaps{
  // Every baked value lives on the thread points now. Only the grain is still a picture: it repeats, so it needs distance levels. Height in red, cavity in green.
  const [image]=images;
  const grain=new Texture(image as unknown as HTMLImageElement);
  grain.flipY=false;
  grain.generateMipmaps=true;
  grain.minFilter=LinearMipmapLinearFilter;
  grain.magFilter=LinearFilter;
  grain.colorSpace=NoColorSpace;
  grain.format=RGFormat;
  grain.internalFormat="RG8";
  grain.wrapS=grain.wrapT=RepeatWrapping;
  grain.anisotropy=8;
  grain.onUpdate=()=>image.close();
  grain.needsUpdate=true;
  return {grain};
}

// The decoded pictures are freed right after upload, so the textures must only be disposed when the page has really gone, not during React's trial remount.
type Held={maps:RopeMaps;timer:number};
function keep(held:Held){window.clearTimeout(held.timer);}
function release(held:Held){
  held.timer=window.setTimeout(()=>{
    Object.values(held.maps).forEach(texture=>texture.dispose());
    useLoader.clear(ImageBitmapLoader,MAPS);
  },0);
}

function Rope({progress,pointer,tuning,flight,blue,yellow,card,link,onLoad,onReady}:{progress:React.RefObject<number>;pointer:React.RefObject<RopePointer>;tuning:React.RefObject<RopeTuningView>;flight:boolean;blue:boolean;yellow:boolean;card:RopeCardControl;link?:RopeLink;onLoad:(share:number)=>void;onReady:()=>void}){
  const profile=yellow?YELLOW_FLIGHT:blue?BLUE_FLIGHT:FLIGHT;
  const gltf=useLoader(GLTFLoader,ROPE_MODEL,loader=>{loader.setMeshoptDecoder(MeshoptDecoder);traceGLTF(loader);},event=>{if(event.total)onLoad(event.loaded/event.total);});
  const images=useLoader(ImageBitmapLoader,MAPS,loader=>loader.setOptions({imageOrientation:"none",premultiplyAlpha:"none",colorSpaceConversion:"none"}));
  const colourImages=useLoader(TextureLoader,blue?[BLUE_PALETTE]:yellow?[YELLOW_PALETTE]:[]);
  const palette=useMemo(()=>prepareBluePalette(colourImages[0]),[colourImages]),bluePalette=blue?palette:undefined,yellowPalette=yellow?palette:undefined;
  const {nodes}=useGraph(gltf.scene);
  const extras=gltf.userData as unknown as Extras;
  const camera=useThree(state=>state.camera) as PerspectiveCamera;
  const size=useThree(state=>state.size);
  const dpr=useThree(state=>state.viewport.dpr);
  const invalidate=useThree(state=>state.invalidate);
  const gl=useThree(state=>state.gl);
  const scene=useThree(state=>state.scene);
  const held=useMemo<Held>(()=>({maps:loadMaps(images as unknown as ImageBitmap[]),timer:0}),[images]);
  const {maps}=held;
  const finish=useMemo(()=>createFinish(blue?blueRopeLook(extras.look):extras.look,flight,blue,yellow),[extras,flight,blue,yellow]);
  useEffect(()=>()=>finish.dispose(),[finish]);
  const parts=useMemo(()=>{
    const threads=threadMaterial(extras.ranges.radius[1],extras.ranges,extras.look,maps,flight,bluePalette,yellowPalette),core=coreMaterial(blue?blueRopeLook(extras.look):extras.look,flight&&!blue,yellow);
    // Test switch: ?colour=green or ?colour=red shows the whole tunnel in one colour, for comparing against Blender's pictures.
    const fixed=flight&&!blue?new URLSearchParams(window.location.search).get("colour"):null;
    if(fixed){
      for(const material of [threads,core]){material.uniforms.uRed.value=yellow?(fixed==="yellow"?0:1):fixed==="green"?0:1;material.uniforms.uJoined.value=0;}
      threads.uniforms.uFadeAt.value=-1e3;
      core.uniforms.uPush.value=0;
    }
    // The whole tunnel again, turned and placed beyond the red one's far tip. The same threads, so nothing more to download.
    const joined=flight&&!blue&&!fixed,greenThreads=joined?greenTunnelMaterial(threads,{uRadiusScale:{value:threads.uniforms.uRadiusScale.value*GREEN.scale},uSpread:{value:new Vector4()},uSpreadAmount:{value:0}}):null,greenCore=joined?greenTunnelMaterial(core):null,toGreen=greenMatrix();
    const sources:Parameters<typeof createHover>[0]=[];
    const made=Object.values(nodes).flatMap((node):Part[]=>{
      const item=node as Line|Mesh;
      if(!(item as Line).isLine&&!(item as Mesh).isMesh)return [];
      const matrix=blue&&flight?new Matrix4().multiplyMatrices(blueMatrix(),item.matrix):item.matrix.clone() as Matrix4;
      const moved=new Matrix4().multiplyMatrices(toGreen,matrix);
      if((item as Line).isLine!==true)return [{name:item.name,matrix,geometry:item.geometry as BufferGeometry,material:core,isThread:false,order:-1e6,rope:-1},...(greenCore?[{name:`${item.name}_green`,matrix:moved,geometry:item.geometry as BufferGeometry,material:greenCore,isThread:false,order:-1e6+1,rope:-1,green:true}]:[])];
      const chunks=extras.chunks[item.name],number=/^Rope_(\d+)$/.exec(item.name),rope=number?Number(number[1]):-1;
      // Only the red tunnel's ropes answer the mouse.
      if(rope>=0)sources.push({index:rope,geometry:item.geometry as BufferGeometry,matrix,stored:storedSamples(extras.hoverSamples?.[item.name])});
      // Nearest stretch first in every rope, so the camera's own view order never has to be worked out.
      return threadGeometries(item.geometry as BufferGeometry,chunks).flatMap((geometry,i):Part[]=>{
        const original=chunks[i],blueBounds=blue&&flight?blueBox(original[2],original[3],original[4],original[5],original[6],original[7]):null;
        const chunk:RopeChunk=blueBounds?[original[0],original[1],blueBounds.x0,blueBounds.x1,blueBounds.y0,blueBounds.y1,blueBounds.z0,blueBounds.z1]:original;
        const here:Part={name:`${item.name}_${i}`,matrix,geometry,material:threads,isThread:true,order:-chunk[6],rope,chunk};
        if(!greenThreads)return [here];
        const [start,count,x0,x1,y0,y1,z0,z1]=chunks[i],box=greenBox(x0,x1,y0,y1,z0,z1);
        return [here,{name:`${item.name}_${i}_green`,matrix:moved,geometry,material:greenThreads,isThread:true,order:-box.z0,rope:-1,chunk:[start,count,box.x0,box.x1,box.y0,box.y1,box.z0,box.z1],green:true}];
      });
    });
    traceMark("Rope model ready");
    return {made,threads,core,greenThreads,greenCore,hole:joined?farHoleMaterial():null,hover:createHover(sources,sources.length)};
  },[nodes,extras,flight,blue,yellow,bluePalette,yellowPalette,maps]);
  useEffect(()=>()=>{
    parts.threads.dispose();parts.core.dispose();parts.greenThreads?.dispose();parts.greenCore?.dispose();parts.hole?.dispose();
    parts.made.forEach(part=>{if(part.isThread&&!part.green)part.geometry.dispose();});
  },[parts]);
  useEffect(()=>{keep(held);return()=>release(held);},[held]);
  // Only with ?diagnostics=1. Otherwise there is no meter and the lines below do nothing.
  const meter=useRef<RopeMeter|null>(null);
  useEffect(()=>{
    const made=createRopeMeter(gl,finish.target.samples);
    meter.current=made;
    return()=>{made?.dispose();meter.current=null;};
  },[gl,finish]);
  // ?still shows the look matched to Blender, ?flowAt=.3 holds the light at one moment. Both are for comparing pictures. People who ask for less motion get the still look.
  const review=useMemo(()=>{const query=new URLSearchParams(window.location.search),at=query.get("flowAt");return{still:query.has("still"),at:at===null?null:Number(at)};},[]);
  const calm=useMemo(()=>window.matchMedia("(prefers-reduced-motion: reduce)"),[]);
  const flowClock=useRef(0);
  const colourFixed=useMemo(()=>new URLSearchParams(window.location.search).get("colour"),[]);
  const flightCamera=useMemo(()=>createFlightCamera(),[]);
  useEffect(()=>flightCamera.place(link?.startZ),[flightCamera,profile,link]);
  useEffect(()=>{const wake=()=>invalidate();calm.addEventListener("change",wake);return()=>calm.removeEventListener("change",wake);},[calm,invalidate]);
  // Sections only (they pass a link): a flight is prepared while it is still hidden under its section, so its first moving
  // frame is not a freeze. Its shaders compile in the background, then one hidden frame uploads the rest (textures,
  // buffers, the finishing passes). It is ready only after that. The /rope pages have no link and start as before.
  const [preparedFor,setPreparedFor]=useState<object|null>(null);
  const prepared=!link||preparedFor===parts;
  const warm=useRef<object|null>(null);
  useEffect(()=>{
    setThreadView(parts.threads,size.width*dpr,size.height*dpr,dpr);
    finish.setSize(Math.round(size.width*dpr),Math.round(size.height*dpr));
    fitLens(camera,extras,size.width/size.height);
    invalidate();
    if(prepared)onReady();
  },[size,dpr,camera,parts,finish,extras,invalidate,onReady,prepared]);
  const portal=useMemo(()=>link&&flight?portalMaterial(blue):null,[link,flight,blue]);
  const portalMesh=useRef<Mesh|null>(null);
  useEffect(()=>()=>portal?.dispose(),[portal]);
  useEffect(()=>{
    if(!link||preparedFor===parts)return;
    let live=true;
    const done=()=>{if(live){warm.current=parts;invalidate();}};
    void compileFlight(gl,scene,camera,finish.target,finish.passes).then(done,()=>{if(live)link.failed();});
    return()=>{live=false;};
  },[link,parts,finish,portal,gl,scene,camera,invalidate,preparedFor]);
  useFrame((state,delta)=>{
    if(link?.covered){
      if(warm.current!==parts)return;
      // The hidden frame, under the section's own plane: never seen.
      warm.current=null;
      state.gl.setRenderTarget(finish.target);
      state.gl.setClearColor(finish.backdrop,1);
      state.gl.clear();
      state.gl.render(state.scene,state.camera);
      finish.render(state.gl);
      setPreparedFor(parts);
      return;
    }
    const position=state.camera.position,target=flight?flightZ(link?link.flightShare(progress.current):progress.current,profile):-progress.current*TRAVEL,gap=target-position.z;
    if(flight){if(flightCamera.move(position,target,delta))state.invalidate();}
    else if(Math.abs(gap)<.0005)position.z=target;
    else{
      position.z+=gap*(1-Math.exp(-Math.min(delta,.1)/SETTLE));
      state.invalidate();
    }
    link?.camera(position.z);
    const across=extras.camera.sensor/2/extras.camera.lens,up=across/(size.width/size.height),look=tuning.current.values;
    // The green goes a little out of focus only as the camera moves on from the stop.
    if(parts.greenThreads){
      parts.greenThreads.uniforms.uWide.value=greenWidth(position.z);
      parts.greenThreads.uniforms.uDim.value=greenDim(position.z);
    }
    if(parts.hover.update(Math.min(delta,.1),pointer.current,state.camera as PerspectiveCamera,across,up,size.width,calm.matches,parts.threads,look.white.speed,tuning.current.holdWhite))state.invalidate();
    if(flight&&card.update(performance.now(),parts.hover.rope,flightAtStop(link?link.flightShare(progress.current):progress.current,position.z,profile)))state.invalidate();
    setThreadTuning(parts.threads,look);
    finish.setTuning(look.red.glow,whiteStored(look));
    if(review.still||calm.matches)setThreadFlow(parts.threads,null);
    else if(review.at!==null)setThreadFlow(parts.threads,review.at);
    else{
      flowClock.current=(flowClock.current+Math.min(delta,.1)*FLOW.speed*look.flow.speed/FLOW.spacing)%1;
      setThreadFlow(parts.threads,flowClock.current);
      state.invalidate();
    }
    // A stretch whose far tips are all behind the camera, or that sits fully beside the view, is not sent to the graphics card this frame.
    for(const part of parts.made){
      if(!part.chunk||!part.mesh)continue;
      const [,,x0,x1,y0,y1,z0]=part.chunk,reach=position.z-z0+CULL_MARGIN;
      part.mesh.visible=reach>0&&x0<across*reach+CULL_MARGIN&&x1>-across*reach-CULL_MARGIN&&y0<up*reach+CULL_MARGIN&&y1>-up*reach-CULL_MARGIN;
    }
    if(portal)placePortal(portal,portalMesh.current,finish.setPortal,position.z,up,size.width/size.height,blue);
    let clearTo=flight&&!blue?finish.backdropAt(yellow?(colourFixed==="yellow"?0:1):colourFixed==="green"?0:1):finish.backdrop;
    if(parts.hole){
      const u=parts.hole.uniforms,curves=curvesRed(position.z);
      clearTo=u.uOuter.value.copy(finish.backdropAt(1,curves));
      u.uInner.value.copy(finish.backdropAt(0,curves));
      u.uRadius.value=holeOnScreen(position.z,up);
      u.uAspect.value=size.width/size.height;
    }
    state.gl.setRenderTarget(finish.target);
    state.gl.setClearColor(clearTo,1);
    meter.current?.sceneStart(progress.current);
    state.gl.clear();
    state.gl.render(state.scene,state.camera);
    meter.current?.sceneEnd();
    finish.render(state.gl);
    meter.current?.frameEnd();
  },1);
  return <>{parts.made.map(part=><mesh key={part.name} ref={mesh=>{part.mesh=mesh;if(mesh&&part.isThread&&!part.green)mesh.onBeforeRender=()=>parts.hover.apply(part.material,part.rope);}} name={part.name} matrix={part.matrix} matrixAutoUpdate={false} geometry={part.geometry} material={part.material} renderOrder={part.order} frustumCulled={false}/>)}{parts.hole?<mesh material={parts.hole} renderOrder={2e6} frustumCulled={false}><planeGeometry args={[2,2]}/></mesh>:null}{portal?<mesh ref={portalMesh} material={portal} renderOrder={3e6} frustumCulled={false}><planeGeometry args={[2,2]}/></mesh>:null}</>;
}

export default function RopeModel({flight=false,blue=false,yellow=false,link,over}:{flight?:boolean;blue?:boolean;yellow?:boolean;link?:RopeLink;over?:React.ReactNode}){
  const profile=yellow?YELLOW_FLIGHT:blue?BLUE_FLIGHT:FLIGHT;
  const scroller=useRef<HTMLDivElement>(null);
  const progress=useRef(0);
  const pointer=useRef<RopePointer>({x:0,y:0,on:false,moved:false});
  const tuning=useRef<RopeTuningView>({values:TUNING_BASE,holdWhite:false});
  const redraw=useCallback(()=>invalidate.current?.(),[]);
  const invalidate=useRef<(()=>void)|null>(null);
  const [loaded,setLoaded]=useState(0);
  const colour=yellow?"yellow-green":blue?"blue":"green-red";
  const [readyColour,setReadyColour]=useState("");
  const ready=readyColour===colour;
  const markReady=useCallback(()=>setReadyColour(colour),[colour]);
  const [cards]=useState(()=>({red:createRopeCard(),blue:createRopeCard(),green:createRopeCard()}));
  const card=yellow?cards.green:blue?cards.blue:cards.red;
  useEffect(()=>{if(!link)return;link.wake=redraw;link.attach(scroller.current!);return()=>{link.wake=null;};},[link,redraw]);
  useEffect(()=>{if(ready)link?.ready();},[ready,link]);
  useEffect(()=>{
    const element=scroller.current!;
    const read=()=>{
      const room=element.scrollHeight-element.clientHeight;
      progress.current=room>0?element.scrollTop/room:0;
      invalidate.current?.();
    };
    // Only a real mouse: touch has no hover. It never moves the camera, it only says which rope turns white.
    const hover=(event:PointerEvent)=>{
      if(event.pointerType!=="mouse")return;
      if(card.holdsPointer(event.clientX,event.clientY)){invalidate.current?.();return;}
      card.moved();
      const box=element.getBoundingClientRect();
      pointer.current.x=(event.clientX-box.left)/box.width*2-1;
      pointer.current.y=1-(event.clientY-box.top)/box.height*2;
      pointer.current.on=pointer.current.moved=true;
      invalidate.current?.();
    };
    // The card's close button sits above this layer, so reaching it reads as leaving. The mouse is still on the card.
    const away=(event:PointerEvent)=>{
      if(card.holdsPointer(event.clientX,event.clientY)){invalidate.current?.();return;}
      pointer.current.on=false;card.release();invalidate.current?.();
    };
    read();
    element.addEventListener("pointermove",hover,{passive:true});
    element.addEventListener("pointerleave",away);
    element.addEventListener("scroll",read,{passive:true});
    window.addEventListener("resize",read);
    return()=>{element.removeEventListener("pointermove",hover);element.removeEventListener("pointerleave",away);element.removeEventListener("scroll",read);window.removeEventListener("resize",read);};
  },[card]);
  useEffect(()=>{
    const query=new URLSearchParams(window.location.search);
    if(!flight||query.has("still")||query.has("flowAt")||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    return link?createFlightGlide(scroller.current!,profile,link.glide):createFlightScroll(scroller.current!,profile);
  },[flight,profile,link]);
  return <div style={{position:"fixed",inset:0,background:"#000"}}>
    <Canvas frameloop="demand" dpr={[1,1.5]} gl={{antialias:true,alpha:false,powerPreference:"high-performance"}} camera={{position:[0,0,0],fov:50}} style={{position:"absolute",inset:0,pointerEvents:"none"}}
      onCreated={state=>{invalidate.current=state.invalidate;if(link)link.wake=state.invalidate;traceMark("Canvas created");}}>
      <Suspense fallback={null}><Rope progress={progress} pointer={pointer} tuning={tuning} flight={flight} blue={blue} yellow={yellow} card={card} link={link} onLoad={setLoaded} onReady={markReady}/></Suspense>
    </Canvas>
    {over}
    {ready||((blue||yellow)&&link)?null:<div style={{position:"absolute",left:24,bottom:20,color:"#888",font:"13px/1 system-ui,sans-serif",pointerEvents:"none"}}>Loading model {Math.round(loaded*100)}%</div>}
    <div ref={scroller} data-rope-scroller data-rope-colour={colour} style={{position:"absolute",inset:0,overflowY:"auto",overscrollBehavior:"contain",scrollbarWidth:"none",outline:"none"}}><div style={{height:`${(flight?profile.scrollScreens:SCROLL_SCREENS)*100}dvh`}}/></div>
    {flight?<RopeCard card={card} tint={profile.cardTint}/>:null}
    {link?null:<RopeTuningPanel view={tuning} onChange={redraw}/>}
    <RopeReportPanel/>
  </div>;
}
