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
