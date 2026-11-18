"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BufferAttribute,
  CustomBlending,
  DoubleSide,
  GLSL3,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  Vector2,
  type Object3D,
} from "three";
import { useCompressedBuffer } from "./compressed-buffer";
import metadata from "./projector-particles.json";
import { particleProfiles } from "./projector-particle-profiles";
import { blenderDisplayGLSL, useBlenderViewLUT } from "./blender-view-lut";
import { particleField } from "./projector-fx/particle-field";
import { createParticleCache } from "./projector-fx/particle-cache";
import { particlesLib } from "./projector-fx/particlesLib.glsl";
import { formationGLSL } from "./projector-fx/formation";
import { traceMark } from "./loading-trace";

// The laser particle formation (Blender: FX_Particles, geometry nodes "FX • Laser Particle Formation").
// Its field math runs per particle in the vertex shader (particlesGenerated, compiled from the node group
// by scripts/blender/particles_to_glsl.py; checked point by point against Blender's evaluated particles,
// positions within 1e-6 m). The geometry steps are rebuilt here: deleted points are culled, fast points
// become streaks from P back along their velocity (Duplicate Elements x2 -> Points to Curves), the rest
// round grains; Blender's "FX • Particle Grain" material: colour fx_col lit + emission fx_col * fx_em,
// mixed with transparency by coverage fx_cov.
// Only the points a final render keeps (the node group's first Delete Geometry, ~24%) are exported
// (scripts/blender/export_particles.py); the shader still makes the same test.

// Light on the grains besides their own emission: the FX rig (vertex shader), its powers keyed over the timeline.
const keyPower = (f: number) =>
  150 * Math.min(1, Math.max(0, f < 12 ? (f - 1) / 11 : f <= 96 ? 1 : 1 - (f - 96) / 30));
const glowPower = (f: number) =>
  Math.min(1, Math.max(0, f < 22 ? (f - 6) / 16 : f <= 90 ? 1 : 1 - (f - 90) / 18));

type Meta = { count: number; blocks: [string, number, "f32" | "u16" | "u32"][]; parts: [number, number][] };

