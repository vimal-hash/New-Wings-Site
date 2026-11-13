import {BufferAttribute,BufferGeometry,DataTexture,LinearFilter,LinearMipmapNearestFilter,NoColorSpace,RedFormat,RepeatWrapping,Sphere,UnsignedByteType,Vector3} from "three";
import type {DecodedRope,Meta,RopeSamples} from "./laptop-decode";
import {traceMark,traceSpan} from "../corridor/loading-trace";
import {assetURL} from "../corridor/asset-url";

const ROPE_FILE=assetURL("/rope-laptop/rope.bin");
const FLIGHT_ROPE_FILE=assetURL("/rope-flight-laptop/rope.bin"); // The flight camera uses the whole tunnel.
export type LaptopChunk={geometry:BufferGeometry;start:number;x0:number;x1:number;y0:number;y1:number;z0:number;z1:number;segments:number;ranks:Uint32Array};
export type LaptopRope={meta:Meta;chunks:LaptopChunk[];core:BufferGeometry;grain:DataTexture;grid:number;zMiddle:number;samples:RopeSamples[];dispose:()=>void;segments:number};

/** Reads the whole file with progress, from 0 to 1. */
export async function downloadRope(onProgress:(share:number)=>void,name=ROPE_FILE){
  const response=await fetch(name);
  if(!response.ok||!response.body)throw new Error(`Rope file: ${response.status}`);
  const total=Number(response.headers.get("content-length"))||0,reader=response.body.getReader(),parts:Uint8Array[]=[];
  let got=0;
  for(;;){
    const {done,value}=await reader.read();
    if(done)break;
    parts.push(value);got+=value.length;
    if(total)onProgress(Math.min(got/total,1));
  }
  const file=new Uint8Array(got);
  let at=0;for(const part of parts){file.set(part,at);at+=part.length;}
  return file;
}

async function unpack(file:Uint8Array):Promise<DecodedRope>{
  try{
    const worker=new Worker(new URL("./laptop-decode.worker.ts",import.meta.url),{type:"module"});
    return await new Promise<DecodedRope>((resolve,reject)=>{
      worker.onmessage=event=>{worker.terminate();if(event.data.error)reject(new Error(event.data.error));else {traceMark("Rope worker decode complete");resolve(event.data);}};
      worker.onerror=event=>{worker.terminate();reject(new Error(event.message));};
      worker.postMessage(file);
    });
  }catch{
    const {decodeRope}=await import("./laptop-decode");
    return decodeRope(file);
  }
}

let flightData:Promise<DecodedRope>|undefined;
let flightUsers=0,expiry:ReturnType<typeof setTimeout>|undefined;
function expireUnusedFlight(){
  clearTimeout(expiry);
  if(flightUsers===0&&flightData)expiry=setTimeout(()=>{flightData=undefined;},45_000);
}
async function load(name:string,onProgress:(share:number)=>void){
  const download=traceSpan(name,"download");
  const file=await downloadRope(onProgress,name);
  download({bytes:file.length});
  const decode=traceSpan("Unpack rope","worker decode");
  const data=await unpack(file);
  decode({segments:data.segments});
  traceMark("Rope model ready");
  return data;
}
export function preloadLaptopFlight(onProgress:(share:number)=>void=()=>{}){
  // Keep the one decoded payload while a flight owns it. A short idle lease
  // also covers preloads and menu jumps without retaining the buffers indefinitely.
  return flightData??=load(FLIGHT_ROPE_FILE,onProgress).then(data=>{
    expireUnusedFlight();
    return data;
  },error=>{flightData=undefined;throw error;});
}
export async function loadLaptopRope(flight:boolean,onProgress:(share:number)=>void){
  if(!flight)return buildLaptopRope(await load(ROPE_FILE,onProgress));
  flightUsers++;
  clearTimeout(expiry);
  const release=()=>{flightUsers--;expireUnusedFlight();};
  try{return buildLaptopRope(await preloadLaptopFlight(onProgress),release);}
  catch(error){release();throw error;}
}

/** The GPU objects share the transferred buffers. No points are rebuilt on the UI thread. */
function buildLaptopRope({meta,chunks,arrays:{P,T,G,L,M,E,F},index,coreP,coreC,coreI,grain:grainData,grid,zMiddle,samples,segments}:DecodedRope,release?:()=>void):LaptopRope{
  const attributes={aP:new BufferAttribute(P,4,true),aT:new BufferAttribute(T,4,true),aG:new BufferAttribute(G,4,true),aL:new BufferAttribute(L,4,true),aM:new BufferAttribute(M,4,true),aE:new BufferAttribute(E,4,true),aF:new BufferAttribute(F,2,true)};
  const indexAttribute=new BufferAttribute(index,1);
  const drawable=chunks.map(chunk=>{
    const {x0,x1,y0,y1,z0,z1}=chunk;
    const geometry=new BufferGeometry();
    for(const [name,attribute] of Object.entries(attributes))geometry.setAttribute(name,attribute);
    geometry.setAttribute("position",attributes.aP);
    geometry.setIndex(indexAttribute);
    geometry.setDrawRange(chunk.start,chunk.segments*6);
    const centre=new Vector3((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
    geometry.boundingSphere=new Sphere(centre,Math.hypot(x1-x0,y1-y0,z1-z0)/2);
    return {...chunk,geometry};
  });
  // The grain: one small picture, read once per pixel.
  const grain=new DataTexture(grainData,meta.grain.width,meta.grain.height,RedFormat,UnsignedByteType);
  grain.wrapS=grain.wrapT=RepeatWrapping;
  grain.minFilter=LinearMipmapNearestFilter;
  grain.magFilter=LinearFilter;
  grain.generateMipmaps=true;
  grain.colorSpace=NoColorSpace;
  grain.needsUpdate=true;

  const core=new BufferGeometry();
  core.setAttribute("position",new BufferAttribute(coreP,4,true));
  core.setAttribute("aC",new BufferAttribute(coreC,4,true));
  core.setIndex(new BufferAttribute(coreI,1));
  core.boundingSphere=new Sphere(new Vector3(0,0,-14),40);

  let disposed=false;
  return {meta,chunks:drawable,core,grain,grid,zMiddle,samples,segments,dispose(){
    if(disposed)return;
    disposed=true;
    try{drawable.forEach(c=>c.geometry.dispose());core.dispose();grain.dispose();}
    finally{release?.();}
  }};
}
