import test from "node:test";
import assert from "node:assert/strict";
import { createLensControls, cleanLensValues, LENS_DEFAULTS } from "../components/corridor/lens-controls.ts";
import {
  createLensMotion,
  projectBrandPlane,
  lensZoom,
  viewOneLensWeight,
} from "../components/corridor/lens-motion.ts";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as Three from "three";
import * as lensModule from "../components/corridor/lens-controls.ts";
import * as motionModule from "../components/corridor/lens-motion.ts";

test("camera presets are independent, validated, persistent and individually resettable", () => {
  const a = createLensControls();
  a.set("view1", "fov", 31);
  a.set("brand", "squeeze", 1.25);
  assert.equal(a.read().presets.brand.fov, 40);
  assert.equal(a.read().presets.view1.squeeze, 1.05);
  const data = new Map(),
    storage = { getItem: (k) => data.get(k) || null, setItem: (k, v) => data.set(k, v) };
  a.save(storage);
  const b = createLensControls();
  b.load(storage);
  assert.deepEqual(a.read().presets, b.read().presets);
  b.reset("view1");
  assert.equal(b.read().presets.view1.fov, 65);
  assert.equal(b.read().presets.view1.squeeze, 1.05);
  assert.equal(b.read().presets.brand.squeeze, 1.25);
  const safe = cleanLensValues({ fov: 999, squeeze: NaN, response: -10, living: "false" });
  assert.equal(safe.fov, 65);
  assert.equal(safe.squeeze, 1);
  assert.equal(safe.response, 0.06);
  assert.equal(safe.living, true);
});
test("neutral brand lens preserves authored placement across sizes and depths", () => {
  const still = { x: 0, y: 0, roll: 0 };
  for (const [w, h] of [
    [1920, 945],
    [1366, 768],
    [390, 844],
  ])
    for (const depth of [-0.35, -0.2, 0, 0.14]) {
      const p = projectBrandPlane(w * 0.2, h * 0.7, w, h, depth, LENS_DEFAULTS, still, 1);
      assert.ok(Math.abs(p.x) + Math.abs(p.y) < 1e-10);
      assert.equal(p.sx, 1);
      assert.equal(p.sy, 1);
      assert.equal(p.roll, 0);
    }
  assert.equal(lensZoom(40), 1);
  assert.ok(lensZoom(30) > 1);
});
test("depth changes parallax while the centred brand remains anchored; squeeze changes width only", () => {
  const v = { ...LENS_DEFAULTS, squeeze: 1.25 },
    m = { x: 1, y: 0, roll: 0 };
  const far = projectBrandPlane(500, 400, 1000, 800, -0.35, v, m, 1),
    near = projectBrandPlane(500, 400, 1000, 800, 0.14, v, m, 1),
    logo = projectBrandPlane(500, 400, 1000, 800, 0, v, m, 1);
  assert.ok(far.x > 0 && near.x < 0);
  assert.equal(logo.x, 0);
  assert.equal(logo.sx, 0.8);
  assert.equal(logo.sy, 1);
});
test("living motion eases consistently at 60 and 120 Hz and sleeps when disabled/reduced", () => {
  const values = { ...LENS_DEFAULTS, sway: 0 };
  const run = (hz) => {
    const rig = createLensMotion();
    rig.pointer(1, 0.4);
    let result;
    for (let i = 0; i < hz; i++) result = rig.tick(1 / hz, values);
    return result;
  };
  assert.ok(Math.abs(run(60).x - run(120).x) < 1e-10);
  const rig = createLensMotion();
  rig.pointer(1, 1);
  assert.equal(rig.tick(0.016, values, true).moving, false);
  assert.equal(rig.tick(0.016, { ...values, living: false }).x, 0);
});
test("View 1 lens eases in from the corridor and out continuously before View 2", () => {
  assert.equal(viewOneLensWeight("slide", 0), 0);
  assert.equal(viewOneLensWeight("slide", 0.985), 1);
  assert.equal(viewOneLensWeight("slide", 1), 1);
  assert.equal(viewOneLensWeight("turn", 0), 1);
  assert.equal(viewOneLensWeight("turn", 1), 0);
  let previous = 0;
  for (let i = 0; i <= 100; i++) {
    const current = viewOneLensWeight("slide", i / 100);
    assert.ok(current >= previous);
    previous = current;
  }
  assert.ok(viewOneLensWeight("slide", 0.0001) < 1e-8);
  assert.ok(1 - viewOneLensWeight("slide", 0.9849) < 1e-8);
  for (const stage of ["turned", "pullback", "done", "intro"]) assert.equal(viewOneLensWeight(stage, 0.4), 0);
  assert.equal(viewOneLensWeight("turn", 0.5), 0.5);
});

