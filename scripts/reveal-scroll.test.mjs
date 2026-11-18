import test from "node:test";
import assert from "node:assert/strict";
import { revealScrollTarget, settleReveal } from "../components/corridor/reveal-scroll.ts";
test("scroll destination clamps and reverses from either end", () => {
  assert.equal(revealScrollTarget(0.9, 10000, 844), 1);
  assert.equal(revealScrollTarget(0.1, -10000, 844), 0);
  assert.ok(revealScrollTarget(1, -180, 844) < 1);
  assert.ok(revealScrollTarget(0, 180, 844) > 0);
});
test("smoothing is independent of refresh rate and never overshoots", () => {
  const run = (hz) => {
    let p = 0;
    for (let i = 0; i < hz; i++) p = settleReveal(p, 0.8, 1 / hz);
    return p;
  };
  assert.ok(Math.abs(run(30) - run(120)) < 1e-10);
  let p = 0.8;
  for (let i = 0; i < 500; i++) {
    p = settleReveal(p, 0.2, 1 / 60);
    assert.ok(p >= 0.2 && p <= 0.8);
  }
  assert.equal(p, 0.2);
});
