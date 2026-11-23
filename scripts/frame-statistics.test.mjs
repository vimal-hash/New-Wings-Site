import test from "node:test";
import assert from "node:assert/strict";
import { createFrameStatistics } from "../components/corridor/frame-statistics.ts";
test("long foreground freezes are retained instead of discarded", () => {
  const clock = createFrameStatistics();
  clock.sample(100);
  clock.sample(113);
  const result = clock.sample(513);
  assert.equal(result.freezes, 1);
  assert.equal(result.stalls, 1);
  assert.equal(result.worstFrame, 400);
  assert.ok(result.fps < 5);
  clock.resetClock();
  assert.equal(clock.sample(10000), null);
  const next = clock.sample(10013);
  assert.equal(next.freezes, 1);
  assert.equal(next.worstFrame, 400);
});

test("frame percentiles and averages expire old gaps, including repeated values", () => {
  const clock = createFrameStatistics();
  const gaps = [];
  let time = 0;
  clock.sample(time);
  for (let frame = 0; frame < 360; frame++) {
    const gap = frame < 120 && frame % 5 === 0 ? 80 : 14 + (frame % 7);
    time += gap;
    gaps.push(gap);
    if (gaps.length > 120) gaps.shift();
    const sorted = [...gaps].sort((a, b) => a - b);
    const result = clock.sample(time);
    assert.equal(result.p95, sorted[Math.ceil(sorted.length * 0.95) - 1]);
    assert.equal(result.frameMs, gaps.reduce((sum, value) => sum + value, 0) / gaps.length);
  }
});
