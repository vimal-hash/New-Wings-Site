import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { brandRepulsion } from "../components/corridor/brand-repulsion.ts";

const parts = JSON.parse(
  fs.readFileSync(new URL("../components/corridor/brand-letter-parts.json", import.meta.url)),
);
test("letter windows partition both original word images without losing or duplicating pixels", () => {
  for (const [file, label, width] of [
    ["text-new-wings.webp", "NewWings", 654],
    ["text-solutions.webp", "Solutions", 579],
  ]) {
    let edge = 0;
    assert.equal(parts[file].map((letter) => letter.letter).join(""), label);
    for (const letter of parts[file]) {
      assert.equal(letter.x, edge);
      assert.ok(letter.inkLeft >= letter.x && letter.inkRight < letter.x + letter.width);
      edge += letter.width;
    }
    assert.equal(edge, width);
  }
});

test("a nearby letter responds without translating the rest of its word", () => {
  const near = brandRepulsion(99, 120, { x: 100, y: 100, width: 25, height: 40 }, "letter");
  const far = brandRepulsion(99, 120, { x: 240, y: 100, width: 25, height: 40 }, "letter");
  assert.ok(near.x > 0 && Math.hypot(near.x, near.y) <= 6);
  assert.equal(Math.hypot(far.x, far.y), 0);
});
