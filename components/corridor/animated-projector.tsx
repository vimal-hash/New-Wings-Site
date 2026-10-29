"use client";
import { Suspense,use,useCallback,useEffect,useMemo,useRef,useState,useSyncExternalStore } from "react";
import { useFrame,useLoader,useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { BackSide,Box3,BufferAttribute,BufferGeometry,DataTexture,FloatType,Group,Matrix4,Mesh,MeshDepthMaterial,MeshPhysicalMaterial,NearestFilter,NoColorSpace,RepeatWrapping,RGBAFormat,RGBADepthPacking,SRGBColorSpace,Sphere,Vector3,type Texture,type WebGLRenderer } from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { localEnvironment } from "./local-environment";
import { stageLighting,updateStageLighting } from "./stage-lighting";
import { traceGLTF,traceMark,traceSpan,traceSync } from "./loading-trace";
import metadata from "./projector-animation.json";
import sourceMaterials from "../../public/textures/projector/materials.json";
import fx from "./projector-fx-config.json";
import alignedFormation from "./projector-formation-aligned.json";
import { projectorControls } from "./projector-controls";
import { configureBakedTextureLoader } from "./baked-texture-loader";
import { blenderDisplayGLSL,useBlenderViewLUT } from "./blender-view-lut";
import { particlesLib } from "./projector-fx/particlesLib.glsl";
import { sweepUniforms } from "./projector-fx/formation";
import { surfaceFormationGLSL } from "./projector-fx/surface-formation";
import ProjectorParticles from "./projector-particles";
import { effectQuality,type EffectQuality } from "./effect-quality";
import { loadCompressedBuffer } from "./compressed-buffer";
import { particleProfiles } from "./projector-particle-profiles";
import { createClipClock } from "./clip-clock";
import { scheduleSceneIdle } from "./scene-idle";
import { compileHiddenGPU,prepareHiddenGPU } from "./hidden-gpu-preparation";
import { journeyControls } from "./journey-controls";
import { assetURL } from "./asset-url";

export const PROJECTOR_TEXTURES=["/textures/projector/brushed-base.ktx2","/textures/projector/brushed-metal-rough-spec.ktx2","/textures/projector/brushed-normal.ktx2"];
export function preloadProjector(gl:WebGLRenderer){
  useGLTF.preload(metadata.modelUrl,"/draco/",false,traceGLTF);void loadProjectorMotion().catch(()=>{});
  useLoader.preload(KTX2Loader,PROJECTOR_TEXTURES,l=>configureBakedTextureLoader(l,gl));
  const quality=effectQuality(gl);if(quality!=="mobile"){const url=particleProfiles[quality].path;
  void loadCompressedBuffer(url).catch(()=>{});}
}
let motionPromise:Promise<ArrayBuffer>|undefined;
export function loadProjectorMotion(){
  return motionPromise??=(async()=>{
    const compressed=typeof DecompressionStream!=="undefined";
    const finish=traceSpan("Projector motion fetch + streamed decompression","motion processing",{compressed});
    try{const response=await fetch(assetURL(compressed?metadata.dataUrl:metadata.fallbackUrl));if(!response.ok||!response.body)throw new Error("Projector animation data could not load");const result=await(compressed?new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer():response.arrayBuffer());finish({outputBytes:result.byteLength});return result;}catch(error){finish({error:String(error)});throw error;}
  })();
}
const poseShader=`
attribute float aPart;attribute float aSurface;
uniform sampler2D uPoses;uniform sampler2D uMaterials;uniform sampler2D uFxData;
uniform mat4 uFxRootInverse;uniform float uPoseFrame;uniform float uFormation;
varying vec3 vSourceBase;varying float vPartVisible;varying float vLens;varying vec4 vSurface;varying vec4 vEmission;varying vec4 vFxTiming;varying vec4 vFxSweep;varying vec4 vFxAxis;varying vec3 vFxPoint;varying vec2 vOptics;
vec3 partPosition,partScale;vec4 partRotation;
vec3 rotatePart(vec4 q,vec3 v){return v+2.0*cross(q.xyz,cross(q.xyz,v)+q.w*v);}
void readPart(){
 vLens=step(91.5,aPart)*step(aPart,99.5);int part=int(floor(aPart+.5));int id=part*3;int lo=int(floor(uPoseFrame));int hi=min(lo+1,${metadata.frames-1});float t=fract(uPoseFrame);
 vec4 pa=texelFetch(uPoses,ivec2(id,lo),0),pb=texelFetch(uPoses,ivec2(id,hi),0);
 vec4 qa=texelFetch(uPoses,ivec2(id+1,lo),0),qb=texelFetch(uPoses,ivec2(id+1,hi),0);
 vec4 sa=texelFetch(uPoses,ivec2(id+2,lo),0),sb=texelFetch(uPoses,ivec2(id+2,hi),0);
 if(dot(qa,qb)<0.0)qb=-qb;
 partPosition=mix(pa.xyz,pb.xyz,t);partRotation=normalize(mix(qa,qb,t));partScale=mix(sa.xyz,sb.xyz,t);vPartVisible=mix(pa.w,pb.w,t);
 int mat=int(floor(aSurface+.5));vSurface=texelFetch(uMaterials,ivec2(mat,0),0);vEmission=texelFetch(uMaterials,ivec2(mat,1),0);vOptics=texelFetch(uMaterials,ivec2(mat,2),0).xy;vSourceBase=texelFetch(uMaterials,ivec2(mat,3),0).rgb;
 vFxTiming=texelFetch(uFxData,ivec2(part,0),0);vFxSweep=texelFetch(uFxData,ivec2(part,1),0);vFxAxis=texelFetch(uFxData,ivec2(part,2),0);
}`;
const fragmentCommon=`
uniform float uFormation;uniform float uFxFrame;uniform float uCoverageEnabled;
varying vec3 vSourceBase;varying float vPartVisible;varying float vLens;varying vec4 vSurface;varying vec4 vEmission;varying vec4 vFxTiming;varying vec4 vFxSweep;varying vec4 vFxAxis;varying vec3 vFxPoint;varying vec2 vOptics;
${blenderDisplayGLSL}
${particlesLib}
${surfaceFormationGLSL}
`;

const noFlight=Promise.resolve(null);
export default function AnimatedProjector(){
  const motion=loadProjectorMotion();
  const gltf=useGLTF(metadata.modelUrl,"/draco/",false,traceGLTF),gl=useThree(s=>s.gl);
  const quality=effectQuality(gl);traceMark("Projector profile: "+quality+(quality==="mobile"?" (reveal only)":""));
  const bakes=useLoader(KTX2Loader,PROJECTOR_TEXTURES,l=>configureBakedTextureLoader(l,gl));
  const buffer=use(motion),display=useBlenderViewLUT();
  use(quality==="mobile"?noFlight:loadCompressedBuffer(particleProfiles[quality].path));
  const [started,setStarted]=useState(false);
  useEffect(()=>{traceMark("Projector resources ready");return scheduleSceneIdle(()=>setStarted(true));},[]);
  return started?<ProjectorRig gltf={gltf} bakes={bakes} buffer={buffer} display={display} quality={quality}/>:null;
}
function ProjectorRig({gltf,bakes,buffer,display,quality}:{gltf:{scene:Group};bakes:Texture[];buffer:ArrayBuffer;display:ReturnType<typeof useBlenderViewLUT>;quality:EffectQuality}){
  const gl=useThree(s=>s.gl),get=useThree(s=>s.get),invalidate=useThree(s=>s.invalidate);
  const command=useSyncExternalStore(projectorControls.subscribe,projectorControls.read,projectorControls.read);
  const frame=useRef(0),readiness=useRef({core:false,fx:false,warming:false}),cancelWarm=useRef(()=>{});
  const playback=useRef({command:-1,phase:"hidden",elapsed:0,finishing:false});
  const clock=useRef(createClipClock());
  // Local, opt-in frame inspection for landing/reveal regression screenshots.
  const inspectFrame=useMemo(()=>{
    if(typeof location==="undefined"||!/^(localhost|127\.)/.test(location.hostname))return null;
    const params=new URLSearchParams(location.search),value=Number(params.get("formation-frame"));
    return params.get("diagnostics")==="1"&&value>=1&&value<96?value:null;
  },[]);
  useEffect(()=>{const clip=clock.current,visibility=()=>clip.visibility(performance.now(),document.hidden);document.addEventListener("visibilitychange",visibility);return()=>document.removeEventListener("visibilitychange",visibility);},[]);
  const rig=useMemo(()=>traceSync("Construct projector geometry/materials/motion texture",()=>{
    let source:Mesh|undefined;gltf.scene.traverse(o=>{if((o as Mesh).isMesh)source=o as Mesh;});if(!source)throw new Error("Projector mesh missing");
    const values=new Float32Array(buffer);const texture=new DataTexture(values.subarray(0,metadata.textureFloats),metadata.textureWidth,metadata.frames,RGBAFormat,FloatType);
    texture.minFilter=texture.magFilter=NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
    const geometry=new BufferGeometry();for(const [name,attribute]of Object.entries(source.geometry.attributes))geometry.setAttribute(name,attribute);geometry.setIndex(source.geometry.getIndex());const part=geometry.getAttribute("_part"),surface=geometry.getAttribute("_surface");
    if(!part||!surface||!geometry.getAttribute("uv"))throw new Error("Projector source material/pose attributes missing");geometry.setAttribute("aPart",part);geometry.setAttribute("aSurface",surface);
    const bounds=new Box3(new Vector3(...metadata.bounds[0]),new Vector3(...metadata.bounds[1]));geometry.boundingBox=bounds;geometry.boundingSphere=bounds.getBoundingSphere(new Sphere());
    const params=new Float32Array(128*4*4);sourceMaterials.forEach((m,i)=>{params.set([m.roughness,m.metalness,m.brushed?1:0,m.roughnessRange[0]],i*4);params.set([...m.emission,m.roughnessRange[1]],(128+i)*4);params.set([m.ior,m.specular,0,0],(256+i)*4);params.set(m.baseColor,(384+i)*4);});
    const palette=new DataTexture(params,128,4,RGBAFormat,FloatType);palette.needsUpdate=true;
    const fxValues=new Float32Array(metadata.parts*3*4);fx.parts.forEach((_,i)=>{const sweep=sweepUniforms(alignedFormation.names[alignedFormation.owners[i]]);fxValues.set(alignedFormation.timings[i],i*4);fxValues.set(sweep.sweep,(metadata.parts+i)*4);fxValues.set([...sweep.axis,sweep.revealDelay],(metadata.parts*2+i)*4);});
    const fxData=new DataTexture(fxValues,metadata.parts,3,RGBAFormat,FloatType);fxData.needsUpdate=true;
    const maps=bakes.map((b,i)=>{const map=b.clone();map.colorSpace=i===0?SRGBColorSpace:NoColorSpace;map.wrapS=map.wrapT=RepeatWrapping;map.anisotropy=Math.min(8,gl.capabilities.getMaxAnisotropy());return map;});
    const material=new MeshPhysicalMaterial({name:"Projector | Source metal, rubber, copper and PCB",vertexColors:false,toneMapped:false,alphaToCoverage:true,map:maps[0],roughnessMap:maps[1],normalMap:maps[2],envMap:localEnvironment(gl),envMapIntensity:.75,clearcoat:quality==="desktop"?.12:0,clearcoatRoughness:.2});
    material.normalScale.set(.65,.65);
    const uniforms={uPoses:{value:texture},uMaterials:{value:palette},uFxData:{value:fxData},uFxRootInverse:{value:new Matrix4().fromArray(fx.matrix).invert()},blenderView:{value:display},uPoseFrame:{value:metadata.frames-1},uFormation:{value:1},uFxFrame:{value:576},uCoverageEnabled:{value:1},stageIndirect:stageLighting.indirect};
    const configure=(target:MeshPhysicalMaterial,optical:boolean)=>{target.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader=shader.vertexShader.replace("#include <common>","#include <common>\n"+poseShader)
        .replace("#include <beginnormal_vertex>",`#include <beginnormal_vertex>\nreadPart();vec3 safeScale=max(abs(partScale),vec3(.000001))*mix(vec3(-1.0),vec3(1.0),step(vec3(0.0),partScale));objectNormal=rotatePart(partRotation,objectNormal/safeScale);`)
        .replace("#include <begin_vertex>",`#include <begin_vertex>\ntransformed=rotatePart(partRotation,transformed*partScale)+partPosition;vFxPoint=(uFxRootInverse*modelMatrix*vec4(transformed,1.0)).xyz;`);
      shader.fragmentShader=shader.fragmentShader.replace("#include <common>","#include <common>\nuniform float stageIndirect;\n"+fragmentCommon)
        .replace("#include <map_fragment>",`#ifdef USE_MAP\nif(vSurface.z>.5)diffuseColor.rgb=texture2D(map,vMapUv).rgb;\n#endif`)
        .replace("#include <color_fragment>",`#include <color_fragment>\n${optical?"diffuseColor.rgb=vec3(.80,.91,.97);":"if(vSurface.z<.5)diffuseColor.rgb=vSourceBase;"}`)
        .replace("#include <roughnessmap_fragment>",optical?"float roughnessFactor=.012;vec3 brushedChannels=vec3(0.0);":`float roughnessFactor=${optical?".025":"vSurface.x"};vec3 brushedChannels=vec3(0.0);if(vSurface.z>.5){brushedChannels=texture2D(roughnessMap,vRoughnessMapUv).rgb;roughnessFactor=brushedChannels.g;}else if(vEmission.w>vSurface.w+.001)roughnessFactor=mix(vSurface.w,vEmission.w,noiseTexFac(vFxPoint,120.0,2.0,.5,2.0,0.0,true));`)
        .replace("#include <metalnessmap_fragment>",`float metalnessFactor=vSurface.z>.5?brushedChannels.r:vSurface.y;`)
        .replace("#include <lights_physical_fragment>",`#include <lights_physical_fragment>\n
#ifdef USE_CLEARCOAT
material.clearcoat=${optical?"1.0":"mix(.12,.035,metalnessFactor)"};
#endif
float sourceSpecular=vSurface.z>.5?brushedChannels.b:vOptics.y;float sourceF0=pow((vOptics.x-1.0)/(vOptics.x+1.0),2.0)*2.0*sourceSpecular;material.specularColor=vec3(sourceF0);material.specularColorBlended=mix(material.specularColor,diffuseColor.rgb,metalnessFactor);`)
        .replace("#include <aomap_fragment>",`#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=stageIndirect;reflectedLight.indirectSpecular*=stageIndirect;
#ifdef USE_CLEARCOAT
clearcoatSpecularIndirect*=stageIndirect;
#endif
`)
        .replace("#include <normal_fragment_maps>",`if(vSurface.z>.5){\n#include <normal_fragment_maps>\n}`)
        .replace("#include <alphatest_fragment>",`#include <alphatest_fragment>\nif(vPartVisible<.5)discard;
if(uFormation<.9999){float reveal=surfaceFormation(vFxPoint,vFxTiming,vFxSweep,vFxAxis,uFxFrame);if(reveal<=.001)discard;${optical?"diffuseColor.a*=reveal;":"if(uCoverageEnabled>.5)diffuseColor.a*=reveal;else if(reveal<.5)discard;"}}`)
        .replace("#include <opaque_fragment>",optical?`float lensEdge=pow(1.-abs(dot(normal,normalize(vViewPosition))),3.);outgoingLight*=mix(1.,mix(.16,1.,lensEdge),vLens);${quality!=="desktop"?"diffuseColor.a*=mix(1.,.375+1.5625*lensEdge,vLens);":""}
#include <opaque_fragment>`:"#include <opaque_fragment>")
        .replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vEmission.rgb;`)
        .replace("#include <tonemapping_fragment>",optical?"#include <tonemapping_fragment>":`gl_FragColor.rgb=blenderDisplayLinear(gl_FragColor.rgb);`);
    };
    target.customProgramCacheKey=()=>"projector-physical-source-v7-"+quality+"-"+optical;};
    configure(material,false);
    const glass=new MeshPhysicalMaterial({name:"Projector | Coated optical glass",transmission:quality==="desktop"?.96:0,transparent:true,opacity:quality==="desktop"?1:.32,depthWrite:false,thickness:.018,ior:1.52,roughness:.012,metalness:0,clearcoat:1,clearcoatRoughness:.015,envMap:localEnvironment(gl),envMapIntensity:1.6,iridescence:.28,iridescenceIOR:1.32,iridescenceThicknessRange:[220,360],toneMapped:false});
    configure(glass,true);
    const indices=geometry.getIndex()!;let glassCount=0;
    for(let t=0;t<indices.count;t+=3)if(Math.round(surface.getX(indices.getX(t)))===40)glassCount+=3;
    const body=new Uint32Array(indices.count-glassCount),optics=new Uint32Array(glassCount);let bi=0,oi=0;
    for(let t=0;t<indices.count;t+=3){const glassPart=Math.round(surface.getX(indices.getX(t)))===40;for(let k=0;k<3;k++){if(glassPart)optics[oi++]=indices.getX(t+k);else body[bi++]=indices.getX(t+k);}}
    geometry.setIndex(new BufferAttribute(body,1));
    const opticalGeometry=new BufferGeometry();for(const [name,attribute]of Object.entries(geometry.attributes))opticalGeometry.setAttribute(name,attribute);
    opticalGeometry.setIndex(new BufferAttribute(optics,1));opticalGeometry.boundingBox=bounds;opticalGeometry.boundingSphere=geometry.boundingSphere;
    const depth=new MeshDepthMaterial({depthPacking:RGBADepthPacking,side:BackSide});
    depth.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);shader.vertexShader=shader.vertexShader.replace("#include <common>","#include <common>\n"+poseShader).replace("#include <begin_vertex>","#include <begin_vertex>\nreadPart();transformed=rotatePart(partRotation,transformed*partScale)+partPosition;vFxPoint=(uFxRootInverse*modelMatrix*vec4(transformed,1.)).xyz;");
      shader.fragmentShader=shader.fragmentShader.replace("#include <common>","#include <common>\nvarying float vPartVisible;varying vec4 vFxTiming,vFxSweep,vFxAxis;varying vec3 vFxPoint;uniform float uFxFrame,uFormation;\n"+particlesLib+surfaceFormationGLSL).replace("#include <alphatest_fragment>","#include <alphatest_fragment>\nif(vPartVisible<.5||(uFormation<.9999&&surfaceFormation(vFxPoint,vFxTiming,vFxSweep,vFxAxis,uFxFrame)<.5))discard;");};
    depth.customProgramCacheKey=()=>"projector-pose-shadow-v2";
    const mesh=new Mesh(geometry,material),opticalMesh=new Mesh(opticalGeometry,glass),fxRoot=new Group();mesh.name="Projector | Opaque original materials";mesh.castShadow=true;mesh.receiveShadow=true;mesh.customDepthMaterial=depth;opticalMesh.name="Projector | Optical lens and prisms";opticalMesh.userData.excludeFromMirror=true;fxRoot.name="Projector | Original particle coordinates";fxRoot.matrixAutoUpdate=false;fxRoot.matrix.fromArray(fx.matrix);
    const defaultSamples=gl.getContext().getParameter(gl.getContext().SAMPLES) as number;
    mesh.onBeforeRender=renderer=>{uniforms.uCoverageEnabled.value=(renderer.getRenderTarget()?.samples??defaultSamples)>1?1:0;};
    mesh.visible=opticalMesh.visible=fxRoot.visible=false;
    return{mesh,opticalMesh,fxRoot,uniforms,texture,palette,fxData,maps,geometry,material,glass,opticalGeometry,depth};
  }),[gltf,buffer,bakes,display,gl,quality]);
  const finishPreparation=useCallback(()=>{
    const ready=readiness.current;if(!ready.core||!ready.fx||ready.warming)return;ready.warming=true;
    cancelWarm.current=scheduleSceneIdle(()=>{
      const returning=journeyControls.read().phase==="pageReturnLoading";
      const draw=()=>{
        const {scene,camera}=get(),end=traceSpan(returning?"Covered full-scene GPU preparation":"Hidden projector GPU preparation","GPU resource submission");
        try{prepareHiddenGPU(gl,scene,camera,[scene]);end();traceMark("Projector GPU ready");projectorControls.ready(true);invalidate();}
        catch(error){end({error:String(error)});console.error("Projector preparation failed",error);}
      };
      // Warm both normal and reflection variants for the whole mounted scene
      // at this stop. Warming only the rig left the live floor's first normal
      // and mirror draws to compile during pullback/screens camera movement.
      // The same path also protects a covered native-page remount.
      const state=get(),end=traceSpan(returning?"Covered full-scene shader preparation":"Stationary full-scene shader preparation","shader preparation");
      void compileHiddenGPU(gl,state.scene,state.camera).then(()=>{
        end();if(readiness.current.warming)cancelWarm.current=scheduleSceneIdle(draw);
      }).catch(error=>{end({error:String(error)});console.error("Return scene preparation failed",error);});
    });
  },[get,gl,invalidate]);
  const onFXReady=useCallback(()=>{readiness.current.fx=true;finishPreparation();},[finishPreparation]);
  /* eslint-disable react-hooks/immutability -- owned GPU uniforms, shaders and frame state */
  useEffect(()=>{
    let active=true;const {scene,camera}=get(),readyState=readiness.current;stageLighting.geometryVersion++;if(quality==="mobile")readyState.fx=true;
    const warm=new Group();warm.add(rig.mesh.clone(false),rig.opticalMesh.clone(false),new Mesh(rig.geometry,rig.depth));
    void gl.compileAsync(warm,camera,scene).then(()=>{if(active){readiness.current.core=true;finishPreparation();}});
    return()=>{active=false;cancelWarm.current();readyState.core=false;readyState.fx=false;readyState.warming=false;projectorControls.ready(false);rig.geometry.dispose();rig.opticalGeometry.dispose();rig.material.dispose();rig.glass.dispose();rig.depth.dispose();rig.texture.dispose();rig.palette.dispose();rig.fxData.dispose();rig.maps.forEach(m=>m.dispose());};
  },[rig,get,gl,invalidate,quality,finishPreparation]);
  useEffect(()=>{
    if(!command.ready||playback.current.command===command.command)return;
    Object.assign(playback.current,{command:command.command,phase:command.phase,elapsed:0,finishing:false});
    clock.current.start(performance.now(),document.hidden);
    const visible=command.phase!=="hidden";rig.mesh.visible=rig.opticalMesh.visible=rig.fxRoot.visible=visible;stageLighting.geometryVersion++;
    if(visible)traceMark("Projector first revealed");
    rig.uniforms.uFormation.value=command.phase==="particles"?0:1;rig.uniforms.uPoseFrame.value=command.phase==="assembled"?metadata.frames-1:0;
    frame.current=command.phase==="hidden"?0:command.phase==="particles"?1:command.phase==="assembled"?576:96;rig.uniforms.uFxFrame.value=frame.current;invalidate();
  },[command,rig,invalidate]);
  useFrame(()=>{
    const state=playback.current;
    if(state.phase!=="particles"&&state.phase!=="assembling"){updateStageLighting(frame.current,state.phase==="exploded");return;}
    if(document.hidden)return;state.elapsed=clock.current.elapsed(performance.now());
    const seconds=state.phase==="particles"?metadata.particleSeconds:metadata.assemblySeconds;
    const inspecting=state.phase==="particles"&&inspectFrame!==null;
    const t=inspecting?(inspectFrame-1)/95:Math.min(1,state.elapsed/seconds);
    if(state.phase==="particles"){rig.uniforms.uFormation.value=t;frame.current=1+t*95;}else{rig.uniforms.uPoseFrame.value=t*(metadata.frames-1);frame.current=96+t*480;}
    rig.uniforms.uFxFrame.value=frame.current;
    updateStageLighting(frame.current,true);
    if(t<1){if(!inspecting)invalidate();}else if(!state.finishing){state.finishing=true;const phase=state.phase==="particles"?"exploded":"assembled";state.phase=phase;queueMicrotask(()=>projectorControls.finish(state.command,phase));}
  },-.75);
  /* eslint-enable react-hooks/immutability */
  return <><primitive object={rig.mesh} dispose={null}/><primitive object={rig.opticalMesh} dispose={null}/><primitive object={rig.fxRoot} dispose={null}/><Suspense fallback={null}>{quality!=="mobile"?<ProjectorParticles quality={quality} root={rig.fxRoot} frame={frame} onReady={onFXReady}/>:null}</Suspense></>;
}
