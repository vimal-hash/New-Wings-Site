import test from "node:test";
import assert from "node:assert/strict";
import { NormalBlending, ShaderMaterial } from "three";
import { createGrainContactMaterial, PUPIL_CONTACT_SCALE } from "../components/corridor/pupil-ray-contact.ts";
import { PULSE_RELEASE, samplePupilPulse } from "../components/corridor/pupil-pulse-state.ts";

test("contact mask reuses actual moving grain coverage without modifying its visible material", () => {
  const uniforms = { uTime: { value: 3 }, uAtlas: { value: null } },
    source = new ShaderMaterial({
      uniforms,
      vertexShader: "moving grain positions",
      fragmentShader:
        "void main(){float alpha=1.;vec4 fragmentColour=vec4(1.,1.,1.,alpha);#include <colorspace_fragment>}",
    });
  const original = source.fragmentShader,
    mask = createGrainContactMaterial(source);
  assert.equal(mask.uniforms, source.uniforms, "motion/atlas uniforms are shared, not a frozen silhouette");
  assert.equal(
    mask.vertexShader,
    source.vertexShader,
    "the real vertex path and authored depth are retained",
  );
  assert.equal(mask.blending, NormalBlending);
  assert.equal(mask.depthWrite, false);
  assert.equal(mask.depthTest, false);
  assert.match(mask.fragmentShader, /fragmentColour.a\*10./);
  assert.equal(source.fragmentShader, original);
  assert.ok(
    PUPIL_CONTACT_SCALE.mobile < PUPIL_CONTACT_SCALE.laptop &&
      PUPIL_CONTACT_SCALE.laptop < PUPIL_CONTACT_SCALE.desktop,
  );
  assert.equal(PUPIL_CONTACT_SCALE.desktop, 0.25);
  mask.dispose();
  source.dispose();
});

test("completed first border is luminous before its additional launch flash", () => {
  const first = samplePupilPulse(PULSE_RELEASE - 0.01),
    peak = samplePupilPulse(PULSE_RELEASE + 0.2);
  assert.ok(first.border >= 1.2);
  assert.equal(first.wave, 0);
  assert.ok(
    peak.border > first.border * 2 && peak.border < first.border * 2.5,
    "controlled launch peak above the unchanged first circle",
  );
  assert.ok(
    samplePupilPulse(20).border < 0.08,
    "the stronger first trace does not raise the settled idle outline",
  );
});
