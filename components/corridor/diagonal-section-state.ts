/** The section's diagonal top edge at a progress: 0 just below the bottom-right corner, 1 covering the whole view; the
 * extra diagonal cap belongs to the moving boundary. */
export function diagonalSectionClip(progress: number, width: number, height: number, featherMargin = 0) {
  const p = Math.max(0, Math.min(1, progress));
  const slant = Math.min(24, (Math.max(0, width) / Math.max(1, height)) * 16);
  const pad =
    ((Math.max(0, featherMargin) *
      Math.hypot(1, ((slant / 100) * Math.max(1, height)) / Math.max(1, width))) /
      Math.max(1, height)) *
    100;
  const right = 100 - (100 + slant) * p - pad,
    left = (100 + slant) * (1 - p) - pad;
  return `polygon(0 ${left}%, 100% ${right}%, 100% 100%, 0 100%)`;
}

/** Soft alpha boundary only; the white section and the scene stay sharp. */
export function diagonalSectionMask(progress: number, width: number, height: number, feather: number) {
  const p = Math.max(0, Math.min(1, progress)),
    amount = Math.max(0, Math.min(240, feather));
  if (!amount || p === 0 || p === 1) return "none";
  const slant = Math.min(Math.max(1, height) * 0.24, Math.max(0, width) * 0.16);
  const angle = 180 - (Math.atan2(slant, Math.max(1, width)) * 180) / Math.PI;
  const stops = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map((t) => {
    // Flat shoulders keep a broad grey veil from lingering over the eye.
    const alpha = t * t * t * (t * (t * 6 - 15) + 10),
      offset = amount * (t - p);
    return `rgba(0,0,0,${alpha.toFixed(3)}) calc(${((1 - p) * 100).toFixed(5)}% ${
      offset < 0 ? "-" : "+"
    } ${Math.abs(offset).toFixed(3)}px)`;
  });
  return `linear-gradient(${angle.toFixed(5)}deg, ${stops.join(", ")})`;
}
/** rad/s of the sweep's spring: half way .4 s, 90% .9 s, 98% 1.3 s, at rest 2.1 s after the step. */
export const DIAGONAL_SWEEP = 4.4;

/** The white section's sweep (the user, 2026-11-18: one scroll rule for the whole site). One step of the site's scroll
 *  (scroll-step.ts) sends it all the way in, or all the way back out, on a critically damped spring: it starts and lands
 *  softly with no overshoot, and is solved exactly, so it runs the same at any frame rate. A step back from the bare eye
 *  is not the section's: it goes on to the journey (the camera back to View 2). */
export function createDiagonalSectionState() {
  let progress = 0,
    velocity = 0,
    target = 0;
  return {
    read: () => ({ progress, target, covered: progress === 1 }),
    /** One step: 1 in, -1 out, 0 the rest of a gesture. False when the step is not the section's. */
    step(way: number) {
      if (!way) return true;
      if (way < 0 && target === 0 && progress === 0) return false;
      target = way > 0 ? 1 : 0;
      return true;
    },
    seek(value: number) {
      target = Math.max(0, Math.min(1, value));
    },
    tick(seconds: number, reduce = false) {
      const dt = Math.max(0, seconds);
      if (reduce) {
        progress = target;
        velocity = 0;
      } else {
        const fall = Math.exp(-DIAGONAL_SWEEP * dt),
          offset = progress - target,
          carry = velocity + DIAGONAL_SWEEP * offset;
        progress = Math.max(0, Math.min(1, target + (offset + carry * dt) * fall));
        velocity = (velocity - DIAGONAL_SWEEP * carry * dt) * fall;
        // A thousandth of the sweep from the end, the moving edge is already off screen (the feather too): land.
        if (Math.abs(target - progress) < 1e-3 && Math.abs(velocity) < 2e-2) {
          progress = target;
          velocity = 0;
        }
      }
      return { progress, moving: progress !== target, covered: progress === 1 };
    },
    reset() {
      progress = target = velocity = 0;
    },
  };
}
