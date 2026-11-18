"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, Matrix4, PerspectiveCamera, Quaternion, Vector2, Vector3 } from "three";
import reference from "./reference-camera.json";
import route from "./scene-route.json";
import projector from "./projector-assets.json";
import { createJourneySampler } from "./journey";
import { projectorControls } from "./projector-controls";
import { journeyControls, type JourneyPhase } from "./journey-controls";
import type { MetricsStore } from "./metrics";
import { createLogoReveal, LOGO_FOV } from "./logo-reveal";
import { createPageDescent, pageReturn } from "./page-exit";
import { createExitStages, type ExitStage } from "./exit-stages";
import { listenSteps, type Step } from "./scroll-step";
import logoBounds from "./logo-reveal.json";
import layout from "./blender-layout.json";
import { traceMark } from "./loading-trace";
import {
  createTheatreOpeningClock,
  OPENING_CAMERA_START,
  OPENING_CAMERA_END,
  theatreOpening,
  theatreOpeningShot,
  openingReviewTime,
  houseLightLevel,
} from "./theatre-opening-state";
import {
  leadStageLighting,
  restoreStageLighting,
  theatrePullbackDim,
  updateStageLighting,
} from "./stage-lighting";
import { pupilFillProgress, pupilFillState } from "./pupil-fill";
import { cinemaShot } from "./cinema-controls";
import { diagonalTransition, diagonalEyeZoom } from "./diagonal-transition";
import { lensControls } from "./lens-controls";
import { createViewOneLens } from "./view-one-lens";
import { viewOneLensWeight } from "./lens-motion";
import { cinemaGlasses } from "./cinema-glasses-state";
import { CORRIDOR_STOP } from "./corridor-screen-state";
import { sceneIdleUrgent, sceneMotion } from "./scene-idle";
import { effectQuality } from "./effect-quality";
import { LOGO_KEY, logoKey, logoKeyAmount } from "./logo-material";
import { createEndBox } from "./end-box";

/** One fresh scroll in the lit theatre: the glasses lift, the screen powers down once
 *  they are nearly clear, then the camera leaves for the projector. */
const GLASSES_EXIT = { liftedAt: 0.8, screenOff: 0.58, hold: 0.1 } as const;

const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
/** Rest outside the theatre before turning to the particles (was .5 s). */
const HOLD_SECONDS = 0.25;
/** Menu destinations: 1-4 are the page sections. */
export type JumpTarget = "theatre" | "projector" | "final" | 1 | 2 | 3 | 4;
/** Scrolling back: each leg in reverse, eased at both ends. */
const BACK_SECONDS = { return: 2.1, approach: 1.7, pullback: 2.6 } as const;
/** Same duration, but the move gets going a little sooner and spends longer gliding into its stop. */
const settle = (t: number) => smooth(Math.pow(t, 0.8));
const screensIndex = route.samples.findIndex(
  (sample) => sample.position[2] <= -55 + reference.stop[2] + 14.2,
);
const passage = createJourneySampler(route.samples.slice(screensIndex), route.up);
// Arc length along the passage samples, so both corridor legs move at an even pace.
const passageArcs = route.samples.slice(screensIndex).reduce<number[]>((arcs, sample, i, all) => {
  arcs.push(
    i
      ? arcs[i - 1] +
          Math.hypot(sample.position[0] - all[i - 1].position[0], sample.position[2] - all[i - 1].position[2])
      : 0,
  );
  return arcs;
}, []);
const PASSAGE_LENGTH = passageArcs[passageArcs.length - 1];
const STOP_ARC =
  CORRIDOR_STOP.arc -
  route.samples
    .slice(0, screensIndex + 1)
    .reduce(
      (arc, sample, i, all) =>
        i
          ? arc +
            Math.hypot(
              sample.position[0] - all[i - 1].position[0],
              sample.position[2] - all[i - 1].position[2],
            )
          : 0,
      0,
    );
/** One unbroken walk through the corridor (no stop): it speeds up over the first leg and eases out
 *  over the second, which starts at the first leg's end speed. `leave` also sets the page-return pace. */
const CORRIDOR_MOVE = { arrive: 2.6, leave: 2.4 } as const;
/** How far through the walk's second leg (eased, 0-1) the drawings are behind and the liquid sphere comes into view:
 *  the corner caption turns from the wall drawings to the lamp there (story-caption.tsx). Measured 2026-11-18: a wall
 *  fills the view for a moment at ~.87 (4.2 s after the step), the sphere shows at ~4.5 s. */
const LIQUID_IN_VIEW = 0.87;
const CORRIDOR_EXIT_SPEED = (PASSAGE_LENGTH - STOP_ARC) / CORRIDOR_MOVE.leave;
/** Passage pose at an arc from its start. */
function corridorPose(arc: number, position: Vector3, rotation: Quaternion) {
  let i = 1;
  while (i < passageArcs.length - 1 && passageArcs[i] < arc) i++;
  const t = Math.max(
    0,
    Math.min(1, (arc - passageArcs[i - 1]) / (passageArcs[i] - passageArcs[i - 1] || 1e-9)),
  );
  passage.sample((i - 1 + t) / (passageArcs.length - 1), position, rotation);
}
export const PAGE_POSE = (() => {
  const position = new Vector3(),
    rotation = new Quaternion();
  passage.sample(1, position, rotation);
  position.y = projector.centre_blender[2] + 0.1;
  return {
    position: position.toArray() as [number, number, number],
    target: new Vector3(0, 0, -1).applyQuaternion(rotation).multiplyScalar(14).add(position).toArray() as [
      number,
      number,
      number,
    ],
  };
})();