const vertexShader = (data: boolean, cached = false) => /* glsl */ `
precision highp float;
precision highp int;
uniform float uFrame;
uniform float uFps;
uniform bool uIsViewport;
uniform float uKeyPower;
uniform float uGlow;
uniform float uViewportHeight; // drawing-buffer pixels
uniform int uCacheOffset;
in vec2 corner;
${
  data
    ? "in vec3 aPosition;\nin vec3 aNormal;\nin vec4 aMisc; // fx_g, fx_t0, fx_dur, fx_part\nin float aId; // the point's index in FX_ParticleData"
    : ""
}
out vec3 vFlat;     // radiance of the grain averaged over its disc (lit sphere) plus emission
out float vAlpha;   // coverage
out vec3 vKeyE, vKeyL, vGlowE, vGlowL; // per light: irradiance facing it, and its direction (view space)
out vec3 vAlbedo;   // fx_col / pi
out vec3 vEmit;
out vec3 vDir, vSide, vFace; // the quad's axes in view space: along the streak, across it, toward the camera
out vec3 vShape;    // half streak length in quad radii, true grain radius in pixels, quad radius / grain radius
out vec2 vSplat;    // soft splat peak, weight of the sharp shape
out vec2 vCorner;
${
  cached
    ? "uniform sampler2D uHeadRadius,uTailCoverage,uColourEmission;"
    : particlesLib + formationGLSL + particleField
}
const float PI = 3.14159265;
vec3 toThree(vec3 b) { return vec3(b.x, b.z, -b.y); } // Blender Z-up -> glTF Y-up, as the exporter does
vec3 viewDir(vec3 b) { return normalize(mat3(modelViewMatrix) * toThree(b)); }
// Lambert sphere seen at phase angle a (light vs view direction): its radiance averaged over the visible disc,
// relative to a flat surface facing the light: 2/3 * (sin a + (pi - a) cos a) / pi.
float spherePhase(vec3 l, vec3 view) {
  float a = acos(clamp(dot(l, view), -1.0, 1.0));
  return 2.0 / 3.0 * (sin(a) + (PI - a) * cos(a)) / PI;
}
void main() {
  int id = ${data ? "int(aId)" : "gl_InstanceID"};
  ${
    cached
      ? `int index=gl_InstanceID+${data ? "0" : "uCacheOffset"};ivec2 texel=ivec2(index%256,index/256);
  vec4 hr=texelFetch(uHeadRadius,texel,0),tc=texelFetch(uTailCoverage,texel,0),ce=texelFetch(uColourEmission,texel,0);
  float rad=abs(hr.w),cov=tc.w,em2=ce.w;bool trail=hr.w<0.;
  if(rad<=0.){gl_Position=vec4(2.,2.,2.,1.);return;}
  vec3 P=hr.xyz,head=toThree(P),tail=toThree(tc.xyz);vec4 col=vec4(ce.rgb,1.);`
      : `
  bool del; vec3 P, PP, v; vec4 col; float em, rad;
  ${
    data
      ? "vec3 n = aNormal; float g = aMisc.x, t0 = aMisc.y, dur = aMisc.z; int part = int(aMisc.w);\n  particleData(aPosition, n, g, t0, dur, part, id, del, P, PP, col, em, rad, v);"
      : "vec3 n = vec3(0.0); float g = 0.0, t0 = 0.0, dur = 0.0; int part = 0;\n  del = id >= particleAmbientCount();\n  particleAmbient(id, P, PP, col, em, rad, v);"
  }
  bool drop, trail, show; float cov, em2;
  particleJoined(P, rad, col, em, v, n, g, t0, dur, part, id, drop, cov, em2, trail, show);
  if (del || drop || !show) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec3 head = toThree(P), tail = head;
  if (trail) {
    vec3 offset;
    particleTrail(P, rad, col, em, v, cov, 1.0, n, g, t0, dur, part, id, offset);
    tail = toThree(P + offset);
  }
  `
  }
  vec4 h = modelViewMatrix * vec4(head, 1.0), t = modelViewMatrix * vec4(tail, 1.0);
  vec3 dir = vec3(1.0, 0.0, 0.0), side = vec3(0.0, 1.0, 0.0);
  vec3 axis = t.xyz - h.xyz;
  if (trail && length(axis) > 1e-7) {
    dir = normalize(axis);
    vec3 s = cross(normalize(-h.xyz), dir); // (side, dir) counter-clockwise as seen: dir x side faces the camera
    side = length(s) > 1e-6 ? normalize(s) : vec3(0.0, 1.0, 0.0);
  }
  // streak: a capsule from head to tail, rad wide each side with round caps; grain: a disc of radius rad.
  // How big it is on screen decides how it is drawn. From 3 px radius: the shape itself, edge anti-aliased.
  // Most grains are far below a pixel (0.0005 m at 3 m is ~0.16 px), where Cycles averages them into the pixels
  // they touch; a hard dot that small would flicker as it crosses MSAA samples, so below 1.5 px it is a soft
  // splat (1 - d^2)^2 at least a pixel wide, its peak set so it carries exactly the grain's coverage
  // (area pi rad^2 for a grain, width 2 rad per length for a streak). In between, the two are blended.
  float pxPerUnit = projectionMatrix[1][1] * 0.5 * uViewportHeight / max(-h.z, 1e-4);
  float pixels = rad * pxPerUnit;
  float splatPx = max(0.8, (trail ? 1.875 : 1.7320508) * pixels); // smallest splat whose peak stays <= 1 (0.8 px: crisper than 1 px, still no pixel flicker)
  float sharp = smoothstep(1.2, 2.5, pixels);
  float drawnPx = sharp >= 1.0 ? pixels : splatPx;
  float drawn = drawnPx / pxPerUnit;
  float peak = trail ? 1.875 * pixels / splatPx : 3.0 * (pixels / splatPx) * (pixels / splatPx);
  vec3 centre = trail ? mix(h.xyz, t.xyz, corner.x * 0.5 + 0.5) : h.xyz;
  vec3 pos = centre + dir * corner.x * drawn + side * corner.y * drawn;
  gl_Position = projectionMatrix * vec4(pos, 1.0);

  // Light from the FX rig (PRJ_ROOT space, Blender axes, as at frame 60; powers keyed over the timeline).
  // FX_Key_Soft: 1.8 m disk, Lambertian (intensity P / pi along its axis); FX_Glow_R/G/B: points (P / 4 pi).
  // The three glows are lit as one light from their irradiance-weighted direction.
  const vec3 KEY_POS = vec3(2.4, 0.9, 2.5), KEY_DIR = vec3(-0.796, -0.214, -0.566), KEY_COLOR = vec3(1.0, 0.97, 0.92);
  // no closer than the lights' own size: the key is a 1.8 m disk, the glows 0.45 m spheres (soft near them in Cycles)
  vec3 toKey = KEY_POS - P; float dk2 = max(dot(toKey, toKey), 0.81);
  vec3 keyE = KEY_COLOR * uKeyPower / PI * max(0.0, dot(-normalize(toKey), KEY_DIR)) / dk2;
  const vec3 GP[3] = vec3[3](vec3(1.148, 0.129, 0.8), vec3(-0.812, 1.403, 1.1), vec3(-0.935, -0.932, 0.55));
  const vec3 GC[3] = vec3[3](vec3(1.0, 0.018, 0.004), vec3(0.03, 1.0, 0.045), vec3(0.012, 0.06, 1.0));
  const float GE[3] = float[3](10.0, 6.0, 13.0);
  vec3 view = normalize(-h.xyz);
  vec3 keyL = viewDir(toKey);
  vec3 glowE = vec3(0.0), glowSum = vec3(0.0), flat_ = keyE * spherePhase(keyL, view);
  for (int i = 0; i < 3; i++) {
    vec3 q = GP[i] - P; vec3 e = GC[i] * GE[i] * uGlow / (4.0 * PI * max(dot(q, q), 0.2025));
    vec3 l = viewDir(q);
    glowE += e; glowSum += l * dot(e, vec3(0.3333)); flat_ += e * spherePhase(l, view);
  }
  vec3 albedo = col.rgb / PI;
  // Real dust is uneven: each grain gets its own brightness (mean 1, about 0.6x to 1.7x), and about half are metal
  // flakes that tumble and flash for a moment when they turn their face to a light (light-coloured, not grain-coloured).
  float h1 = fract(sin(float(id) * 12.9898) * 43758.5453), h2 = fract(sin(float(id) * 78.233) * 43758.5453), h3 = fract(sin(float(id) * 39.425) * 43758.5453);
  float tier = exp2((h1 - 0.5) * 1.6) / 1.052;
  float turn = h3 * 6.2832 + uFrame / uFps * mix(3.0, 9.0, h2);
  float flash = step(0.5, h2) * pow(max(cos(turn), 0.0), 48.0);
  vec3 glint = (keyE + glowE) * flash * 0.55;
  keyE *= tier; glowE *= tier; flat_ *= tier; em2 *= tier;
  vFlat = albedo * flat_ + col.rgb * em2 + glint;
  vKeyE = keyE; vKeyL = keyL;
  vGlowE = glowE; vGlowL = length(glowSum) > 1e-8 ? normalize(glowSum) : view;
  vAlbedo = albedo;
  vEmit = col.rgb * em2 + glint;
  vAlpha = clamp(cov, 0.0, 1.0);
  vec3 face = normalize(cross(dir, side));
  vDir = dir; vSide = side; vFace = dot(face, view) < 0.0 ? -face : face;
  vShape = vec3(trail ? 0.5 * length(axis) / drawn : 0.0, pixels, drawnPx / max(pixels, 1e-6));
  vSplat = vec2(peak, sharp);
  vCorner = corner;
}`;

