/** Browser cadence includes long foreground pauses; idle WebGL is measured separately. */
export function createFrameStatistics() {
  const windowSize = 120;
  const samples = new Float64Array(windowSize);
  const sorted = new Float64Array(windowSize);
  let count = 0,
    next = 0,
    sum = 0,
    last: number | null = null,
    worst = 0,
    stalls = 0,
    freezes = 0;
  return {
    resetClock() {
      last = null;
    },
    sample(time: number) {
      const gap = last === null ? 0 : time - last;
      last = time;
      if (gap <= 0) return null;
      // Only one value changes per frame. Move that slot to its sorted position
      // so the exact percentile stays available without copying and sorting the window.
      let slot = count;
      if (count === windowSize) {
        const expired = samples[next];
        sum -= expired;
        slot = sorted.indexOf(expired);
      } else {
        count++;
      }
      while (slot > 0 && sorted[slot - 1] > gap) {
        sorted[slot] = sorted[slot - 1];
        slot--;
      }
      while (slot + 1 < count && sorted[slot + 1] < gap) {
        sorted[slot] = sorted[slot + 1];
        slot++;
      }
      sorted[slot] = gap;
      samples[next] = gap;
      next = (next + 1) % windowSize;
      sum += gap;
      worst = Math.max(worst, gap);
      if (gap > 50) stalls++;
      if (gap >= 250) freezes++;
      const mean = sum / count;
      return {
        gap,
        fps: 1000 / mean,
        frameMs: mean,
        p95: sorted[Math.ceil(count * 0.95) - 1],
        worstFrame: worst,
        stalls,
        freezes,
      };
    },
  };
}
