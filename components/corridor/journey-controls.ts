export type JourneyPhase =
  | "intro"
  | "glassesExit"
  | "idle"
  | "pullback"
  | "hold"
  | "approach"
  | "reveal"
  | "awaitAssembly"
  | "returnHold"
  | "return"
  | "done"
  | "screens"
  | "corridor"
  | "drawings"
  | "panel"
  | "page"
  | "pageReturnLoading"
  | "logoReveal"
  | "logoDone";
type Snapshot = {
  phase: JourneyPhase;
  cinemaStage: "wearing" | "removing" | "clear";
  openingStage: string;
  openingMoving: boolean;
  /** performance.now() when the opening camera started to move (the opening cue and the room tour count from it). */
  openingMovedAt: number;
  openingPrepared: boolean;
  loaderDone: boolean;
  pageSection: number | null;
  pageJump: number;
  cameraMoving: boolean;
  panelStage: number;
  pageAtEnd: boolean;
  pageReturning: boolean;
  /** Section 4's end: a plain white panel fixed in the corridor where the liquid sphere was (end-box.ts). */
  pageEndBox: boolean;
  revealStage: import("./exit-stages").ExitStage;
  reviewCamera: boolean;
  finalCovered: boolean;
  /** Scrolling back from View 2: the camera has come back down to the white panel and Section 4 opens again at its last
   *  card, as it was left, under a white that lifts off it (normal-page.tsx clears this once it has). */
  pageBack: boolean;
  /** Scrolling back from the start of Section 1: the page turns back into the liquid sphere and the camera walks back
   *  through the corridor to the projector (true from the lights coming up until the camera is back there). */
  leavingPage: boolean;
  /** On the corridor walk's second leg, the liquid sphere has come into view: the corner caption turns from the wall
   *  drawings to the lamp (story-caption.tsx). Set by full-journey.tsx from the walk's own progress. */
  liquidInView: boolean;
};
let snapshot: Snapshot = {
  phase: "intro",
  cinemaStage: "wearing",
  openingStage: "screen",
  openingMoving: false,
  openingMovedAt: 0,
  openingPrepared: false,
  loaderDone: false,
  pageSection: null,
  pageJump: 0,
  cameraMoving: false,
  panelStage: 0,
  pageAtEnd: false,
  pageReturning: false,
  pageEndBox: false,
  revealStage: "slide",
  reviewCamera: false,
  finalCovered: false,
  pageBack: false,
  leavingPage: false,
  liquidInView: false,
};
const listeners = new Set<() => void>();
export const journeyControls = {
  read: () => snapshot,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  update: (next: Partial<Snapshot>) => {
    // Nothing new: keep the same snapshot so subscribed components do not re-render.
    if ((Object.keys(next) as (keyof Snapshot)[]).every((key) => next[key] === snapshot[key])) return;
    snapshot = { ...snapshot, ...next };
    listeners.forEach((listener) => listener());
  },
};
