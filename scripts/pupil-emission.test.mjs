import test from "node:test";
import assert from "node:assert/strict";
import { AdditiveBlending, CustomBlending, OneFactor, OneMinusSrcAlphaFactor, ShaderMaterial } from "three";
import { createPupilEmissionMaterial } from "../components/corridor/pupil-pulse-material.ts";

test("zero-alpha HDR emission remains additive without altering its visible source", () => {
  const source = new ShaderMaterial({
    blending: AdditiveBlending,
    uniforms: { strength: { value: 1 } },
    fragmentShader:
      "void main(){vec3 pulseColour=vec3(1.);vec4 fragmentColour=vec4(1.);#include <colorspace_fragment>}",
  });
  const original = source.fragmentShader,
    emission = createPupilEmissionMaterial(source, 24);
  assert.equal(emission.blending, CustomBlending);
  assert.equal(emission.blendSrc, OneFactor, "radiance cannot be multiplied by its zero mask alpha");
  assert.equal(
    emission.blendDst,
    OneMinusSrcAlphaFactor,
    "zero-alpha light retains existing light behind it",
  );
  assert.equal(emission.blendSrcAlpha, OneFactor);
  assert.equal(emission.blendDstAlpha, OneMinusSrcAlphaFactor);
  assert.match(emission.fragmentShader, /fragmentColour.a\*24.0,0./);
  assert.equal(emission.uniforms, source.uniforms, "the visible source and extraction share one wave");
  assert.equal(source.blending, AdditiveBlending);
  assert.equal(source.fragmentShader, original);
  emission.dispose();
  source.dispose();
});
