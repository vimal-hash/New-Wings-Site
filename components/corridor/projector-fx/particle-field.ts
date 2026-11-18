import { particlesGenerated } from "./particlesGenerated.glsl";
// Shared verbatim by the direct vertex path and the once-per-grain laptop pass.
const landing = "float d12 = mix(d11, aG, d8);",
  launch = "float d33 = mix(d24, d32, d18);";
if (!particlesGenerated.includes(landing) || !particlesGenerated.includes(launch))
  throw new Error("Particle field source changed");
export const particleField =
  /* glsl */ `
bool fxHidden(float land, float launch) {
  float shown = mapRangeSmoothstep(safePow(1.0 - clamp(safeDiv(land - uFrame, max(land - launch, 12.0)), 0.0, 1.0), 2.4000001), 0.0199999996, 0.140000001, 0.0, 1.0);
  float sunk = mapRangeSmoothstep(uFrame, land + 0.5, land + 2.25, 0.0, 1.0);
  return shown * (1.0 - sunk) <= 0.0;
}` +
  particlesGenerated
    .replace(landing, "float d12 = fxFormation(d11, aG, d8, aPosition, aPart);")
    .replace(
      launch,
      `${launch}\nif (fxHidden(d15,d33)) { o_keep=false; o_P=o_PP=o_v=vec3(0.); o_col=vec4(0.); o_em=o_rad=0.; return; }`,
    );
