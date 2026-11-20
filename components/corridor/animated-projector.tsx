"use client";
import {
  Suspense,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  BackSide,
  Box3,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  Float32BufferAttribute,
  FloatType,
  Group,
  Matrix4,
  Mesh,
  MeshDepthMaterial,
  MeshPhysicalMaterial,
  NearestFilter,
  NoColorSpace,
  Quaternion,
  RepeatWrapping,
  RGBAFormat,
  RGBADepthPacking,
  SRGBColorSpace,
  Sphere,
  SpotLight,
  Vector3,
  WebGLRenderTarget,
  type LightShadow,
  type Texture,
  type WebGLRenderer,
} from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { localEnvironment } from "./local-environment";
import { preparedPhoneProjectorShadows, stageLighting, updateStageLighting } from "./stage-lighting";
import { traceGLTF, traceMark, traceSpan, traceSync } from "./loading-trace";
import metadata from "./projector-animation.json";
import sourceMaterials from "../../public/textures/projector/materials.json";
import fx from "./projector-fx-config.json";
import alignedFormation from "./projector-formation-aligned.json";
import { projectorControls } from "./projector-controls";
import { configureBakedTextureLoader } from "./baked-texture-loader";
import { blenderDisplayGLSL, useBlenderViewLUT } from "./blender-view-lut";
import { particlesLib } from "./projector-fx/particlesLib.glsl";
import { sweepUniforms } from "./projector-fx/formation";
import { surfaceFormationGLSL } from "./projector-fx/surface-formation";
import ProjectorParticles from "./projector-particles";
import { effectQuality, type EffectQuality } from "./effect-quality";
import { loadCompressedBuffer } from "./compressed-buffer";
import { particleProfiles } from "./projector-particle-profiles";
import { createClipClock } from "./clip-clock";
import { yieldDuringLoading } from "./loading-step";
import { OPENING_PROJECTOR_PRIORITY, scheduleSceneIdle } from "./scene-idle";
import { compileHiddenGPUGradually, prepareHiddenGPU, prepareMobileMeshes } from "./hidden-gpu-preparation";
import { journeyControls } from "./journey-controls";
import { assetURL } from "./asset-url";
import { blackProjectorHousing, orangeProjectorMaterial } from "./projector-edit";
import { assemblyClips, particlePace } from "./projector-assembly";
import { projectorPartNames } from "./hover-catalogue-state";
import { bakeProjectorPose } from "./projector-static-pose";
import { prepareLegacyResponse } from "./star-bloom";
import type { MetricsStore } from "./metrics";

