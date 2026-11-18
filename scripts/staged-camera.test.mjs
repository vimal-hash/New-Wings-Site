import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Vector3, Quaternion, Matrix4 } from "three";
import { createLogoReveal, VIEW_ONE_PITCH } from "../components/corridor/logo-reveal.ts";
const j = (n) => JSON.parse(fs.readFileSync(new URL("../components/corridor/" + n, import.meta.url)));
const slide = j("blender-layout.json").slides[1],
  start = new Vector3(slide.base[0], 3.372500038, -slide.base[1]);
const q = new Quaternion().setFromRotationMatrix(
  new Matrix4().lookAt(start, start.clone().add(new Vector3(1, 0, -0.2)), new Vector3(0, 1, 0)),
);
test("both staged camera joins match exactly and slide heading stays steady", () => {
  const p = createLogoReveal(j("logo-reveal.json").blenderBounds, slide, start.y, 2, start, q);
  const a = new Vector3(),
    b = new Vector3(),
    qa = new Quaternion(),
    qb = new Quaternion();
  p.sampleSlide(1, a, qa);
  p.sampleTurn(0, b, qb);
  assert.ok(a.distanceTo(b) < 1e-8 && qa.angleTo(qb) < 1e-7);
  assert.ok(qa.angleTo(q) < VIEW_ONE_PITCH + 0.001, "View 1 tilts up by its authored pitch only");
  const lip = a.clone();
  p.sampleTurn(0.5, b, qb);
  assert.ok(b.distanceTo(lip) > 0.01);
  p.sampleTurn(1, a, qa);
  p.samplePullback(0, b, qb);
  assert.ok(a.distanceTo(b) < 1e-8 && qa.angleTo(qb) < 1e-7);
  p.samplePullback(1, b, qb);
  assert.ok(b.distanceTo(p.finalPosition) < 1e-8 && qb.angleTo(p.finalRotation) < 1e-7);
});
