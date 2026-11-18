import { CustomBlending, OneFactor, OneMinusSrcAlphaFactor, type ShaderMaterial } from "three";

/** HDR radiance must survive alpha zero, which reserves alpha for occluders. */
export function createPupilEmissionMaterial(source: ShaderMaterial, radiance: number) {
  // The copy shares the live uniforms, so clone() is kept from copying them: the light front's contact mask is a
  // render-target texture, which three.js cannot copy (it warns in the console).
  const { uniforms } = source;
  source.uniforms = {};
  const material = source.clone();
  source.uniforms = material.uniforms = uniforms;
  material.fragmentShader = source.fragmentShader.replace(
    "#include <colorspace_fragment>",
    `gl_FragColor=vec4(pulseColour*fragmentColour.a*${radiance.toFixed(1)},0.);`,
  );
  material.blending = CustomBlending;
  material.blendSrc = OneFactor;
  material.blendDst = OneMinusSrcAlphaFactor;
  material.blendSrcAlpha = OneFactor;
  material.blendDstAlpha = OneMinusSrcAlphaFactor;
  return material;
}
