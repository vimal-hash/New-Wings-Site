/** Scroll owns the destination; time only smooths toward it, independently of FPS. */
export function revealScrollTarget(current: number, delta: number, viewportHeight: number) {
  return Math.max(0, Math.min(1, current + delta / Math.max(1000, viewportHeight * 1.6)));
}
export function settleReveal(current: number, target: number, seconds: number) {
  const next = current + (target - current) * (1 - Math.exp(-Math.max(0, seconds) / .16));
  return Math.abs(next - target) < .00001 ? target : next;
}
