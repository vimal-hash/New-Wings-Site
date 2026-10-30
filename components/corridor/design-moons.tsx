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

export default function DesignMoons({surfaces}:{surfaces:{item:string;geometry:BufferGeometry}[]}) {
  const root=useRef<Group>(null);
  const lastCapture=useRef(0);
  const invalidate=useThree(s=>s.invalidate);
  const rig=useMemo(()=>{
    const mirrors=["left","right"].map(wall=>{
      const geometry=surfaces.find(s=>pieces.find(p=>p.name===s.item)?.role==="mirror"&&pieces.find(p=>p.name===s.item)?.wall===wall)!.geometry;
      const box=geometry.boundingBox as Box3,normal=new Vector3(wall==="left"?1:-1,0,0),point=new Vector3(wall==="left"?box.max.x:box.min.x,0,0);
      const bounds=new Box3();surfaces.filter(s=>pieces.find(p=>p.name===s.item)?.role==="mirror"&&pieces.find(p=>p.name===s.item)?.wall===wall).forEach(s=>bounds.union(s.geometry.boundingBox!));
      return {mirror:new PlanarMirror(normal.clone(),point.clone(),isMobileDevice()?1:1.25),normal,point,bounds,worldBounds:new Box3()};
    });
    const meshes=surfaces.map(surface=>{
      const spec=pieces.find(p=>p.name===surface.item)!;const mirror=mirrors[spec.wall==="left"?0:1].mirror;
      const material=spec.role==="mirror"?new ShaderMaterial({
        name:"Moon | Live planar room reflection",side:DoubleSide,toneMapped:false,
        uniforms:{reflection:{value:mirror.target.texture},reflectionMatrix:{value:mirror.textureMatrix}},
        vertexShader:`uniform mat4 reflectionMatrix;varying vec4 vReflection;varying vec3 vGlassPosition,vGlassNormal;void main(){vec4 world=modelMatrix*vec4(position,1.0);vGlassPosition=world.xyz;vGlassNormal=normalize(mat3(modelMatrix)*normal);vReflection=reflectionMatrix*world;gl_Position=projectionMatrix*viewMatrix*world;}`,
        fragmentShader:`uniform sampler2D reflection;varying vec4 vReflection;varying vec3 vGlassPosition,vGlassNormal;void main(){float facing=abs(dot(normalize(cameraPosition-vGlassPosition),normalize(vGlassNormal)));float edge=pow(1.-facing,5.);vec3 reflected=texture2DProj(reflection,vReflection).rgb;vec3 coating=mix(vec3(.985,.995,1.),vec3(.94,.975,1.),edge);vec3 result=reflected*coating*(.90+.10*edge)+vec3(.006,.008,.012)*edge;gl_FragColor=vec4(result,1.0);#include <colorspace_fragment>}`.replace(";#include",";\n#include"),
      }):new MeshBasicMaterial({color:spec.role==="light"?"#ffdda8":spec.role==="crescent"?"#fff8e6":"#26201b",side:DoubleSide,toneMapped:false});
      if(spec.role!=="mirror")stageBakedMaterial(material,false,spec.role==="light"||spec.role==="crescent");
      applyTheatreOpeningMaterial(material,false,spec.role==='light'||spec.role==='crescent');
      const mesh=new Mesh(surface.geometry,material);mesh.name=`Moon ${spec.role} | ${spec.name}`;return {mesh,material,spec};
    });
    return {mirrors,meshes,frustum:new Frustum(),matrix:new Matrix4(),previousCamera:new Matrix4()};
  },[surfaces]);
  useEffect(()=>{invalidate();return()=>{rig.mirrors.forEach(m=>m.mirror.dispose());rig.meshes.forEach(m=>m.material.dispose());};},[rig,invalidate]);
  useFrame(({gl,scene,camera,clock})=>{
    if(theatreOpening.active.value>.5&&theatreOpening.room.value===0)return;
    if(!root.current)return;root.current.updateWorldMatrix(true,true);camera.updateMatrixWorld();
    const moved=!rig.previousCamera.equals(camera.matrixWorld),elapsed=clock.elapsedTime;
    if(!moved&&stageLighting.active&&elapsed-lastCapture.current<1/15)return;
    rig.previousCamera.copy(camera.matrixWorld);lastCapture.current=elapsed;
    viewFrustum(gl,camera,rig.frustum);
    const hidden=rig.meshes.filter(m=>m.spec.role==="mirror").map(m=>m.mesh);
    rig.mirrors.forEach((entry,i)=>{
      if(!rig.meshes.some(m=>m.spec.role==="mirror"&&m.spec.wall===(i===0?"left":"right")&&rig.frustum.intersectsObject(m.mesh)))return;
      entry.mirror.normal.copy(entry.normal).transformDirection(root.current!.matrixWorld);
      entry.mirror.point.copy(entry.point).applyMatrix4(root.current!.matrixWorld);
      entry.worldBounds.copy(entry.bounds).applyMatrix4(root.current!.matrixWorld);
      entry.mirror.render(gl,scene,camera,hidden,entry.worldBounds);
    });
  },-.5);
  return <group ref={root}>{rig.meshes.map(({mesh})=><primitive key={mesh.name} object={mesh} dispose={null}/>)}</group>;
}
