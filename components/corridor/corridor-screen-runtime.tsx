"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { Frustum, Matrix4, Quaternion, Sphere, TextureLoader, Vector3, type Material, type Mesh } from "three";
import { createCorridorScreens, SCREEN_GLASS_TEXTURES } from "./corridor-screen-walls";
import { CORRIDOR_STOP, displayOpen, screenTransition } from "./corridor-screen-state";
import { corridorDisplayContent, createDisplayContent, type DisplayContent } from "./corridor-display-content";
import { theatreOpening } from "./theatre-opening-state";
import { cinemaGlasses } from "./cinema-glasses-state";
import projector from "./projector-assets.json";
import { localEnvironment } from "./local-environment";
import { effectQuality } from "./effect-quality";
import { journeyControls } from "./journey-controls";
import { scheduleSceneIdle } from "./scene-idle";
import { cinemaShot } from "./cinema-controls";
import { createJourneySampler } from "./journey";
import route from "./scene-route.json";

/** The scene rests behind the HTML page; its films need not play there. */
const FILM_PAUSED = new Set(["page", "pageReturnLoading"]);

export function preloadCorridorScreens(){useLoader.preload(TextureLoader,SCREEN_GLASS_TEXTURES);}

/** Corridor display walls: panels power on as the camera passes them and close again on the way out. */
export default function CorridorScreenRuntime({ parts }: { parts: { mesh: Mesh; material: Material }[] }) {
  const gl = useThree(state => state.gl), camera = useThree(state => state.camera), scene = useThree(state => state.scene), invalidate = useThree(state => state.invalidate);
  const [rough, normal] = useLoader(TextureLoader, SCREEN_GLASS_TEXTURES);
  const screens = useMemo(() => createCorridorScreens(new Map(parts.map(part => [part.mesh.name, part])), [rough, normal], localEnvironment(gl), effectQuality(gl)), [parts, rough, normal, gl]);
  const reduce = useRef(false), reviewPhase = useRef<string | null>(null), frustum = useMemo(() => new Frustum(), []), viewProjection = useMemo(() => new Matrix4(), []), bounds = useMemo(() => new Sphere(), []);
  const films = useRef<DisplayContent | null>(null);
  // Phones keep the white lit walls but drop everything that moves: no panel-by-panel opening, no feature displays, no films.
  const still = effectQuality(gl) === "mobile";
  useEffect(() => () => screens?.dispose(), [screens]);
  useEffect(() => {
    if (!screens || still) return;
    // Both screens are rendered for the camera's resting eye at the mid-corridor stop. Strict Mode
    // replays setup/cleanup, so each setup owns a fresh instance.
    const [x, z] = screens.centreline.point(CORRIDOR_STOP.arc);
    const content = createDisplayContent(screens.displays.frames, new Vector3(x, projector.centre_blender[2] + .1, z));
    screens.displays.frames.forEach((_, k) => screens.displays.setContent(k, content.texture(k), content.flip[k]));
    films.current = corridorDisplayContent.current = content; invalidate();
    // Warm the films at the projector stop, so their first opening never compiles mid-move.
    const cancelPrepare = scheduleSceneIdle(() => content.prepare(gl), effectQuality(gl)==="desktop"?20:10);
    return () => {
      cancelPrepare();
      if (corridorDisplayContent.current === content) corridorDisplayContent.current = null;
      if (films.current === content) films.current = null;
      screens.displays.frames.forEach((_, k) => screens.displays.setContent(k, null, false)); content.dispose();
    };
  }, [screens, invalidate, gl, still]);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)"), update = () => { reduce.current = query.matches; };
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    // Local review only (?diagnostics=1): place the camera on the corridor centreline while the journey rests.
    if (!screens || !/^(localhost|127\.)/.test(location.hostname) || !new URLSearchParams(location.search).has("diagnostics")) return;
    const passage = createJourneySampler(route.samples, route.up), position = new Vector3(), rotation = new Quaternion();
    const hook = window as unknown as Record<string, unknown>;
    hook.__corridorScreens = {
      pose: (t: number, height = 3.37) => { passage.sample(t, position, rotation); camera.position.copy(position).setY(height); camera.quaternion.copy(rotation); invalidate(); },
      panels: screens.panels, scene, camera, power: screens.power, films: () => corridorDisplayContent.current,
      visible: () => Object.fromEntries(screens.objects.map(object => [object.name, object.visible])),
      review: (phase: string | null) => { reviewPhase.current = phase; invalidate(); },
    };
    return () => { delete hook.__corridorScreens; };
  }, [screens, camera, scene, invalidate]);
  useFrame((_, delta) => {
    if (!screens) return;
    const journey = journeyControls.read(), phase = reviewPhase.current ?? journey.phase;
    if (still) {
      // Steady white glass; only the existing camera-driven leave/return blend into the logo applies.
      screens.panels.setAll(1);
      const { off, baked } = screenTransition(phase, cinemaShot.stage, cinemaShot.progress);
      screens.apply(off, baked);
      screens.displays.meshes.forEach(mesh => { mesh.visible = false; });
      return;
    }
    const [arc, distance] = screens.centreline.project(camera.position.x, camera.position.z);
    const seconds = document.hidden ? 0 : delta;
    const panelsMoving = screens.panels.advance(phase, arc - screens.start, distance < 9 && camera.position.y < 9, seconds, reduce.current);
    // The near display powers on as the camera settles at the mid-corridor stop.
    const displaysMoving = screens.power.advance(phase, arc, phase !== "screens" && phase !== "done", seconds, reduce.current);
    const { off, baked } = screenTransition(phase, cinemaShot.stage, cinemaShot.progress);
    screens.apply(off, baked);
    // Films play only while a display is lit and on screen (or seen in depth through the glasses).
    let playing = false;
    const content = films.current;
    if (content) {
      viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(viewProjection);
      const watched = !journey.pageReturning && !FILM_PAUSED.has(phase) && baked < 1;
      const open = screens.power.values.map((power, k) => { const frame = screens.displays.frames[k]; bounds.set(frame.centre, frame.width * .6); return watched && (frustum.intersectsSphere(bounds) || theatreOpening.glasses.value > .01) ? displayOpen(power * (1 - off)) : 0; });
      // The films come alive once the glasses are fully on at the stop.
      playing = content.update(open, seconds, reduce.current, phase === "screensDone" && cinemaGlasses.position < .02);
      open.forEach((value, k) => { if (value > 0) content.renderDisplay(gl, k); });
    }
    if (panelsMoving || displaysMoving || playing) invalidate();
  }, -.5);
  return screens ? <>{screens.objects.map(object => <primitive key={object.name} object={object} dispose={null} />)}</> : null;
}
