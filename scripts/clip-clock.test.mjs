import test from "node:test";
import assert from "node:assert/strict";
import { createClipClock } from "../components/corridor/clip-clock.ts";
test("formation and reveal share authored time across a dropped frame and pause only in hidden tabs", () => {
  const clock = createClipClock();
  clock.start(1000);
  assert.equal(clock.elapsed(2000), 1);
  assert.equal(clock.elapsed(3000), 2);
  clock.visibility(3100, true);
  assert.equal(clock.elapsed(8000), 2.1);
  clock.visibility(8100, false);
  assert.equal(clock.elapsed(9000), 3);
  assert.equal(clock.elapsed(10000), 4);
  clock.start(12000);
  assert.equal(clock.elapsed(12000), 0);
});
