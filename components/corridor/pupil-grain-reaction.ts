/** Local material response to absorbed energy. Position/coverage/particle motion stay authored. */
export const GRAIN_REACTION = {
  floor: 0.24,
  reflection: 1.85,
  specular: 3.4,
  bloom: 18,
  bloomPeak: 48,
  brightness: 1.3,
} as const;

/** Concentrate hot glints instead of lifting every neighbouring grain equally. */
export const GRAIN_OPTICS_GLSL = /* glsl */ `
float grainGlintWeight(float seed){
  return .28+.72*smoothstep(.22,.82,fract(seed*13.37));
}
vec3 grainBloomDetail(vec3 received){
  float radiance=dot(received,vec3(.2126,.7152,.0722))*${GRAIN_REACTION.bloom.toFixed(1)};
  return received/(1.+radiance/${GRAIN_REACTION.bloomPeak.toFixed(1)});
}`;

export const GRAIN_REACTION_GLSL = /* glsl */ `
float grainGroupHash(vec2 point){
  vec3 q=fract(vec3(point.x,point.y,point.x)*.1031);
  q+=dot(q,q.yzx+33.33);
  return fract((q.x+q.y)*q.z);
}
float grainReactionGroup(vec3 source){
  vec2 point=source.xy*2.4+source.z*vec2(.65,-.45);
  vec2 cell=floor(point),weight=fract(point);
  weight=weight*weight*(3.-2.*weight);
  return mix(mix(grainGroupHash(cell),grainGroupHash(cell+vec2(1.,0.)),weight.x),
             mix(grainGroupHash(cell+vec2(0.,1.)),grainGroupHash(cell+vec2(1.,1.)),weight.x),weight.y);
}
vec3 grainReactionFront(float distanceFromPupil,float seed,float size,float group,float radius,float strength){
  float age=(radius-distanceFromPupil)/max(.001,uHeroWidth);
  // Catch immediately, then transfer through coherent small groups at depth.
  float catchLight=smoothstep(-.13,.07,age)*exp(-pow((age-(.06+.06*seed))/.22,2.));
  float delay=.32+.65*group+.08*seed+.05*size;
  float charge=smoothstep(delay-.20,delay+.22,age);
  float body=charge*exp(-max(0.,age-delay-.24)*1.15);
  float transfer=.22*charge*exp(-pow((age-delay-.18)/.30,2.));
  // A few stable facets retain silver longer; neighbours return to dark steel first.
  // No oscillation: the shimmer is a varied material release, never a second flash.
  float linger=smoothstep(.62,.94,fract(seed*5.73+group*.63));
  float retention=.035+.34*linger;
  float decay=mix(1.15,.36,linger)+.12*(1.-size);
  float wake=retention*charge*smoothstep(delay+.12,delay+.70,age)*exp(-max(0.,age-delay-.70)*decay);
  wake=min(wake,max(0.,1.-body)*.5);
  return vec3(body,catchLight+transfer,wake)*strength;
}
vec3 grainReaction(float distanceFromPupil,float seed,float size,float group){
  vec3 reaction=vec3(0.);
  for(int i=0;i<3;i++){
    if(uHeroWaves[i]>.0001)reaction=max(reaction,grainReactionFront(distanceFromPupil,seed,size,group,uHeroRadii[i],uHeroWaves[i]));
  }
  reaction.z=min(reaction.z,max(0.,1.-reaction.x)*.5);
  return reaction;
}`;

const fract = (x: number) => x - Math.floor(x);
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Spatial reference: nearby grains share a smooth group rather than a hard tile. */
export function grainReactionGroupAt(x: number, y: number, z: number) {
  const hash = (x: number, y: number) => {
    const q = [fract(x * 0.1031), fract(y * 0.1031), fract(x * 0.1031)];
    const d = q[0] * (q[1] + 33.33) + q[1] * (q[2] + 33.33) + q[2] * (q[0] + 33.33);
    return fract((q[0] + d + q[1] + d) * (q[2] + d));
  };
  const px = x * 2.4 + z * 0.65,
    py = y * 2.4 - z * 0.45,
    cx = Math.floor(px),
    cy = Math.floor(py),
    u = smooth(0, 1, fract(px)),
    v = smooth(0, 1, fract(py));
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  return mix(mix(hash(cx, cy), hash(cx + 1, cy), u), mix(hash(cx, cy + 1), hash(cx + 1, cy + 1), u), v);
}

/** Independent temporal reference for catch, transfer and release regressions. */
export function grainReactionAt(
  distance: number,
  radius: number,
  width: number,
  seed: number,
  size: number,
  strength = 1,
  group = 0.5,
) {
  const age = (radius - distance) / Math.max(0.001, width),
    delay = 0.32 + 0.65 * group + 0.08 * seed + 0.05 * size;
  const charge = smooth(delay - 0.2, delay + 0.22, age);
  const catchLight = smooth(-0.13, 0.07, age) * Math.exp(-Math.pow((age - (0.06 + 0.06 * seed)) / 0.22, 2));
  const transfer = 0.22 * charge * Math.exp(-Math.pow((age - delay - 0.18) / 0.3, 2));
  const linger = smooth(0.62, 0.94, fract(seed * 5.73 + group * 0.63));
  const retention = 0.035 + 0.34 * linger,
    decay = 1.15 + (0.36 - 1.15) * linger + 0.12 * (1 - size);
  const body = charge * Math.exp(-Math.max(0, age - delay - 0.24) * 1.15);
  const wake =
    retention *
    charge *
    smooth(delay + 0.12, delay + 0.7, age) *
    Math.exp(-Math.max(0, age - delay - 0.7) * decay);
  return {
    body: body * strength,
    glint: (catchLight + transfer) * strength,
    wake: Math.min(wake, Math.max(0, 1 - body) * 0.5) * strength,
  };
}

/** Combined reference: preserve each front without stacking its neighbour into a white wash. */
export function grainReactionsAt(
  distance: number,
  fronts: readonly { radius: number; strength: number }[],
  width: number,
  seed: number,
  size: number,
  group = 0.5,
) {
  const result = { body: 0, glint: 0, wake: 0 };
  for (const front of fronts) {
    const response = grainReactionAt(distance, front.radius, width, seed, size, front.strength, group);
    for (const key of ["body", "glint", "wake"] as const) result[key] = Math.max(result[key], response[key]);
  }
  result.wake = Math.min(result.wake, Math.max(0, 1 - result.body) * 0.5);
  return result;
}
