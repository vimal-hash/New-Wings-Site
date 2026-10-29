// Blender's own Random Value and Noise Texture (Perlin fBm, 3D and 4D) and the math-node edge cases,
// for the particle shader generated from the FX_Particles node group (scripts/blender/particles_to_glsl.py).
// Ported from Blender's BLI_noise / BLI_hash (lookup3 by Bob Jenkins) and node_math definitions.
export const particlesLib = /* glsl */ `
#define ROT(x, k) (((x) << (k)) | ((x) >> (32u - (k))))
#define FINAL(a, b, c) { c ^= b; c -= ROT(b, 14u); a ^= c; a -= ROT(c, 11u); b ^= a; b -= ROT(a, 25u); c ^= b; c -= ROT(b, 16u); a ^= c; a -= ROT(c, 4u); b ^= a; b -= ROT(a, 14u); c ^= b; c -= ROT(b, 24u); }
#define MIXH(a, b, c) { a -= c; a ^= ROT(c, 4u); c += b; b -= a; b ^= ROT(a, 6u); a += c; c -= b; c ^= ROT(b, 8u); b += a; a -= c; a ^= ROT(c, 16u); c += b; b -= a; b ^= ROT(a, 19u); a += c; c -= b; c ^= ROT(b, 4u); b += a; }

uint hashUint2(uint kx, uint ky) {
  uint a, b, c;
  a = b = c = 0xdeadbeefu + (2u << 2u) + 13u;
  b += ky; a += kx;
  FINAL(a, b, c);
  return c;
}
uint hashUint3(uint kx, uint ky, uint kz) {
  uint a, b, c;
  a = b = c = 0xdeadbeefu + (3u << 2u) + 13u;
  c += kz; b += ky; a += kx;
  FINAL(a, b, c);
  return c;
}
uint hashUint4(uint kx, uint ky, uint kz, uint kw) {
  uint a, b, c;
  a = b = c = 0xdeadbeefu + (4u << 2u) + 13u;
  a += kx; b += ky; c += kz;
  MIXH(a, b, c);
  a += kw;
  FINAL(a, b, c);
  return c;
}
float hashToFloat(uint kx, uint ky) { return float(hashUint2(kx, ky)) / 4294967295.0; }
float hashFloat2ToFloat(vec2 k) { return hashToFloat(floatBitsToUint(k.x), floatBitsToUint(k.y)); }

// Random Value node (float): noise::hash_to_float(seed, id)
float randomFloat(int id, int seed) { return hashToFloat(uint(seed), uint(id)); }
// Random Value node (vector): noise::hash_to_float(seed, id, axis) per component
float hashToFloat3(uint kx, uint ky, uint kz) { return float(hashUint3(kx, ky, kz)) / 4294967295.0; }
vec3 randomVec3(int id, int seed) {
  return vec3(hashToFloat3(uint(seed), uint(id), 0u), hashToFloat3(uint(seed), uint(id), 1u), hashToFloat3(uint(seed), uint(id), 2u));
}

float fadeT(float t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
float negateIf(float v, uint c) { return c != 0u ? -v : v; }
float grad3(uint hash, float x, float y, float z) {
  uint h = hash & 15u;
  float u = h < 8u ? x : y;
  float vt = (h == 12u || h == 14u) ? x : z;
  float v = h < 4u ? y : vt;
  return negateIf(u, h & 1u) + negateIf(v, h & 2u);
}
float grad4(uint hash, float x, float y, float z, float w) {
  uint h = hash & 31u;
  float u = h < 24u ? x : y;
  float v = h < 16u ? y : z;
  float s = h < 8u ? z : w;
  return negateIf(u, h & 1u) + negateIf(v, h & 2u) + negateIf(s, h & 4u);
}
float perlin3(vec3 p) {
  vec3 fl = floor(p); vec3 f = p - fl;
  uint X = uint(int(fl.x)), Y = uint(int(fl.y)), Z = uint(int(fl.z));
  float u = fadeT(f.x), v = fadeT(f.y), w = fadeT(f.z);
  float x0 = mix(grad3(hashUint3(X, Y, Z), f.x, f.y, f.z), grad3(hashUint3(X + 1u, Y, Z), f.x - 1.0, f.y, f.z), u);
  float x1 = mix(grad3(hashUint3(X, Y + 1u, Z), f.x, f.y - 1.0, f.z), grad3(hashUint3(X + 1u, Y + 1u, Z), f.x - 1.0, f.y - 1.0, f.z), u);
  float x2 = mix(grad3(hashUint3(X, Y, Z + 1u), f.x, f.y, f.z - 1.0), grad3(hashUint3(X + 1u, Y, Z + 1u), f.x - 1.0, f.y, f.z - 1.0), u);
  float x3 = mix(grad3(hashUint3(X, Y + 1u, Z + 1u), f.x, f.y - 1.0, f.z - 1.0), grad3(hashUint3(X + 1u, Y + 1u, Z + 1u), f.x - 1.0, f.y - 1.0, f.z - 1.0), u);
  return mix(mix(x0, x1, v), mix(x2, x3, v), w);
}
float perlin4(vec4 p) {
  vec4 fl = floor(p); vec4 f = p - fl;
  uint X = uint(int(fl.x)), Y = uint(int(fl.y)), Z = uint(int(fl.z)), W = uint(int(fl.w));
  float u = fadeT(f.x), v = fadeT(f.y), t = fadeT(f.z), s = fadeT(f.w);
  float r[2];
  for (int k = 0; k < 2; k++) {
    uint Wk = W + uint(k); float fw = f.w - float(k);
    float x0 = mix(grad4(hashUint4(X, Y, Z, Wk), f.x, f.y, f.z, fw), grad4(hashUint4(X + 1u, Y, Z, Wk), f.x - 1.0, f.y, f.z, fw), u);
    float x1 = mix(grad4(hashUint4(X, Y + 1u, Z, Wk), f.x, f.y - 1.0, f.z, fw), grad4(hashUint4(X + 1u, Y + 1u, Z, Wk), f.x - 1.0, f.y - 1.0, f.z, fw), u);
    float x2 = mix(grad4(hashUint4(X, Y, Z + 1u, Wk), f.x, f.y, f.z - 1.0, fw), grad4(hashUint4(X + 1u, Y, Z + 1u, Wk), f.x - 1.0, f.y, f.z - 1.0, fw), u);
    float x3 = mix(grad4(hashUint4(X, Y + 1u, Z + 1u, Wk), f.x, f.y - 1.0, f.z - 1.0, fw), grad4(hashUint4(X + 1u, Y + 1u, Z + 1u, Wk), f.x - 1.0, f.y - 1.0, f.z - 1.0, fw), u);
    r[k] = mix(mix(x0, x1, v), mix(x2, x3, v), t);
  }
  return mix(r[0], r[1], s);
}
// perlin_signed: wrapped every 100000 (Blender's precision guard), scaled to about [-1, 1]
// Blender wraps with fmod (truncated, sign kept); GLSL mod floors and would move negative coordinates
float snoise3(vec3 p) { p = p - 100000.0 * trunc(p / 100000.0); return perlin3(p) * 0.9820; }
float snoise4(vec4 p) { p = p - 100000.0 * trunc(p / 100000.0); return perlin4(p) * 0.8344; }

// The noise below is written so that each noise evaluation appears once in the compiled code: the shader compiler
// inlines every call, and the plain forms (an extra call for the remainder octave, one fBm call per color channel,
// one noise per distortion axis) made the particle shader a ~8 s compile on Windows' D3D compiler. Same octaves, same
// order, same sums.
float fbm3(vec3 p, float detail, float roughness, float lacunarity, bool normalize) {
  float fscale = 1.0, amp = 1.0, maxamp = 0.0, sum = 0.0, sum2 = 0.0;
  int octaves = int(detail);
  float rmd = detail - floor(detail);
  int last = rmd != 0.0 ? octaves + 1 : octaves; // the remainder octave runs in the same loop
  for (int i = 0; i <= 16; i++) {
    if (i > last) break;
    float t = snoise3(fscale * p);
    if (i <= octaves) { sum += t * amp; maxamp += amp; amp *= clamp(roughness, 0.0, 1.0); fscale *= lacunarity; }
    else sum2 = sum + t * amp;
  }
  if (rmd != 0.0) return normalize ? mix(0.5 * sum / maxamp + 0.5, 0.5 * sum2 / (maxamp + amp) + 0.5, rmd) : mix(sum, sum2, rmd);
  return normalize ? 0.5 * sum / maxamp + 0.5 : sum;
}
float fbm4(vec4 p, float detail, float roughness, float lacunarity, bool normalize) {
  float fscale = 1.0, amp = 1.0, maxamp = 0.0, sum = 0.0, sum2 = 0.0;
  int octaves = int(detail);
  float rmd = detail - floor(detail);
  int last = rmd != 0.0 ? octaves + 1 : octaves; // the remainder octave runs in the same loop
  for (int i = 0; i <= 16; i++) {
    if (i > last) break;
    float t = snoise4(fscale * p);
    if (i <= octaves) { sum += t * amp; maxamp += amp; amp *= clamp(roughness, 0.0, 1.0); fscale *= lacunarity; }
    else sum2 = sum + t * amp;
  }
  if (rmd != 0.0) return normalize ? mix(0.5 * sum / maxamp + 0.5, 0.5 * sum2 / (maxamp + amp) + 0.5, rmd) : mix(sum, sum2, rmd);
  return normalize ? 0.5 * sum / maxamp + 0.5 : sum;
}
vec3 randomVec3Offset(float seed) {
  return vec3(100.0 + hashFloat2ToFloat(vec2(seed, 0.0)) * 100.0, 100.0 + hashFloat2ToFloat(vec2(seed, 1.0)) * 100.0, 100.0 + hashFloat2ToFloat(vec2(seed, 2.0)) * 100.0);
}
vec4 randomVec4Offset(float seed) {
  return vec4(randomVec3Offset(seed), 100.0 + hashFloat2ToFloat(vec2(seed, 3.0)) * 100.0);
}
// distortion: one noise per axis, at offsets 0, 1, 2 (3), all of the undistorted point
vec3 distort3(vec3 p, float distortion) {
  if (distortion == 0.0) return p;
  vec3 d;
  for (int k = 0; k < 3; k++) d[k] = snoise3(p + randomVec3Offset(float(k)));
  return p + d * distortion;
}
vec4 distort4(vec4 p, float distortion) {
  if (distortion == 0.0) return p;
  vec4 d;
  for (int k = 0; k < 4; k++) d[k] = snoise4(p + randomVec4Offset(float(k)));
  return p + d * distortion;
}
float noiseTexFac(vec3 co, float scale, float detail, float roughness, float lacunarity, float distortion, bool normalize) {
  return fbm3(distort3(co * scale, distortion), clamp(detail, 0.0, 15.0), roughness, lacunarity, normalize);
}
// color: one fBm per channel, the second and third at offsets 3 and 4
vec4 noiseTexColor(vec3 co, float scale, float detail, float roughness, float lacunarity, float distortion, bool normalize) {
  vec3 p = distort3(co * scale, distortion);
  float d = clamp(detail, 0.0, 15.0);
  vec3 c;
  for (int k = 0; k < 3; k++) c[k] = fbm3(k == 0 ? p : p + randomVec3Offset(float(k + 2)), d, roughness, lacunarity, normalize);
  return vec4(c, 1.0);
}
float noiseTex4Fac(vec3 co, float w, float scale, float detail, float roughness, float lacunarity, float distortion, bool normalize) {
  return fbm4(distort4(vec4(co, w) * scale, distortion), clamp(detail, 0.0, 15.0), roughness, lacunarity, normalize);
}
// color: one fBm per channel, the second and third at offsets 4 and 5
vec4 noiseTex4Color(vec3 co, float w, float scale, float detail, float roughness, float lacunarity, float distortion, bool normalize) {
  vec4 p = distort4(vec4(co, w) * scale, distortion);
  float d = clamp(detail, 0.0, 15.0);
  vec3 c;
  for (int k = 0; k < 3; k++) c[k] = fbm4(k == 0 ? p : p + randomVec4Offset(float(k + 3)), d, roughness, lacunarity, normalize);
  return vec4(c, 1.0);
}

float safeDiv(float a, float b) { return b != 0.0 ? a / b : 0.0; }
float safePow(float a, float b) {
  if (a >= 0.0) return pow(a, b);
  float f = mod(abs(b), 1.0);
  return (f > 0.999 || f < 0.001) ? (mod(floor(b + 0.5), 2.0) == 0.0 ? 1.0 : -1.0) * pow(-a, floor(b + 0.5)) : 0.0;
}
float safeSqrt(float a) { return a > 0.0 ? sqrt(a) : 0.0; }
float safeMod(float a, float b) { return b != 0.0 ? a - b * trunc(a / b) : 0.0; }
float safeFloorMod(float a, float b) { return b != 0.0 ? a - b * floor(a / b) : 0.0; }
vec3 safeNormalize(vec3 v) { float l = length(v); return l != 0.0 ? v / l : vec3(0.0); }
float mapRangeLinear(float v, float a, float b, float c, float d, bool clampIt) {
  float r = c + safeDiv(v - a, b - a) * (d - c);
  return clampIt ? (c > d ? clamp(r, d, c) : clamp(r, c, d)) : r;
}
float mapRangeSmoothstep(float v, float a, float b, float c, float d) {
  float f = clamp(safeDiv(v - a, b - a), 0.0, 1.0);
  f = (3.0 - 2.0 * f) * (f * f);
  return c + f * (d - c);
}
`;
