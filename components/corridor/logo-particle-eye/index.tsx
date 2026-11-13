"use client";
import {useEffect,useMemo,useRef,useSyncExternalStore} from "react";
import {useFrame,useThree} from "@react-three/fiber";
import {BufferAttribute,GLSL3,Group,InstancedBufferAttribute,InstancedBufferGeometry,Matrix4,Mesh,Quaternion,Scene,ShaderMaterial,SRGBColorSpace,Vector2,Vector3,type Texture} from "three";
import {KTX2Loader} from "three/examples/jsm/loaders/KTX2Loader.js";
import {journeyControls,type JourneyPhase} from "../journey-controls";
import {effectQuality,type EffectQuality} from "../effect-quality";
import {createLogoReveal,LOGO_FOV} from "../logo-reveal";
import {PAGE_POSE} from "../full-journey";
import bounds from "../logo-reveal.json";
import layout from "../blender-layout.json";
import {phoneEyePreparationWindow,scheduleSceneIdle,waitForSceneIdle} from "../scene-idle";
import {compileHiddenGPU,compileHiddenGPUGradually,prepareHiddenGPU,prepareMobileMeshes} from "../hidden-gpu-preparation";
import {traceMark,traceSpan} from "../loading-trace";
import {assetURL} from "../asset-url";
import {configureBakedTextureLoader} from "../baked-texture-loader";
import {isMobileDevice} from "../texture-quality";
import {pageReturn} from "../page-exit";
import {eyeDimensions,loadEyePoints} from "./field";
import assets from "./assets.json";
import lighting from "./lighting.json";
import {createDepthField,createDepthLayout,depthLayerVisibility} from "./depth-field";
import {HERO_WAVE_GLSL,pupilPulseUniforms} from "../pupil-pulse-state";
import {GRAIN_REACTION,GRAIN_REACTION_GLSL,GRAIN_OPTICS_GLSL} from "../pupil-grain-reaction";

