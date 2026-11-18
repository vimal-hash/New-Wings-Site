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

test("wheel distance is reversible and independent of input event frequency; full cover can sleep", () => {
  const a = createDiagonalSectionState(),
    b = createDiagonalSectionState();
  a.move(945, 945);
  for (let i = 0; i < 9; i++) b.move(105, 945);
  for (let i = 0; i < 150; i++) {
    a.tick(1 / 60);
    b.tick(1 / 60);
  }
  assert.deepEqual(a.read(), b.read());
  assert.equal(a.read().covered, true);
  assert.equal(a.tick(1 / 60).moving, false);
  a.move(-945, 945);
  for (let i = 0; i < 150; i++) a.tick(1 / 60);
  assert.deepEqual(a.read(), { progress: 0, target: 0, covered: false });
  a.move(2000, 945);
  assert.equal(a.tick(1 / 60, true).progress, 1);
  a.reset();
  assert.equal(a.read().progress, 0);
});
