import test from "node:test";
import assert from "node:assert/strict";
import { brandRepulsion } from "../components/corridor/brand-repulsion.ts";

test("pointer repulsion pushes away, stays bounded and leaves distant objects still", () => {
  const rect = { x: 100, y: 100, width: 40, height: 40 };
  assert.ok(brandRepulsion(90, 120, rect, "object").x > 0);
  assert.ok(brandRepulsion(150, 120, rect, "object").x < 0);
  assert.deepEqual(brandRepulsion(1000, 1000, rect, "object"), { x: -0, y: -0 });
  for (const kind of ["object", "text", "logo", "star", "background"])
    for (let x = 90; x < 150; x++) {
      const offset = brandRepulsion(x, 120, rect, kind);
      assert.ok(Number.isFinite(offset.x) && Number.isFinite(offset.y));
      assert.ok(Math.hypot(offset.x, offset.y) <= 8.00001);
    }
});

test("a sound ring responds near its actual arc rather than its empty interior", () => {
  const rect = { x: 0, y: 0, width: 430, height: 473 };
  const centre = brandRepulsion(150, 280, rect, "ring", 120);
  assert.equal(Math.hypot(centre.x, centre.y), 0);
  assert.ok(brandRepulsion(270, 280, rect, "ring", 120).x < 0);
});
