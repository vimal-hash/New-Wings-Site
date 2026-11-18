import type { WebGLRenderer } from "three";

/** Steps from best to lightest. Scale is of the canvas's own pixels; share is how many of the far threads are drawn. The page finds its step once, before the picture is shown, so the viewer does not watch it change. */
export const STEPS = [
  { scale: 1, samples: 4, share: 1 },
  { scale: 0.85, samples: 4, share: 1 },
  { scale: 0.72, samples: 4, share: 0.85 },
  { scale: 0.72, samples: 2, share: 0.85 },
  { scale: 0.6, samples: 4, share: 0.7 },
  { scale: 0.6, samples: 2, share: 0.6 },
  { scale: 0.5, samples: 2, share: 0.5 },
  { scale: 0.42, samples: 2, share: 0.4 },
];
type QualityStep = (typeof STEPS)[number];

const BUDGET = 12.5; // ms of chip work a frame may take: the browser and the rest of the laptop need the remainder of a 60 Hz frame
const TOO_SLOW = 1000 / 54; // ms a frame may take when the chip has no timer: a 60 Hz screen shows 16.7, a little more is normal
const TEST_SKIP = 3; // frames ignored after a change, while the graphics card catches up
const TEST_READINGS = 6; // chip readings for one step
const TEST_MOST = 60; // frames at most for one step: some laptops lose most of their chip readings, and a choice made without them is too high
const TEST_LONGEST = 6000; // ms for the whole test: a very slow machine still gets a picture
const MIDDLE = 3; // the step used when frames stay slow at every step and the chip gives no reading: smaller pictures did not help, so something else holds the frames back
const TRUST_FROM = 0.5; // ms: below this a chip's timer is not believed, some return nothing useful
const IGNORE_LONGER = 250; // ms: the tab was hidden or the page was stalled by something else
const WINDOW = 60; // frames in one check while watching
const SLOW = 1000 / 49; // ms: an average over this for two windows in a row, with the chip over TROUBLE, is real trouble, like a hot laptop, not a passing hitch
const TROUBLE = BUDGET * 1.2; // ms of chip work: only this much while watching is worth changing the picture for
const WIDEST_START = 1920; // canvas pixels across: wider screens begin the test lower down

type Timer = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };
type Hooks = {
  onChange: (step: QualityStep, index: number) => void;
  onSettled: (index: number) => void;
  onStepDown: (index: number) => void;
  onTest?: (index: number, chipMs: number | null, frameMs: number) => void;
};

/** The first step whose picture is not too wide. */
export function firstStep(canvasWidth: number) {
  const found = STEPS.findIndex((step) => canvasWidth * step.scale <= WIDEST_START);
  return found < 0 ? STEPS.length - 1 : found;
}

const middle = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/**
 * Test: while the canvas is still hidden, draw each step for a few frames and keep the first the chip can hold. No later step is ever climbed to, so the picture does not change while being watched.
 * Slow frames alone never lower the picture: the browser can hold a page at 30 fps with the chip idle, and a smaller picture would not help. Only the chip's own time, lastingly too long, takes it down, and only once. With no chip timer at all, lasting slow frames count instead, also once.
 * `sweep` tests every step and reports them, for the diagnostics report. `timerWhileWatching` is off in diagnostics, where the report's meter uses the same timer, so the picture simply holds there.
 */
