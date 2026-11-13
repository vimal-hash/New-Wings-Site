"use client";
import { useEffect,useMemo,useRef } from "react";
import { useFrame,useThree } from "@react-three/fiber";
import { Box3,DoubleSide,Frustum,Group,Matrix4,Mesh,MeshBasicMaterial,ShaderMaterial,Vector3,type BufferGeometry } from "three";
import { PlanarMirror,viewFrustum } from "./planar-mirror";
import { isMobileDevice } from "./texture-quality";
import pieces from "./moon-surfaces.json";
import { stageBakedMaterial,stageLighting } from "./stage-lighting";
import {applyTheatreOpeningMaterial} from './theatre-opening-material';
import {theatreOpening} from './theatre-opening-state';
import {journeyControls} from './journey-controls';

export default function DesignMoons({surfaces}:{surfaces:{item:string;geometry:BufferGeometry}[]}) {
  const root=useRef<Group>(null);
  const lastCapture=useRef(0);
  const mobile=isMobileDevice();
  const phoneCapture=useRef({next:0,captured:[false,false],lighting:""});
  const invalidate=useThree(s=>s.invalidate);
  const rig=useMemo(()=>{
    const mirrors=["left","right"].map(wall=>{
      const geometry=surfaces.find(s=>pieces.find(p=>p.name===s.item)?.role==="mirror"&&pieces.find(p=>p.name===s.item)?.wall===wall)!.geometry;
      const box=geometry.boundingBox as Box3,normal=new Vector3(wall==="left"?1:-1,0,0),point=new Vector3(wall==="left"?box.max.x:box.min.x,0,0);
      const bounds=new Box3();surfaces.filter(s=>pieces.find(p=>p.name===s.item)?.role==="mirror"&&pieces.find(p=>p.name===s.item)?.wall===wall).forEach(s=>bounds.union(s.geometry.boundingBox!));
      return {mirror:new PlanarMirror(normal.clone(),point.clone(),mobile?.72:1.25,undefined,undefined,undefined,mobile),normal,point,bounds,worldBounds:new Box3(),gain:{value:1},capturedRoom:1};
    });
    const meshes=surfaces.map(surface=>{
      const spec=pieces.find(p=>p.name===surface.item)!;const {mirror,gain}=mirrors[spec.wall==="left"?0:1];
      const material=spec.role==="mirror"?new ShaderMaterial({
        name:"Moon | Live planar room reflection",side:DoubleSide,toneMapped:false,
        uniforms:{reflection:{value:mirror.target.texture},reflectionMatrix:{value:mirror.textureMatrix},reflectionGain:gain},
        vertexShader:`uniform mat4 reflectionMatrix;varying vec4 vReflection;varying vec3 vGlassPosition,vGlassNormal;void main(){vec4 world=modelMatrix*vec4(position,1.0);vGlassPosition=world.xyz;vGlassNormal=normalize(mat3(modelMatrix)*normal);vReflection=reflectionMatrix*world;gl_Position=projectionMatrix*viewMatrix*world;}`,
        fragmentShader:`uniform sampler2D reflection;uniform float reflectionGain;varying vec4 vReflection;varying vec3 vGlassPosition,vGlassNormal;void main(){float facing=abs(dot(normalize(cameraPosition-vGlassPosition),normalize(vGlassNormal)));float edge=pow(1.-facing,5.);vec3 reflected=texture2DProj(reflection,vReflection).rgb*reflectionGain;vec3 coating=mix(vec3(.985,.995,1.),vec3(.94,.975,1.),edge);vec3 result=reflected*coating*(.90+.10*edge)+vec3(.006,.008,.012)*edge;gl_FragColor=vec4(result,1.0);#include <colorspace_fragment>}`.replace(";#include",";\n#include"),
      }):new MeshBasicMaterial({color:spec.role==="light"?"#ffdda8":spec.role==="crescent"?"#fff8e6":"#26201b",side:DoubleSide,toneMapped:false});
      if(spec.role!=="mirror")stageBakedMaterial(material,false,spec.role==="light"||spec.role==="crescent");
      applyTheatreOpeningMaterial(material,false,spec.role==='light'||spec.role==='crescent');
      const mesh=new Mesh(surface.geometry,material);mesh.name=`Moon ${spec.role} | ${spec.name}`;return {mesh,material,spec};
    });
    return {mirrors,meshes,frustum:new Frustum(),matrix:new Matrix4(),previousCamera:new Matrix4()};
  },[surfaces,mobile]);
  useEffect(()=>{invalidate();return()=>{rig.mirrors.forEach(m=>m.mirror.dispose());rig.meshes.forEach(m=>m.material.dispose());};},[rig,invalidate]);
  /* eslint-disable react-hooks/immutability -- Reflection cameras and shader uniforms are owned by this Three.js rig. */
  useFrame(({gl,scene,camera,clock})=>{
    if(theatreOpening.active.value>.5&&theatreOpening.room.value===0)return;
    const phase=journeyControls.read().phase;
    if(mobile&&(phase==="glassesExit"||phase==="pullback")){
      // Reuse the seated reflection and dim it with the room during the exit.
      // Repainting the theatre from a second camera competes with the pullback.
      for(const entry of rig.mirrors)entry.gain.value=Math.sqrt(stageLighting.room.value/Math.max(.1,entry.capturedRoom));
      return;
    }
    if(!root.current)return;root.current.updateWorldMatrix(true,true);camera.updateMatrixWorld();
    const moved=!rig.previousCamera.equals(camera.matrixWorld),elapsed=clock.elapsedTime;
    const capture=phoneCapture.current;
    const lighting=mobile?[theatreOpening.room.value,theatreOpening.house.value,theatreOpening.screenPower.value,stageLighting.room.value].join(","):"";
    if(mobile){
      if(moved||capture.lighting!==lighting){capture.lighting=lighting;capture.captured.fill(false);}
      if(elapsed-lastCapture.current<1/15&&lastCapture.current>0){
        if(capture.captured.some(Boolean)&&!capture.captured.every(Boolean))invalidate();
        return;
      }
    }else if(!moved&&stageLighting.active&&elapsed-lastCapture.current<1/15)return;
    rig.previousCamera.copy(camera.matrixWorld);lastCapture.current=elapsed;
    viewFrustum(gl,camera,rig.frustum);
    const hidden=rig.meshes.filter(m=>m.spec.role==="mirror").map(m=>m.mesh);
    for(let index=0;index<rig.mirrors.length;index++){
      const i=mobile?(capture.next+index)%rig.mirrors.length:index,entry=rig.mirrors[i];
      if(mobile&&capture.captured[i])continue;
      if(!rig.meshes.some(m=>m.spec.role==="mirror"&&m.spec.wall===(i===0?"left":"right")&&rig.frustum.intersectsObject(m.mesh))){
        if(mobile)capture.captured[i]=true;
        continue;
      }
      entry.mirror.normal.copy(entry.normal).transformDirection(root.current!.matrixWorld);
      entry.mirror.point.copy(entry.point).applyMatrix4(root.current!.matrixWorld);
      entry.worldBounds.copy(entry.bounds).applyMatrix4(root.current!.matrixWorld);
      const rendered=entry.mirror.render(gl,scene,camera,hidden,entry.worldBounds,mobile);
      if(rendered){entry.capturedRoom=stageLighting.room.value;entry.gain.value=1;}
      if(mobile)capture.captured[i]=true;
      if(rendered&&mobile){
        capture.next=(i+1)%rig.mirrors.length;
        if(capture.captured.some(done=>!done))invalidate();
        break;
      }
    }
  },-.5);
  /* eslint-enable react-hooks/immutability */
  return <group ref={root}>{rig.meshes.map(({mesh})=><primitive key={mesh.name} object={mesh} dispose={null}/>)}</group>;
}
