"use client";
/* eslint-disable react-hooks/immutability -- These are mount-owned Three.js objects; frame callbacks mutate their render state. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { BufferGeometry, Color, DoubleSide, EdgesGeometry, Float32BufferAttribute, Group, LineSegments, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, RectAreaLight, ShaderMaterial, SRGBColorSpace, TextureLoader, Vector3 } from 'three';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { THEATRE_MODELS } from './opening-assets';
import manifest from './baked-surfaces.json';
import sofaAssets from './sofa-assets.json';
import { extractSurface, type SurfaceId } from './baked-surface-geometry';
import { applyTheatreScreenArtwork, THEATRE_SCREEN_ARTWORK } from './theatre-screen-artwork';
import { stageBakedMaterial } from './stage-lighting';
import { theatreOpening } from './theatre-opening-state';
import type { MetricsStore } from './metrics';
import { traceGLTF, traceMark } from './loading-trace';
import { scheduleSceneIdle } from './scene-idle';
import { journeyControls } from './journey-controls';
import {applyTheatreOpeningMaterial} from './theatre-opening-material';

/** Independent critical path: the image can paint before the room's atlas/LUT dependencies. */
export function TheatreOpeningScreen({metrics}:{metrics:MetricsStore}) {
  const [theatre] = useGLTF(THEATRE_MODELS, '/draco/', false, traceGLTF);
  const [source] = useLoader(TextureLoader,[THEATRE_SCREEN_ARTWORK]);
  const gl=useThree(s=>s.gl),invalidate=useThree(s=>s.invalidate);
  const screen=useMemo(()=>{
    let geometry:BufferGeometry|undefined;
    const spec=manifest.items.find(item=>item.item==='screen')!;
    theatre.scene.traverse(o=>{if(o instanceof Mesh)geometry=extractSurface(o.geometry,spec.ids as SurfaceId[]);});
    if(!geometry)throw new Error('Theatre opening: screen geometry missing');
    const texture=source.clone();texture.colorSpace=SRGBColorSpace;texture.anisotropy=Math.min(16,gl.capabilities.getMaxAnisotropy());
    const material=new MeshBasicMaterial({color:'#050505',side:DoubleSide,toneMapped:false});
    material.name='Theatre | Luminous image screen';
    stageBakedMaterial(material);
    applyTheatreOpeningMaterial(material,true);
    applyTheatreScreenArtwork(material,geometry,texture);
    const mesh=new Mesh(geometry,material);mesh.name='Theatre screen | Full aspect artwork';
    const haloGeometry=new PlaneGeometry(16,8);
    const haloMaterial=new ShaderMaterial({transparent:true,depthWrite:false,side:DoubleSide,toneMapped:false,
      uniforms:{uActive:theatreOpening.active,uRoom:theatreOpening.room,uHouse:theatreOpening.house},
      vertexShader:`varying vec2 vLocal;void main(){vLocal=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform float uActive,uRoom,uHouse;varying vec2 vLocal;void main(){
        float edge=max(abs(vLocal.x)-5.65,abs(vLocal.y)-2.1);
        float glow=exp(-max(edge,0.)*2.7)*smoothstep(-.06,.07,edge)*.16*max(uActive,1.-uHouse)*(1.-uRoom*.5);
        if(glow<.0005)discard;gl_FragColor=vec4(.78,.86,1.,glow);
        #include <colorspace_fragment>
      }`});
    const halo=new Mesh(haloGeometry,haloMaterial);halo.name='Screen | Restrained edge diffusion';halo.position.set(.010995,3.24,24.72);
    RectAreaLightUniformsLib.init();
    const bounce=new RectAreaLight('#edf3ff',6.5,11.4,4.1);bounce.position.set(.010995,3.24,25.05);
    bounce.name='Cinema screen | Broad soft seating illumination';
    return {mesh,geometry,material,texture,halo,haloGeometry,haloMaterial,bounce};
  },[theatre,source,gl]);
  useEffect(()=>{
    traceMark('Screen-only opening painted');metrics.update({loaded:true,modelReady:metrics.read().modelReady||performance.now()});invalidate();
    return()=>{screen.geometry.dispose();screen.material.dispose();screen.texture.dispose();screen.haloGeometry.dispose();screen.haloMaterial.dispose();};
  },[screen,metrics,invalidate]);
  useFrame(()=>{screen.halo.visible=theatreOpening.active.value>.5||theatreOpening.house.value<1;screen.bounce.intensity=6.5*(1-theatreOpening.house.value);},-.76);
  return <><primitive object={screen.mesh} dispose={null}/><primitive object={screen.halo} dispose={null}/><primitive object={screen.bounce}/></>;
}

