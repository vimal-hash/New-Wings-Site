"use client";

import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, NoColorSpace, SRGBColorSpace, Vector3 } from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { configureBakedTextureLoader } from "./baked-texture-loader";
import { blenderDisplayGLSL, useBlenderViewLUT } from "./blender-view-lut";
import { traceGLTF, traceSync } from "./loading-trace";
import assets from "./sofa-assets.json";
import { localEnvironment } from "./local-environment";
import { stageLighting } from "./stage-lighting";
import {theatreOpening} from './theatre-opening-state';
import {applyTheatreOpeningMaterial} from './theatre-opening-material';

const leatherNoise=`varying vec3 vLeatherPosition;
float leatherHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float leatherNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(leatherHash(i),leatherHash(i+vec3(1,0,0)),f.x),mix(leatherHash(i+vec3(0,1,0)),leatherHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(leatherHash(i+vec3(0,0,1)),leatherHash(i+vec3(1,0,1)),f.x),mix(leatherHash(i+vec3(0,1,1)),leatherHash(i+vec3(1,1,1)),f.x),f.y),f.z);}`;

/** Same compressed 1,479-triangle sofa; clean shared source upholstery instead of coarse quilt radiance. */
export default function Sofas() {
  const { scene } = useGLTF(assets.model, "/draco/", false, traceGLTF);
  const gl=useThree(state=>state.gl);
  const bakes=useLoader(KTX2Loader,assets.textures,loader=>configureBakedTextureLoader(loader,gl));
  const display=useBlenderViewLUT();
  const invalidate = useThree(state => state.invalidate);
  const seating = useMemo(() => traceSync("Construct sofa instances", () => {
    const meshes: Mesh[] = [];
    scene.updateWorldMatrix(true, true);
    scene.traverse(object => { if (object instanceof Mesh) meshes.push(object); });
    if (meshes.length !== 1) throw new Error("Seating requires one shared low-poly mesh");
    const source = meshes[0];
    const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld);
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!;
    const size = bounds.getSize(new Vector3());
    const maps=bakes.map((bake,i)=>{const map=bake.clone();map.colorSpace=i===0?SRGBColorSpace:NoColorSpace;map.anisotropy=Math.min(8,gl.capabilities.getMaxAnisotropy());return map;});
    const material=new MeshStandardMaterial({name:"Sofa | Charcoal leather with physical grain",map:maps[0],aoMap:maps[1],roughnessMap:maps[1],metalnessMap:maps[1],roughness:.95,metalness:1,color:"#80878c",envMap:localEnvironment(gl),envMapIntensity:.16,toneMapped:false});
    material.onBeforeCompile=shader=>{shader.uniforms.blenderView={value:display};
      shader.vertexShader=shader.vertexShader.replace("#include <common>","#include <common>\nvarying vec3 vLeatherPosition;").replace("#include <begin_vertex>","#include <begin_vertex>\nvLeatherPosition=position;");
      shader.fragmentShader=shader.fragmentShader.replace("#include <common>","#include <common>\n"+blenderDisplayGLSL+leatherNoise)
        .replace("#include <roughnessmap_fragment>","#include <roughnessmap_fragment>\nfloat leatherMask=1.-texture2D(metalnessMap,vMetalnessMapUv).b;roughnessFactor=mix(roughnessFactor,.61+.045*leatherNoise(vLeatherPosition*55.)+.015*leatherNoise(vLeatherPosition*280.),leatherMask);")
        .replace("#include <tonemapping_fragment>","gl_FragColor.rgb=blenderDisplayLinear(gl_FragColor.rgb);");};
    material.customProgramCacheKey=()=>"sofa-charcoal-leather-grain-v3";
    applyTheatreOpeningMaterial(material,false,false,true);
    const rows=[new InstancedMesh(geometry,material,assets.instances.length)];
    const scale = new Vector3(), position = new Vector3(), matrix = new Matrix4();
    assets.instances.forEach((copy,i) => {
      scale.fromArray(copy.maximum).sub(new Vector3().fromArray(copy.minimum)).divide(size);
      position.fromArray(copy.minimum).sub(new Vector3().copy(bounds.min).multiply(scale));
      matrix.makeScale(scale.x, scale.y, scale.z).setPosition(position);
      rows[0].setMatrixAt(i, matrix);
    });
    rows.forEach(instances=>{instances.name="Clean source upholstery | 12 sofas";instances.receiveShadow=true;instances.instanceMatrix.needsUpdate=true;instances.computeBoundingBox();instances.computeBoundingSphere();instances.matrixAutoUpdate=false;});
    return { rows, geometry, maps,material };
  }), [scene,bakes,display,gl]);
  /* eslint-disable react-hooks/immutability -- owned Three.js material */
  useFrame(()=>{seating.material.envMapIntensity=.16*stageLighting.room.value*theatreOpening.house.value;});
  /* eslint-enable react-hooks/immutability */
  useEffect(() => {
    invalidate();
    return () => { seating.rows.forEach(row=>row.dispose());seating.material.dispose();seating.maps.forEach(map=>map.dispose());seating.geometry.dispose(); };
  }, [seating, invalidate]);
  // Cached loader resources stay shared; the owned instances, materials and texture clones are disposed above.
  return <>{seating.rows.map(row=><primitive key={row.name} object={row} dispose={null}/>)}</>;
}
