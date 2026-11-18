"use client";
/* eslint-disable react-hooks/immutability -- This R3F owner sets up loaded Three.js textures, materials and instance positions. */
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useLoader, useThree } from "@react-three/fiber";
import {
  BufferAttribute,
  BufferGeometry,
  type InstancedMesh,
  Matrix4,
  type Mesh,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { contentTexture, filmFonts } from "./film-content";
import { FILM_MODEL, FILM_PRODUCTS, FRAME_PITCH } from "./film-data";
import { filmLooks } from "./film-material";
import { wearTexture } from "./film-wear";

const COUNT = FILM_PRODUCTS.length;
const LEADER = 3; // blank frames of black leader before the first frame and after the last, so the strip never ends on screen
const PICTURES = FILM_PRODUCTS.map((product) => product.picture);
const PARTS = ["Frame", "Image", "Content"] as const;
type Part = (typeof PARTS)[number];
export type FilmLooks = ReturnType<typeof filmLooks>;

// One triangle that covers the whole screen, for the dark behind the strip. Drawn last (renderOrder 1) and depth tested.
const screenTriangle = () => {
  const shape = new BufferGeometry();
  shape.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  return shape;
};

/** Fetch and parse the strip ahead of time (a resting stop in the 3D journey), so Section 1 opens without waiting on the network. */
export function preloadFilmStrip() {
  useLoader.preload(GLTFLoader, FILM_MODEL);
  useLoader.preload(TextureLoader, PICTURES);
}

/**
 * Six joined frames, with black leader at both ends. Frame 1 sits at x = 0 and the rest follow to the right, one FRAME_PITCH apart.
 * The strip draws nothing by itself: whoever holds it moves it and sets its lamp through `onLooks`.
 */
export function FilmStrip({
  onLooks,
  onReady,
}: {
  onLooks: (looks: FilmLooks) => void;
  onReady?: () => void;
}) {
  const gltf = useLoader(GLTFLoader, FILM_MODEL);
  const pictures = useLoader(TextureLoader, PICTURES);
  const gl = useThree((state) => state.gl),
    invalidate = useThree((state) => state.invalidate);
  const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());

  const shapes = useMemo(
    () =>
      Object.fromEntries(
        PARTS.map((part) => {
          const mesh = gltf.scene.getObjectByName(part) as Mesh | undefined;
          if (!mesh?.geometry) throw new Error(`film-frame.glb has no ${part}`);
          return [part, mesh.geometry];
        }),
      ) as Record<Part, BufferGeometry>,
    [gltf],
  );
  const triangle = useMemo(() => screenTriangle(), []);
  useEffect(() => () => triangle.dispose(), [triangle]);

  const looks = useMemo(() => filmLooks(pictures), [pictures]);
  useEffect(() => () => looks.dispose(), [looks]);
  useLayoutEffect(() => {
    onLooks(looks);
  }, [looks, onLooks]);

  useLayoutEffect(() => {
    for (const map of pictures) {
      map.colorSpace = SRGBColorSpace;
      map.flipY = false;
      map.anisotropy = anisotropy;
      map.needsUpdate = true;
    }
  }, [pictures, anisotropy]);

  // The handling marks. A phone gets the half-size drawing.
  useEffect(() => {
    const small = Math.min(window.screen.width, window.screen.height) < 600;
    const wear = wearTexture(small, anisotropy);
    looks.wear.value = wear;
    invalidate();
    return () => {
      looks.wear.value = looks.blank;
      wear.dispose();
    };
  }, [looks, anisotropy, invalidate]);

  // The text under each picture, written with the site's fonts. The strip is ready once it is drawn.
  useEffect(() => {
    let live = true,
      frame = 0;
    const made: Texture[] = [];
    void filmFonts().then((fonts) => {
      if (!live) return;
      const make = (index: number) => {
        const map = contentTexture(FILM_PRODUCTS[index], index, COUNT, fonts, anisotropy);
        made.push(map);
        looks.contents[index].uniforms.uMap.value = map;
      };
      const finish = () => {
        invalidate();
        onReady?.();
      };
      let index = 0;
      const step = () => {
        if (!live) return;
        make(index++);
        if (index === COUNT) finish();
        else frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    });
    return () => {
      live = false;
      cancelAnimationFrame(frame);
      for (const look of looks.contents) look.uniforms.uMap.value = looks.blank;
      for (const map of made) map.dispose();
    };
  }, [looks, anisotropy, invalidate, onReady]);

  const frames = useRef<InstancedMesh>(null);
  const leaderImage = useRef<InstancedMesh>(null),
    leaderContent = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const place = new Matrix4();
    const lay = (owner: InstancedMesh | null, slots: number[]) => {
      if (!owner) return;
      slots.forEach((slot, index) =>
        owner.setMatrixAt(index, place.makeTranslation(slot * FRAME_PITCH, 0, 0)),
      );
      owner.instanceMatrix.needsUpdate = true;
      owner.computeBoundingBox();
      owner.computeBoundingSphere();
    };
    const all = Array.from({ length: COUNT + LEADER * 2 }, (_, index) => index - LEADER);
    const leader = all.filter((slot) => slot < 0 || slot >= COUNT);
    lay(frames.current, all);
    for (const owner of [leaderImage.current, leaderContent.current]) lay(owner, leader);
    invalidate();
  }, [shapes, invalidate]);

  return (
    <group>
      <mesh geometry={triangle} material={looks.void} renderOrder={1} frustumCulled={false} />
      <instancedMesh
        ref={frames}
        args={[shapes.Frame, looks.base, COUNT + LEADER * 2]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={leaderImage}
        args={[shapes.Image, looks.leader, LEADER * 2]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={leaderContent}
        args={[shapes.Content, looks.leader, LEADER * 2]}
        frustumCulled={false}
      />
      {FILM_PRODUCTS.map((product, index) => (
        <group key={product.picture} position={[index * FRAME_PITCH, 0, 0]}>
          <mesh geometry={shapes.Image} material={looks.pictures[index]} frustumCulled={false} />
          <mesh geometry={shapes.Content} material={looks.contents[index]} frustumCulled={false} />
        </group>
      ))}
    </group>
  );
}
