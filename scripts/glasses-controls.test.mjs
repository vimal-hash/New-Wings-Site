import test from "node:test";
import assert from "node:assert/strict";
import { glassesControls as controls, GLASSES_DEFAULTS } from "../components/corridor/glasses-controls.ts";
test("glasses controls clamp distances outside the camera near plane and reject invalid input", () => {
  controls.reset();
  controls.set("distance", 0);
  assert.equal(controls.read().distance, 8);
  controls.set("distance", 1000);
  assert.equal(controls.read().distance, 80);
  controls.set("distance", NaN);
  assert.equal(controls.read().distance, 80);
  controls.set("width", 200);
  assert.equal(controls.read().width, 140);
  controls.set("width", 0);
  assert.equal(controls.read().width, 40);
  controls.set("gap", 0);
  assert.equal(controls.read().gap, 2);
  controls.set("gap", 200);
  assert.equal(controls.read().gap, 100);
  controls.set("tint", -1);
  assert.equal(controls.read().tint, 0);
  controls.set("size", 500);
  assert.equal(controls.read().size, 180);
  controls.set("height", -99);
  assert.equal(controls.read().height, -30);
  controls.set("lockWidth", false);
  assert.equal(controls.read().lockWidth, false);
  controls.reset();
  assert.deepEqual(controls.read(), GLASSES_DEFAULTS);
});
test("glasses drafts survive reload, including independent blur, bridge and width settings", () => {
  let saved = "";
  const storage = {
    setItem: (_, v) => {
      saved = v;
    },
    getItem: () => saved,
  };
  controls.set("distance", 35);
  controls.set("width", 110);
  controls.set("gap", 12);
  controls.set("blur", 24);
  controls.set("bridge", 0.16);
  controls.set("tint", 0.5);
  controls.set("size", 130);
  controls.set("height", 10);
  controls.set("lockWidth", false);
  const expected = { ...controls.read() };
  assert.equal(controls.save(storage), true);
  controls.reset();
  controls.load(storage);
  assert.deepEqual(controls.read(), expected);
  controls.reset();
});
test("older glasses drafts keep the approved width default", () => {
  controls.reset();
  controls.load({ getItem: () => JSON.stringify({ distance: 20, blur: 16 }) });
  assert.equal(controls.read().width, GLASSES_DEFAULTS.width);
  assert.equal(controls.read().gap, 8);
  assert.equal(controls.read().size, GLASSES_DEFAULTS.size);
  assert.equal(controls.read().height, GLASSES_DEFAULTS.height);
  assert.equal(controls.read().distance, 20);
  controls.reset();
});

test("split blur migration adopts 5/8 while preserving the existing fit and lens tint", () => {
  controls.reset();
  controls.load({
    getItem: () =>
      JSON.stringify({ distance: 12, width: 108, blur: 33, tint: 0.38, height: 3, lockWidth: true }),
  });
  assert.equal(controls.read().blur, 5);
  assert.equal(controls.read().innerBlur, 8);
  assert.equal(controls.read().distance, 12);
  assert.equal(controls.read().width, 108);
  assert.equal(controls.read().tint, 0.38);
  assert.equal(controls.read().height, 3);
  controls.reset();
});

test("independent inner blur edits survive later refreshes without resetting the approved profile", () => {
  let saved = "";
  const storage = {
    setItem: (_, v) => {
      saved = v;
    },
    getItem: () => saved,
  };
  controls.reset();
  controls.set("blur", 0);
  controls.set("innerBlur", 11);
  controls.save(storage);
  controls.reset();
  controls.load(storage);
  assert.equal(controls.read().blur, 0);
  assert.equal(controls.read().innerBlur, 11);
  controls.set("innerBlur", 100);
  assert.equal(controls.read().innerBlur, 40);
  controls.reset();
});
