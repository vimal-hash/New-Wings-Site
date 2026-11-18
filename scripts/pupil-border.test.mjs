import test from "node:test";
import assert from "node:assert/strict";
import { Shape, ShapeGeometry, Vector2 } from "three";
import { createPupilBorderGeometry } from "../components/corridor/pupil-border.ts";

test("front border joins both ribbon sides at every corner without moving the source", () => {
  const face = new ShapeGeometry(
    new Shape(
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ].map((p) => new Vector2(...p)),
    ),
  ).rotateX(-Math.PI / 2);
  const original = face.getAttribute("position").array.slice(),
    border = createPupilBorderGeometry([face], 0.04, 1),
    p = border.getAttribute("position");
  assert.equal(p.count, 24, "four contour segments, no internal triangulation edges");
  const endpoints = new Map();
  for (let segment = 0; segment < 4; segment++)
    for (const i of [0, 2, 1, 4]) {
      const id = segment * 6 + i,
        key = [p.getX(id), p.getZ(id)].map((n) => n.toFixed(4)).join(",");
      endpoints.set(key, (endpoints.get(key) ?? 0) + 1);
    }
  assert.equal(endpoints.size, 8, "four corners on each side share precisely the same joined position");
  assert.ok([...endpoints.values()].every((n) => n === 2));
  for (let i = 0; i < p.count; i++) assert.ok(Math.abs(p.getY(i) - 0.04) < 1e-6);
  assert.deepEqual(face.getAttribute("position").array, original);
  border.dispose();
  face.dispose();
});