const preparationPhases=new Set<JourneyPhase>(["screensDone","corridor","panel","page","pageReturnLoading","logoReveal","logoDone"]);
// Phones walk the corridor without a stop: the eye mounts only once the HTML page covers the scene.
const phonePreparationPhases=new Set<JourneyPhase>(["done","screens","corridor","panel","page","pageReturnLoading","logoReveal","logoDone"]);
const visiblePhases=new Set<JourneyPhase>(["logoReveal","logoDone"]);
const vertexShader=/* glsl */`
precision highp float;
uniform vec3 uMin,uExtent;
uniform vec3 uLighting[16];
uniform float uTime,uRadiusMax,uSizeBias,uPadding,uOpacity,uMotion,uViewportHeight,uDpr;
in vec2 corner;
in vec3 authoredPosition,grain;
out vec2 vUV;
out float vCoverage;
out vec3 vLighting;
out float vHeroWave;
out float vHeroSpark;
out float vHeroWake;
out vec2 vHeroLocal;
out vec3 vHeroDirection;
${HERO_WAVE_GLSL}
${GRAIN_REACTION_GLSL}
void main(){
  vec3 centre=uMin+authoredPosition*uExtent;
  vec2 lightCoord=clamp((vec2(centre.x/12.760252,-centre.y/7.177642)*.5+.5)*4.-.5,0.,3.);
  ivec2 cell=ivec2(floor(lightCoord)),nextCell=min(cell+1,ivec2(3));
  vec2 weight=fract(lightCoord);
  vLighting=mix(mix(uLighting[cell.y*4+cell.x],uLighting[cell.y*4+nextCell.x],weight.x),
    mix(uLighting[nextCell.y*4+cell.x],uLighting[nextCell.y*4+nextCell.x],weight.x),weight.y);
  float seed=fract(sin(dot(authoredPosition,vec3(127.1,311.7,74.7)))*43758.5453);
  float life=fract(seed+uTime*.16);
  float ends=smoothstep(.25,2.,10.9-abs(centre.x));
  float drift=(life-.5)*.10*ends*uMotion;
  centre.xy+=vec2(drift,drift*(-sign(centre.x)*sign(centre.y)*.35));
  vHeroWave=0.;vHeroSpark=0.;vHeroWake=0.;
  float grainSize=grain.x/255.;
  if(uHeroStrength>.0001){
    vec3 source=uMin+authoredPosition*uExtent;
    float group=grainReactionGroup(source);
    vec3 reaction=grainReaction(length((modelMatrix*vec4(centre,1.)).xyz-uHeroOrigin),seed,grainSize,group);
    float character=.8+.35*seed+.25*grainSize;
    vHeroWave=reaction.x*character;vHeroSpark=reaction.y*character;vHeroWake=reaction.z*character;
  }
  vec4 view=modelViewMatrix*vec4(centre,1.);
  float radius=grain.x/255.*uRadiusMax*uSizeBias;
  float aspect=floor(grain.y/16.)/15.;
  float angle=mod(grain.y,16.)*6.283185307/16.;
  vec2 local=corner*vec2(radius,radius*aspect)*uPadding;
  mat2 rotation=mat2(cos(angle),sin(angle),-sin(angle),cos(angle));
  vHeroLocal=corner*uPadding;
  vHeroDirection=vec3(0.,1.,seed);
  if(uHeroStrength>.0001){
    vec2 inward=(viewMatrix*vec4(uHeroOrigin,1.)).xy-view.xy;
    vHeroDirection.xy=transpose(rotation)*(inward/max(.001,length(inward)));
  }
  float worldScale=length(modelMatrix[1].xyz);
  float px=radius*worldScale*projectionMatrix[1][1]*.5*uViewportHeight/max(.01,-view.z);
  // Retain distant coverage; close grains become finer instead of large pebbles.
  // Work in CSS pixels so the close-up limit is consistent across display DPRs.
  float cssRadius=px/uDpr;
  float refinement=mix(1.,.75,smoothstep(1.25,5.,cssRadius));
  float refinedPx=min(px*refinement,3.*uDpr);
  float footprint=max(.65,refinedPx)/max(px,.001);
  view.xy+=rotation*local*worldScale*footprint;
  gl_Position=projectionMatrix*view;
  if(view.z>=-.1)gl_Position=vec4(2.,2.,2.,1.);
  vec2 cellUV=vec2(corner.x*.5+.5,.5-corner.y*.5);
  vUV=(vec2(mod(grain.z,8.),floor(grain.z/8.))+cellUV)/8.;
  float lifeFade=smoothstep(0.,.06,life)*(1.-smoothstep(.94,1.,life));
  float coverageScale=max(1.,footprint);
  vCoverage=uOpacity/(coverageScale*coverageScale)*mix(1.,lifeFade,uMotion);
}`;
const fragmentShader=/* glsl */`
precision highp float;
uniform sampler2D uAtlas;
in vec2 vUV;
in float vCoverage;
in vec3 vLighting;
in float vHeroWave;
in float vHeroSpark;
in float vHeroWake;
in vec2 vHeroLocal;
in vec3 vHeroDirection;
uniform vec3 uHeroCore;
uniform float uHeroReactionGain;
${GRAIN_OPTICS_GLSL}
out vec4 fragmentColour;
void main(){
  vec4 steel=texture(uAtlas,vUV);
  float alpha=steel.a*vCoverage;
  if(alpha<.006)discard;
  vec3 colour=steel.rgb*vLighting;
  // Compress only bright reflection peaks, preserving the darker steel tones.
  float luminance=dot(colour,vec3(.2126,.7152,.0722));
  float excess=max(0.,luminance-.28);
  float softLuminance=min(luminance,.28)+excess/(1.+.85*excess);
  colour*=softLuminance/max(luminance,.0001);
  // Retain the atlas's metallic facets/dark sides under the travelling light.
  // This changes illumination only; coverage, motion and blending are untouched.
  vec3 vHeroLight=vec3(0.),vHeroBloom=vec3(0.);
  if(vHeroWave+vHeroSpark+vHeroWake>.00001){
  float grainLuma=dot(steel.rgb,vec3(.2126,.7152,.0722));
  float facet=smoothstep(.025,.50,grainLuma),shaded=smoothstep(.003,.045,grainLuma);
  // A compact curved facet model: inward-facing edges catch the pupil's grazing
  // light, the opposite side stays dark, and roughness varies with the grain.
  vec2 local=vHeroLocal*.82;
  vec3 normal=normalize(vec3(local,sqrt(max(.06,1.-dot(local,local)))));
  vec3 incoming=normalize(vec3(vHeroDirection.xy,.38));
  float facing=max(0.,dot(normal,incoming));
  vec3 halfway=normalize(incoming+vec3(0.,0.,1.));
  float specular=pow(max(0.,dot(normal,halfway)),mix(44.,100.,vHeroDirection.z));
  float reflection=(${GRAIN_REACTION.floor}+${GRAIN_REACTION.reflection}*pow(facing,1.35))*(.35+.65*sqrt(facet));
  float hotFacet=specular*(.28+.72*facet)*${GRAIN_REACTION.specular}*grainGlintWeight(vHeroDirection.z);
  // Fast contact glint and a slower material afterglow are separate from the ray.
  float received=shaded*((vHeroWave+vHeroWake)*reflection+vHeroSpark*hotFacet);
  vHeroLight=uHeroCore*received;
  vHeroLight/=1.+.70*dot(vHeroLight,vec3(.2126,.7152,.0722));
  vHeroLight*=uHeroReactionGain;
  // Feed only received energy to HDR bloom; resting grains remain excluded.
  vHeroBloom=grainBloomDetail(uHeroCore*shaded*((vHeroWave*.75+vHeroWake*.65)*reflection+vHeroSpark*hotFacet*1.7))*uHeroReactionGain;
  }
  colour+=vHeroLight;
  fragmentColour=vec4(colour,alpha);
  #define gl_FragColor fragmentColour
  #include <colorspace_fragment>
}`;

