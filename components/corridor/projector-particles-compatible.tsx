"use client";
import { useEffect,useMemo,type RefObject } from "react";
import { useFrame,useThree } from "@react-three/fiber";
import { BufferAttribute,CustomBlending,DataTexture,DoubleSide,GLSL3,HalfFloatType,InstancedBufferGeometry,Mesh,NearestFilter,NoColorSpace,OneFactor,OneMinusSrcAlphaFactor,RGBAFormat,ShaderMaterial,Vector2,type Object3D } from "three";
import { useCompressedBuffer } from "./compressed-buffer";
import { blenderDisplayGLSL,useBlenderViewLUT } from "./blender-view-lut";
import cache from "./projector-trajectories.json";
import type { EffectQuality } from "./effect-quality";
import { stageLighting } from "./stage-lighting";

const vertex=`
precision highp float;precision highp int;
in vec2 corner;uniform sampler2D uHead,uTail,uColour;uniform float uFrame,uHeight;uniform int uRows,uInstances,uAvailable,uCopies;uniform float uWeight;uniform float stageFlash;
out vec2 vCorner;out float vAspect,vAlpha;out vec3 vColour;
${blenderDisplayGLSL}
vec4 at(sampler2D map,int sampleIndex){int mapped=int((float(gl_InstanceID)+.5)*float(uAvailable*uCopies)/float(uInstances));int id=mapped/uCopies;return texelFetch(map,ivec2(id%256,sampleIndex*uRows+id/256),0);}
float particleHash(float n){return fract(sin(n*127.1)*43758.5453);}
vec3 toThree(vec3 p){return vec3(p.x,p.z,-p.y);}
void main(){int mapped=int((float(gl_InstanceID)+.5)*float(uAvailable*uCopies)/float(uInstances));int sibling=mapped%uCopies;float seed=float(mapped)*1.37;float phase=clamp((uFrame-1.0)/95.,0.,1.);float timeOffset=sibling==0?0.:(particleHash(seed+41.)-.5)*3.*sin(phase*3.14159265);float sampleFrame=clamp((uFrame-1.0)*96.0/95.0+timeOffset,0.0,96.0);int lo=int(floor(sampleFrame)),hi=min(lo+1,96);float t=fract(sampleFrame);
vec4 a=at(uHead,lo),b=at(uHead,hi),h=mix(a,b,t),ta=at(uTail,lo),tb=at(uTail,hi),tail=mix(ta,tb,t),col=mix(at(uColour,lo),at(uColour,hi),t);
if(a.w<=0.0){h.xyz=b.xyz;tail.xyz=tb.xyz;}if(b.w<=0.0){h.xyz=a.xyz;tail.xyz=ta.xyz;}
float curve=sin(phase*3.14159265);float angle=seed+phase*6.2831853;vec3 scatter=vec3(cos(angle),sin(angle)*.35,sin(angle))*.07*curve;
if(sibling>0){h.xyz+=scatter;tail.xyz+=scatter;}
if(h.w<=0.0||tail.w<=0.0){gl_Position=vec4(2.0);vAlpha=0.0;return;}
vec3 headView=(modelViewMatrix*vec4(toThree(h.xyz),1.0)).xyz,endView=(modelViewMatrix*vec4(toThree(tail.xyz),1.0)).xyz;
float pxPerUnit=projectionMatrix[1][1]*uHeight*.5/max(-headView.z,.001);float truePixels=h.w*pxPerUnit*1.6;float radiusPixels=max(.85,truePixels),radius=radiusPixels/pxPerUnit;
vec3 axis=endView-headView;float length_=length(axis);vec3 direction=length_>1e-6?axis/length_:vec3(1.0,0.0,0.0),side=normalize(cross(normalize(-headView),direction));if(length(side)<.1)side=vec3(0.0,1.0,0.0);
vec3 centre=mix(headView,endView,corner.x*.5+.5);vec3 p=centre+direction*corner.x*radius+side*corner.y*radius;
vAspect=.5*length_/radius;vCorner=corner;vAlpha=clamp(tail.w*max(.14,pow(min(1.0,truePixels/radiusPixels),1.4)*uWeight),0.0,.92);
vColour=blenderDisplayLinear(col.rgb*(.45+col.a*1.2)+vec3(.05,.07,.09)*stageFlash);gl_Position=projectionMatrix*vec4(p,1.0);}`;
const fragment=`precision highp float;in vec2 vCorner;in float vAspect,vAlpha;in vec3 vColour;out vec4 fragColor;
void main(){float x=max(abs(vCorner.x*(vAspect+1.0))-vAspect,0.0),d=length(vec2(x,vCorner.y));float aa=max(fwidth(d),.06);float a=vAlpha*mix(1.,.35,clamp(vCorner.x*.5+.5,0.,1.))*(1.0-smoothstep(1.0-aa,1.0+aa,d));if(a<.001)discard;fragColor=vec4(vColour*a,a);
#define gl_FragColor fragColor
#include <colorspace_fragment>
}`;

