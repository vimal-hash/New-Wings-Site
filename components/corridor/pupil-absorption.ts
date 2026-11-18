/** Integrate from the pupil to the travelling front, not just at its current pixel.
 * Once energy enters the deposit it cannot reappear in a gap or outside the eye.
 * This is a conservative projected absorption envelope; grain lighting retains 3D arrival.
 */
export const PUPIL_ABSORPTION_STEPS = { desktop: 96, laptop: 72, mobile: 48 } as const;
export const PUPIL_ABSORPTION_GLSL = /* glsl */ `
uniform sampler2D uHeroGrainMask;
uniform vec2 uHeroMaskTexel,uHeroScreenOrigin;
float rayTransmission(vec2 uv){
  vec2 path=uv-uHeroScreenOrigin;
  vec2 texel=uHeroMaskTexel*1.25;
  float stepPixels=max(1.,length(path/uHeroMaskTexel)/float(PUPIL_ABSORPTION_STEPS));
  float absorbed=0.;
  for(int i=1;i<=PUPIL_ABSORPTION_STEPS;i++){
    vec2 q=uHeroScreenOrigin+path*(float(i)/float(PUPIL_ABSORPTION_STEPS));
    float coverage=texture2D(uHeroGrainMask,q).a*.4;
    coverage+=(texture2D(uHeroGrainMask,q+vec2(texel.x,0.)).a+texture2D(uHeroGrainMask,q-vec2(texel.x,0.)).a
              +texture2D(uHeroGrainMask,q+vec2(0.,texel.y)).a+texture2D(uHeroGrainMask,q-vec2(0.,texel.y)).a)*.15;
    absorbed+=smoothstep(.035,.22,coverage)*stepPixels*.8;
    if(absorbed>=.7)return 0.;
  }
  return 1.-smoothstep(.06,.7,absorbed);
}`;

/** Reference for absorption regressions, including gaps and the empty outer region. */
export function pupilRayTransmission(coverage: readonly number[], stepPixels = 1) {
  const smooth = (a: number, b: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  let absorbed = 0;
  for (const density of coverage) {
    absorbed += smooth(0.035, 0.22, density) * Math.max(1, stepPixels) * 0.8;
    if (absorbed >= 0.7) return 0;
  }
  return 1 - smooth(0.06, 0.7, absorbed);
}
