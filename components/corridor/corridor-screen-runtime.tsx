"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { Quaternion, TextureLoader, Vector3, type Material, type Mesh } from "three";
import { createCorridorScreens, SCREEN_GLASS_TEXTURES, SCREEN_INK_TEXTURES } from "./corridor-screen-walls";
import { screenTransition } from "./corridor-screen-state";
import { localEnvironment } from "./local-environment";
import { effectQuality } from "./effect-quality";
import { journeyControls } from "./journey-controls";
import { cinemaShot } from "./cinema-controls";
import { createJourneySampler } from "./journey";
import route from "./scene-route.json";

export function preloadCorridorScreens() {
  useLoader.preload(TextureLoader, SCREEN_GLASS_TEXTURES);
}

/** Corridor display walls: panels power on as the camera passes them and close again on the way out. */
export default function CorridorScreenRuntime({ parts }: { parts: { mesh: Mesh; material: Material }[] }) {
  const gl = useThree((state) => state.gl),
    camera = useThree((state) => state.camera),
    scene = useThree((state) => state.scene),
    invalidate = useThree((state) => state.invalidate);
  // Phones keep the white lit walls but drop everything that moves: no panel-by-panel opening, no drawings.
  const still = effectQuality(gl) === "mobile";
  const [rough, normal] = useLoader(TextureLoader, SCREEN_GLASS_TEXTURES);
  const ink = useLoader(TextureLoader, still ? [] : SCREEN_INK_TEXTURES);
  const screens = useMemo(
    () =>
      createCorridorScreens(
        new Map(parts.map((part) => [part.mesh.name, part])),
        [rough, normal],
        localEnvironment(gl),
        effectQuality(gl),
        ink,
      ),
    [parts, rough, normal, ink, gl],
  );
  const reduce = useRef(false),
    reviewPhase = useRef<string | null>(null);
  useEffect(() => () => screens?.dispose(), [screens]);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)"),
      update = () => {
        reduce.current = query.matches;
      };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    // Local review only (?diagnostics=1): place the camera on the corridor centreline while the journey rests.
    if (
      !screens ||
      !/^(localhost|127\.)/.test(location.hostname) ||
      !new URLSearchParams(location.search).has("diagnostics")
    )
      return;
    const passage = createJourneySampler(route.samples, route.up),
      position = new Vector3(),
      rotation = new Quaternion();
    const hook = window as unknown as Record<string, unknown>;
    hook.__corridorScreens = {
      pose: (t: number, height = 3.37) => {
        passage.sample(t, position, rotation);
        camera.position.copy(position).setY(height);
        camera.quaternion.copy(rotation);
        invalidate();
      },
      panels: screens.panels,
      scene,
      camera,
      visible: () => Object.fromEntries(screens.objects.map((object) => [object.name, object.visible])),
      review: (phase: string | null) => {
        reviewPhase.current = phase;
        invalidate();
      },
      inkStretch: (value: number) => {
        screens.inkStretch(value);
        invalidate();
      },
    };
    return () => {
      delete hook.__corridorScreens;
    };
  }, [screens, camera, scene, invalidate]);
  useFrame((_, delta) => {
    if (!screens) return;
    const phase = reviewPhase.current ?? journeyControls.read().phase;
    if (still) {
      // Steady white glass; only the existing camera-driven leave/return blend into the logo applies.
      screens.panels.setAll(1);
      screens.apply(screenTransition(phase, cinemaShot.stage, cinemaShot.progress).off);
      return;
    }
    const [arc, distance] = screens.centreline.project(camera.position.x, camera.position.z);
    const seconds = document.hidden ? 0 : delta;
    const panelsMoving = screens.panels.advance(
      phase,
      arc - screens.start,
      distance < 9 && camera.position.y < 9,
      seconds,
      reduce.current,
    );
    screens.apply(screenTransition(phase, cinemaShot.stage, cinemaShot.progress).off);
    if (panelsMoving) invalidate();
  }, -0.5);
  return screens ? (
    <>
      {screens.objects.map((object) => (
        <primitive key={object.name} object={object} dispose={null} />
      ))}
    </>
  ) : null;
}
