import test from "node:test";
import assert from "node:assert/strict";
import { brandRevealPoint } from "../components/corridor/brand-reveal.ts";

test("the entrance waits until the complete logo is beyond the opaque feather shoulder", () => {
  for (const [width, height] of [
    [1920, 945],
    [1366, 768],
    [390, 844],
  ]) {
    for (const feather of [0, 50, 240]) {
      const logoWidth = Math.min(width, height) * 0.32;
      const point = brandRevealPoint(width, height, logoWidth, feather);
      const slant = Math.min(height * 0.24, width * 0.16),
        normal = Math.hypot(1, slant / width);
      const span = (height + slant) / normal;
      const corner =
        (height / 2 - (logoWidth * 355) / 390 / 2 + (slant / width) * (width / 2 - logoWidth / 2)) / normal;
      assert.ok(corner > (1 - point) * (span + feather));
      assert.ok(point > 0.5 && point < 0.9);
    }
  }
});

test("wider feathers and larger logos defer the entrance to preserve the handoff", () => {
  assert.ok(brandRevealPoint(1920, 945, 300, 240) > brandRevealPoint(1920, 945, 300, 0));
  assert.ok(brandRevealPoint(1920, 945, 360, 64) > brandRevealPoint(1920, 945, 240, 64));
});