test("real Three camera applies the lens once per authored pose and leaves other shots untouched", () => {
  const code = ts.transpileModule(
    readFileSync(new URL("../components/corridor/view-one-lens.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  const loaded = { exports: {} };
  let baseline = false;
  const dependencies = {
    three: Three,
    "./lens-controls": lensModule,
    "./lens-motion": motionModule,
    "./cinema-controls": { cinemaControls: { read: () => ({ baseline }) } },
  };
  new Function("require", "module", "exports", code)((id) => dependencies[id], loaded, loaded.exports);
  const rig = loaded.exports.createViewOneLens(),
    camera = new Three.PerspectiveCamera(40, 16 / 9, 0.1, 1200);
  lensModule.lensControls.set("view1", "fov", 30);
  lensModule.lensControls.set("view1", "squeeze", 1.2);
  const pose = () => {
    camera.position.set(10, 20, 200);
    camera.lookAt(0, 0, 0);
    camera.fov = 40;
    camera.updateProjectionMatrix();
  };
  pose();
  rig.apply(camera, "slide", 0.985, 1 / 60, true, 120);
  const first = camera.projectionMatrix.clone();
  assert.equal(camera.fov, 30);
  for (let i = 0; i < 120; i++) {
    pose();
    rig.apply(camera, "slide", 0.985, 1 / 60, true, 120);
    assert.deepEqual(camera.projectionMatrix.elements, first.elements);
  }
  for (const stage of ["turned", "pullback", "done"]) {
    pose();
    const original = camera.projectionMatrix.clone(),
      position = camera.position.clone();
    rig.apply(camera, stage, 0.5, 1 / 60, false, 120);
    assert.deepEqual(camera.projectionMatrix.elements, original.elements);
    assert.ok(camera.position.equals(position));
  }
  baseline = true;
  pose();
  rig.apply(camera, "slide", 0.985, 1 / 60, false, 120);
  assert.equal(camera.fov, 40);
  lensModule.lensControls.reset("view1");
});

test("v1 drafts promote only the two requested View 1 values once", () => {
  const data = new Map(),
    storage = { getItem: (k) => data.get(k) || null, setItem: (k, v) => data.set(k, v) };
  data.set(
    "eye-lens-controls-v1",
    JSON.stringify({
      version: 1,
      presets: {
        view1: { ...LENS_DEFAULTS, fov: 32, squeeze: 1.2, sway: 0.31 },
        brand: { ...LENS_DEFAULTS, fov: 50, squeeze: 1.15 },
      },
    }),
  );
  const a = createLensControls();
  a.load(storage);
  assert.equal(a.read().presets.view1.fov, 65);
  assert.equal(a.read().presets.view1.squeeze, 1.05);
  assert.equal(a.read().presets.view1.sway, 0.31);
  assert.equal(a.read().presets.brand.fov, 50);
  assert.equal(a.read().presets.brand.squeeze, 1.15);
  a.set("view1", "fov", 61);
  a.save(storage);
  const b = createLensControls();
  b.load(storage);
  assert.equal(b.read().presets.view1.fov, 61);
  assert.equal(b.export().version, 2);
});

test("approach lens starts at the actual corridor projection and lands exactly at 65° / 1.05×", () => {
  const code = ts.transpileModule(
    readFileSync(new URL("../components/corridor/view-one-lens.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  const loaded = { exports: {} };
  const dependencies = {
    three: Three,
    "./lens-controls": lensModule,
    "./lens-motion": motionModule,
    "./cinema-controls": { cinemaControls: { read: () => ({ baseline: false }) } },
  };
  new Function("require", "module", "exports", code)((id) => dependencies[id], loaded, loaded.exports);
  lensModule.lensControls.reset("view1");
  const rig = loaded.exports.createViewOneLens(),
    camera = new Three.PerspectiveCamera(47, 16 / 9, 0.1, 1200);
  const focal = new Three.PerspectiveCamera(65, 16 / 9, 0.1, 1200);
  camera.position.set(0, 0, 100);
  const original = camera.projectionMatrix.clone();
  rig.apply(camera, "slide", 0, 1 / 60, true, 100);
  assert.equal(camera.fov, 47);
  assert.deepEqual(camera.projectionMatrix.elements, original.elements);
  camera.fov = 47;
  camera.updateProjectionMatrix();
  rig.apply(camera, "slide", 0.985, 1 / 60, true, 100);
  assert.equal(camera.fov, 65);
  assert.ok(
    Math.abs(camera.projectionMatrix.elements[0] - focal.projectionMatrix.elements[0] / 1.05) < 1e-12,
  );
});