/** Original deliberate-shot timings; the curved leg uses the audited Blender centreline. */
export default function FullJourney({ metrics, orbit }: { metrics: MetricsStore; orbit: boolean }) {
  const { camera, invalidate, size, scene, gl } = useThree();
  const projectorTravel = effectQuality(gl) === "desktop" ? 2.85 : 2;
  /** Phones: the projector simply appears at the pulled-back stop (no fly-in, particles or assembly). */
  const phone = effectQuality(gl) === "mobile";
  const livingLens = useMemo(() => createViewOneLens(), []),
    lensTouch = useRef(false);
  useEffect(() => {
    const touch = matchMedia("(hover: none)");
    const changed = () => {
      lensTouch.current = touch.matches;
      livingLens.reset();
      invalidate();
    };
    changed();
    const pointer = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        lensTouch.current = true;
        livingLens.pointer(0, 0);
        return;
      }
      if (
        journeyControls.read().phase !== "logoReveal" ||
        viewOneLensWeight(cinemaShot.stage, cinemaShot.progress) === 0
      )
        return;
      lensTouch.current = false;
      const ui = event.target instanceof Element && event.target.closest("[data-cinema-controls]");
      livingLens.pointer(
        ui ? 0 : (event.clientX / innerWidth) * 2 - 1,
        ui ? 0 : (event.clientY / innerHeight) * 2 - 1,
      );
      invalidate();
    };
    const leave = () => {
      livingLens.pointer(0, 0);
      invalidate();
    };
    const unsubscribe = lensControls.subscribe(invalidate);
    window.addEventListener("pointermove", pointer, { passive: true });
    window.addEventListener("blur", leave);
    document.documentElement.addEventListener("pointerleave", leave);
    touch.addEventListener("change", changed);
    return () => {
      unsubscribe();
      window.removeEventListener("pointermove", pointer);
      window.removeEventListener("blur", leave);
      document.documentElement.removeEventListener("pointerleave", leave);
      touch.removeEventListener("change", changed);
    };
  }, [invalidate, livingLens]);
  useEffect(() => diagonalTransition.subscribe(invalidate), [invalidate]);
  const corridorBackground = useMemo(() => new Color("#11151a"), []);
  const reveal = useMemo(() => {
    const initialRotation = new Quaternion().setFromRotationMatrix(
      new Matrix4().lookAt(
        new Vector3(...PAGE_POSE.position),
        new Vector3(...PAGE_POSE.target),
        new Vector3(0, 1, 0),
      ),
    );
    return createLogoReveal(
      logoBounds.blenderBounds,
      layout.slides[1],
      PAGE_POSE.position[1],
      size.width / Math.max(1, size.height),
      new Vector3(...PAGE_POSE.position),
      initialRotation,
    );
  }, [size.width, size.height]);
  // Section 4's white, fixed in the corridor at the liquid sphere's spot (see end-box.ts).
  const endBox = useMemo(() => createEndBox(), []);
  // Scrolling back from View 2: the way back down to that white (page-exit.ts), and a stand-in camera that places it
  // where the camera will land.
  const descent = useMemo(() => ({ clock: createPageDescent(), lens: new PerspectiveCamera() }), []);
  useEffect(() => {
    scene.add(endBox.group);
    return () => endBox.dispose();
  }, [scene, endBox]);
  // View 2's key light on the logo: placed once per framing, relative to the View 2 camera (see LOGO_KEY).
  useEffect(() => {
    const position = new Vector3(),
      rotation = new Quaternion();
    reveal.sampleTurn(1, position, rotation);
    logoKey.position
      .copy(position)
      .addScaledVector(new Vector3(0, 0, -1).applyQuaternion(rotation), LOGO_KEY.ahead)
      .addScaledVector(new Vector3(1, 0, 0).applyQuaternion(rotation), LOGO_KEY.side)
      .addScaledVector(new Vector3(0, 1, 0).applyQuaternion(rotation), LOGO_KEY.lift);
    invalidate();
  }, [reveal, invalidate]);
  const exitStages = useRef(createExitStages());
  const jumpProjector = useRef(() => {});
  const openingClock = useRef(createTheatreOpeningClock());
  /** Pace of the theatre view following the mouse (see the idle frame below). */
  const GAZE_FOLLOW = 4.2;
  const theatreLook = useRef({ target: new Vector2(), current: new Vector2(), velocity: new Vector2() });

  const openingReview = useMemo(
    () => (typeof window === "undefined" ? undefined : openingReviewTime(location.search, location.hostname)),
    [],
  );
  const openingEnd = useMemo(() => new Vector3(...OPENING_CAMERA_END), []);
  const state = useRef({
    phase: (journeyControls.read().pageAtEnd ? "panel" : "intro") as JourneyPhase,
    revealFov: 40,
    resumeCamera: journeyControls.read().pageAtEnd,
    pendingScreens: false,
    elapsed: 0,
    last: 0,
    lockedUntil: 0,
    reduce: false,
    houseSeconds: 0,
    pendingProjector: false,
    pendingJump: null as "projector" | null,
    assemblySettled: false,
    lead: 0,
    back: false,
    /** On the way back down from View 2 to Section 4's white. */
    descending: false,
    from: new Vector3(),
    fromFocus: new Vector3(...reference.screenCentre),
    focus: new Vector3(...reference.screenCentre),
    to: new Vector3(),
    q: new Quaternion(),
  });
  const points = useMemo(() => {
    const [x, y, z] = projector.centre_blender;
    const centre = new Vector3(x, z, -y);
    const returned = centre.clone().add(new Vector3(0, 0.1, -6));
    return {
      centre,
      wide: centre.clone().add(new Vector3(0, 0.25, -9.5)),
      close: centre.clone().add(new Vector3(-2.7, 1.8, -2.7)),
      returned,
      screens: new Vector3().fromArray(route.samples[screensIndex].position).setY(centre.y + 0.1),
      position: new Vector3(),
      rotation: new Quaternion(),
      // Canonical resting poses, so scrolling back (or a menu jump) never depends on how the visitor arrived.
      seat: new Vector3(...OPENING_CAMERA_END),
      seatFocus: new Vector3(reference.screenCentre[0], OPENING_CAMERA_END[1], reference.screenCentre[2]),
    };
  }, []);
  useEffect(() => {
    const s = state.current;
    let wasReturning = journeyControls.read().pageReturning,
      wasLeaving = journeyControls.read().leavingPage,
      wasPhase = journeyControls.read().phase,
      hideFrame = 0;
    const unsubscribeJourney = journeyControls.subscribe(() => {
      const journey = journeyControls.read(),
        returning = journey.pageReturning;
      if (returning && !wasReturning) {
        s.phase = "logoReveal";
        s.last = performance.now();
        s.revealFov = camera instanceof PerspectiveCamera ? camera.fov : LOGO_FOV;
        livingLens.reset();
        invalidate();
      }
      wasReturning = returning;
      // Back from the start of Section 1: the page turns back into the liquid in front of the camera, which rests at the
      // corridor's end as it did on the way in, with the projector waiting assembled at the far end.
      if (journey.leavingPage && !wasLeaving) {
        endBox.hide();
        exitStages.current.reset();
        s.descending = false;
        s.back = false;
        s.phase = "panel";
        restCamera();
        camera.position.fromArray(PAGE_POSE.position);
        camera.lookAt(...PAGE_POSE.target);
        readyProjectorStop();
        invalidate();
      }
      wasLeaving = journey.leavingPage;
      // The liquid is a sphere again (corridor-page.tsx): walk back through the corridor, each leg in reverse.
      if (journey.leavingPage && journey.phase === "corridor" && s.phase !== "corridor" && s.phase !== "screens") {
        s.phase = "corridor";
        s.back = true;
        s.elapsed = 0;
        s.last = performance.now();
        s.from.copy(points.returned);
        s.q.setFromRotationMatrix(new Matrix4().lookAt(points.returned, points.centre, new Vector3(0, 1, 0)));
        s.lead = points.returned.distanceTo(points.screens);
        invalidate();
      }
      // Once the page covers the screen again, the white panel behind it is put away.
      if (journey.phase === "page" && wasPhase !== "page" && endBox.visible) {
        cancelAnimationFrame(hideFrame);
        hideFrame = requestAnimationFrame(() => {
          hideFrame = requestAnimationFrame(() => {
            if (journeyControls.read().phase !== "page") return;
            endBox.hide();
            invalidate();
          });
        });
      }
      wasPhase = journey.phase;
    });

    const phase = (next: JourneyPhase) => {
      s.phase = next;
      s.elapsed = 0;
      s.last = performance.now();
      journeyControls.update({ phase: next });
      invalidate();
    };
    // Temporary buttons reuse the authored samplers and end-of-journey lighting.
    const preview = (event: Event) => {
      const view = (event as CustomEvent).detail;
      if (view !== "slide" && view !== "turned" && view !== "final") return;
      theatreOpening.house.value = 1;
      s.phase = view === "final" ? "logoDone" : "logoReveal";
      s.resumeCamera = false;
      s.pendingProjector = false;
      s.pendingScreens = false;
      s.descending = false;
      s.elapsed = 0;
      s.last = performance.now();
      s.lockedUntil = 0;
      s.revealFov = LOGO_FOV;
      exitStages.current.preview(view === "final" ? "done" : view);
      updateStageLighting(576, true);
      metrics.update({ progress: 1, waitingForProjector: false, waitingForCorridor: false });
      journeyControls.update({
        phase: s.phase,
        revealStage: view === "final" ? "done" : view === "slide" ? "top" : view,
        pageReturning: false,
        reviewCamera: true,
        openingMoving: false,
        cinemaStage: "clear",
      });
      invalidate();
    };
    window.addEventListener("eye-camera-view", preview);
    // Menu: straight to a section's resting state. No camera move or build plays.
    const restCamera = () => {
      camera.up.set(0, 1, 0); // the logo shots roll it
      if (!(camera instanceof PerspectiveCamera)) return;
      const aspect = size.width / Math.max(1, size.height);
      camera.fov = Math.max(
        40,
        Math.min(88, (2 * Math.atan((11.64 * 1.06) / (2 * 9.6 * aspect)) * 180) / Math.PI),
      );
      camera.far = reference.far;
      camera.updateProjectionMatrix();
      if (scene.background instanceof Color) scene.background.copy(corridorBackground);
    };
    const jump = (event: Event) => {
      endBox.hide();
      const target = (event as CustomEvent).detail as JumpTarget;
      const common = {
        pageReturning: false,
        pageEndBox: false,
        reviewCamera: false,
        revealStage: "slide" as ExitStage,
        pageAtEnd: false,
        finalCovered: false,
        panelStage: 0,
        openingMoving: false,
        pageBack: false,
        leavingPage: false,
      };
      s.back = false;
      s.descending = false;
      s.pendingScreens = false;
      s.elapsed = 0;
      s.last = performance.now();
      s.lockedUntil = performance.now() + 300;
      livingLens.reset();
      exitStages.current.reset();
      theatreOpening.house.value = 1;
      metrics.update({ waitingForCorridor: false });
      if (target === "final") {
        s.pendingJump = null;
        window.dispatchEvent(new CustomEvent("eye-camera-view", { detail: "final" }));
        journeyControls.update({ pageSection: null });
        requestAnimationFrame(() =>
          window.dispatchEvent(
            new CustomEvent("eye-diagonal-preview", { detail: { value: 1, instant: true } }),
          ),
        );
        return;
      }
      restCamera();
      if (typeof target === "number") {
        // Page sections: the scene rests at the corridor end behind the page, as after the liquid.
        s.pendingJump = null;
        s.phase = "page";
        camera.position.fromArray(PAGE_POSE.position);
        camera.lookAt(...PAGE_POSE.target);
        cinemaGlasses.toggle(1, true);
        theatreOpening.screenPower.value = 0;
        journeyControls.update({
          ...common,
          phase: "page",
          pageSection: target,
          pageJump: journeyControls.read().pageJump + 1,
          cinemaStage: "clear",
        });
        invalidate();
        return;
      }
      if (target === "projector" && !projectorControls.read().ready) {
        // Not prepared yet: wait at the seat, then jump (the usual "Preparing projector" note shows).
        s.pendingJump = "projector";
        s.pendingProjector = true;
        sceneIdleUrgent.value = true;
        metrics.update({ waitingForProjector: true });
      } else s.pendingJump = null;
      if (target === "theatre" || s.pendingJump) {
        if (projectorControls.read().ready) projectorControls.set("hidden");
        restoreStageLighting(1);
        theatreOpening.screenPower.value = 1;
        cinemaGlasses.toggle(0, true);
        s.focus.copy(points.seatFocus);
        camera.position.copy(points.seat);
        camera.lookAt(s.focus);
        theatreLook.current.target.set(0, 0);
        theatreLook.current.current.set(0, 0);
        s.phase = "idle";
        journeyControls.update({ ...common, phase: "idle", pageSection: null, cinemaStage: "wearing" });
        invalidate();
        return;
      }
      projectorAt();
      journeyControls.update({ ...common, phase: "done", pageSection: null, cinemaStage: "clear" });
    };
    // The projector stop as it is after the assembly: the projector built, the room as its lights settled, glasses off.
    function readyProjectorStop() {
      if (projectorControls.read().ready) projectorControls.set("assembled");
      updateStageLighting(576, true);
      leadStageLighting(1, 1);
      cinemaGlasses.toggle(1, true);
      theatreOpening.screenPower.value = 0;
    }
    const projectorAt = () => {
      s.pendingJump = null;
      s.pendingProjector = false;
      metrics.update({ waitingForProjector: false });
      readyProjectorStop();
      s.focus.copy(points.centre);
      camera.position.copy(points.returned);
      camera.lookAt(s.focus);
      s.phase = "done";
      invalidate();
    };
    jumpProjector.current = () => {
      projectorAt();
      journeyControls.update({ phase: "done", cinemaStage: "clear" });
    };
    window.addEventListener("journey-jump", jump);
    const unsubscribe = projectorControls.subscribe(() => {
      const p = projectorControls.read();
      if (p.ready && s.pendingProjector) invalidate();
      if (s.phase === "reveal" && p.phase === "exploded") phase("awaitAssembly");
      if (s.phase === "awaitAssembly" && p.phase === "assembling") {
        s.assemblySettled = false;
        phase("returnHold");
      }
      // The hold restarts when the last cover has settled, so the finished projector is seen before the camera leaves.
      else if (s.phase === "returnHold" && p.phase === "assembled" && !s.assemblySettled) {
        s.assemblySettled = true;
        s.elapsed = 0;
        invalidate();
      }
    });
    // One gesture, one step (scroll-step.ts). `pixels` still drives the review slide, which follows the scroll.
    const advance = (step: Step, pixels: number) => {
      const now = performance.now();
      const page = journeyControls.read();
      if (page.phase === "pageReturnLoading" || page.pageReturning || page.leavingPage || s.descending) return;
      if (!orbit && (s.phase === "logoReveal" || s.phase === "logoDone")) {
        if (now < s.lockedUntil) return;
        if (page.reviewCamera) journeyControls.update({ reviewCamera: false });
        exitStages.current.input(pixels, now, innerHeight, step);
        invalidate();
        return;
      }
      if (orbit || !step || now < s.lockedUntil || s.phase === "intro") return;
      if (step < 0) {
        // Scrolling back plays each step in reverse: projector -> parts -> theatre.
        if (!["awaitAssembly", "done"].includes(s.phase)) return;
        s.back = true;
        if (s.phase === "done" && phone) {
          projectorControls.set("hidden");
          s.from.copy(points.seat);
          s.to.copy(points.wide);
          s.fromFocus.copy(points.seatFocus);
          s.focus.copy(points.centre);
          phase("pullback");
        } else if (s.phase === "done") {
          projectorControls.play("disassembling");
          s.from.copy(points.close);
          s.to.copy(points.returned);
          s.fromFocus.copy(points.centre);
          phase("return");
        } else {
          projectorControls.play("dissolving");
          s.from.copy(points.wide);
          s.to.copy(points.close);
          s.fromFocus.copy(points.centre);
          phase("approach");
        }
        return;
      }
      if (!["idle", "awaitAssembly", "done"].includes(s.phase)) return;
      if (s.phase === "idle") {
        traceMark("Theatre to projector gesture");
        cinemaGlasses.toggle(1, s.reduce);
        journeyControls.update({ cinemaStage: "removing" });
        phase("glassesExit");
      } else if (s.phase === "awaitAssembly") projectorControls.play("assembling");
      else if (s.phase === "done") {
        if (!metrics.read().corridorReady) {
          s.pendingScreens = true;
          sceneIdleUrgent.value = true;
          metrics.update({ waitingForCorridor: true });
          invalidate();
          return;
        }
        s.from.copy(camera.position);
        s.q.copy(camera.quaternion);
        s.lead = s.from.distanceTo(points.screens);
        phase("screens");
      }
    };
    // The page sections hear their own scroll (normal-page.tsx); everywhere else it is the journey's.
    const stopListening = listenSteps(window, (step, pixels) => {
      if (orbit || journeyControls.read().phase === "page") return false;
      advance(step, pixels);
      return true;
    });
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const gaze = theatreLook.current;
    const clearGaze = () => {
      gaze.target.set(0, 0);
      invalidate();
    };
    const gazePointer = (event: PointerEvent) => {
      if (s.phase !== "idle" || orbit || s.reduce) return;
      if (
        event.pointerType !== "mouse" ||
        (event.target instanceof Element && event.target.closest("button,a,input,[data-cinema-controls]"))
      ) {
        clearGaze();
        return;
      }
      gaze.target.set(
        (1 - (event.clientX / innerWidth) * 2) * 0.065,
        (1 - (event.clientY / innerHeight) * 2) * 0.042,
      );
      invalidate();
    };
    const preference = () => {
      s.reduce = query.matches;
      if (s.reduce) clearGaze();
    };
    preference();
    const visibility = () => {
      s.last = performance.now();
      if (!document.hidden) invalidate();
    };
    window.addEventListener("pointermove", gazePointer, { passive: true });
    window.addEventListener("blur", clearGaze);
    document.documentElement.addEventListener("pointerleave", clearGaze);
    document.addEventListener("visibilitychange", visibility);
    query.addEventListener("change", preference);
    return () => {
      unsubscribe();
      unsubscribeJourney();
      window.removeEventListener("eye-camera-view", preview);
      window.removeEventListener("journey-jump", jump);
      stopListening();
      cancelAnimationFrame(hideFrame);
      window.removeEventListener("pointermove", gazePointer);
      window.removeEventListener("blur", clearGaze);
      document.documentElement.removeEventListener("pointerleave", clearGaze);
      document.removeEventListener("visibilitychange", visibility);
      query.removeEventListener("change", preference);
    };
  }, [
    camera,
    invalidate,
    orbit,
    points,
    metrics,
    livingLens,
    scene,
    size.width,
    size.height,
    corridorBackground,
    phone,
    endBox,
  ]);

  /* eslint-disable react-hooks/immutability -- Camera projection/clipping are imperative Three.js state. */
  useFrame(() => {
    const s = state.current,
      now = performance.now();
    sceneIdleUrgent.value = s.pendingProjector || s.pendingScreens;
    theatreOpening.active.value = s.phase === "intro" ? 1 : 0;
    if (s.phase !== "intro") theatreOpening.room.value = 1;
    if (s.phase !== "logoReveal" && s.phase !== "logoDone") pupilFillState.value = 0;
    const gap = s.last ? Math.max(0, (now - s.last) / 1000) : 0;
    s.last = now;
    // A missed phone frame must not teleport the camera through a shot.
    const dt = phone ? Math.min(0.05, gap) : gap;
    if (document.hidden) return;
    if (s.resumeCamera) {
      camera.position.fromArray(PAGE_POSE.position);
      camera.lookAt(...PAGE_POSE.target);
      metrics.update({ progress: 1 });
      s.resumeCamera = false;
    }
    // House lights rise by themselves once the opening pullback has settled.
    if (s.phase === "intro") {
      s.houseSeconds = 0;
      theatreOpening.house.value = 0;
    } else if (theatreOpening.house.value < 1) {
      s.houseSeconds += Math.min(0.05, dt);
      theatreOpening.house.value = houseLightLevel(s.houseSeconds, s.reduce);
      if (theatreOpening.house.value < 1) invalidate();
    }
    if (orbit || document.hidden) return;
    const change = (phase: JourneyPhase) => {
      s.phase = phase;
      s.elapsed = 0;
      queueMicrotask(() => journeyControls.update({ phase }));
    };
    if (s.pendingJump === "projector" && projectorControls.read().ready) {
      jumpProjector.current();
      invalidate();
    }
    if (s.pendingScreens && metrics.read().corridorReady) {
      s.pendingScreens = false;
      metrics.update({ waitingForCorridor: false });
      s.from.copy(camera.position);
      s.q.copy(camera.quaternion);
      s.lead = s.from.distanceTo(points.screens);
      change("screens");
    }
    if (s.phase === "logoReveal" || s.phase === "logoDone") {
      // Back from the page sections the camera climbs all the way to the top of the slide (View 1), where the turn begins.
      const leaving = journeyControls.read().pageReturning
        ? pageReturn.tick(dt, reveal.topDistance / CORRIDOR_EXIT_SPEED, s.reduce)
        : null;
      // Scrolling back from View 2, after the turn back up: the same climb in reverse, down to Section 4's white.
      const going =
        !leaving && s.descending
          ? descent.clock.tick(dt, reveal.topDistance / CORRIDOR_EXIT_SPEED, s.reduce)
          : null;
      const staged = leaving || going ? null : exitStages.current.tick(dt, now, s.reduce);
      const shot = staged ?? {
        stage: "slide" as ExitStage,
        progress: reveal.progressToTop(settle((leaving ?? going)!.travel)),
        moving: (leaving ?? going)!.moving,
      };
      if (staged?.descending && camera instanceof PerspectiveCamera) {
        // The turn back has reached the top of the slide. The white panel stands where the liquid sphere was (it may
        // still be there from the way up), filling the view the camera will have when it lands in front of it.
        s.descending = true;
        descent.clock.reset();
        descent.lens.copy(camera, false);
        reveal.sampleSlide(0, descent.lens.position, descent.lens.quaternion);
        descent.lens.fov = s.revealFov;
        descent.lens.updateProjectionMatrix();
        endBox.place(descent.lens);
        invalidate();
      }
      cinemaShot.stage = shot.stage;
      cinemaShot.progress = shot.progress;
      logoKey.view = logoKeyAmount(shot.stage, shot.progress);
      pupilFillState.value = pupilFillProgress(shot.stage, shot.progress);
      if (shot.stage === "slide" || shot.stage === "top")
        reveal.sampleSlide(shot.progress, points.position, points.rotation);
      else if (shot.stage === "turn" || shot.stage === "turned")
        reveal.sampleTurn(shot.progress, points.position, points.rotation);
      else reveal.samplePullback(shot.progress, points.position, points.rotation);
      const t =
        shot.stage === "slide" || shot.stage === "top"
          ? 0
          : shot.stage === "turn" || shot.stage === "turned"
            ? 0.25 * smooth(shot.progress)
            : 0.25 + 0.75 * smooth(shot.progress);
      if (scene.background instanceof Color)
        scene.background.copy(corridorBackground).multiplyScalar(1 - smooth(Math.min(1, t / 0.25)));
      camera.position.copy(points.position);
      camera.quaternion.copy(points.rotation);
      camera.up.set(0, 1, 0).applyQuaternion(points.rotation);
      if (camera instanceof PerspectiveCamera) {
        camera.setFocalLength(
          camera.getFilmHeight() /
            (2 * Math.tan(((s.revealFov + (LOGO_FOV - s.revealFov) * smooth(t)) * Math.PI) / 360)),
        );
        camera.far = reveal.far;
        camera.updateProjectionMatrix();
      }
      if (shot.stage === "done" && camera instanceof PerspectiveCamera) {
        // The existing final shot stays centred. Change only its magnification
        // during the following section, rendering native-resolution grains.
        const tangent = Math.tan((camera.fov * Math.PI) / 360);
        const diameter =
          ((logoBounds.blenderBounds[0][1] - logoBounds.blenderBounds[0][0]) * size.height) /
          (2 * tangent * (reveal.finalPosition.y - logoBounds.blenderBounds[2][1]));
        diagonalTransition.setPupilDiameter(diameter);
        camera.fov = (2 * Math.atan(tangent / diagonalEyeZoom(diagonalTransition.progress)) * 180) / Math.PI;
        camera.updateProjectionMatrix();
      }
      if (
        camera instanceof PerspectiveCamera &&
        livingLens.apply(
          camera,
          shot.stage,
          shot.progress,
          Math.min(0.05, dt),
          s.reduce || lensTouch.current,
          camera.position.distanceTo(reveal.centre),
        )
      )
        invalidate();
      if (shot.moving) invalidate();
      // Section 4's white: fixed in the corridor at the liquid sphere's spot from the first frame of the return (under
      // the screen white, which hands over to it just before the camera moves). Plain white, no glow.
      if (leaving && !endBox.visible && journeyControls.read().pageEndBox) endBox.place(camera);
      // The contact bar and menu step aside while the camera travels. The return's last frame counts too: the hold at
      // the top follows straight on, so View 1's caption never flashes up between them. So does the way back down.
      const moving = !!shot.moving || !!leaving || s.descending;
      if (journeyControls.read().cameraMoving !== moving)
        queueMicrotask(() => journeyControls.update({ cameraMoving: moving }));
      if (leaving && !leaving.moving) {
        // At the top: hold for a second, then turn to View 2 by itself.
        exitStages.current.arrive();
        invalidate();
        queueMicrotask(() => journeyControls.update({ pageReturning: false, revealStage: "top" }));
      }
      if (going && !going.moving) {
        // Landed in front of the white panel, which fills the view: Section 4 opens again under a white that lifts off
        // it (normal-page.tsx), on its last card, as it was left. The panel is put away once the page covers it.
        s.descending = false;
        s.phase = "page";
        exitStages.current.reset();
        queueMicrotask(() =>
          journeyControls.update({
            phase: "page",
            pageBack: true,
            pageAtEnd: true,
            pageSection: null,
            revealStage: "slide",
            cameraMoving: false,
          }),
        );
        return;
      }
      if (shot.stage !== journeyControls.read().revealStage)
        queueMicrotask(() => journeyControls.update({ revealStage: shot.stage }));
      if (shot.stage === "done" && s.phase !== "logoDone") change("logoDone");
      // Back from the final eye, the pullback plays in reverse: the white section after it is left behind.
      else if (shot.stage !== "done" && s.phase === "logoDone") change("logoReveal");
      return;
    }
    if (s.phase === "intro") {
      // Enforce the screen-facing pose even before assets/FX are ready.
      if (!metrics.read().firstFrame) {
        theatreOpening.room.value = 0;
        camera.position.fromArray(OPENING_CAMERA_START);
        camera.lookAt(...(reference.screenCentre as [number, number, number]));
        invalidate();
        return;
      }
      const prepared = journeyControls.read().openingPrepared;
      const shot =
        openingReview === undefined
          ? openingClock.current.tick(
              dt,
              theatreOpening.geometryReady,
              prepared && journeyControls.read().loaderDone,
              s.reduce,
            )
          : {
              ...theatreOpeningShot(prepared && theatreOpening.geometryReady ? openingReview : 0),
              elapsed: prepared && theatreOpening.geometryReady ? openingReview : 0,
            };
      theatreOpening.room.value = shot.room;
      theatreOpening.trace.value = shot.trace;
      theatreOpening.white.value = shot.white;
      theatreOpening.lineOpacity.value = shot.lineOpacity;
      theatreOpening.stage = shot.stage;
      theatreOpening.elapsed = shot.elapsed;
      if (journeyControls.read().openingStage !== shot.stage)
        queueMicrotask(() => journeyControls.update({ openingStage: shot.stage }));
      if (shot.progress > 0 && !journeyControls.read().openingMoving) {
        traceMark("Opening motion started");
        queueMicrotask(() => journeyControls.update({ openingMoving: true }));
      }
      camera.position.fromArray(OPENING_CAMERA_START).lerp(openingEnd, shot.position);
      s.focus.set(
        reference.screenCentre[0],
        OPENING_CAMERA_START[1] + (OPENING_CAMERA_END[1] - OPENING_CAMERA_START[1]) * shot.position,
        reference.screenCentre[2],
      );
      camera.lookAt(s.focus);
      if (openingReview !== undefined && prepared && theatreOpening.geometryReady) return;
      if (shot.done) {
        traceMark("Opening camera settled");
        s.lockedUntil = now + 240;
        change("idle");
      } else invalidate();
      return;
    }
    if (s.phase === "idle" || s.phase === "glassesExit") {
      const gaze = theatreLook.current;
      gaze.velocity ??= new Vector2(); // a hot reload can keep an older ref without it
      if (s.phase === "glassesExit" || s.reduce) gaze.target.set(0, 0);
      // Critically damped follow: the view eases into motion and settles without any jolt.
      // GAZE_FOLLOW sets the pace; lower is slower (most of the move takes about 1/GAZE_FOLLOW s).
      if (s.reduce) {
        gaze.current.copy(gaze.target);
        gaze.velocity.set(0, 0);
      } else {
        const step = Math.min(dt, 0.05) / 4;
        for (let i = 0; i < 4; i++) {
          gaze.velocity.x +=
            (GAZE_FOLLOW * GAZE_FOLLOW * (gaze.target.x - gaze.current.x) -
              2 * GAZE_FOLLOW * gaze.velocity.x) *
            step;
          gaze.velocity.y +=
            (GAZE_FOLLOW * GAZE_FOLLOW * (gaze.target.y - gaze.current.y) -
              2 * GAZE_FOLLOW * gaze.velocity.y) *
            step;
          gaze.current.x += gaze.velocity.x * step;
          gaze.current.y += gaze.velocity.y * step;
        }
      }
      const moving = gaze.current.distanceToSquared(gaze.target) > 1.6e-7 || gaze.velocity.lengthSq() > 1e-8;
      if (!moving) {
        gaze.current.copy(gaze.target);
        gaze.velocity.set(0, 0);
      }
      camera.lookAt(s.focus);
      camera.rotateY(gaze.current.x);
      camera.rotateX(gaze.current.y);
      // Back in the seat after scrolling back: the screen powers up again as the glasses come down.
      if (s.phase === "idle" && theatreOpening.screenPower.value < 1) {
        theatreOpening.screenPower.value = s.reduce
          ? 1
          : Math.min(1, theatreOpening.screenPower.value + Math.min(dt, 0.05) / 1.1);
        invalidate();
      }
      // Background GPU preparation waits until the glide has settled (scene-idle).
      if (moving) {
        invalidate();
        sceneMotion.at = performance.now();
      }
    }
    if (["idle", "reveal", "awaitAssembly", "done", "panel", "page"].includes(s.phase)) return;
    s.elapsed += dt;
    if (s.phase === "glassesExit") {
      // Follow the glasses' own motion, so a slow frame cannot cut the lift short.
      if (cinemaGlasses.position < GLASSES_EXIT.liftedAt && !s.reduce) {
        s.elapsed = 0;
        invalidate();
        return;
      }
      theatreOpening.screenPower.value = s.reduce
        ? 0
        : 1 - smooth(Math.min(1, s.elapsed / GLASSES_EXIT.screenOff));
      if (!s.reduce && s.elapsed < GLASSES_EXIT.screenOff + GLASSES_EXIT.hold) {
        invalidate();
        return;
      }
      // Finish any cold GPU work while seated, then play the whole shot once.
      if (!projectorControls.read().ready) {
        if (!s.pendingProjector) {
          s.pendingProjector = true;
          sceneIdleUrgent.value = true;
          metrics.update({ waitingForProjector: true });
        }
        return;
      }
      if (s.pendingProjector) {
        s.pendingProjector = false;
        metrics.update({ waitingForProjector: false });
      }
      s.from.copy(camera.position);
      s.fromFocus.copy(s.focus);
      s.to.copy(points.wide);
      traceMark("Theatre to projector pullback started");
      queueMicrotask(() => journeyControls.update({ cinemaStage: "clear" }));
      change("pullback");
    }
    // The pullback rests briefly in the dark before turning to the particle view.
    if (s.phase === "hold") {
      leadStageLighting(1, 0);
      if (s.elapsed < HOLD_SECONDS) {
        invalidate();
        return;
      }
      s.from.copy(camera.position);
      s.fromFocus.copy(s.focus);
      s.to.copy(points.close);
      change("approach");
    }
    if (s.phase === "returnHold") {
      if (
        s.reduce
          ? s.elapsed < 1
          : (!s.assemblySettled && s.elapsed < 6) || (s.assemblySettled && s.elapsed < 0.45)
      ) {
        invalidate();
        return;
      }
      s.from.copy(camera.position);
      s.fromFocus.copy(s.focus);
      s.to.copy(points.returned);
      change("return");
    }
    // The second corridor leg starts at the first leg's end speed (2·distance/duration for both easings).
    const leave = (CORRIDOR_MOVE.arrive * (PASSAGE_LENGTH - STOP_ARC)) / Math.max(1, s.lead + STOP_ARC);
    // No stop at the join: the first leg's leftover time carries straight into the second in the same frame. Walking
    // back (from the liquid to the projector) the legs come in the other order, each played exactly backwards.
    if (s.phase === "screens" && !s.back && !s.reduce && s.elapsed >= CORRIDOR_MOVE.arrive) {
      const over = s.elapsed - CORRIDOR_MOVE.arrive;
      change("corridor");
      s.elapsed = over;
    } else if (s.phase === "corridor" && s.back && !s.reduce && s.elapsed >= leave) {
      const over = s.elapsed - leave;
      change("screens");
      s.elapsed = over;
    }
    const walk = s.phase === "screens" || s.phase === "corridor";
    const duration =
      s.phase === "corridor"
        ? leave
        : s.phase === "screens"
          ? CORRIDOR_MOVE.arrive
          : s.back
            ? BACK_SECONDS[s.phase as keyof typeof BACK_SECONDS] ?? 1
            : s.phase === "approach"
              ? 1.4
              : s.phase === "return"
                ? 0.9
                : s.phase === "pullback"
                  ? projectorTravel
                  : 0.5;
    const t = s.reduce ? 1 : Math.min(1, s.elapsed / duration),
      // The corridor walk backwards is the same walk in reverse time, so it speeds up and eases out the other way round.
      along = s.back ? 1 - t : t,
      eased = walk
        ? s.phase === "screens"
          ? along * along
          : 1 - (1 - along) * (1 - along) // corridor: one unbroken walk, speeding up then easing out
        : s.back
          ? 1 - smooth(t)
          : settle(t);
    if (s.back && (s.phase === "approach" || s.phase === "pullback"))
      restoreStageLighting(s.phase === "approach" ? 0.35 * t : 0.35 + 0.65 * t);
    else if (!s.back && s.phase === "pullback") leadStageLighting(theatrePullbackDim(t), 0);
    else if (!s.back && s.phase === "approach") leadStageLighting(1, smooth(t));
    if (s.phase === "screens") {
      // First leg from the projector: into the passage and along it to the middle.
      const total = s.lead + STOP_ARC,
        u = eased * total;
      corridorPose(Math.max(0, u - s.lead), points.position, points.rotation);
      if (u < s.lead) points.position.lerpVectors(s.from, points.screens, u / s.lead);
      camera.position.copy(points.position).setY(points.returned.y);
      camera.quaternion.copy(s.q).slerp(points.rotation, smooth(Math.min(1, u / (s.lead + 12))));
      metrics.update({ progress: (eased * STOP_ARC) / PASSAGE_LENGTH });
    } else if (s.phase === "corridor") {
      // Second leg, without stopping: on to the liquid.
      const u = eased * (PASSAGE_LENGTH - STOP_ARC);
      corridorPose(STOP_ARC + u, points.position, points.rotation);
      camera.position.copy(points.position).setY(points.returned.y);
      camera.quaternion.copy(points.rotation);
      metrics.update({ progress: (STOP_ARC + u) / PASSAGE_LENGTH });
    } else {
      camera.position.lerpVectors(s.from, s.to, eased);
      if (s.phase === "pullback") {
        const rise = Math.sin((Math.PI * eased) / (0.63 + 0.37 * eased)) ** 2;
        camera.position.y += rise * 3.2;
      }
      s.focus.lerpVectors(s.fromFocus, points.centre, eased);
      camera.lookAt(s.focus);
    }
    if (walk) {
      const liquidInView = s.phase === "corridor" && eased >= LIQUID_IN_VIEW;
      if (journeyControls.read().liquidInView !== liquidInView)
        queueMicrotask(() => journeyControls.update({ liquidInView }));
    }
    invalidate();
    if (t === 1 && s.back) {
      if (s.phase === "corridor") change("screens");
      else if (s.phase === "screens") {
        // Back at the projector, as after its assembly.
        s.back = false;
        s.focus.copy(points.centre);
        if (!projectorControls.read().ready) {
          // Opened from the menu before it was ever prepared: it is built here as soon as it is ready.
          s.pendingJump = "projector";
          s.pendingProjector = true;
          metrics.update({ waitingForProjector: true });
        }
        change("done");
        queueMicrotask(() => journeyControls.update({ leavingPage: false, panelStage: 0 }));
      } else if (s.phase === "return") {
        s.back = false;
        change("awaitAssembly");
      } else if (s.phase === "approach") {
        s.from.copy(points.seat);
        s.to.copy(points.wide);
        s.fromFocus.copy(points.seatFocus);
        change("pullback");
      } else if (s.phase === "pullback") {
        s.back = false;
        s.focus.copy(points.seatFocus);
        restoreStageLighting(1);
        cinemaGlasses.toggle(0, s.reduce);
        s.lockedUntil = now + 240;
        change("idle");
        queueMicrotask(() => journeyControls.update({ cinemaStage: "wearing" }));
      }
      return;
    }
    if (t === 1) {
      if (s.phase === "pullback") {
        traceMark("Theatre to projector pullback settled");
        if (phone) {
          projectorControls.set("assembled");
          updateStageLighting(576, true);
          leadStageLighting(1, 1);
          change("done");
        } else change("hold");
      } else if (s.phase === "approach") {
        change("reveal");
        queueMicrotask(() => projectorControls.play("particles"));
      } else if (s.phase === "return") change("done");
      // No stop in the corridor: the walk carries straight on toward the liquid.
      else if (s.phase === "screens") change("corridor");
      else if (s.phase === "corridor") {
        change("panel");
        queueMicrotask(() => journeyControls.update({ panelStage: 1 }));
      }
    }
  }, -1);
  /* eslint-enable react-hooks/immutability */
  return null;
}
