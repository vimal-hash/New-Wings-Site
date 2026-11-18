import test from "node:test";
import assert from "node:assert/strict";
import { createScrollSteps, keyDirection, SCROLL, wheelPixels } from "../components/corridor/scroll-step.ts";

// A run of events, one every `every` ms from `at`: returns the steps they made.
const feed = (steps, pixels, { at = 0, every = 16 } = {}) =>
  pixels.map((value, i) => steps.push(value, at + i * every)).filter(Boolean);

test("one mouse-wheel notch is one step, whatever the mouse sends", () => {
  for (const notch of [40, 53, 100, 120]) {
    const steps = createScrollSteps();
    assert.deepEqual(feed(steps, [notch]), [1]);
    assert.deepEqual(feed(steps, [-notch], { at: 1000 }), [-1]);
  }
});

test("a long trackpad swipe and its momentum make one step", () => {
  const steps = createScrollSteps();
  const swipe = [2, 4, 8, 14, 22, 30, 36, 40, 38, 34, 28, 22, 18, 14, 10, 8, 6, 4, 3, 2, 1, 1];
  const momentum = Array.from({ length: 90 }, (_, i) => Math.max(1, Math.round(30 * Math.exp(-i / 25))));
  assert.deepEqual(feed(steps, [...swipe, ...momentum]), [1]);
});

test("a nudge under one step moves nothing", () => {
  const steps = createScrollSteps();
  assert.deepEqual(feed(steps, [4, 6, 5, 4, 3]), []);
  assert.ok(4 + 6 + 5 + 4 + 3 < SCROLL.step);
});

test("a new gesture needs a pause, a turn the other way, or a new touch", () => {
  const steps = createScrollSteps();
  assert.deepEqual(feed(steps, [100]), [1]);
  assert.deepEqual(feed(steps, [100], { at: SCROLL.gap - 20 }), [], "too soon: the same gesture");
  assert.deepEqual(feed(steps, [100], { at: 2 * SCROLL.gap + 40 }), [1], "after a pause: a new one");
  assert.deepEqual(feed(steps, [-12, -12, -12], { at: 2 * SCROLL.gap + 60, every: 8 }), [-1], "turning round");
  steps.touch(2000);
  assert.deepEqual(feed(steps, [10, 10, 10, 10], { at: 2001 }), [1]);
  steps.release(2070);
  steps.touch(2080);
  assert.deepEqual(feed(steps, [20, 20], { at: 2081 }), [1], "a new touch straight after is a new gesture");
});

test("a finger held still keeps its gesture; lifting it ends it", () => {
  const steps = createScrollSteps();
  steps.touch(0);
  assert.deepEqual(feed(steps, [40], { at: 1 }), [1]);
  assert.deepEqual(feed(steps, [40], { at: 1000 }), [], "still the same touch, however long it rests");
  steps.release(1100);
  assert.deepEqual(feed(steps, [5, 5], { at: 1110 }), [], "what the release leaves behind moves nothing");
});

test("one key press is one step; holding it makes no more", () => {
  const steps = createScrollSteps();
  assert.equal(steps.key(1, false, 0), 1);
  assert.equal(steps.key(1, true, 30), 0);
  assert.equal(steps.key(1, true, 60), 0);
  assert.equal(steps.key(-1, false, 100), -1);
  assert.equal(steps.key(0, false, 200), 0);
  assert.equal(keyDirection({ key: "ArrowDown" }), 1);
  assert.equal(keyDirection({ key: " ", shiftKey: false }), 1);
  assert.equal(keyDirection({ key: " ", shiftKey: true }), -1);
  assert.equal(keyDirection({ key: "PageUp" }), -1);
  assert.equal(keyDirection({ key: "Tab" }), 0);
});

test("wheel lines and pages count in pixels", () => {
  assert.equal(wheelPixels({ deltaY: 3, deltaMode: 1 }, 800), 48);
  assert.equal(wheelPixels({ deltaY: 1, deltaMode: 2 }, 800), 800);
  assert.equal(wheelPixels({ deltaY: -100, deltaMode: 0 }, 800), -100);
});
