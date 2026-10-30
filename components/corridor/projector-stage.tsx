"use client";
import { useMemo,useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AmbientLight,DirectionalLight,Object3D,SpotLight } from "three";
import { stageLighting } from "./stage-lighting";
import { isMobileDevice } from "./texture-quality";
import {theatreOpening} from './theatre-opening-state';

/** The local key persists across formation and assembly; only it owns a small shadow map. */
export default function ProjectorStage(){
  const ambient=useRef<AmbientLight>(null),fill=useRef<DirectionalLight>(null);
  const key=useRef<SpotLight>(null),rim=useRef<SpotLight>(null);
  const target=useMemo(()=>{const o=new Object3D();o.position.set(.010995,2.65,-7.84475);return o;},[]);
  const last=useRef(""),lastShadow=useRef(-1),mobile=isMobileDevice();
  useFrame(({clock})=>{
    const house=theatreOpening.house.value;
    if(ambient.current)ambient.current.intensity=.55*Math.max(.18,stageLighting.room.value)*(.007+.993*house);
    if(fill.current)fill.current.intensity=1.15*Math.max(.06,stageLighting.room.value)*house;
    if(key.current){key.current.intensity=40+740*stageLighting.key.value;key.current.shadow.autoUpdate=false;
      const pose=stageLighting.frame+":"+stageLighting.geometryVersion;
      if(last.current!==pose&&(clock.elapsedTime-lastShadow.current>(mobile?.1:.066)||stageLighting.frame===576)){key.current.shadow.needsUpdate=true;last.current=pose;lastShadow.current=clock.elapsedTime;}}
    if(rim.current)rim.current.intensity=18+65*stageLighting.key.value;
  },-.6);
  return <>
    <ambientLight ref={ambient} intensity={.55}/><directionalLight ref={fill} position={[4,7,5]} intensity={1.15} color="#fff0de"/>
    <primitive object={target}/>
    <spotLight ref={key} target={target} position={[-3.99,8.27,-10.84475]} color="#edf4ff" intensity={40} angle={.55} penumbra={.80} distance={20} decay={2}
      castShadow shadow-mapSize={[mobile?512:1024,mobile?512:1024]} shadow-camera-near={.3} shadow-camera-far={20} shadow-bias={-.00015} shadow-normalBias={.006}/>
    <spotLight ref={rim} target={target} position={[3.01,4.77,-11.84475]} color="#90c7ed" intensity={18} angle={.7} penumbra={1} distance={16} decay={2}/>
  </>;
}
