import test from "node:test";
import assert from "node:assert/strict";
import { Path, Shape, ShapeGeometry, Vector2, Vector3 } from "three";
import {
  createPupilFrontGeometry,
  pupilFillProgress,
  PUPIL_FILL,
} from "../components/corridor/pupil-fill.ts";

test("front-only extraction closes an internal channel while preserving the outer C outline", () => {
  const outline = [
    [0, 0],
    [4, 0],
    [4, 1],
    [1, 1],
    [1, 3],
    [4, 3],
    [4, 4],
    [0, 4],
  ].map((p) => new Vector2(...p));
  const shape = new Shape(outline),
    hole = new Path([new Vector2(2, 0.2), new Vector2(2.5, 0.2), new Vector2(2.5, 0.8), new Vector2(2, 0.8)]);
  shape.holes.push(hole);
  const source = new ShapeGeometry(shape).rotateX(-Math.PI / 2),
    original = source.getAttribute("position").array.slice();
  const face = createPupilFrontGeometry(source, 0.1),
    p = face.getAttribute("position"),
    ids = face.getIndex();
  function contains(x, z) {
    const q = new Vector3(x, 0.1, z),
      a = new Vector3(),
      b = new Vector3(),
      c = new Vector3();
    for (let i = 0; i < ids.count; i += 3) {
      a.fromBufferAttribute(p, ids.getX(i));
      b.fromBufferAttribute(p, ids.getX(i + 1));
      c.fromBufferAttribute(p, ids.getX(i + 2));
      const cross = (u, v, w) => (v.x - u.x) * (w.z - u.z) - (v.z - u.z) * (w.x - u.x);
      const d = [cross(a, b, q), cross(b, c, q), cross(c, a, q)];
      if (d.every((n) => n >= -1e-6) || d.every((n) => n <= 1e-6)) return true;
    }
    return false;
  }
  assert.equal(contains(2.25, -0.5), true, "the internal corridor channel is closed");
  assert.equal(contains(2, -2), false, "the natural C opening stays empty");
  assert.deepEqual(source.getAttribute("position").array, original, "the source GLB geometry is read only");
  for (let i = 0; i < p.count; i++)
    assert.ok(Math.abs(p.getY(i) - 0.1) < 1e-6, "only one front plane, no wall/back geometry");
  source.dispose();
  face.dispose();
});

test("fill starts after View 2 and completes before the existing camera settles", () => {
  for (const stage of ["slide", "top", "turn", "turned"]) assert.equal(pupilFillProgress(stage, 1), 0);
  assert.equal(pupilFillProgress("pullback", PUPIL_FILL.start), 0);
  let previous = 0;
  for (let p = 0; p <= 1; p += 0.001) {
    const next = pupilFillProgress("pullback", p);
    assert.ok(next >= previous && next <= 1);
    assert.ok(next - previous < 0.003);
    previous = next;
  }
  assert.equal(pupilFillProgress("pullback", PUPIL_FILL.end), 1);
  assert.ok(PUPIL_FILL.end < 1);
  assert.equal(pupilFillProgress("done", 1), 1);
});
