import {CustomBlending,OneFactor,OneMinusSrcAlphaFactor,type ShaderMaterial} from 'three';

/** HDR radiance must survive alpha zero, which reserves alpha for occluders. */
export function createPupilEmissionMaterial(source:ShaderMaterial,radiance:number){
  const material=source.clone();material.uniforms=source.uniforms;
  material.fragmentShader=source.fragmentShader.replace('#include <colorspace_fragment>',`gl_FragColor=vec4(pulseColour*fragmentColour.a*${radiance.toFixed(1)},0.);`);
  material.blending=CustomBlending;material.blendSrc=OneFactor;material.blendDst=OneMinusSrcAlphaFactor;
  material.blendSrcAlpha=OneFactor;material.blendDstAlpha=OneMinusSrcAlphaFactor;
  return material;
}