export function createQuality(
  gl: WebGLRenderer,
  start: number,
  fixed: boolean,
  hooks: Hooks,
  { sweep, timerWhileWatching }: { sweep: boolean; timerWhileWatching: boolean },
) {
  const context = gl.getContext() as WebGL2RenderingContext;
  const timer = context.getExtension("EXT_disjoint_timer_query_webgl2") as Timer | null;
  let query: WebGLQuery | null = null; // made when first used, as React may dispose and use this again
  const last = STEPS.length - 1;
  let step = start,
    testing = !fixed,
    best = -1,
    startedAt = -1;
  let skip = TEST_SKIP,
    chips: number[] = [],
    times: number[] = [],
    frames = 0,
    stalls = 0,
    quiet = false,
    unexplained = false;
  let open = false,
    waiting = false,
    generation = 0,
    asked = 0;
  let seen = 0,
    sum = 0,
    chipSum = 0,
    chipCount = 0,
    slowWindows = 0,
    dropped = false;
  const timerOn = () => !!timer && (testing || timerWhileWatching);
  const apply = (next: number) => {
    step = next;
    generation++;
    skip = TEST_SKIP;
    chips = [];
    times = [];
    frames = 0;
    seen = sum = chipSum = chipCount = slowWindows = 0;
    hooks.onChange(STEPS[step], step);
  };
  const settle = (index: number) => {
    testing = false;
    if (index !== step) apply(index);
    hooks.onSettled(index);
  };
  return {
    get step() {
      return step;
    },
    get testing() {
      return testing;
    },
    /** Around the frame's drawing. One question to the chip at a time, and it never waits for the answer. */
    begin() {
      if (!timerOn() || waiting) return;
      query ??= context.createQuery();
      {
        context.beginQuery(timer!.TIME_ELAPSED_EXT, query);
        open = true;
        asked = generation;
      }
    },
    end() {
      if (open) {
        context.endQuery(timer!.TIME_ELAPSED_EXT);
        open = false;
        waiting = true;
      }
      if (query && waiting && context.getQueryParameter(query, context.QUERY_RESULT_AVAILABLE)) {
        waiting = false;
        if (asked === generation && !context.getParameter(timer!.GPU_DISJOINT_EXT)) {
          const chipMs = context.getQueryParameter(query, context.QUERY_RESULT) / 1e6;
          if (!testing) {
            chipSum += chipMs;
            chipCount++;
          } else if (skip === 0) chips.push(chipMs);
        }
      }
    },
    frame(milliseconds: number, now: number) {
      if (testing) {
        if (startedAt < 0) startedAt = now;
        const late = now - startedAt > TEST_LONGEST;
        // A long frame at the start is the shaders being prepared. Many in a row is simply a very slow machine.
        if (milliseconds > IGNORE_LONGER && ++stalls < 4 && !late) return;
        if (skip > 0 && !late) {
          skip--;
          return;
        }
        times.push(milliseconds);
        frames++;
        const enough =
          timer && !quiet
            ? chips.length >= TEST_READINGS || frames >= TEST_MOST
            : frames >= TEST_READINGS * 2;
        if (!late && !enough) return;
        const trusted = chips.length >= 2 && middle(chips) >= TRUST_FROM,
          chip = trusted ? middle(chips) : null,
          time = middle(times);
        if (!trusted) quiet = true; // this chip gives no useful answer: the next steps do not wait for one
        const fits = chip !== null ? chip <= BUDGET : time <= TOO_SLOW;
        hooks.onTest?.(step, chip, time);
        if (fits && best < 0) best = step;
        if (late || step >= last || (fits && !sweep)) {
          unexplained = best < 0 && chip === null;
          settle(best >= 0 ? best : chip === null ? MIDDLE : Math.min(last, step + 1));
          return;
        }
        apply(Math.min(last, step + (chip !== null && chip > BUDGET * 2.2 && !sweep ? 2 : 1)));
        return;
      }
      if (fixed || milliseconds > IGNORE_LONGER) return;
      sum += milliseconds;
      if (++seen < WINDOW) return;
      const average = sum / seen,
        chip = chipCount ? chipSum / chipCount : 0;
      seen = sum = chipSum = chipCount = 0;
      // With no sign that the chip is the cause, a smaller picture would not help, so keep it.
      const trouble = average > SLOW && (timer ? chip >= TROUBLE : !unexplained);
      if (!trouble) {
        slowWindows = 0;
        return;
      }
      if (++slowWindows < 2 || step >= last || dropped) return;
      dropped = true;
      apply(step + 1);
      hooks.onStepDown(step);
    },
    dispose() {
      if (query) context.deleteQuery(query);
      query = null;
      open = waiting = false;
    },
  };
}
