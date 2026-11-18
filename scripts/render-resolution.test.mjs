import test from "node:test";
import assert from "node:assert/strict";
import {
  createResolutionGovernor,
  mobileEyeDpr,
  RESOLUTION,
  targetDpr,
} from "../components/corridor/render-resolution.ts";

/** Feed `count` frames of `ms` each; returns the time reached and how often the scale changed. */
const feed = (g, from, ms, count, minScale = 0.5) => {
  let t = from,
    changes = 0;
  for (let i = 0; i < count; i++) {
    t += ms;
    if (g.sample(t, minScale)) changes++;
  }
  return { t, changes };
};

test("device targets stay within the main scene pixel budget and the phone eye can use its own budget", () => {
  assert.equal(targetDpr("mobile", 390, 844, 3), 1.65);
  assert.equal(mobileEyeDpr(432, 838, 2.5), 1.85);
  assert.equal(mobileEyeDpr(432, 838, 1.5), 1.5);
  assert.ok(mobileEyeDpr(1024, 1366, 2) < 1.04);
  assert.ok(targetDpr("mobile", 1024, 1366, 2) < 1.01);
  assert.ok(Math.abs(targetDpr("laptop", 1512, 982, 2) - 1.68) < 0.01);
  assert.equal(targetDpr("desktop", 1920, 1080, 1), 1);
  assert.equal(targetDpr("laptop", 3840, 2160, 2), 1.25);
});

test("a single stall never lowers the resolution", () => {
  const g = createResolutionGovernor();
  let r = feed(g, 0, 8, 200);
  assert.equal(g.sample(r.t + 90, 0.5), false); // a 90 ms compile hitch is ignored
  r = feed(g, r.t + 90, 8, 400);
  assert.equal(r.changes, 0);
  assert.equal(g.scale, 1);
});

test("a frame-rate cap (30 fps, e.g. Low Power Mode) lowers once, sees no gain, restores and stops", () => {
  const g = createResolutionGovernor();
  const r = feed(g, 0, 33.3, RESOLUTION.window * 6);
  assert.equal(g.scale, 1);
  assert.equal(g.locked, true);
  assert.equal(r.changes, 2);
});

test("pixel-bound slowness keeps lowering while each step helps", () => {
  // 60 ms frames whose cost follows pixel count (scale²): several steps each help, then it settles under budget.
  const g = createResolutionGovernor();
  let t = 0,
    ms = 60;
  for (let i = 0; i < RESOLUTION.window * 60; i++) {
    const s = g.scale;
    t += ms;
    if (g.sample(t, 0.5)) ms *= (g.scale / s) ** 2;
  }
  assert.ok(g.scale < 0.6, "scale " + g.scale);
  assert.equal(g.locked, false);
  assert.ok(ms < RESOLUTION.slowMs);
});
