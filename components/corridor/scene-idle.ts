import { journeyControls } from "./journey-controls";
import { projectorControls } from "./projector-controls";
import { theatreOpening } from "./theatre-opening-state";
import { isMobileDevice } from "./texture-quality";
/** Set while the journey is waiting on prepared work: extra scrolling must not postpone it. */
export const sceneIdleUrgent = { value: false };
/** Last time the resting camera was still gliding (the theatre gaze follows the mouse without any input event). */
export const sceneMotion = { at: 0 };
export const OPENING_PROJECTOR_PRIORITY = -95;
const queue = new Map<() => void, { priority: number; allowed: () => boolean }>();
let timer: ReturnType<typeof setTimeout> | undefined,
  lastInput = 0,
  listening = false;
const input = (event: Event) => {
  if (event.type !== "pointermove" || (event as PointerEvent).buttons) lastInput = performance.now();
};
// The HTML page still covers the scene during pageReturnLoading. Critical mounts
// must run here: its transition waits for projector readiness before moving.
const settled = new Set(["idle", "done", "awaitAssembly", "panel", "logoDone", "pageReturnLoading"]);
// The HTML sections cover the scene. Return preparation can use quiet frames
// there on every tier while the visitor reads.
let phone: boolean | undefined;
const isPhone = () => (phone ??= isMobileDevice());
let previousPhase = "",
  phaseSince = 0;
function tick() {
  timer = undefined;
  if (!queue.size) return;
  const fx = projectorControls.read().phase;
  const shot = journeyControls.read(),
    holding = shot.phase === "intro" && !shot.openingMoving;
  const now = performance.now();
  if (shot.phase !== previousPhase) {
    previousPhase = shot.phase;
    phaseSince = now;
  }
  const reviewing =
    shot.reviewCamera &&
    shot.phase === "logoReveal" &&
    (shot.revealStage === "slide" || shot.revealStage === "top" || shot.revealStage === "turned");
  const waitingForProjector = shot.phase === "glassesExit" && sceneIdleUrgent.value;
  const resting = settled.has(shot.phase) || shot.phase === "page";
  if (
    !document.hidden &&
    (resting || holding || reviewing || waitingForProjector) &&
    fx !== "particles" &&
    fx !== "assembling" &&
    (holding ||
      shot.phase === "pageReturnLoading" ||
      sceneIdleUrgent.value ||
      (now - lastInput > 450 && now - sceneMotion.at > 250))
  ) {
    const lightsRising = shot.phase === "idle" && theatreOpening.house.value < 1;
    // Give the phone's projector reveal its first frames before starting the eye and HTML sections.
    const projectorJustRevealed = shot.phase === "done" && isPhone() && now - phaseSince < 1250;
    const phoneMorph = shot.phase === "panel" && isPhone();
    const next = [...queue]
      .filter(
        ([, job]) =>
          job.allowed() &&
          (!holding || job.priority <= OPENING_PROJECTOR_PRIORITY) &&
          (!waitingForProjector || job.priority <= 0) &&
          !lightsRising &&
          (!(projectorJustRevealed || phoneMorph) || job.priority < 15) &&
          (job.priority < 20 ||
            reviewing ||
            ["done", "panel", "logoDone", "page", "pageReturnLoading"].includes(shot.phase)),
      )
      .sort((a, b) => a[1].priority - b[1].priority)[0];
    if (next) {
      queue.delete(next[0]);
      next[0]();
    }
  }
  if (queue.size) timer = setTimeout(tick, 80);
}
/** Serial background work only at authored resting stops, after input settles. */
export function scheduleSceneIdle(job: () => void, priority = 0, allowed = () => true) {
  if (!listening) {
    for (const name of ["wheel", "touchmove", "pointerdown", "pointermove"])
      window.addEventListener(name, input, { passive: true });
    // HTML sections glide on after the finger lifts (snap momentum); element scrolls only reach window in capture.
    window.addEventListener("scroll", input, { passive: true, capture: true });
    listening = true;
  }
  queue.set(job, { priority, allowed });
  if (!timer) timer = setTimeout(tick, 80);
  return () => {
    queue.delete(job);
  };
}

/** Continue a multi-draw preparation only when the scene is quiet again. */
export function waitForSceneIdle(signal: AbortSignal, priority: number, allowed: () => boolean) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const finish = () => {
      cancel();
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const cancel = scheduleSceneIdle(finish, priority, allowed);
    signal.addEventListener("abort", finish, { once: true });
  });
}

export function phoneEyePreparationWindow() {
  const shot = journeyControls.read();
  return (
    shot.phase === "page" ||
    shot.phase === "pageReturnLoading" ||
    shot.phase === "logoDone" ||
    shot.reviewCamera
  );
}
