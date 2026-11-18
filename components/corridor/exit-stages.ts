import { revealScrollTarget, settleReveal } from "./reveal-scroll";
export type ExitStage = "slide" | "top" | "turn" | "turned" | "pullback" | "done";
/** View 1 is the top of the climb. Coming back from the page sections the camera holds there this long, then turns to
 *  View 2 by itself (the user, 2026-11-16: no scroll for the turn). */
export const TOP_HOLD = 1;
const TURN_SECONDS = 1.4,
  PULLBACK_SECONDS = 4.5;
/** The slide flows into the turn; a fresh gesture starts the final pullback. Scrolling back plays each leg in reverse
 *  (the user, 2026-11-18): the final eye pulls back in to View 2, and View 2 turns back up to the top of the slide,
 *  where the camera goes back down to Section 4 (`descend`, run by FullJourney). */
export function createExitStages() {
  let stage: ExitStage = "slide",
    progress = 0,
    target = 0,
    elapsed = 0,
    wokeAt = -Infinity,
    autoTurn = false,
    back = false,
    descend = false;
  return {
    reset(seed = 0, start = 0) {
      stage = "slide";
      progress = Math.min(1, start);
      target = Math.min(1, seed);
      elapsed = 0;
      wokeAt = -Infinity;
      autoTurn = false;
      back = descend = false;
    },
    // Temporary review shortcuts; scrolling continues from the selected stop. View 1 rests at the top (no automatic turn).
    preview(view: "slide" | "turned" | "done") {
      stage = view === "slide" ? "top" : view;
      progress = target = 1;
      elapsed = 0;
      wokeAt = -Infinity;
      autoTurn = false;
      back = descend = false;
    },
    /** The return from the page sections has reached the top: hold, then turn to View 2 without any input. */
    arrive() {
      stage = "top";
      progress = target = 1;
      elapsed = 0;
      wokeAt = -Infinity;
      autoTurn = true;
      back = descend = false;
    },
    /** True while a leg plays backwards. */
    get back() {
      return back;
    },
    /** delta: the scroll in pixels (the review slide follows it). step: +1/-1 when a gesture has made one step
     *  (scroll-step.ts), else 0. */
    input(delta: number, now: number, height: number, step: -1 | 0 | 1 = 0) {
      if (stage === "slide" && !descend) {
        if (progress === target) wokeAt = now;
        target = revealScrollTarget(target, delta, height);
        return;
      }
      // The hold, the turns, the pullbacks and the way down ignore input, so nothing is skipped.
      if (!step || descend || autoTurn || stage === "turn" || stage === "pullback") return;
      if (step > 0 && stage === "top") {
        stage = "turn";
        elapsed = progress = 0;
        wokeAt = now;
      } else if (step > 0 && stage === "turned") {
        stage = "pullback";
        elapsed = progress = 0;
        wokeAt = now;
      } else if (step < 0 && stage === "done") {
        // Back from the final eye: the pullback in reverse, to View 2.
        stage = "pullback";
        back = true;
        elapsed = 0;
        progress = 1;
        wokeAt = now;
      } else if (step < 0 && stage === "turned") {
        // Back from View 2: the turn in reverse, up to the top of the slide; then down to Section 4.
        stage = "turn";
        back = true;
        elapsed = 0;
        progress = 1;
        wokeAt = now;
      }
    },
    tick(seconds: number, now: number, reduce = false) {
      // The first demand frame may arrive after seconds of resting. Only time
      // since the input that woke this shot belongs to its animation clock.
      seconds = Math.min(seconds, Math.max(0, (now - wokeAt) / 1000));
      wokeAt = -Infinity;
      let descending = false;
      if (stage === "slide" && !descend) {
        progress = reduce ? target : settleReveal(progress, target, seconds);
        // sampleSlide(1) and sampleTurn(0) are the identical camera pose.
        // No idle frame, timeout or extra gesture at this boundary.
        if (progress === 1) {
          stage = "turn";
          progress = 0;
          elapsed = 0;
        }
      } else if (stage === "top" && autoTurn) {
        // The turn begins exactly at the end of the hold; any time past it already belongs to the turn.
        elapsed += seconds;
        if (elapsed >= TOP_HOLD) {
          stage = "turn";
          progress = 0;
          autoTurn = false;
          elapsed -= TOP_HOLD;
          progress = reduce ? 1 : Math.min(1, elapsed / TURN_SECONDS);
          if (progress === 1) stage = "turned";
        }
      } else if ((stage === "turn" || stage === "pullback") && back) {
        elapsed += seconds;
        progress = reduce ? 0 : Math.max(0, 1 - elapsed / (stage === "turn" ? TURN_SECONDS : PULLBACK_SECONDS));
        if (progress === 0) {
          back = false;
          if (stage === "pullback") {
            stage = "turned";
            progress = 1;
          } else {
            // sampleTurn(0) is the top of the slide: from here FullJourney takes the camera down to Section 4.
            stage = "top";
            progress = 1;
            descend = descending = true;
          }
        }
      } else if (stage === "turn" || stage === "pullback") {
        elapsed += seconds;
        progress = reduce ? 1 : Math.min(1, elapsed / (stage === "turn" ? TURN_SECONDS : PULLBACK_SECONDS));
        if (progress === 1) stage = stage === "turn" ? "turned" : "done";
      }
      return {
        stage,
        progress,
        /** True on the one tick the turn back reaches the top: the way down to Section 4 starts now. */
        descending,
        moving:
          stage === "turn" ||
          stage === "pullback" ||
          (stage === "slide" && progress !== target) ||
          (stage === "top" && autoTurn),
      };
    },
  };
}