export const PROJECTOR_TEXTURES = [
  "/textures/projector/brushed-base.ktx2",
  "/textures/projector/brushed-metal-rough-spec.ktx2",
  "/textures/projector/brushed-normal.ktx2",
];
export function preloadProjector(gl: WebGLRenderer) {
  useGLTF.preload(metadata.modelUrl, "/draco/", false, traceGLTF);
  void loadProjectorMotion().catch(() => {});
  useLoader.preload(KTX2Loader, PROJECTOR_TEXTURES, (l) => configureBakedTextureLoader(l, gl));
  const quality = effectQuality(gl);
  if (quality !== "mobile") {
    const url = particleProfiles[quality].path;
    void loadCompressedBuffer(url).catch(() => {});
  }
}
let motionPromise: Promise<ArrayBuffer> | undefined;
export function loadProjectorMotion() {
  return (motionPromise ??= (async () => {
    const compressed = typeof DecompressionStream !== "undefined";
    const finish = traceSpan("Projector motion fetch + streamed decompression", "motion processing", {
      compressed,
    });
    try {
      const response = await fetch(assetURL(compressed ? metadata.dataUrl : metadata.fallbackUrl));
      if (!response.ok || !response.body) throw new Error("Projector animation data could not load");
      const result = await (compressed
        ? new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()
        : response.arrayBuffer());
      finish({ outputBytes: result.byteLength });
      return result;
    } catch (error) {
      finish({ error: String(error) });
      throw error;
    }
  })());
}
const projectorPoseGLSL = `
attribute float aPart;attribute float aSurface;
uniform sampler2D uPoses;uniform sampler2D uMaterials;uniform sampler2D uFxData;
uniform mat4 uFxRootInverse;uniform float uPoseFrame;uniform float uFormation;uniform float uAssemblyTime;
varying vec3 vSourceBase;varying float vPartVisible;varying float vLens;varying vec4 vSurface;varying vec4 vEmission;varying vec4 vFxTiming;varying vec4 vFxSweep;varying vec4 vFxAxis;varying vec3 vFxPoint;varying vec2 vOptics;
uniform vec3 uLensCentre;varying vec3 vLensCentre;varying float vFront;
vec3 partPosition,partScale;vec4 partRotation;
vec3 rotatePart(vec4 q,vec3 v){return v+2.0*cross(q.xyz,cross(q.xyz,v)+q.w*v);}
void readPart(){
 vLens=step(91.5,aPart)*step(aPart,99.5);vFront=step(91.5,aPart)*step(aPart,92.5);
 #ifdef STATIC_PROJECTOR
 partPosition=vec3(0.);partRotation=vec4(0.,0.,0.,1.);partScale=vec3(1.);vPartVisible=1.;
 #else
 int part=int(aPart);int id=part*3;
 float poseFrame=uPoseFrame;
 // Assembly: each part follows its own original Blender path, on its own clock (row 3: first/last moving pose, delay, seconds).
 // The curve starts at rest, moves quickly, then spends its last half slowing into place.
 if(uAssemblyTime>=0.){vec4 clip=texelFetch(uFxData,ivec2(part,3),0);float u=clamp((uAssemblyTime-clip.z)/clip.w,0.,1.),r=1.-u;poseFrame=mix(clip.x,clip.y,1.-r*r*r*(1.+3.*u));}
 int lo=int(floor(poseFrame));float t=fract(poseFrame);
 vec4 positionSample=texelFetch(uPoses,ivec2(id,lo),0),rotationSample=texelFetch(uPoses,ivec2(id+1,lo),0);
 vec3 scaleSample=texelFetch(uPoses,ivec2(id+2,lo),0).xyz;
 if(t>0.){
   int hi=min(lo+1,${metadata.frames - 1});
   vec4 nextRotation=texelFetch(uPoses,ivec2(id+1,hi),0);
   if(dot(rotationSample,nextRotation)<0.)nextRotation=-nextRotation;
   rotationSample=mix(rotationSample,nextRotation,t);
   positionSample=mix(positionSample,texelFetch(uPoses,ivec2(id,hi),0),t);
   scaleSample=mix(scaleSample,texelFetch(uPoses,ivec2(id+2,hi),0).xyz,t);
 }
 partPosition=positionSample.xyz;partRotation=normalize(rotationSample);partScale=scaleSample;vPartVisible=positionSample.w;
 #endif
 int mat=int(floor(aSurface+.5));vSurface=texelFetch(uMaterials,ivec2(mat,0),0);vEmission=texelFetch(uMaterials,ivec2(mat,1),0);vOptics=texelFetch(uMaterials,ivec2(mat,2),0).xy;vSourceBase=texelFetch(uMaterials,ivec2(mat,3),0).rgb;
 #ifndef STATIC_PROJECTOR
 if(uFormation<.9999){
   vFxTiming=texelFetch(uFxData,ivec2(part,0),0);vFxSweep=texelFetch(uFxData,ivec2(part,1),0);vFxAxis=texelFetch(uFxData,ivec2(part,2),0);
 }else vFxTiming=vFxSweep=vFxAxis=vec4(0.);
 #endif
}`;
const fragmentCommon = (mobile: boolean) => `
uniform float uFormation;uniform float uFxFrame;uniform float uCoverageEnabled;
varying vec3 vSourceBase;varying float vPartVisible;varying float vLens;varying vec4 vSurface;varying vec4 vEmission;varying vec4 vFxTiming;varying vec4 vFxSweep;varying vec4 vFxAxis;varying vec3 vFxPoint;varying vec2 vOptics;
varying vec3 vLensCentre;varying float vFront;
uniform float uRim;uniform float uGlint;uniform float uLensRadius;
// A soft rectangular window above and behind the camera, seen mirrored in the glass.
float softbox(vec3 n,vec3 v){
 vec3 r=reflect(-v,n),l=normalize(vec3(-.42,.62,.66)),u=normalize(cross(vec3(0.,1.,0.),l)),w=cross(l,u);
 float z=dot(r,l);if(z<=.05)return 0.;
 vec2 q=vec2(dot(r,u),dot(r,w))/z;
 return (1.-smoothstep(.30,.40,abs(q.x)))*(1.-smoothstep(.17,.25,abs(q.y)))*(.5+.5*smoothstep(.012,.03,abs(q.x)));
}
${blenderDisplayGLSL}
${mobile ? "" : particlesLib + surfaceFormationGLSL}
`;

const noFlight = Promise.resolve(null);
const GLINT_SECONDS = 1.1,
  FRONT_ELEMENT = 92; // LENS_Front_element_multicoated
/** Reverse playback runs at this share of the forward build's length. */
const REVERSE_PACE = 0.6;
/** Edge (rim) light: the room's soft value, and the exploded view's stronger cool studio edge. */
const RIM = { room: 0.45, exploded: 0.45 } as const;
const rimAt = (exploded: number) =>
  RIM.room + (RIM.exploded - RIM.room) * exploded * exploded * (3 - 2 * exploded);
