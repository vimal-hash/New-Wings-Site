/** One display timestamp for everything drawn in this frame, regardless of callback order or CPU load. */
export function frameTime() {
  const time = typeof document !== "undefined" ? document.timeline?.currentTime : null;
  return typeof time === "number" ? time : performance.now();
}

/** A dropped frame does not slow the authored clip; time spent in a hidden tab is paused. */
export function createClipClock() {
  let start = 0,
    pausedAt: number | null = null;
  return {
    start(now: number, hidden = false) {
      start = now;
      pausedAt = hidden ? now : null;
    },
    visibility(now: number, hidden: boolean) {
      if (hidden && pausedAt === null) pausedAt = now;
      else if (!hidden && pausedAt !== null) {
        start += now - pausedAt;
        pausedAt = null;
      }
    },
    elapsed(now: number) {
      return Math.max(0, ((pausedAt ?? now) - start) / 1000);
    },
  };
}