// Each grain is a small lit sphere and each streak the same sphere smeared along its path (a capsule), shaded
// per pixel with Blender's grain material (Principled, roughness 0.42, a thin glossy coat) under the rig lights,
// with soft edges. Below a few pixels the shape is not resolved: the disc-averaged radiance (vFlat) is used,
// which is what the shaded sphere averages to, so near and far grains carry the same light.
const fragmentShader = /* glsl */ `
${blenderDisplayGLSL}
uniform float uDensityWeight;
precision highp float;
in vec3 vFlat;
in float vAlpha;
in vec3 vKeyE, vKeyL, vGlowE, vGlowL;
in vec3 vAlbedo;
in vec3 vEmit;
in vec3 vDir, vSide, vFace;
in vec3 vShape;
in vec2 vSplat;
in vec2 vCorner;
out vec4 fragColor;
// radiance per unit irradiance: dielectric base (F0 0.04, roughness 0.42 ~ Blinn-Phong 60) + coat (weight 0.25,
// roughness 0.03, kept at 300 so its glint stays at least a pixel wide)
float gloss(vec3 n, vec3 l, vec3 view) {
  float nl = max(dot(n, l), 0.0);
  float nh = max(dot(n, normalize(l + view)), 0.0);
  return nl * 0.04 * ((68.0 / 25.1327) * pow(nh, 60.0) + 0.25 * (308.0 / 25.1327) * pow(nh, 300.0));
}
void main() {
  // distance from the capsule's axis segment in quad radii (a disc when the segment is empty) ...
  float along = vCorner.x * (vShape.x + 1.0);
  float daQuad = sign(along) * max(abs(along) - vShape.x, 0.0);
  float dQuad = length(vec2(daQuad, vCorner.y));
  // ... and in grain radii
  float da = daQuad * vShape.z, across = vCorner.y * vShape.z, d = dQuad * vShape.z;
  float pixels = vShape.y;
  float fall = max(1.0 - dQuad * dQuad, 0.0);
  float splat = vSplat.x * fall * fall;
  float aa = max(fwidth(d), 1e-4);
  float shape = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d);
  float coverage = mix(splat, shape, vSplat.y);
  if (coverage <= 0.0) discard;
  // A moving grain reads as a comet: brightest at its head, thinning toward the tail (mean 1 over the streak).
  if (vShape.x > 0.0) coverage *= mix(1.55, 0.45, vCorner.x * 0.5 + 0.5);
  vec3 colour = vFlat;
  float resolved = smoothstep(1.5, 4.0, pixels);
  if (resolved > 0.0) {
    vec3 view = vFace;
    float dc = min(d, 1.0);
    vec3 n = normalize(vDir * da + vSide * across + vFace * sqrt(max(0.0, 1.0 - dc * dc)));
    vec3 diffuse = vAlbedo * (vKeyE * max(dot(n, vKeyL), 0.0) + vGlowE * max(dot(n, vGlowL), 0.0));
    vec3 shaded = diffuse + vKeyE * gloss(n, vKeyL, view) + vGlowE * gloss(n, vGlowL, view) + vEmit;
    colour = mix(vFlat, shaded, resolved);
  }
  float a = clamp(vAlpha * coverage * uDensityWeight,0.0,1.0);
  fragColor = vec4(blenderDisplayLinear(colour) * a, a);
  #define gl_FragColor fragColor
  #include <colorspace_fragment> // premultiplied: Mix Shader(Transparent, grain, cov)
}`;

