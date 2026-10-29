"use client";

import { useEffect, useMemo } from "react";
import { useLoader, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Mesh, MeshBasicMaterial, SRGBColorSpace } from "three";
import { traceGLTF, traceSync } from "./loading-trace";
import { configureBakedTextureLoader } from "./baked-texture-loader";
import TextureRefinement from "./texture-refinement";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import assets from "./theatre-ceiling-assets.json";
import { stageBakedMaterial } from "./stage-lighting";

/** One surface-bound appearance. No camera projection, lighting switch or blend. */
export default function TheatreCeiling() {
  const gl=useThree(state=>state.gl);
  const {scene}=useGLTF(assets.model,"/draco/",false,traceGLTF);
  const atlas=useLoader(KTX2Loader,assets.texture,loader=>configureBakedTextureLoader(loader,gl));
  const instance=useMemo(()=>traceSync("Construct ceiling materials", ()=>{
    const copy=scene.clone(true);
    const map=atlas.clone();map.colorSpace=SRGBColorSpace;map.channel=1;
    map.anisotropy=Math.min(16,gl.capabilities.getMaxAnisotropy());
    const materials: MeshBasicMaterial[]=[];
    copy.traverse(object=>{
      if(!(object instanceof Mesh))return;
      if(!object.geometry.getAttribute("uv1"))throw new Error("Ceiling appearance UVs missing");
      const originals=Array.isArray(object.material)?object.material:[object.material];
      const restored=originals.map(original=>{
        const material=new MeshBasicMaterial({map,side:original.side,toneMapped:false});
        material.name="Ceiling | Approved baked appearance";material.dithering=true;
        stageBakedMaterial(material,false,true);
        materials.push(material);return material;
      });
      object.material=Array.isArray(object.material)?restored:restored[0];
    });
    return {scene:copy,map,materials};
  }),[scene,atlas,gl]);
  useEffect(()=>()=>{instance.materials.forEach(material=>material.dispose());instance.map.dispose();},[instance]);
  const refinement=useMemo(()=>[{url:assets.texture,base:instance.map,materials:instance.materials}],[instance]);
  return <><primitive object={instance.scene} dispose={null}/><TextureRefinement targets={refinement}/></>;
}



