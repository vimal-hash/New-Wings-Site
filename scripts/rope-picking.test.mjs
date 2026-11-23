import test from "node:test";
import assert from "node:assert/strict";
import { indexRopeSamples } from "../components/rope-model/rope-picking.ts";

function linearPick(points, z, dx, dy, near, world, pixels) {
  let index = -1, closest = Infinity;
  for (let i = 0; i < points.length; i += 3) {
    const depth = z - points[i + 2];
    if (depth < near || depth >= closest) continue;
    const x = points[i] - dx * depth, y = points[i + 1] - dy * depth;
    const reach = Math.max(world, pixels * depth);
    if (x * x + y * y <= reach * reach) {
      index = i;
      closest = depth;
    }
  }
  return index;
}

test("indexed hover selects the original sample at every tested camera and pointer position", () => {
  let seed = 7;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const points = Float32Array.from({ length: 6000 }, (_, i) => i % 3 === 2 ? -32 * random() : 10 * random() - 5);
  const pick = indexRopeSamples(points);
  for (let i = 0; i < 600; i++) {
    const ray = [2 - random() * 35, random() - 0.5, random() - 0.5, 0.3, 0.12, random() / 20];
    assert.equal(pick(...ray), linearPick(points, ...ray));
  }
});

test("near-plane and depth-slice boundaries include exact hits and keep the first equal-depth sample", () => {
  const points = new Float32Array([0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, -1]);
  const pick = indexRopeSamples(points);
  assert.equal(pick(1, 0, 0, 1, 0, 0), 3);
  assert.equal(pick(0, 0, 0, 1, 0, 0), 9);
  assert.equal(pick(-1, 0, 0, 1, 0, 0), -1);
});