export type EyeStats={quality:EffectQuality;count:number;downloadBytes:number;attributeBytes:number;loadDecodeMs:number};
type EyeFieldProps={active:boolean;review?:boolean;qualityOverride?:EffectQuality;moving?:boolean;onReady?:(stats:EyeStats)=>void};
/** Shared by the actual journey and the isolated /eye-study review. */
export function AuthoredEyeField({active,review=false,qualityOverride,moving=true,onReady}:EyeFieldProps) {
  const gl=useThree(s=>s.gl),camera=useThree(s=>s.camera),size=useThree(s=>s.size),invalidate=useThree(s=>s.invalidate);
  const quality=qualityOverride??effectQuality(gl),tier=assets.tiers[quality];
  const state=useRef({ready:false,time:0,opacity:0,reduce:false});
  const callback=useRef(onReady);
  useEffect(()=>{callback.current=onReady;},[onReady]);
  const anchor=useMemo(()=>{
    if(review){
      const aspect=size.width/Math.max(1,size.height);
      const distance=19.7209459118*Math.max(1,(16/9)/aspect);
      const dimensions=eyeDimensions(3.5,distance,aspect,40);
      return {centre:new Vector3(),rotation:new Quaternion(),...dimensions};
    }
    const start=new Vector3(...PAGE_POSE.position),rotation=new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(start,new Vector3(...PAGE_POSE.target),new Vector3(0,1,0)));
    const reveal=createLogoReveal(bounds.blenderBounds,layout.slides[1],PAGE_POSE.position[1],size.width/Math.max(1,size.height),start,rotation);
    const diameter=Math.max(bounds.blenderBounds[0][1]-bounds.blenderBounds[0][0],bounds.blenderBounds[1][1]-bounds.blenderBounds[1][0]);
    const dimensions=eyeDimensions(diameter,reveal.finalPosition.distanceTo(reveal.centre),size.width/Math.max(1,size.height),LOGO_FOV);
    // Narrow and portrait screens keep the approved 16:9 almond: the eye is never squeezed to the screen width;
    // its tips run past the edges instead (a closer crop of the same eye), and the lids and pupil stay unchanged.
    const wide=createLogoReveal(bounds.blenderBounds,layout.slides[1],PAGE_POSE.position[1],16/9,start,rotation);
    const wideFit=eyeDimensions(diameter,wide.finalPosition.distanceTo(wide.centre),16/9,LOGO_FOV).fit;
    return {centre:reveal.centre,rotation:reveal.finalRotation,scale:dimensions.scale,scaleX:dimensions.scale*Math.max(dimensions.fit,wideFit),front:dimensions.front};
  },[review,size.width,size.height]);
  const resources=useMemo(()=>{
    const geometry=new InstancedBufferGeometry();
    geometry.setAttribute("corner",new BufferAttribute(new Float32Array([-1,-1,1,-1,1,1,-1,1]),2));
    geometry.setIndex([0,1,2,0,2,3]);geometry.instanceCount=0;
    const material=new ShaderMaterial({glslVersion:GLSL3,vertexShader,fragmentShader,transparent:true,depthWrite:false,depthTest:true,toneMapped:false,
      uniforms:{...pupilPulseUniforms,uHeroReactionGain:{value:GRAIN_REACTION.brightness},uTime:{value:0},uMin:{value:new Vector3()},uExtent:{value:new Vector3()},uRadiusMax:{value:assets.radiusMax},uAtlas:{value:null},uLighting:{value:lighting.values.map(v=>new Vector3(...v))},
        uSizeBias:{value:Math.min(2,Math.sqrt(assets.authoringCount/tier.count))},uPadding:{value:assets.atlas.quadPadding},uOpacity:{value:0},uMotion:{value:0},uViewportHeight:{value:720},uDpr:{value:1}}});
    const mesh=new Mesh(geometry,material),group=new Group(),pixels=new Vector2();
    mesh.frustumCulled=false;mesh.renderOrder=8;mesh.name="Approved revision 16 — authored steel grains";mesh.userData.excludeFromMirror=true;
    mesh.onBeforeRender=renderer=>{material.uniforms.uViewportHeight.value=renderer.getDrawingBufferSize(pixels).y;material.uniforms.uDpr.value=renderer.getPixelRatio();};
    group.name="LogoParticleEye — removable authored effect";group.add(mesh);group.visible=false;
    const root=new Group();root.add(group);
    const start=new Vector3(...PAGE_POSE.position),initial=new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(start,new Vector3(...PAGE_POSE.target),new Vector3(0,1,0)));
    const reveal=createLogoReveal(bounds.blenderBounds,layout.slides[1],PAGE_POSE.position[1],16/9,start,initial);
    const stop=new Vector3(),stopRotation=new Quaternion();reveal.sampleTurn(1,stop,stopRotation);
    const forward=new Vector3(0,0,-1).applyQuaternion(stopRotation),unit=(bounds.blenderBounds[1][1]-bounds.blenderBounds[1][0])/3.5;
    // Local diagnostic comparison; normal/LAN viewers always receive the layer.
    const params=typeof location==='undefined'?null:new URLSearchParams(location.search);
    const disabled=typeof location!=='undefined'&&/^(localhost|127\.)/.test(location.hostname)&&params?.has('diagnostics')&&params.get('eye-depth')==='off';
    const depth=review||disabled?null:createDepthField(createDepthLayout(quality,stop,Math.atan2(forward.x,forward.z),unit),unit,assets.atlas.quadPadding,fragmentShader,quality==="mobile");
    if(depth)root.add(depth.root);
    return {geometry,material,mesh,group,root,depth,stop,travelDistance:reveal.finalPosition.distanceTo(stop)};
  },[tier.count,quality,review]);
  useEffect(()=>{
    resources.group.position.copy(anchor.centre);resources.group.quaternion.copy(anchor.rotation);resources.group.scale.set(anchor.scaleX,anchor.scale,anchor.scale);invalidate();
  },[anchor,resources,invalidate]);
  useEffect(()=>{
    // Matched-camera material QA only; the normal experience always uses the bake.
    if(review&&new URLSearchParams(location.search).get('lighting')==='raw'){
      resources.material.uniforms.uLighting.value.forEach((value:Vector3)=>value.setScalar(1));invalidate();
    }
  },[review,resources,invalidate]);
  /* eslint-disable react-hooks/immutability -- The loader fills the mount-owned mesh, attributes and uniforms. */
  useEffect(()=>{
    const motion=state.current,query=matchMedia("(prefers-reduced-motion: reduce)");
    motion.ready=false;motion.opacity=0;motion.time=0;
    resources.mesh.userData.eyePrepared=false;
    const update=()=>{motion.reduce=query.matches;invalidate();};update();
    const visibility=()=>{if(!document.hidden)invalidate();};
    query.addEventListener("change",update);document.addEventListener("visibilitychange",visibility);
    let alive=true,cancelCompile=()=>{},cancelDraw=()=>{};let texture:Texture|undefined;
    const controller=new AbortController(),loader=new KTX2Loader();
    const mobile=quality==="mobile"&&!review;
    const schedule=(job:()=>void,gpu=false)=>review?(job(),()=>{}):scheduleSceneIdle(job,mobile?20:15,gpu&&mobile?phoneEyePreparationWindow:undefined);
    const waitForQuiet=()=>waitForSceneIdle(controller.signal,20,phoneEyePreparationWindow);
    const failed=(error:unknown)=>{if(!alive||controller.signal.aborted)return;resources.mesh.userData.eyePrepared=true;console.error("Authored eye preparation failed",error);invalidate();};
    const cancelLoad=schedule(()=>{
      const end=traceSpan("Authored logo eye load","worker decode and grain atlas",{quality,count:tier.count});
      configureBakedTextureLoader(loader,gl);
      void Promise.all([
        loadEyePoints(assetURL(assets.worker),assetURL(tier.url),controller.signal),
        loader.loadAsync(assetURL(assets.atlas.url)).then(value=>{if(!alive){value.dispose();throw new DOMException('Eye load cancelled','AbortError');}texture=value;return value;}),
      ]).then(([data,atlas])=>{
        if(!alive)return;
        end({loadDecodeMs:data.loadDecodeMs});
        cancelCompile=schedule(()=>{
          if(!alive)return;
          atlas.colorSpace=SRGBColorSpace;atlas.anisotropy=Math.min(4,gl.capabilities.getMaxAnisotropy());
          resources.geometry.setAttribute("authoredPosition",new InstancedBufferAttribute(data.positions,3,true));
          // Same 0-255 values as floats: byte data on a float attribute makes Windows
          // (ANGLE/D3D11) recompile this shader on the GPU thread at its first draw.
          resources.geometry.setAttribute("grain",new InstancedBufferAttribute(Float32Array.from(data.grains),3));resources.geometry.instanceCount=data.count;
          resources.material.uniforms.uMin.value.fromArray(data.min);resources.material.uniforms.uExtent.value.fromArray(data.extent);
          resources.material.uniforms.uAtlas.value=atlas;
          const probe=new Mesh(resources.geometry,resources.material),privateScene=new Scene();privateScene.add(probe);
          if(resources.depth){resources.depth.material.uniforms.uAtlas.value=atlas;privateScene.add(new Mesh(resources.depth.geometry,resources.depth.material),resources.depth.haze.mesh.clone());}
          const compilation=mobile?compileHiddenGPUGradually(gl,privateScene,camera,()=>alive,privateScene,false,waitForQuiet):compileHiddenGPU(gl,privateScene,camera);
          void compilation.then(()=>{
            if(!alive)return;
            cancelDraw=schedule(()=>{
              if(!alive)return;
              const prepared=()=>{
                if(!alive)return;
                motion.ready=true;resources.mesh.userData.eyePrepared=true;traceMark("Authored logo eye ready");
                callback.current?.({quality,count:data.count,downloadBytes:tier.bytes+assets.atlas.bytes,attributeBytes:data.positions.byteLength+data.grains.byteLength,loadDecodeMs:data.loadDecodeMs});invalidate();
              };
              if(mobile)void prepareMobileMeshes(gl,privateScene,camera,privateScene.children,()=>alive,waitForQuiet).then(prepared,failed);
              else try{prepareHiddenGPU(gl,privateScene,camera,privateScene.children);prepared();}catch(error){failed(error);}
            },true);
          }).catch(failed);
        },true);
      }).catch(error=>{end({error:String(error)});failed(error);});
    });
    return()=>{alive=false;motion.ready=false;cancelLoad();cancelCompile();cancelDraw();controller.abort();loader.dispose();texture?.dispose();
      query.removeEventListener("change",update);document.removeEventListener("visibilitychange",visibility);resources.geometry.dispose();resources.material.dispose();resources.depth?.geometry.dispose();resources.depth?.material.dispose();resources.depth?.haze.geometry.dispose();resources.depth?.haze.material.dispose();};
  },[gl,camera,resources,quality,tier,review,invalidate]);
  /* eslint-enable react-hooks/immutability */
  useEffect(()=>{invalidate();},[active,moving,invalidate]);
  /* eslint-disable react-hooks/immutability -- imperative updates to owned Three.js objects. */
  useFrame((_,delta)=>{
    const journey=journeyControls.read(),coveredReturn=journey.phase==='pageReturnLoading';
    const warming=journey.phase==='page'&&pageReturn.warming;
    const motion=state.current,visible=(active||coveredReturn||warming)&&motion.ready;
    resources.root.visible=resources.group.visible=visible;
    if(!visible||document.hidden||journey.finalCovered)return;
    const step=Math.min(delta,.05),animate=moving&&!motion.reduce;
    // Keep the same grain positions when the phone camera settles. A resting
    // view no longer runs the scene solely for the tiny grain drift.
    const ticking=animate&&(quality!=="mobile"||journey.cameraMoving||journey.phase==="logoDone");
    if(ticking)motion.time+=step;
    if(!warming)motion.opacity=review||motion.reduce?1:Math.min(1,motion.opacity+step*2.5);
    const alpha=warming?1:motion.opacity;
    resources.material.uniforms.uTime.value=motion.time;resources.material.uniforms.uOpacity.value=alpha;resources.material.uniforms.uMotion.value=animate?1:0;
    if(resources.depth){
      const travel=camera.position.distanceTo(resources.stop)/resources.travelDistance;
      const opacity=alpha*depthLayerVisibility(coveredReturn||warming?'logoReveal':journey.phase,journey.revealStage,travel);
      resources.depth.mesh.visible=opacity>.0001;
      resources.depth.haze.mesh.visible=opacity>.0001;resources.depth.haze.material.uniforms.uOpacity.value=opacity;
      resources.depth.material.uniforms.uOpacity.value=opacity;resources.depth.material.uniforms.uTime.value=motion.time;resources.depth.material.uniforms.uMotion.value=animate?1:0;
    }
    if(!warming&&(ticking||motion.opacity<1))invalidate();
  },-.35);
  /* eslint-enable react-hooks/immutability */
  return <primitive object={resources.root} dispose={null}/>;
}
export default function LogoParticleEye({enabled=true}:{enabled?:boolean}) {
  const journey=useSyncExternalStore(journeyControls.subscribe,journeyControls.read,journeyControls.read);
  const phases=isMobileDevice()?phonePreparationPhases:preparationPhases;
  return enabled&&phases.has(journey.phase)?<AuthoredEyeField active={visiblePhases.has(journey.phase)}/>:null;
}