function createBlueprint(theatre:Group,seating:Group) {
  const root=new Group();root.name='Theatre | Actual geometry blueprint';
  const positions:number[]=[];
  const depthMaterial=new MeshBasicMaterial({colorWrite:false,side:DoubleSide});
  const depths:Mesh[]=[], owned:BufferGeometry[]=[];
  const add=(geometry:BufferGeometry,matrix:Matrix4)=>{
    const copy=geometry.clone().applyMatrix4(matrix);owned.push(copy);
    const depth=new Mesh(copy,depthMaterial);depth.renderOrder=-10;depths.push(depth);root.add(depth);
    const edges=new EdgesGeometry(copy,28);const p=edges.getAttribute('position');
    for(let i=0;i<p.count;i++)positions.push(p.getX(i),p.getY(i),p.getZ(i));
    edges.dispose();
  };
  theatre.updateWorldMatrix(true,true);
  theatre.traverse(o=>{if(o instanceof Mesh)add(o.geometry,o.matrixWorld);});
  seating.updateWorldMatrix(true,true);
  seating.traverse(o=>{
    if(!(o instanceof Mesh))return;
    const g=o.geometry.clone().applyMatrix4(o.matrixWorld);g.computeBoundingBox();
    const bounds=g.boundingBox!,size=bounds.getSize(new Vector3());
    const matrix=new Matrix4(),scale=new Vector3(),position=new Vector3();
    for(const instance of sofaAssets.instances){
      scale.fromArray(instance.maximum).sub(new Vector3().fromArray(instance.minimum)).divide(size);
      position.fromArray(instance.minimum).sub(new Vector3().copy(bounds.min).multiply(scale));
      add(g,matrix.makeScale(scale.x,scale.y,scale.z).setPosition(position));
    }
    g.dispose();
  });
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.computeBoundingSphere();
  const material=new ShaderMaterial({toneMapped:false,transparent:true,depthWrite:false,
    uniforms:{uTrace:theatreOpening.trace,uWhite:theatreOpening.white,uOpacity:theatreOpening.lineOpacity,uBlue:{value:new Color('#268bff')}},
    vertexShader:`varying vec3 vWorld;void main(){vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader:`uniform float uTrace,uWhite,uOpacity;uniform vec3 uBlue;varying vec3 vWorld;
      void main(){float order=clamp((25.6-vWorld.z)/29.,0.,1.)*.84+clamp(vWorld.y/8.,0.,1.)*.16;
      float formed=smoothstep(order-.025,order+.025,uTrace*1.06-.03);if(formed*uOpacity<.002)discard;
      vec3 colour=mix(uBlue,vec3(.93,.96,1.),uWhite);gl_FragColor=vec4(colour,formed*uOpacity*.9);
      #include <colorspace_fragment>
      }`});
  const lines=new LineSegments(geometry,material);lines.renderOrder=1;root.add(lines);
  root.visible=false;
  return {root,depths,dispose:()=>{geometry.dispose();material.dispose();depthMaterial.dispose();owned.forEach(g=>g.dispose());}};
}

/** Build real mesh edges once, during the stationary screen shot. */
export function TheatreBlueprint() {
  const [theatre]=useGLTF(THEATRE_MODELS,'/draco/',false,traceGLTF);
  const seating=useGLTF(sofaAssets.model,'/draco/',false,traceGLTF);
  const invalidate=useThree(s=>s.invalidate);
  const [rig,setRig]=useState<ReturnType<typeof createBlueprint>|null>(null);
  useEffect(()=>{
    let owned:ReturnType<typeof createBlueprint>|undefined;
    const cancel=scheduleSceneIdle(()=>{
      owned=createBlueprint(theatre.scene,seating.scene);theatreOpening.geometryReady=true;
      traceMark('Theatre outline geometry prepared');setRig(owned);invalidate();
    },-105);
    return()=>{cancel();owned?.dispose();theatreOpening.geometryReady=false;};
  },[theatre,seating,invalidate]);
  useFrame(()=>{if(rig){rig.root.visible=theatreOpening.active.value>.5&&theatreOpening.trace.value>0&&theatreOpening.lineOpacity.value>.001;rig.depths.forEach(mesh=>{mesh.visible=theatreOpening.room.value===0;});}},-.75);
  return rig?<primitive object={rig.root} dispose={null}/>:null;
}

/** A finite intro owner. Later shots get exactly their original background and material response. */
export function TheatreOpeningOwner() {
  const scene=useThree(s=>s.scene),invalidate=useThree(s=>s.invalidate);
  const original=useRef(scene.background??new Color('#11151a'));
  const dark=useMemo(()=>new Color('#000000'),[]);
  useLayoutEffect(()=>{const background=original.current;theatreOpening.active.value=journeyControls.read().phase==='intro'?1:0;theatreOpening.room.value=theatreOpening.active.value?0:1;theatreOpening.house.value=theatreOpening.active.value?0:1;theatreOpening.glasses.value=theatreOpening.active.value?1:0;if(theatreOpening.active.value)scene.background=dark;invalidate();return()=>{theatreOpening.active.value=0;theatreOpening.room.value=1;theatreOpening.house.value=1;theatreOpening.glasses.value=0;scene.background=background;};},[scene,invalidate,dark]);
  useFrame(()=>{
    const intro=journeyControls.read().phase==='intro';
    if(intro||theatreOpening.house.value<1)scene.background=dark;
    else if(scene.background===dark)scene.background=original.current;
  },-.9);
  return null;
}