function makeMesh(
  data: boolean,
  count: number,
  attributes: Record<string, InstancedBufferAttribute>,
  cached = false,
) {
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute("corner", new BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  for (const [name, attribute] of Object.entries(attributes)) geometry.setAttribute(name, attribute);
  geometry.instanceCount = count;
  const material = new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: vertexShader(data, cached),
    fragmentShader,
    uniforms: {
      uFrame: { value: 0 },
      uFps: { value: 24 },
      uIsViewport: { value: false },
      uKeyPower: { value: 0 },
      uGlow: { value: 0 },
      uViewportHeight: { value: 1000 },
      uDensityWeight: { value: 1 },
    },
    transparent: true,
    toneMapped: false,
    side: DoubleSide, // ribbons are built facing the camera; both sides as a safeguard
    depthWrite: false,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10; // after the forming (transparent) parts, so the grains on their edge are never drawn under them
  const size = new Vector2();
  mesh.onBeforeRender = (renderer) => {
    material.uniforms.uViewportHeight.value = renderer.getDrawingBufferSize(size).y;
  };
  mesh.name = data ? "FX particles" : "FX ambient particles";
  return mesh;
}

/** Adds the particles under `root` (the projector's PRJ_ROOT, whose local space the node group works in);
 * `frame` is the Blender frame the projector timeline is at. */
/* eslint-disable react-hooks/immutability -- particle meshes, uniforms and roots are owned imperative GPU objects */
export default function ProjectorParticles({
  root,
  frame,
  onMount,
  quality,
}: {
  root: Object3D;
  frame: RefObject<number>;
  onMount: (compile: Promise<unknown>, upload: () => void) => void;
  quality: "desktop" | "laptop";
}) {
  const gl = useThree((state) => state.gl);
  const display = useBlenderViewLUT();
  const pacing = useRef({ average: 1 / 60, slowSeconds: 0, keep: 1 });
  const profile = particleProfiles[quality],
    count = profile.count;
  const meta = useMemo(() => ({ ...metadata, count }) as unknown as Meta, [count]);
  const buffer = useCompressedBuffer(profile.path);

  const { list: meshes, cache } = useMemo(() => {
    const n = meta.count;
    const blocks: Record<string, Float32Array | Uint16Array | Uint32Array> = {};
    const bytes = { f32: 4, u16: 2, u32: 4 },
      arrays = { f32: Float32Array, u16: Uint16Array, u32: Uint32Array };
    let offset = 0;
    for (const [name, width, type] of meta.blocks) {
      // Most blocks can view the original data without a second allocation/copy. The
      // u32 IDs follow a u16 block and may be unaligned, so retain the copy for that case.
      blocks[name] =
        offset % bytes[type] === 0
          ? new arrays[type](buffer, offset, n * width)
          : new arrays[type](buffer.slice(offset, offset + n * width * bytes[type]));
      offset += n * width * bytes[type];
    }
    const { fx_g: g, fx_part: part, id } = blocks;
    const misc = new Float32Array(n * 4),
      ids = Float32Array.from(id);
    for (let i = 0; i < n; i++) {
      const [t0, dur] = meta.parts[part[i]];
      misc[i * 4] = g[i];
      misc[i * 4 + 1] = t0;
      misc[i * 4 + 2] = dur;
      misc[i * 4 + 3] = part[i];
    }
    const attributes = {
      aPosition: new InstancedBufferAttribute(blocks.position, 3),
      aNormal: new InstancedBufferAttribute(blocks.fx_n, 3),
      aMisc: new InstancedBufferAttribute(misc, 4),
      aId: new InstancedBufferAttribute(ids, 1),
    };
    const direct =
      /^(localhost|127\.)/.test(location.hostname) &&
      new URLSearchParams(location.search).get("particle-eval") === "vertex";
    const cache = direct ? null : createParticleCache(gl, n, profile.ambient, attributes);
    const list = [makeMesh(true, n, attributes, !!cache), makeMesh(false, profile.ambient, {}, !!cache)];
    if (cache)
      for (const mesh of list)
        Object.assign(mesh.material.uniforms, {
          uHeadRadius: { value: cache.textures[0] },
          uTailCoverage: { value: cache.textures[1] },
          uColourEmission: { value: cache.textures[2] },
          uCacheOffset: { value: n },
        });
    return { list, cache };
  }, [buffer, meta, profile, gl]);

  useEffect(() => {
    for (const mesh of meshes) {
      root.add(mesh);
      const u = (mesh.material as ShaderMaterial).uniforms;
      u.blenderView = { value: display };
      u.uDensityWeight = { value: metadata.originalCount / count };
    }
    traceMark("Projector particle evaluation: " + (cache ? "once per grain" : "original vertex path"));
    onMount(cache?.compile() ?? Promise.resolve(), () => cache?.update(66));
    return () => {
      cache?.dispose();
      for (const mesh of meshes) {
        root.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as ShaderMaterial).dispose();
      }
    };
  }, [root, meshes, onMount, display, count, cache]);

  useFrame((_, delta) => {
    const f = frame.current ?? 0;
    const flying = f > 5 && f < 96;
    if (!flying) {
      for (const mesh of meshes) mesh.visible = false;
      return;
    }
    const pace = pacing.current;
    if (delta > 0 && !document.hidden) {
      const sample = Math.min(delta, 0.1);
      pace.average = 0.9 * pace.average + 0.1 * sample;
      pace.slowSeconds = pace.average > 1 / 55 ? pace.slowSeconds + sample : 0;
      if (pace.slowSeconds > 0.55) {
        pace.keep = Math.max(0.55, pace.keep * 0.82);
        pace.slowSeconds = 0;
      }
    }
    const mainCount = Math.floor(count * pace.keep),
      ambientCount = Math.floor(profile.ambient * pace.keep);
    cache?.update(f, mainCount, ambientCount);
    meshes.forEach((mesh, index) => {
      const u = (mesh.material as ShaderMaterial).uniforms;
      u.uFrame.value = f;
      u.uKeyPower.value = keyPower(f);
      u.uGlow.value = glowPower(f);
      u.uDensityWeight.value = (0.9 * metadata.originalCount) / mainCount;
      mesh.geometry.instanceCount = index === 0 ? mainCount : ambientCount;
      mesh.visible = true;
    });
  }, -0.7);

  return null;
}
/* eslint-enable react-hooks/immutability */
