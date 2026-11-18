import test from "node:test";
import assert from "node:assert/strict";
import { pupilRayTransmission, PUPIL_ABSORPTION_STEPS } from "../components/corridor/pupil-absorption.ts";

test("intercepted light never reappears through deposit gaps or beyond its outer edge", () => {
  const radialPath = [
    ...Array(12).fill(0),
    0.04,
    0.08,
    0.14,
    0.3,
    ...Array(8).fill(0),
    0.4,
    0.8,
    ...Array(24).fill(0),
  ];
  let previous = 1;
  for (let i = 1; i <= radialPath.length; i++) {
    const next = pupilRayTransmission(radialPath.slice(0, i));
    assert.ok(next <= previous);
    previous = next;
  }
  assert.equal(pupilRayTransmission(radialPath.slice(0, 16)), 0);
  assert.equal(pupilRayTransmission(radialPath.slice(0, 23)), 0, "a hole cannot re-emit absorbed energy");
  assert.equal(pupilRayTransmission(radialPath), 0, "rays cannot escape after passing through grains");
});

test("empty lateral directions retain their light and contact fades continuously", () => {
  assert.equal(pupilRayTransmission(Array(96).fill(0)), 1);
  const transmissions = Array.from({ length: 100 }, (_, i) => pupilRayTransmission([i / 500]));
  assert.ok(transmissions.some((t) => t > 0 && t < 1));
  assert.ok(transmissions.slice(1).every((t, i) => Math.abs(t - transmissions[i]) < 0.08));
  assert.ok(
    PUPIL_ABSORPTION_STEPS.desktop > PUPIL_ABSORPTION_STEPS.laptop &&
      PUPIL_ABSORPTION_STEPS.laptop > PUPIL_ABSORPTION_STEPS.mobile,
  );
});
