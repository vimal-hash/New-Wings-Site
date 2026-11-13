/** Draw at the screen's density up to each tier's pixel budget. */
import type { EffectQuality } from "./effect-quality";

/** Drawing-buffer budgets apply to the main scene, including phone and tablet layouts. */
export const RESOLUTION = {
  desktop: { cap: 2, budget: 6.2e6, base: 1.25 },
  laptop: { cap: 2, budget: 4.2e6, base: 1.25 },
  mobile: { cap: 1.65, budget: 1.1e6, base: 1 },
  /** Never below one device pixel per CSS pixel unless the screen itself is lower. */
  floor: 1,
  /** Each slow window lowers the resolution by this factor. */
  step: .85,
  /** Frames per evaluation window, and the median frame time that counts as slow (≈ 58 fps). */
  window: 90,
  slowMs: 1000 / 58,
  /** A step counts as helping only if the next window's median frame is at least 10% shorter. */
  helped: .9,
} as const;

export function targetDpr(tier: EffectQuality, width: number, height: number, deviceDpr: number) {
  const { cap, budget, base } = RESOLUTION[tier], device = Math.max(.5, deviceDpr || 1);
  const byBudget = Math.sqrt(budget / Math.max(1, width * height));
  return Math.max(Math.min(base, device), Math.min(device, cap, byBudget));
}

/** A sharper eye is an optional single trial at its settled camera stop. */
export function mobileEyeDpr(width:number,height:number,deviceDpr:number){
  return Math.min(deviceDpr,1.85,Math.sqrt(1.5e6/Math.max(1,width*height)));
}

/** One-way adaptive scale: a sustained slow median lowers it, never a single stall (shader compile, upload).
 *  Every step is checked: if the next window is not clearly faster, the frames were not limited by pixels
 *  (a 30 fps cap such as iPhone Low Power Mode or Chrome Energy Saver, or CPU work), so the step is undone and
 *  the governor stops. Lowering would only have blurred the picture. */
export function createResolutionGovernor() {
  const gaps: number[] = [];
  let scale = 1, last = 0, cooldownUntil = 0, strikes = 0, before = 0, previous = 1, locked = false;
  return {
    get scale() { return scale; },
    get locked() { return locked; },
    /** Returns true when the scale changed. `now` is the frame time in ms. */
    sample(now: number, minScale: number) {
      const gap = last ? now - last : 0; last = now;
      if (locked || gap <= 0 || gap > 100 || now < cooldownUntil) return false; // idle gaps and resize hitches are not load
      gaps.push(gap); if (gaps.length < RESOLUTION.window) return false;
      const median = [...gaps].sort((a, b) => a - b)[gaps.length >> 1]; gaps.length = 0;
      if (before) {
        const helped = median < before * RESOLUTION.helped; before = 0;
        if (!helped) { scale = previous; locked = true; return true; }
      }
      // Two slow windows in a row (about three seconds of motion), so a loading burst cannot lower it for good.
      strikes = median > RESOLUTION.slowMs ? strikes + 1 : 0;
      if (strikes < 2 || scale <= minScale) return false;
      previous = scale; before = median;
      scale = Math.max(minScale, scale * RESOLUTION.step); cooldownUntil = now + 1500; strikes = 0;
      return true;
    },
    resetClock() { last = 0; },
  };
}
