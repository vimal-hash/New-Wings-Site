"use client";

import { useEffect, useMemo } from "react";
import { useLoader, useThree } from "@react-three/fiber";
import { BufferGeometry, Mesh, MeshBasicMaterial, SRGBColorSpace } from "three";
import { traceSync } from "./loading-trace";
import { configureBakedTextureLoader } from "./baked-texture-loader";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import assets from "./theatre-left-wall-assets.json";
import { stageBakedMaterial } from "./stage-lighting";
import TextureRefinement from "./texture-refinement";

/** Left wall only: one fixed Blender surface bake. No camera projection, lighting switch or blend. */
export default function TheatreLeftWall({ geometry }: { geometry: BufferGeometry }) {
  const gl=useThree(state=>state.gl);
  const atlas=useLoader(KTX2Loader,assets.texture,loader=>configureBakedTextureLoader(loader,gl));
  const instance=useMemo(()=>traceSync("Construct left wall material", ()=>{
    const map=atlas.clone();map.colorSpace=SRGBColorSpace;
    map.anisotropy=Math.min(16,gl.capabilities.getMaxAnisotropy());
    const material=new MeshBasicMaterial({map,toneMapped:false});
    material.name="Left wall | Baked Blender appearance";material.dithering=true;
    stageBakedMaterial(material);
    return {mesh:new Mesh(geometry,material),map,material};
  }),[atlas,geometry,gl]);
  useEffect(()=>()=>{instance.material.dispose();instance.map.dispose();},[instance]);
  const refinement=useMemo(()=>[{url:assets.texture,base:instance.map,materials:[instance.material]}],[instance]);
  return <><primitive object={instance.mesh} dispose={null}/><TextureRefinement targets={refinement}/></>;
}
