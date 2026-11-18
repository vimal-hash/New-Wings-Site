/** Scroll distance is independent of event/frame frequency. One viewport reveals
 * one blank viewport; the extra diagonal cap belongs to the moving boundary. */
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
export function createDiagonalSectionState() {
  let progress = 0,
    target = 0;
  return {
    read: () => ({ progress, target, covered: progress === 1 }),
    move(delta: number, height: number) {
      if (Number.isFinite(delta)) target = Math.max(0, Math.min(1, target + delta / Math.max(1, height)));
    },
    seek(value: number) {
      target = Math.max(0, Math.min(1, value));
    },
    tick(seconds: number, reduce = false) {
      // A short, time-based coast after input ends; never a timed autoplay.
      progress = reduce
        ? target
        : progress + (target - progress) * (1 - Math.exp(-Math.max(0, seconds) / 0.18));
      if (Math.abs(target - progress) < 0.0001) progress = target;
      return { progress, moving: progress !== target, covered: progress === 1 };
    },
    reset() {
      progress = target = 0;
    },
  };
}
