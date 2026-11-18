import test from "node:test";
import assert from "node:assert/strict";
import {
  createDiagonalSectionState,
  diagonalSectionClip,
} from "../components/corridor/diagonal-section-state.ts";
import { diagonalEyeZoom } from "../components/corridor/diagonal-transition.ts";

test("section enters at bottom-right, has a diagonal boundary, and completely covers either viewport", () => {
  for (const [width, height] of [
    [1920, 945],
    [390, 844],
  ]) {
    const edges = (p) =>
      [...diagonalSectionClip(p, width, height).matchAll(/(-?[\d.]+)%/g)].map((m) => Number(m[1]));
    const start = edges(0),
      middle = edges(0.5),
      end = edges(1);
    assert.ok(start[0] > 100);
    assert.equal(start[2], 100);
    assert.ok(middle[0] > middle[2] && middle[0] < 100 && middle[2] > 0);
    assert.equal(end[0], 0);
    assert.ok(end[2] < 0);
  }
});

test("the approach stays small, reversible, and independent of frame rate", () => {
  assert.equal(diagonalEyeZoom(0), 1);
  assert.equal(diagonalEyeZoom(1), 1.1);
  let previous = 1;
  for (let i = 0; i <= 100; i++) {
    const zoom = diagonalEyeZoom(i / 100);
    assert.ok(zoom >= previous && zoom <= 1.1);
    previous = zoom;
  }
  const slow = createDiagonalSectionState(),
    fast = createDiagonalSectionState();
  slow.seek(0.55);
  fast.seek(0.55);
  for (let i = 0; i < 30; i++) slow.tick(1 / 60);
  for (let i = 0; i < 60; i++) fast.tick(1 / 120);
  assert.ok(Math.abs(slow.read().progress - fast.read().progress) < 1e-12);
  assert.ok(slow.read().progress < 0.55); // Smooth settling continues after release.
  slow.seek(0);
  for (let i = 0; i < 150; i++) slow.tick(1 / 60);
  assert.equal(diagonalEyeZoom(slow.read().progress), 1);
});

test("one step sweeps the whole section in, one sweeps it out; it lands softly, never overshoots, and can sleep", () => {
  const a = createDiagonalSectionState();
  assert.equal(a.step(1), true);
  let previous = 0,
    firstMove = 0,
    settledAt = 0;
  for (let i = 1; i <= 180; i++) {
    const shot = a.tick(1 / 60);
    if (i === 1) firstMove = shot.progress;
    if (i === 90) assert.ok(shot.progress > 0.98, "all but there after 1.5 s");
    assert.ok(shot.progress >= previous && shot.progress <= 1, "only forwards, never past the end");
    previous = shot.progress;
    if (!settledAt && !shot.moving) settledAt = i / 60;
  }
  assert.ok(firstMove < 0.01, "it starts softly");
  assert.ok(settledAt > 1.5 && settledAt < 2.4, `rests after the edge has left the screen (${settledAt})`);
  assert.equal(a.read().covered, true);
  assert.equal(a.tick(1 / 60).moving, false);
  assert.equal(a.step(1), true, "more steps forward stay with the covered section");
  assert.equal(a.step(0), true, "the rest of a gesture too");
  assert.equal(a.step(-1), true);
  for (let i = 0; i < 180; i++) a.tick(1 / 60);
  assert.deepEqual(a.read(), { progress: 0, target: 0, covered: false });
  assert.equal(a.step(-1), false, "a step back from the bare eye goes on to the journey");
  a.step(1);
  assert.equal(a.tick(1 / 60, true).progress, 1);
  a.reset();
  assert.equal(a.read().progress, 0);
});

test("a step the other way mid-sweep turns it round without a jump", () => {
  const a = createDiagonalSectionState();
  a.step(1);
  for (let i = 0; i < 30; i++) a.tick(1 / 60);
  const middle = a.read().progress;
  assert.ok(middle > 0.2 && middle < 0.9);
  a.step(-1);
  const next = a.tick(1 / 60).progress;
  assert.ok(Math.abs(next - middle) < 0.05, "it carries on from where it was");
  for (let i = 0; i < 200; i++) assert.ok(a.tick(1 / 60).progress >= 0);
  assert.equal(a.read().progress, 0);
});