export default function AnimatedProjector({ metrics }: { metrics: MetricsStore }) {
  const motion = loadProjectorMotion();
  const gltf = useGLTF(metadata.modelUrl, "/draco/", false, traceGLTF),
    gl = useThree((s) => s.gl);
  const quality = effectQuality(gl);
  traceMark("Projector profile: " + quality + (quality === "mobile" ? " (reveal only)" : ""));
  const bakes = useLoader(KTX2Loader, PROJECTOR_TEXTURES, (l) => configureBakedTextureLoader(l, gl));
  const buffer = use(motion),
    display = useBlenderViewLUT();
  use(quality === "mobile" ? noFlight : loadCompressedBuffer(particleProfiles[quality].path));
  const [started, setStarted] = useState(false);
  useEffect(() => {
    traceMark("Projector resources ready");
    return scheduleSceneIdle(() => setStarted(true), OPENING_PROJECTOR_PRIORITY);
  }, []);
  return started ? (
    <ProjectorRig
      gltf={gltf}
      bakes={bakes}
      buffer={buffer}
      display={display}
      quality={quality}
      metrics={metrics}
    />
  ) : null;
}
function ProjectorRig({
  gltf,
  bakes,
  buffer,
  display,
  quality,
  metrics,
}: {
  gltf: { scene: Group };
  bakes: Texture[];
  buffer: ArrayBuffer;
  display: ReturnType<typeof useBlenderViewLUT>;
  quality: EffectQuality;
  metrics: MetricsStore;
}) {
  const gl = useThree((s) => s.gl),
    get = useThree((s) => s.get),
    invalidate = useThree((s) => s.invalidate);
  const command = useSyncExternalStore(
    projectorControls.subscribe,
    projectorControls.read,
    projectorControls.read,
  );
  const frame = useRef(0),
    preparation = useRef<AbortController | null>(null),
    cancelWarm = useRef(() => {});
  const playback = useRef({ command: -1, phase: "hidden", elapsed: 0, finishing: false, glint: 0 });
  const clock = useRef(createClipClock());
  // Local, opt-in frame inspection for landing/reveal regression screenshots.
  const inspectFrame = useMemo(() => {
    if (typeof location === "undefined" || !/^(localhost|127\.)/.test(location.hostname)) return null;
    const params = new URLSearchParams(location.search),
      value = Number(params.get("formation-frame"));
    return params.get("diagnostics") === "1" && value >= 1 && value < 96 ? value : null;
  }, []);
  useEffect(() => {
    const clip = clock.current,
      visibility = () => clip.visibility(performance.now(), document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  const rig = useMemo(
    () =>
      traceSync(
        quality === "mobile"
          ? "Bake assembled phone projector"
          : "Construct projector geometry/materials/motion texture",
        () => {
          let source: Mesh | undefined;
          gltf.scene.traverse((o) => {
            if ((o as Mesh).isMesh) source = o as Mesh;
          });
          if (!source) throw new Error("Projector mesh missing");
          const mobile = quality === "mobile",
            values = new Float32Array(buffer);
          const poseGLSL = mobile ? "#define STATIC_PROJECTOR\n" + projectorPoseGLSL : projectorPoseGLSL;
          const texture = mobile
            ? null
            : new DataTexture(
                values.subarray(0, metadata.textureFloats),
                metadata.textureWidth,
                metadata.frames,
                RGBAFormat,
                FloatType,
              );
          if (texture) {
            texture.minFilter = texture.magFilter = NearestFilter;
            texture.generateMipmaps = false;
            texture.needsUpdate = true;
          }
          const geometry = new BufferGeometry();
          for (const [name, attribute] of Object.entries(source.geometry.attributes))
            geometry.setAttribute(name, attribute);
          geometry.setIndex(source.geometry.getIndex());
          const part = geometry.getAttribute("_part"),
            surface = geometry.getAttribute("_surface").clone();
          if (!part || !surface || !geometry.getAttribute("uv"))
            throw new Error("Projector source material/pose attributes missing");
          const names = projectorPartNames(alignedFormation),
            blackSurface = sourceMaterials.findIndex((m) => m.name === "PH_black_anod");
          // Keep the approved textured side's UVs. Other panels receive the same dark
          // family as a constant finish, rather than sampling unrelated atlas UVs.
          for (let i = 0; i < surface.count; i++) {
            const original = Math.round(surface.getX(i));
            if (
              original !== 40 &&
              !sourceMaterials[original]?.brushed &&
              blackProjectorHousing(names[Math.round(part.getX(i))])
            )
              surface.setX(i, blackSurface);
          }
          // Same whole-number indices, stored as floats: integer data on a float attribute makes
          // Windows (ANGLE/D3D11) recompile the shader on the GPU thread at its first draw.
          const asFloat = (a: typeof part) => {
            const out = new Float32Array(a.count);
            for (let i = 0; i < a.count; i++) out[i] = a.getX(i);
            return new Float32BufferAttribute(out, 1);
          };
          geometry.setAttribute("aPart", asFloat(part));
          geometry.setAttribute("aSurface", asFloat(surface));
          const bounds = new Box3(new Vector3(...metadata.bounds[0]), new Vector3(...metadata.bounds[1]));
          geometry.boundingBox = bounds;
          geometry.boundingSphere = bounds.getBoundingSphere(new Sphere());
          // Orange finishes stay black as approved; the glowing laser plates keep their own red.
          const params = new Float32Array(128 * 4 * 4);
          sourceMaterials.forEach((source, i) => {
            const m =
              orangeProjectorMaterial(source.baseColor) && !source.emission.some((e) => e > 0)
                ? sourceMaterials[blackSurface]
                : source;
            params.set([m.roughness, m.metalness, m.brushed ? 1 : 0, m.roughnessRange[0]], i * 4);
            params.set([...m.emission, m.roughnessRange[1]], (128 + i) * 4);
            params.set([m.ior, m.specular, 0, 0], (256 + i) * 4);
            params.set(m.baseColor, (384 + i) * 4);
          });
          const palette = new DataTexture(params, 128, 4, RGBAFormat, FloatType);
          palette.needsUpdate = true;
          let fxData: DataTexture | null = null;
          if (!mobile) {
            const fxValues = new Float32Array(metadata.parts * 4 * 4);
            fx.parts.forEach((_, i) => {
              const sweep = sweepUniforms(alignedFormation.names[alignedFormation.owners[i]]);
              fxValues.set(alignedFormation.timings[i], i * 4);
              fxValues.set(sweep.sweep, (metadata.parts + i) * 4);
              fxValues.set([...sweep.axis, sweep.revealDelay], (metadata.parts * 2 + i) * 4);
            });
            fxValues.set(assemblyClips(values), metadata.parts * 3 * 4);
            fxData = new DataTexture(fxValues, metadata.parts, 4, RGBAFormat, FloatType);
            fxData.needsUpdate = true;
          }
          const maps = bakes.map((b, i) => {
            const map = b.clone();
            map.colorSpace = i === 0 ? SRGBColorSpace : NoColorSpace;
            map.wrapS = map.wrapT = RepeatWrapping;
            map.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
            return map;
          });
          const material = new MeshPhysicalMaterial({
            name: "Projector | Source metal, rubber, copper and PCB",
            vertexColors: false,
            toneMapped: false,
            alphaToCoverage: !mobile,
            map: maps[0],
            roughnessMap: maps[1],
            normalMap: maps[2],
            envMap: localEnvironment(gl),
            envMapIntensity: 0.75,
            clearcoat: quality === "desktop" ? 0.12 : 0,
            clearcoatRoughness: 0.2,
          });
          material.normalScale.set(0.65, 0.65);
          // On the assembled projector (last pose): the front lens element's centre and size (for its glint),
          const position = geometry.getAttribute("position"),
            last = (metadata.frames - 1) * metadata.textureWidth,
            v = new Vector3(),
            q = new Quaternion();
          const lens = new Box3();
          for (let i = 0; i < position.count; i++) {
            const id = Math.round(part.getX(i)),
              off = (last + id * 3) * 4;
            if (values[off + 3] < 0.5) continue;
            v.set(
              position.getX(i) * values[off + 8],
              position.getY(i) * values[off + 9],
              position.getZ(i) * values[off + 10],
            ).applyQuaternion(q.set(values[off + 4], values[off + 5], values[off + 6], values[off + 7]));
            v.x += values[off];
            v.y += values[off + 1];
            v.z += values[off + 2];
            if (id === FRONT_ELEMENT) lens.expandByPoint(v);
          }
          const lensSize = lens.isEmpty()
            ? [0.1, 0.1, 0.1]
            : lens
                .getSize(v)
                .toArray()
                .sort((a, b) => a - b);
          const hidden = mobile ? bakeProjectorPose(geometry, values, last * 4) : null;
          const uniforms = {
            uPoses: { value: texture },
            uMaterials: { value: palette },
            uFxData: { value: fxData },
            uFxRootInverse: { value: new Matrix4().fromArray(fx.matrix).invert() },
            blenderView: { value: display },
            uPoseFrame: { value: metadata.frames - 1 },
            uAssemblyTime: { value: -1 },
            uFormation: { value: 1 },
            uFxFrame: { value: 576 },
            uCoverageEnabled: { value: 1 },
            stageIndirect: stageLighting.indirect,
            uRim: { value: 0.45 },
            uGlint: { value: -1 },
            uLensCentre: {
              value: lens.isEmpty() ? bounds.getCenter(new Vector3()) : lens.getCenter(new Vector3()),
            },
            uLensRadius: { value: lensSize[1] / 2 },
          };
          const configure = (target: MeshPhysicalMaterial, optical: boolean) => {
            target.onBeforeCompile = (shader) => {
              Object.assign(shader.uniforms, uniforms);
              shader.vertexShader = shader.vertexShader
                .replace("#include <common>", "#include <common>\n" + poseGLSL)
                .replace(
                  "#include <beginnormal_vertex>",
                  `#include <beginnormal_vertex>\nreadPart();${
                    mobile
                      ? ""
                      : "vec3 safeScale=max(abs(partScale),vec3(.000001))*mix(vec3(-1.0),vec3(1.0),step(vec3(0.0),partScale));objectNormal=rotatePart(partRotation,objectNormal/safeScale);"
                  }`,
                )
                .replace(
                  "#include <begin_vertex>",
                  `#include <begin_vertex>\nvLensCentre=(modelViewMatrix*vec4(uLensCentre,1.)).xyz;\n${
                    mobile ? "" : "transformed=rotatePart(partRotation,transformed*partScale)+partPosition;"
                  }vFxPoint=(uFxRootInverse*modelMatrix*vec4(transformed,1.0)).xyz;`,
                );
              shader.fragmentShader = shader.fragmentShader
                .replace(
                  "#include <common>",
                  "#include <common>\nuniform float stageIndirect;\n" + fragmentCommon(mobile),
                )
                .replace(
                  "#include <map_fragment>",
                  `#ifdef USE_MAP\nif(vSurface.z>.5)diffuseColor.rgb=texture2D(map,vMapUv).rgb;\n#endif`,
                )
                .replace(
                  "#include <color_fragment>",
                  `#include <color_fragment>\n${
                    optical
                      ? "diffuseColor.rgb=vec3(.80,.91,.97);"
                      : "if(vSurface.z<.5)diffuseColor.rgb=vSourceBase;"
                  }`,
                )
                .replace(
                  "#include <roughnessmap_fragment>",
                  optical
                    ? "float roughnessFactor=.012;vec3 brushedChannels=vec3(0.0);"
                    : `float roughnessFactor=vSurface.x;vec3 brushedChannels=vec3(0.0);if(vSurface.z>.5){brushedChannels=texture2D(roughnessMap,vRoughnessMapUv).rgb;roughnessFactor=brushedChannels.g;}else if(vEmission.w>vSurface.w+.001)roughnessFactor=mix(vSurface.w,vEmission.w,${
                        mobile ? ".5" : "noiseTexFac(vFxPoint,120.0,2.0,.5,2.0,0.0,true)"
                      });`,
                )
                .replace(
                  "#include <metalnessmap_fragment>",
                  `float metalnessFactor=vSurface.z>.5?brushedChannels.r:vSurface.y;`,
                )
                .replace(
                  "#include <lights_physical_fragment>",
                  `#include <lights_physical_fragment>\n
#ifdef USE_CLEARCOAT
material.clearcoat=${optical ? "1.0" : "mix(.12,.035,metalnessFactor)"};
#endif
float sourceSpecular=vSurface.z>.5?brushedChannels.b:vOptics.y;float sourceF0=pow((vOptics.x-1.0)/(vOptics.x+1.0),2.0)*2.0*sourceSpecular;material.specularColor=vec3(sourceF0);material.specularColorBlended=mix(material.specularColor,diffuseColor.rgb,metalnessFactor);`,
                )
                .replace(
                  "#include <aomap_fragment>",
                  `#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=stageIndirect;reflectedLight.indirectSpecular*=stageIndirect;
#ifdef USE_CLEARCOAT
clearcoatSpecularIndirect*=stageIndirect;
#endif
`,
                )
                .replace(
                  "#include <normal_fragment_maps>",
                  `if(vSurface.z>.5){\n#include <normal_fragment_maps>\n}`,
                )
                .replace(
                  "#include <alphatest_fragment>",
                  mobile
                    ? "#include <alphatest_fragment>"
                    : `#include <alphatest_fragment>\nif(vPartVisible<.5)discard;
if(uFormation<.9999){float reveal=surfaceFormation(vFxPoint,vFxTiming,vFxSweep,vFxAxis,uFxFrame);if(reveal<=.001)discard;${
                        optical
                          ? "diffuseColor.a*=reveal;"
                          : "if(uCoverageEnabled>.5)diffuseColor.a*=reveal;else if(reveal<.5)discard;"
                      }}`,
                )
                .replace(
                  "#include <opaque_fragment>",
                  optical
                    ? `float lensEdge=pow(1.-abs(dot(normal,normalize(vViewPosition))),3.);outgoingLight*=mix(1.,mix(.16,1.,lensEdge),vLens);${
                        quality !== "desktop" ? "diffuseColor.a*=mix(1.,.375+1.5625*lensEdge,vLens);" : ""
                      }
vec3 glassView=normalize(vViewPosition);float glassFresnel=.18+.82*pow(1.-clamp(abs(dot(normal,glassView)),0.,1.),5.);
float window=.16+.3*glassFresnel;
float glint=0.;if(uGlint>=0.&&vFront>.5){vec3 d=-vViewPosition-vLensCentre;float s=dot(d.xy,normalize(vec2(1.,.55)))/uLensRadius;glint=exp(-pow((s-mix(-1.4,1.4,uGlint))*2.4,2.))*sin(3.14159*uGlint);}
outgoingLight+=vec3(1.,.74,.36)*window+vec3(1.,.985,.96)*glint*4.;diffuseColor.a=max(diffuseColor.a,clamp(window*.9+glint,0.,1.));
#include <opaque_fragment>`
                    : `float rimFacing=1.-clamp(dot(normal,normalize(vViewPosition)),0.,1.);
// A cool back light from above, seen only on the edges: separates the dark panels from the dark room.
outgoingLight+=uRim*vec3(.70,.78,.92)*pow(rimFacing,3.)*max(dot(normal,normalize(vec3(.35,.75,-.25))),0.)*mix(.4,1.,metalnessFactor);
#include <opaque_fragment>`,
                )
                .replace(
                  "#include <emissivemap_fragment>",
                  `#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vEmission.rgb;`,
                )
                .replace(
                  "#include <tonemapping_fragment>",
                  optical
                    ? "#include <tonemapping_fragment>"
                    : `gl_FragColor.rgb=blenderDisplayLinear(gl_FragColor.rgb);`,
                );
            };
            target.customProgramCacheKey = () => "projector-physical-lean-v13-" + quality + "-" + optical;
          };
          configure(material, false);
          const glass = new MeshPhysicalMaterial({
            name: "Projector | Coated optical glass",
            transmission: quality === "desktop" ? 0.96 : 0,
            transparent: true,
            opacity: quality === "desktop" ? 1 : 0.32,
            depthWrite: false,
            thickness: 0.018,
            ior: 1.52,
            roughness: 0.012,
            metalness: 0,
            clearcoat: 1,
            clearcoatRoughness: 0.015,
            envMap: localEnvironment(gl),
            envMapIntensity: 1.6,
            iridescence: 0.28,
            iridescenceIOR: 1.32,
            iridescenceThicknessRange: [220, 360],
            toneMapped: false,
          });
          configure(glass, true);
          const indices = geometry.getIndex()!;
          let glassCount = 0,
            bodyCount = 0;
          for (let t = 0; t < indices.count; t += 3) {
            const first = indices.getX(t);
            if (hidden?.[first]) continue;
            if (Math.round(surface.getX(first)) === 40) glassCount += 3;
            else bodyCount += 3;
          }
          const body = new Uint32Array(bodyCount),
            optics = new Uint32Array(glassCount);
          let bi = 0,
            oi = 0;
          for (let t = 0; t < indices.count; t += 3) {
            const first = indices.getX(t);
            if (hidden?.[first]) continue;
            const glassPart = Math.round(surface.getX(first)) === 40;
            for (let k = 0; k < 3; k++) {
              if (glassPart) optics[oi++] = indices.getX(t + k);
              else body[bi++] = indices.getX(t + k);
            }
          }
          geometry.setIndex(new BufferAttribute(body, 1));
          const opticalGeometry = new BufferGeometry();
          for (const [name, attribute] of Object.entries(geometry.attributes))
            opticalGeometry.setAttribute(name, attribute);
          opticalGeometry.setIndex(new BufferAttribute(optics, 1));
          opticalGeometry.boundingBox = bounds;
          opticalGeometry.boundingSphere = geometry.boundingSphere;
          // Three's shadow path gives alpha-to-coverage casters this fixed alpha test.
          const depth = new MeshDepthMaterial({
            depthPacking: RGBADepthPacking,
            side: BackSide,
            alphaTest: mobile ? 0 : 0.5,
            map: mobile ? null : maps[0],
          });
          if (!mobile) {
            depth.onBeforeCompile = (shader) => {
              Object.assign(shader.uniforms, uniforms);
              shader.vertexShader = shader.vertexShader
                .replace("#include <common>", "#include <common>\n" + projectorPoseGLSL)
                .replace(
                  "#include <begin_vertex>",
                  "#include <begin_vertex>\nreadPart();transformed=rotatePart(partRotation,transformed*partScale)+partPosition;vFxPoint=(uFxRootInverse*modelMatrix*vec4(transformed,1.)).xyz;",
                );
              shader.fragmentShader = shader.fragmentShader
                .replace(
                  "#include <common>",
                  "#include <common>\nvarying float vPartVisible;varying vec4 vFxTiming,vFxSweep,vFxAxis;varying vec3 vFxPoint;uniform float uFxFrame,uFormation;\n" +
                    particlesLib +
                    surfaceFormationGLSL,
                )
                .replace(
                  "#include <alphatest_fragment>",
                  "#include <alphatest_fragment>\nif(vPartVisible<.5||(uFormation<.9999&&surfaceFormation(vFxPoint,vFxTiming,vFxSweep,vFxAxis,uFxFrame)<.5))discard;",
                );
            };
            depth.customProgramCacheKey = () => "projector-pose-shadow-v5";
          }
          const mesh = new Mesh(geometry, material),
            opticalMesh = new Mesh(opticalGeometry, glass),
            fxRoot = new Group();
          mesh.name = "Projector | Opaque original materials";
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.customDepthMaterial = depth;
          opticalMesh.name = "Projector | Optical lens and prisms";
          opticalMesh.userData.excludeFromMirror = true;
          fxRoot.name = "Projector | Original particle coordinates";
          fxRoot.matrixAutoUpdate = false;
          fxRoot.matrix.fromArray(fx.matrix);
          const defaultSamples = gl.getContext().getParameter(gl.getContext().SAMPLES) as number;
          mesh.onBeforeRender = (renderer) => {
            uniforms.uCoverageEnabled.value =
              (renderer.getRenderTarget()?.samples ?? defaultSamples) > 1 ? 1 : 0;
          };
          mesh.visible = opticalMesh.visible = fxRoot.visible = false;
          mesh.userData.projectorHover = { uniforms, opticalGeometry, poseGLSL, partNames: names };
          const shadowProbe = new Mesh(geometry, depth);
          shadowProbe.receiveShadow = mesh.receiveShadow;
          return {
            mesh,
            opticalMesh,
            fxRoot,
            uniforms,
            texture,
            palette,
            fxData,
            maps,
            geometry,
            material,
            glass,
            opticalGeometry,
            depth,
            shadowProbe,
          };
        },
      ),
    [gltf, buffer, bakes, display, gl, quality],
  );
  const prepare = useCallback(
    (particles: Promise<unknown>, uploadParticles: () => void) => {
      preparation.current?.abort();
      cancelWarm.current();
      const controller = new AbortController();
      preparation.current = controller;
      const schedule = (job: () => void) =>
        scheduleSceneIdle(job, OPENING_PROJECTOR_PRIORITY, () => {
          const shot = journeyControls.read();
          return shot.phase !== "intro" || shot.openingPrepared;
        });
      const fail = (error: unknown) => {
        if (!controller.signal.aborted) {
          projectorControls.fail();
          console.error("Projector preparation failed", error);
        }
      };
      // The particle compile can settle before the room is mounted.
      void particles.catch(() => {});
      const queue = () => {
        if (controller.signal.aborted) return;
        if (!metrics.read().corridorReady) {
          cancelWarm.current = schedule(queue);
          return;
        }
        const yieldStep = journeyControls.read().loaderDone ? undefined : yieldDuringLoading;
        const returning = journeyControls.read().phase === "pageReturnLoading";
        const state = get();
        const corridor = state.scene.getObjectByName("Corridor room");
        if (corridor) prepareLegacyResponse(corridor);
        let shadow: LightShadow | undefined;
        state.scene.traverseVisible((object) => {
          if (object instanceof SpotLight && object.castShadow) shadow = object.shadow;
        });
        const prepareShadow = () => {
          // All tiers: desktop used to skip this, and its private draw then linked the shadow-pass depth variant
          // synchronously (~70 ms on Windows) right before the pullback.
          if (!(shadow?.map instanceof WebGLRenderTarget)) return Promise.resolve();
          const previous = gl.getRenderTarget();
          try {
            gl.setRenderTarget(shadow.map);
            return gl.compileAsync(rig.shadowProbe, shadow.camera, state.scene);
          } finally {
            gl.setRenderTarget(previous);
          }
        };
        const draw = async () => {
          const { scene, camera } = get();
          const end = traceSpan(
            returning ? "Covered full-scene GPU preparation" : "Hidden projector GPU preparation",
            "GPU resource submission",
          );
          try {
            if (quality === "mobile") {
              const alive = () => !controller.signal.aborted;
              const meshes = [rig.mesh, rig.opticalMesh];
              if (corridor) {
                // The room root stays hidden until this finishes. Its visible children
                // are the surfaces the pullback and corridor will actually use.
                corridor.children.forEach((child) =>
                  child.traverseVisible((object) => {
                    if (object instanceof Mesh) meshes.push(object);
                  }),
                );
              }
              // Use the selected draws to upload the textures they actually sample.
              // A separate material-wide initTexture sweep blocked the phone even
              // before the first hidden draw, and uploaded unused uniforms as well.
              await prepareMobileMeshes(gl, scene, camera, meshes, alive, yieldStep, shadow);
              if (alive() && shadow?.map) preparedPhoneProjectorShadows.add(shadow);
            } else {
              uploadParticles();
              prepareHiddenGPU(gl, scene, camera, [scene], shadow);
            }
            end();
            if (controller.signal.aborted) return;
            traceMark("Projector GPU ready");
            projectorControls.ready(true);
            invalidate();
          } catch (error) {
            end({ error: String(error) });
            fail(error);
          }
        };
        // Prepare the actual scene and its reflection together with the particle field.
        // The visible corridor backdrop must already be mounted.
        const end = traceSpan(
          returning ? "Covered full-scene shader preparation" : "Stationary full-scene shader preparation",
          "shader preparation",
        );
        const alive = () => !controller.signal.aborted;
        const compile = async () => {
          if (quality !== "mobile") {
            await compileHiddenGPUGradually(gl, state.scene, state.camera, alive, state.scene, false, yieldStep);
            return;
          }
          for (const root of [rig.mesh, rig.opticalMesh, corridor]) {
            if (root && alive()) await compileHiddenGPUGradually(gl, state.scene, state.camera, alive, root, false, yieldStep);
          }
        };
        void Promise.all([particles, prepareShadow(), compile()])
          .then(() => {
            end();
            if (!controller.signal.aborted) cancelWarm.current = schedule(draw);
          })
          .catch((error) => {
            end({ error: String(error) });
            fail(error);
          });
      };
      cancelWarm.current = schedule(queue);
    },
    [get, gl, invalidate, metrics, quality, rig.mesh, rig.opticalMesh, rig.shadowProbe],
  );
  /* eslint-disable react-hooks/immutability -- owned GPU uniforms, shaders and frame state */
  useEffect(() => {
    stageLighting.geometryVersion++;
    if (quality === "mobile") prepare(Promise.resolve(), () => {});
    return () => {
      preparation.current?.abort();
      cancelWarm.current();
      projectorControls.ready(false);
      rig.geometry.dispose();
      rig.opticalGeometry.dispose();
      rig.material.dispose();
      rig.glass.dispose();
      rig.depth.dispose();
      rig.texture?.dispose();
      rig.palette.dispose();
      rig.fxData?.dispose();
      rig.maps.forEach((m) => m.dispose());
    };
  }, [rig, quality, prepare]);
  useEffect(() => {
    if (!command.ready || playback.current.command === command.command) return;
    Object.assign(playback.current, {
      command: command.command,
      phase: command.phase,
      elapsed: 0,
      finishing: false,
      glint: 0,
    });
    rig.uniforms.uGlint.value = -1;
    clock.current.start(performance.now(), document.hidden);
    const visible = command.phase !== "hidden";
    rig.mesh.visible = rig.opticalMesh.visible = rig.fxRoot.visible = visible;
    stageLighting.geometryVersion++;
    if (visible) traceMark("Projector first revealed");
    rig.uniforms.uFormation.value = command.phase === "particles" ? 0 : 1;
    rig.uniforms.uPoseFrame.value = command.phase === "assembled" ? metadata.frames - 1 : 0;
    rig.uniforms.uAssemblyTime.value =
      command.phase === "assembling" ? 0 : command.phase === "disassembling" ? metadata.assemblySeconds : -1;
    frame.current =
      command.phase === "hidden"
        ? 0
        : command.phase === "particles"
          ? 1
          : command.phase === "assembled" || command.phase === "disassembling"
            ? 576
            : 96;
    rig.uniforms.uFxFrame.value = frame.current;
    rig.uniforms.uRim.value = rimAt(command.phase === "exploded" || command.phase === "dissolving" ? 1 : 0);
    invalidate();
  }, [command, rig, invalidate]);
  useFrame(({ controls }) => {
    // The projector is never on screen from the logo climb or the final eye (pixel-checked on desktop and phone),
    // yet its glass alone makes three draw the whole scene once more for transmission. The Orbit camera keeps it.
    const journey = journeyControls.read().phase;
    rig.opticalMesh.visible =
      rig.mesh.visible && (!!controls || (journey !== "logoReveal" && journey !== "logoDone"));
    const state = playback.current;
    if (state.phase === "disassembling" || state.phase === "dissolving") {
      // Scrolling back: the build plays in reverse, a little quicker. Room light is owned by the journey here.
      if (document.hidden) return;
      state.elapsed = clock.current.elapsed(performance.now());
      const dissolve = state.phase === "dissolving",
        seconds = (dissolve ? metadata.particleSeconds : metadata.assemblySeconds) * REVERSE_PACE;
      const t = Math.min(1, state.elapsed / seconds),
        back = 1 - t;
      if (dissolve) {
        rig.uniforms.uFormation.value = back;
        frame.current = 1 + 95 * particlePace(back);
        rig.uniforms.uRim.value = rimAt(back);
      } else {
        rig.uniforms.uAssemblyTime.value = back * metadata.assemblySeconds;
        frame.current = 96 + back * 480;
        rig.uniforms.uRim.value = rimAt(t);
      }
      rig.uniforms.uFxFrame.value = frame.current;
      stageLighting.frame = frame.current;
      if (t < 1) invalidate();
      else if (!state.finishing) {
        state.finishing = true;
        const phase = dissolve ? "hidden" : "exploded";
        rig.uniforms.uAssemblyTime.value = -1;
        rig.uniforms.uPoseFrame.value = 0;
        if (dissolve) {
          rig.mesh.visible = rig.opticalMesh.visible = rig.fxRoot.visible = false;
          frame.current = 0;
          stageLighting.geometryVersion++;
        }
        state.phase = phase;
        invalidate();
        queueMicrotask(() => projectorControls.finish(state.command, phase));
      }
      return;
    }
    if (state.phase !== "particles" && state.phase !== "assembling") {
      updateStageLighting(frame.current, state.phase === "exploded");
      // (No glint after the build any more: the camera leaves as the build ends. The glass holds a steady warm glow.)
      if (state.glint && !document.hidden) {
        const g = (performance.now() - state.glint) / 1000 / GLINT_SECONDS;
        rig.uniforms.uGlint.value = g < 1 ? g : -1;
        if (g < 1) invalidate();
        else state.glint = 0;
      }
      return;
    }
    if (document.hidden) return;
    state.elapsed = clock.current.elapsed(performance.now());
    const seconds = state.phase === "particles" ? metadata.particleSeconds : metadata.assemblySeconds;
    const inspecting = state.phase === "particles" && inspectFrame !== null;
    const t = inspecting ? (inspectFrame - 1) / 95 : Math.min(1, state.elapsed / seconds);
    // Room light keeps Blender's linear timeline; the grains and surfaces follow the paced one (projector-assembly.ts).
    if (state.phase === "particles") {
      rig.uniforms.uFormation.value = t;
      frame.current = inspecting ? inspectFrame : 1 + 95 * particlePace(t);
      rig.uniforms.uRim.value = rimAt(t);
    } else {
      rig.uniforms.uAssemblyTime.value = t * seconds;
      frame.current = 96 + t * 480;
      rig.uniforms.uRim.value = rimAt(1 - t);
    }
    rig.uniforms.uFxFrame.value = frame.current;
    updateStageLighting(state.phase === "particles" ? 1 + t * 95 : frame.current, true);
    if (t < 1) {
      if (!inspecting) invalidate();
    } else if (!state.finishing) {
      state.finishing = true;
      const phase = state.phase === "particles" ? "exploded" : "assembled";
      if (phase === "assembled") {
        rig.uniforms.uAssemblyTime.value = -1;
        rig.uniforms.uPoseFrame.value = metadata.frames - 1;
        invalidate();
      }
      state.phase = phase;
      queueMicrotask(() => projectorControls.finish(state.command, phase));
    }
  }, -0.75);
  /* eslint-enable react-hooks/immutability */
  return (
    <>
      <primitive object={rig.mesh} dispose={null} />
      <primitive object={rig.opticalMesh} dispose={null} />
      <primitive object={rig.fxRoot} dispose={null} />
      <Suspense fallback={null}>
        {quality !== "mobile" ? (
          <ProjectorParticles quality={quality} root={rig.fxRoot} frame={frame} onMount={prepare} />
        ) : null}
      </Suspense>
    </>
  );
}
