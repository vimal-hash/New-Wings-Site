"use client";

import { useEffect, useLayoutEffect, useMemo } from "react";
import { compileHiddenGPU } from "./hidden-gpu-preparation";
import { useLoader, useThree } from "@react-three/fiber";
import { BufferGeometry, type CompressedTexture, FileLoader, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Side, SRGBColorSpace, TextureLoader, type WebGLRenderer } from "three";
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
import CorridorScreenRuntime,{preloadCorridorScreens} from './corridor-screen-runtime';
import {effectQuality} from './effect-quality';

type Source = keyof typeof manifest.sources;
const active = (source: Source) => manifest.items.filter(item => item.active && item.source === source);
type Item = (typeof manifest.items)[number];
/** Bake texture and UV chart of an item; null for plain meshes (the corridor walls are drawn as display glass). */
const bakeOf = (item: Item): { texture: string; uv: string } | null => {
  const { texture, uv } = item as { texture?: string; uv?: string };
  return texture && uv ? { texture, uv } : null;
};

/** Fetch each room's atlases and UV sidecars together, before its GLB resolves. */
export function preloadBakedSurfaces(source: Source, gl: WebGLRenderer, connectedTheatre = false) {
  const items = active(source).filter(item =>
    item.item !== "corridor-pathway-lights" && !(connectedTheatre && item.item === "screen"),
  ).flatMap(item => bakeOf(item) ?? []);
  useLoader.preload(FileLoader, items.map(item => item.uv), loader => loader.setResponseType("arraybuffer"));
  useLoader.preload(KTX2Loader, items.map(item => item.texture), loader => configureBakedTextureLoader(loader, gl));
  if (source === "theatre") useLoader.preload(TextureLoader, [THEATRE_SCREEN_ARTWORK]);
  if (source === "corridor") preloadCorridorScreens();
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
  const bakes = useMemo(()=>items.flatMap(item => bakeOf(item) ?? []),[items]);
  const atlases = useLoader(KTX2Loader, bakes.map(bake => bake.texture), loader => configureBakedTextureLoader(loader, gl)) as CompressedTexture[];
  const charts = useLoader(FileLoader, bakes.map(bake => bake.uv), loader => loader.setResponseType("arraybuffer")) as ArrayBuffer[];
  const artworkTextures = useLoader(TextureLoader, source === "theatre" ? [THEATRE_SCREEN_ARTWORK] : []);
  const instance = useMemo(() => traceSync(`Construct baked materials/UVs: ${source}`, () => {
    const anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy());
    let baked = 0;
    const parts = surfaces.map((surface, i) => {
      const bake = bakeOf(items[i]);
      if (!bake) {
        // Plain mesh (corridor walls): the display-glass walls reuse its geometry and draw it.
        const material = new MeshBasicMaterial({ color: "#1b1d20", side, toneMapped: false });
        material.name = `${surface.item} | Plain (display-glass wall)`;
        const mesh = new Mesh(surface.geometry, material); mesh.name = surface.item;
        return { mesh, map: null, material, artwork: undefined, url: null };
      }
      const k = baked++;
      applySurfaceUV(surface.geometry, charts[k], manifest.sources[source].runtimeToBlender);
      const map = atlases[k].clone(); map.colorSpace = SRGBColorSpace; map.anisotropy = anisotropy;
      const liveFloor=source==="projector-floor";
      const material = liveFloor
        ?new MeshStandardMaterial({map,emissiveMap:map,emissive:"white",roughness:.72,metalness:0,side,toneMapped:false})
        :new MeshBasicMaterial({ map, side, toneMapped: false });
      material.name = `${surface.item} | Baked Blender appearance`; material.dithering = true;
      const mesh = new Mesh(surface.geometry, material); mesh.name = surface.item;
      if(source==="corridor"&&surface.item==="corridor-wall-caps")applyCorridorRim(mesh,()=>journeyControls.read().phase);
      if(liveFloor){stageProjectorFloor(material,effectQuality(gl)==="mobile");mesh.receiveShadow=true;}
      else if(source!=="corridor")stageBakedMaterial(material,surface.item==="floor-slab",/lights|sconces/.test(surface.item));
      if(source==='theatre')applyTheatreOpeningMaterial(material,surface.item==='screen',/lights|sconces/.test(surface.item));
      const artwork = surface.item === "screen" ? artworkTextures[0].clone() : undefined;
      if (artwork && material instanceof MeshBasicMaterial) {
        artwork.colorSpace = SRGBColorSpace; artwork.anisotropy = anisotropy;
        applyTheatreScreenArtwork(material, surface.geometry, artwork);
      }
      return { mesh, map, material, artwork, url:bake.texture };
    });
    return parts;
  }), [surfaces, items, atlases, charts, artworkTextures, gl, source, side]);
  useEffect(() => () => instance.forEach(part => { part.material.dispose(); part.map?.dispose(); part.artwork?.dispose(); }), [instance]);
  // The projector floor mounts while the theatre is live (behind the camera). Show it only once its
  // shaders are compiled off-thread; a first draw would otherwise compile them synchronously (a hitch).
  const scene = useThree(state => state.scene), camera = useThree(state => state.camera), invalidate = useThree(state => state.invalidate);
  useLayoutEffect(() => {
    if (source !== "projector-floor") return;
    let alive = true;
    instance.forEach(part => { part.mesh.visible = false; });
    void Promise.all(instance.map(part => compileHiddenGPU(gl, scene, camera, part.mesh))).catch(error => console.error("Projector floor compile failed", error))
      .finally(() => { if (!alive) return; instance.forEach(part => { part.mesh.visible = true; }); invalidate(); });
    return () => { alive = false; };
  }, [instance, source, gl, scene, camera, invalidate]);
  const refinement=useMemo(()=>instance.flatMap(part=>part.url&&part.map?[{url:part.url,base:part.map,materials:[part.material]}]:[]),[instance]);
  return <>{instance.map(part => <primitive key={part.mesh.name} object={part.mesh} dispose={null} />)}<TextureRefinement targets={refinement}/>{source === "corridor" && <CorridorScreenRuntime parts={instance}/>}</>;
}
