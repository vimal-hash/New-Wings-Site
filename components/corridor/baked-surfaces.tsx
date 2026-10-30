"use client";

import { useEffect, useMemo } from "react";
import { useLoader, useThree } from "@react-three/fiber";
import { BufferGeometry, FileLoader, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Side, SRGBColorSpace, TextureLoader, type WebGLRenderer } from "three";
import { traceSync } from "./loading-trace";
import { configureBakedTextureLoader } from "./baked-texture-loader";
import TextureRefinement from "./texture-refinement";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import manifest from "./baked-surfaces.json";
import { applySurfaceUV, concatenateMeshes, extractSurface, type SurfaceId } from "./baked-surface-geometry";
import { stageBakedMaterial,stageProjectorFloor } from "./stage-lighting";
import {applyCorridorRim} from "./logo-material";
import {journeyControls} from "./journey-controls";
import {applyTheatreScreenArtwork, THEATRE_SCREEN_ARTWORK} from "./theatre-screen-artwork";
import {applyTheatreOpeningMaterial} from './theatre-opening-material';

type Source = keyof typeof manifest.sources;
const active = (source: Source) => manifest.items.filter(item => item.active && item.source === source);

/** Fetch each room's atlases and UV sidecars together, before its GLB resolves. */
export function preloadBakedSurfaces(source: Source, gl: WebGLRenderer) {
  const items = active(source);
  useLoader.preload(FileLoader, items.map(item => item.uv), loader => loader.setResponseType("arraybuffer"));
  useLoader.preload(KTX2Loader, items.map(item => item.texture), loader => configureBakedTextureLoader(loader, gl));
  if (source === "theatre") useLoader.preload(TextureLoader, [THEATRE_SCREEN_ARTWORK]);
}

/** Colour IDs of every active baked theatre item, for removal from the diagnostic mesh. */
export const bakedTheatreIds = active("theatre").flatMap(item => item.ids as SurfaceId[]);

/** Runtime copies of each active item's triangles; the diagnostic source stays intact. */
export function extractTheatreSurfaces(source: BufferGeometry) {
  return active("theatre").map(item => ({ item: item.item, geometry: extractSurface(source, item.ids as SurfaceId[]) }));
}

/** World-space copies of each active item's runtime nodes (matched by material name) for GLBs with separate
 *  nodes; the originals are hidden in the route's own clone, never removed or edited. */
export function extractNodeSurfaces(scene: Object3D, source: Source) {
  const byMaterial = new Map<string, Mesh>();
  scene.updateMatrixWorld(true);
  scene.traverse(object => { if (object instanceof Mesh && !Array.isArray(object.material)) byMaterial.set(object.material.name, object); });
  let side: Material["side"] | undefined;
  const surfaces = active(source).map(item => {
    const ids = item.ids as { material: string; expectedTriangles: number }[];
    const meshes = ids.map(id => { const mesh = byMaterial.get(id.material); if (!mesh) throw new Error("Baked surface: runtime node missing"); return mesh; });
    const geometry = concatenateMeshes(meshes, ids.map(id => id.expectedTriangles));
    side ??= (meshes[0].material as Material).side;
    meshes.forEach(mesh => { mesh.visible = false; });
    return { item: item.item, geometry };
  });
  return { surfaces, side };
}

/** One fixed Blender surface bake per item. No camera projection, lighting switch or blend. */
export default function BakedSurfaces({ source, surfaces, side }: { source: Source; surfaces: { item: string; geometry: BufferGeometry }[]; side: Side }) {
  const gl = useThree(state => state.gl);
  const items = useMemo(()=>surfaces.map(surface => manifest.items.find(item => item.item === surface.item)!),[surfaces]);
  const atlases = useLoader(KTX2Loader, items.map(item => item.texture), loader => configureBakedTextureLoader(loader, gl));
  const charts = useLoader(FileLoader, items.map(item => item.uv), loader => loader.setResponseType("arraybuffer")) as ArrayBuffer[];
  const artworkTextures = useLoader(TextureLoader, source === "theatre" ? [THEATRE_SCREEN_ARTWORK] : []);
  const instance = useMemo(() => traceSync(`Construct baked materials/UVs: ${source}`, () => {
    const anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy());
    const parts = surfaces.map((surface, i) => {
      applySurfaceUV(surface.geometry, charts[i], manifest.sources[source].runtimeToBlender);
      const map = atlases[i].clone(); map.colorSpace = SRGBColorSpace; map.anisotropy = anisotropy;
      const liveFloor=source==="projector-floor";
      const material = liveFloor
        ?new MeshStandardMaterial({map,emissiveMap:map,emissive:"white",roughness:.72,metalness:0,side,toneMapped:false})
        :new MeshBasicMaterial({ map, side, toneMapped: false });
      material.name = `${surface.item} | Baked Blender appearance`; material.dithering = surface.item!=="corridor-wall-red";
      const mesh = new Mesh(surface.geometry, material); mesh.name = surface.item;
      if(source==="corridor"&&["corridor-wall-red","corridor-wall-connecting","corridor-wall-caps"].includes(surface.item))applyCorridorRim(mesh,()=>journeyControls.read().phase);
      if(liveFloor){stageProjectorFloor(material);mesh.receiveShadow=true;}
      else if(source!=="corridor")stageBakedMaterial(material,surface.item==="floor-slab",/lights|sconces/.test(surface.item));
      if(source==='theatre')applyTheatreOpeningMaterial(material,surface.item==='screen',/lights|sconces/.test(surface.item));
      const artwork = surface.item === "screen" ? artworkTextures[0].clone() : undefined;
      if (artwork && material instanceof MeshBasicMaterial) {
        artwork.colorSpace = SRGBColorSpace; artwork.anisotropy = anisotropy;
        applyTheatreScreenArtwork(material, surface.geometry, artwork);
      }
      return { mesh, map, material, artwork, url:items[i].texture };
    });
    return parts;
  }), [surfaces, items, atlases, charts, artworkTextures, gl, source, side]);
  useEffect(() => () => instance.forEach(part => { part.material.dispose(); part.map.dispose(); part.artwork?.dispose(); }), [instance]);
  const refinement=useMemo(()=>instance.map(part=>({url:part.url,base:part.map,materials:[part.material]})),[instance]);
  return <>{instance.map(part => <primitive key={part.mesh.name} object={part.mesh} dispose={null} />)}<TextureRefinement targets={refinement}/></>;
}