/** Offline evaluation of the original flight field; runtime only interpolates neighbouring samples. */
/* eslint-disable react-hooks/immutability -- owned Three.js textures, buffers and uniforms */
export default function CompatibleParticles({root,frame,onReady,quality}:{root:Object3D;frame:RefObject<number>;onReady:()=>void;quality:Exclude<EffectQuality,"desktop">}){
  const gl=useThree(s=>s.gl),scene=useThree(s=>s.scene),camera=useThree(s=>s.camera),display=useBlenderViewLUT();
  const copies=quality==="mobile"?1:3;
  const profile=cache.profiles[quality],buffer=useCompressedBuffer(profile.path);
  const rig=useMemo(()=>{
    const plane=cache.width*profile.rows*cache.frames*4,values=new Uint16Array(buffer);
    if(values.length!==plane*3)throw Error("Compatible projector trajectory length mismatch");
    const textures=[0,1,2].map(i=>{const texture=new DataTexture(values.subarray(i*plane,(i+1)*plane),cache.width,profile.rows*cache.frames,RGBAFormat,HalfFloatType);texture.minFilter=texture.magFilter=NearestFilter;texture.generateMipmaps=false;texture.colorSpace=NoColorSpace;texture.needsUpdate=true;return texture;});
    const geometry=new InstancedBufferGeometry();geometry.setAttribute("corner",new BufferAttribute(new Float32Array([-1,-1,1,-1,1,1,-1,1]),2));geometry.setIndex([0,1,2,0,2,3]);geometry.instanceCount=profile.count*copies;
    const material=new ShaderMaterial({name:`Projector | Cached ${quality} flight paths`,glslVersion:GLSL3,vertexShader:vertex,fragmentShader:fragment,transparent:true,toneMapped:false,depthWrite:false,side:DoubleSide,blending:CustomBlending,blendSrc:OneFactor,blendDst:OneMinusSrcAlphaFactor,
      uniforms:{uHead:{value:textures[0]},uTail:{value:textures[1]},uColour:{value:textures[2]},uFrame:{value:576},uHeight:{value:720},uRows:{value:profile.rows},uInstances:{value:profile.count*copies},uAvailable:{value:profile.count},uCopies:{value:copies},stageFlash:stageLighting.flash,uWeight:{value:2.8},blenderView:{value:display}}});
    const mesh=new Mesh(geometry,material);mesh.name=`Projector particles | Cached ${quality}`;mesh.frustumCulled=false;mesh.renderOrder=10;const size=new Vector2();mesh.onBeforeRender=renderer=>{material.uniforms.uHeight.value=renderer.getDrawingBufferSize(size).y;};
    return{mesh,material,geometry,textures,frames:0,average:1/60,slowSeconds:0};
  },[buffer,display,profile,quality,copies]);
  useEffect(()=>{root.add(rig.mesh);let active=true;void gl.compileAsync(scene,camera).then(()=>{if(active)onReady();});return()=>{active=false;root.remove(rig.mesh);rig.geometry.dispose();rig.material.dispose();rig.textures.forEach(t=>t.dispose());};},[root,rig,gl,scene,camera,onReady]);
  useFrame((_,delta)=>{const f=frame.current??576;rig.mesh.visible=f>5&&f<96.5;rig.material.uniforms.uFrame.value=f;
    if(rig.mesh.visible&&delta<.25){rig.average=.9*rig.average+.1*delta;rig.slowSeconds=rig.average>1/22?rig.slowSeconds+delta:0;
      if(rig.slowSeconds>1){rig.geometry.instanceCount=Math.max(profile.count*2,Math.floor(rig.geometry.instanceCount*.8));rig.material.uniforms.uInstances.value=rig.geometry.instanceCount;rig.slowSeconds=0;}}

  },-.7);
  return null;
}
/* eslint-enable react-hooks/immutability */
