"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BloomEffect, EffectComposer, Pass, RenderPass } from "postprocessing";
import {
  AdditiveBlending,
  Color,
  CustomBlending,
  Frustum,
  HalfFloatType,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  OneFactor,
  OneMinusSrcAlphaFactor,
  Scene,
  ShaderChunk,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import type { Camera, Object3D, TextureDataType } from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { effectQuality, type EffectQuality } from "./effect-quality";
import { phoneEyePreparationWindow, scheduleSceneIdle, waitForSceneIdle } from "./scene-idle";
import { journeyControls, type JourneyPhase } from "./journey-controls";
import { pageReturn } from "./page-exit";
import { createSpaceGrade } from "./space-grade";
import { createSilverToneControl, silverToneAmount } from "./silver-tones";
import { createPupilFillMask, isPupilFillMaterial, PUPIL_FILL_NAME } from "./pupil-fill";
import {
  createPupilPulse,
  privatePupilLightMaterial,
  PUPIL_BORDER_NAME,
  PUPIL_RAY_NAME,
} from "./pupil-pulse";
import {
  compileByDryRun,
  compileHiddenGPU,
  prepareHiddenGPU,
  prepareMobileMeshes,
} from "./hidden-gpu-preparation";
import { LOGO_PARTICLE_EYE_ENABLED } from "./scene-features";
import { traceMark, traceSpan } from "./loading-trace";
import { PUPIL_PULSE, pupilPulseUniforms } from "./pupil-pulse-state";
import { GRAIN_REACTION } from "./pupil-grain-reaction";
import {
  cinemaControls,
  cinemaShot,
  CINEMA_DEFAULTS,
  resolveCinemaValues,
  type CinemaValues,
} from "./cinema-controls";
import { createCinemaFocus } from "./cinema-focus";

// Only the glow buffer is HDR. Keep the approved display-LUT image on its
// original framebuffer: changing its transparent blending space changes steel.
const STAR_BLOOM = {
  desktop: { scale: 1, blurScale: 0.5, levels: 4, gain: 0.24 },
  laptop: { scale: 0.75, blurScale: 0.5, levels: 3, gain: 0.24 },
  mobile: { scale: 0.5, blurScale: 0.5, levels: 2, gain: 0.24 },
} as const;
const STAR_NAME = "Logo eye — sparse depth grains";
const EYE_NAME = "Approved revision 16 — authored steel grains";

class StarBloomPass extends Pass {
  readonly bloom = new BloomEffect({
    luminanceThreshold: 1.15,
    luminanceSmoothing: 0.15,
    mipmapBlur: true,
    radius: 0.35,
    levels: 4,
  });
  constructor(private profile: (typeof STAR_BLOOM)[EffectQuality]) {
    super("Star highlights only");
    this.needsSwap = false;
    this.bloom.mipmapBlurPass.levels = profile.levels;
  }
  initialize(renderer: WebGLRenderer, alpha: boolean, type: TextureDataType) {
    this.bloom.initialize(renderer, alpha, type);
  }
  setSize(width: number, height: number) {
    this.bloom.setSize(width, height);
    // Bloom's resolutionScale does not resize its mipmap chain. Do it explicitly.
    this.bloom.luminancePass.setSize(
      Math.max(1, Math.round(width * this.profile.blurScale)),
      Math.max(1, Math.round(height * this.profile.blurScale)),
    );
    this.bloom.mipmapBlurPass.setSize(
      Math.max(1, Math.round(width * this.profile.blurScale)),
      Math.max(1, Math.round(height * this.profile.blurScale)),
    );
  }
  render(renderer: WebGLRenderer, input: WebGLRenderTarget) {
    this.bloom.update(renderer, input, 0);
  }
  dispose() {
    this.bloom.dispose();
  }
}

function privateGrainMaterial(source: ShaderMaterial, stars: boolean) {
  const material = source.clone();
  material.uniforms = source.uniforms;
  material.fragmentShader = source.fragmentShader
    .replace("void main(){", `void main(){${stars ? "if(vDistant<.5)discard;" : ""}`)
    .replaceAll(
      "#include <colorspace_fragment>",
      stars
        ? // HDR radiance exists only in this private extraction. The visible shader,
          // its LUT, alpha, geometry and all instance data remain untouched.
          "fragmentColour=vec4(fragmentColour.rgb*fragmentColour.a*12.,0.);"
        : source.fragmentShader.includes("vDistant")
          ? "fragmentColour.rgb=vec3(0.);"
          : `fragmentColour.rgb=vHeroBloom*fragmentColour.a*${GRAIN_REACTION.bloom.toFixed(1)};`,
    );
  if (!stars && source.fragmentShader.includes("vDistant"))
    material.fragmentShader = material.fragmentShader.replace(
      "void main(){",
      "void main(){if(vDistant>.5)discard;",
    );
  material.blending = CustomBlending;
  material.blendSrc = OneFactor;
  material.blendDst = OneMinusSrcAlphaFactor;
  material.blendSrcAlpha = OneFactor;
  material.blendDstAlpha = OneMinusSrcAlphaFactor;
  // The black occlusion masks use premultiplied alpha as well (black * alpha = 0).
  return material;
}

function createStarBloom(
  gl: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  quality: EffectQuality,
  enabled = true,
) {
  const profile = STAR_BLOOM[quality],
    privateScene = new Scene(),
    black = new MeshBasicMaterial({ color: 0, depthWrite: true, toneMapped: false });
  const oldAutoClear = gl.autoClear;
  const composer = new EffectComposer(gl, {
    frameBufferType: HalfFloatType,
    multisampling: 0,
    depthBuffer: true,
  });
  gl.autoClear = oldAutoClear;
  composer.autoRenderToScreen = false;
  const render = new RenderPass(privateScene, camera);
  render.clearPass.overrideClearColor = new Color(0);
  render.clearPass.overrideClearAlpha = 0;
  const bloomPass = new StarBloomPass(profile);
  bloomPass.enabled = enabled;
  composer.addPass(render);
  composer.addPass(bloomPass);
  const overlayMaterial = new ShaderMaterial({
    toneMapped: false,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uBloom: { value: bloomPass.bloom.texture },
      uMask: { value: composer.inputBuffer.texture },
      uGain: { value: profile.gain },
      uHeroGlow: { value: 0 },
      uHeroCore: pupilPulseUniforms.uHeroCore,
      uHeroHalo: pupilPulseUniforms.uHeroHalo,
    },
    vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}",
    // Add a small display-relative halo only. Do not regrade or tone-map the base.
    fragmentShader: /* glsl */ `
      uniform sampler2D uBloom,uMask;uniform float uGain,uHeroGlow;uniform vec3 uHeroCore,uHeroHalo;varying vec2 vUv;
      void main(){
        float open=mix(1.-texture2D(uMask,vUv).a,1.,uHeroGlow);
        vec3 light=texture2D(uBloom,vUv).rgb;
        if(uHeroGlow>.5){
          float energy=dot(light,vec3(.2126,.7152,.0722));
          // White-hot centre; pale blue/cyan wings only around emitted light.
          light=mix(uHeroHalo,uHeroCore,smoothstep(.10,1.4,energy))*energy;
        }
        gl_FragColor=vec4(light*uGain*open,1.);
      }`,
  });
  const overlay = new FullScreenQuad(overlayMaterial),
    pixels = new Vector2();
  const mobile = quality === "mobile",
    frustum = new Frustum(),
    viewProjection = new Matrix4();
  const proxies = new Map<Mesh, { mesh: Mesh; sourceMaterial: Material | Material[]; owned: Material[] }>();
  let width = 0,
    height = 0;
  function sync(warm: boolean) {
    if (mobile)
      frustum.setFromProjectionMatrix(
        viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
        gl.coordinateSystem,
      );
    const seen = new Set<Mesh>();
    privateScene.children.forEach((child) => (child.visible = false));
    const visit = (object: Object3D) => {
      if (!(object instanceof Mesh)) return;
      const source = object.material,
        isStars = object.name === STAR_NAME,
        isEye = object.name === EYE_NAME,
        isPupil = !Array.isArray(source) && isPupilFillMaterial(source);
      const opaque = Array.isArray(source) ? source.some((m) => !m.transparent) : !source.transparent,
        isPulse = object.userData.pupilPulseEmitter === true;
      if (!isStars && !isEye && !opaque && !isPupil && !isPulse) return;
      if (
        mobile &&
        !isStars &&
        !isEye &&
        !isPupil &&
        !isPulse &&
        object.frustumCulled &&
        !frustum.intersectsObject(object)
      )
        return;
      seen.add(object);
      let entry = proxies.get(object);
      if (entry && entry.sourceMaterial !== source) {
        privateScene.remove(entry.mesh);
        const near = entry.mesh.userData.nearMask as Mesh | undefined;
        if (near) privateScene.remove(near);
        entry.owned.forEach((m) => m.dispose());
        proxies.delete(object);
        entry = undefined;
      }
      if (!entry) {
        const owned: Material[] = [];
        let material: Material | Material[] = black;
        if (isPulse && source instanceof ShaderMaterial) {
          material = privatePupilLightMaterial(source);
          owned.push(material);
        } else if (isPupil && !Array.isArray(source)) {
          material = createPupilFillMask(source)!;
          owned.push(material);
        } else if ((isStars || isEye) && source instanceof ShaderMaterial) {
          material = privateGrainMaterial(source, isStars);
          owned.push(material);
        } else if (Array.isArray(source))
          material = source.map((m) => {
            const mask = new MeshBasicMaterial({
              color: 0,
              visible: !m.transparent,
              side: m.side,
              toneMapped: false,
            });
            owned.push(mask);
            return mask;
          });
        else {
          material = new MeshBasicMaterial({ color: 0, side: source.side, toneMapped: false });
          owned.push(material);
        }
        const mesh = new Mesh(object.geometry, material);
        mesh.matrixAutoUpdate = false;
        mesh.frustumCulled = false;
        mesh.renderOrder = isStars ? 0 : isEye ? 2 : 1;
        privateScene.add(mesh);
        entry = { mesh, sourceMaterial: source, owned };
        proxies.set(object, entry);
      }
      entry.mesh.geometry = object.geometry;
      entry.mesh.matrix.copy(object.matrixWorld);
      entry.mesh.visible = true;
    };
    scene.traverseVisible(visit);
    if (warm) {
      // Prepare before the sky is visible, at the preceding stationary stop.
      // Never change the source hierarchy's visibility to warm a post effect.
      for (const name of [STAR_NAME, EYE_NAME, PUPIL_FILL_NAME, PUPIL_BORDER_NAME, PUPIL_RAY_NAME]) {
        const source = scene.getObjectByName(name);
        if (source) {
          source.updateWorldMatrix(true, false);
          visit(source);
        }
      }
    }
    // Nearby loose grains occlude the stars using their unchanged atlas coverage.
    const source = scene.getObjectByName(STAR_NAME) as Mesh | undefined;
    if (source && source.material instanceof ShaderMaterial) {
      const entry = proxies.get(source);
      if (entry && !entry.mesh.userData.nearMask) {
        const material = privateGrainMaterial(source.material, false),
          near = new Mesh(source.geometry, material);
        near.matrixAutoUpdate = false;
        near.frustumCulled = false;
        near.renderOrder = 3;
        privateScene.add(near);
        entry.owned.push(material);
        entry.mesh.userData.nearMask = near;
      }
      const near = entry?.mesh.userData.nearMask as Mesh | undefined;
      if (near && entry) {
        near.visible = entry.mesh.visible;
        near.matrix.copy(source.matrixWorld);
      }
    }
    proxies.forEach((entry, source) => {
      if (seen.has(source)) return;
      // Keep warmed programs for culled/temporarily hidden sources on phones.
      if (mobile) {
        let node: Object3D | null = source.parent;
        while (node && node !== scene) node = node.parent;
        if (node === scene) return;
      }
      privateScene.remove(entry.mesh);
      const near = entry.mesh.userData.nearMask as Mesh | undefined;
      if (near) privateScene.remove(near);
      entry.owned.forEach((material) => material.dispose());
      proxies.delete(source);
    });
  }
  function draw(composite: boolean, heroGlow = false, tuning?: CinemaValues) {
    const target = gl.getRenderTarget(),
      auto = gl.autoClear,
      shadow = gl.shadowMap.autoUpdate;
    const clearColour = gl.getClearColor(new Color()).clone(),
      clearAlpha = gl.getClearAlpha();
    gl.getDrawingBufferSize(pixels);
    const w = Math.max(1, Math.round(pixels.x * profile.scale)),
      h = Math.max(1, Math.round(pixels.y * profile.scale));
    if (w !== width || h !== height) {
      width = w;
      height = h;
      // Composer.setSize also resizes the visible renderer. Resize private
      // buffers directly so laptop/mobile scaling cannot change the canvas.
      composer.inputBuffer.setSize(w, h);
      composer.outputBuffer.setSize(w, h);
      composer.passes.forEach((pass) => pass.setSize(w, h));
    }
    sync(!composite);
    render.mainCamera = camera;
    overlayMaterial.uniforms.uGain.value = heroGlow
      ? tuning?.heroBloom ?? PUPIL_PULSE.bloomGain
      : tuning?.starBloom ?? profile.gain;
    overlayMaterial.uniforms.uHeroGlow.value = heroGlow ? 1 : 0;
    bloomPass.enabled = enabled && (!tuning || (tuning.post && tuning.bloom));
    bloomPass.bloom.mipmapBlurPass.radius = heroGlow
      ? tuning?.heroRadius ?? PUPIL_PULSE.bloomRadius
      : tuning?.starRadius ?? 0.35;
    const uniforms = new Set<ShaderMaterial["uniforms"]>();
    proxies.forEach((entry) =>
      entry.owned.forEach((material) => {
        if (material instanceof ShaderMaterial && material.uniforms.uViewportHeight)
          uniforms.add(material.uniforms);
      }),
    );
    const sizes = [...uniforms].map((uniforms) => ({
      uniforms,
      height: uniforms.uViewportHeight.value,
      dpr: uniforms.uDpr.value,
      opacity: uniforms.uOpacity.value,
    }));
    // Match screen footprints when extracting at a smaller device-tier resolution.
    sizes.forEach(({ uniforms }) => {
      uniforms.uViewportHeight.value = pixels.y * profile.scale;
      uniforms.uDpr.value = gl.getPixelRatio() * profile.scale;
      if (!composite) uniforms.uOpacity.value = 1;
    });
    try {
      gl.autoClear = false;
      gl.shadowMap.autoUpdate = false;
      composer.render(0);
      if (composite && bloomPass.enabled) {
        gl.setRenderTarget(target);
        overlay.render(gl);
      }
    } finally {
      sizes.forEach(({ uniforms, height, dpr, opacity }) => {
        uniforms.uViewportHeight.value = height;
        uniforms.uDpr.value = dpr;
        uniforms.uOpacity.value = opacity;
      });
      gl.setRenderTarget(target);
      gl.autoClear = auto;
      gl.shadowMap.autoUpdate = shadow;
      gl.setClearColor(clearColour, clearAlpha);
    }
  }
  return {
    mask: composer.inputBuffer.texture,
    draw,
    dispose() {
      composer.dispose();
      overlay.dispose();
      overlayMaterial.dispose();
      black.dispose();
      proxies.forEach((p) => p.owned.forEach((m) => m.dispose()));
      privateScene.clear();
    },
  };
}

type LegacyResponse = Map<
  Material,
  { compile: Material["onBeforeCompile"]; key: Material["customProgramCacheKey"] }
>;
let activeLegacy: LegacyResponse | null = null;
/** Apply the retained ACES response to a subtree before it is compiled ahead of time, so its first
 * visible frame does not swap every patched material to a new, synchronously linked program. */
export function prepareLegacyResponse(root: Object3D) {
  if (activeLegacy) preserveLegacyResponse(root, activeLegacy);
}
function renderBase(gl: WebGLRenderer, scene: Scene, camera: Camera, legacy: LegacyResponse) {
  activeLegacy = legacy;
  preserveLegacyResponse(scene, legacy);
  const auto = gl.autoClear;
  try {
    gl.autoClear = true;
    gl.render(scene, camera);
  } finally {
    gl.autoClear = auto;
  }
}
function preserveLegacyResponse(root: Object3D, legacy: LegacyResponse) {
  // The previous Canvas default was ACES, despite the intended NoToneMapping
  // setup. Retain that *existing* response only on ordinary mapped materials.
  // Every custom particle/LUT material is excluded. A global switch alone
  // would otherwise brighten the corridor and change the approved base image.
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const materials: Material[] = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material.toneMapped || material instanceof ShaderMaterial || legacy.has(material)) continue;
      const compile = material.onBeforeCompile,
        key = material.customProgramCacheKey,
        cacheKey = key.call(material);
      legacy.set(material, { compile, key });
      material.onBeforeCompile = function (shader, renderer) {
        compile.call(this, shader, renderer);
        shader.uniforms.toneMappingExposure = { value: renderer.toneMappingExposure };
        shader.fragmentShader =
          ShaderChunk.tonemapping_pars_fragment +
          "\n" +
          shader.fragmentShader.replace(
            "#include <tonemapping_fragment>",
            "gl_FragColor.rgb=ACESFilmicToneMapping(gl_FragColor.rgb);",
          );
      };
      material.customProgramCacheKey = () => cacheKey + "|preserve-authored-response";
      material.needsUpdate = true;
    }
  });
}

function renderFrame(
  gl: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  phase: JourneyPhase,
  legacy: LegacyResponse,
  pipeline: ReturnType<typeof createStarBloom> | null,
  grade: ReturnType<typeof createSpaceGrade> | null,
  tones: ReturnType<typeof createSilverToneControl> | null,
  heroGlow = false,
  contact?: () => void,
  tuning?: CinemaValues,
  focus?: ReturnType<typeof createCinemaFocus> | null,
  mobile = false,
) {
  const autoReset = gl.info.autoReset;
  gl.info.autoReset = false;
  gl.info.reset();
  try {
    contact?.();
    const eye = scene.getObjectByName(EYE_NAME) as Mesh | undefined;
    tones?.apply(
      eye?.material instanceof ShaderMaterial ? eye.material : null,
      silverToneAmount(phase, camera.position.y),
    );
    renderBase(gl, scene, camera, legacy);
    const source = scene.getObjectByName(STAR_NAME);
    const sky = !!(source && source.visible && source.parent?.visible);
    const extract = (!mobile && sky) || heroGlow;
    if (extract && pipeline && (!tuning || (tuning.post && (tuning.bloom || tuning.grade))))
      pipeline.draw(true, heroGlow, tuning);
    if (tuning && (phase === "logoReveal" || phase === "logoDone")) focus?.draw(camera, tuning);
    if (grade && (phase === "logoReveal" || phase === "logoDone")) {
      const amount = eye?.material instanceof ShaderMaterial ? eye.material.uniforms.uOpacity.value : 0;
      grade.draw(camera, extract && sky && pipeline ? pipeline.mask : null, sky, amount, tuning);
    }
  } finally {
    gl.info.autoReset = autoReset;
  }
}

/** Existing renderer plus the finite, user-authorised final pupil pulse. */
export default function StarBloom() {
  const { gl, scene, camera, invalidate } = useThree(),
    pipeline = useRef<ReturnType<typeof createStarBloom> | null>(null),
    grade = useRef<ReturnType<typeof createSpaceGrade> | null>(null),
    tones = useRef<ReturnType<typeof createSilverToneControl> | null>(null),
    legacy = useRef<LegacyResponse>(new Map());
  const mobile = effectQuality(gl) === "mobile";
  const pulse = useRef<ReturnType<typeof createPupilPulse> | null>(null),
    reduce = useRef(false);
  const tuning = useRef<CinemaValues>({ ...CINEMA_DEFAULTS }),
    focus = useRef<ReturnType<typeof createCinemaFocus> | null>(null);
  useEffect(() => cinemaControls.subscribe(invalidate), [invalidate]);
  useEffect(() => {
    let covered = journeyControls.read().finalCovered;
    return journeyControls.subscribe(() => {
      const next = journeyControls.read().finalCovered;
      if (next !== covered) {
        covered = next;
        pulse.current?.pause();
        invalidate();
      }
    });
  }, [invalidate]);
  useEffect(
    () => () => {
      focus.current?.dispose();
      focus.current = null;
    },
    [gl, scene],
  );
  useEffect(() => {
    let cancel = () => {},
      phase: JourneyPhase | undefined;
    const schedule = () => {
      const next = journeyControls.read().phase;
      if (next === phase) return;
      phase = next;
      cancel();
      pageReturn.warming = false;
      if (next !== "page") return;
      const warm = () => {
        const eye = scene.getObjectByName(EYE_NAME);
        if (LOGO_PARTICLE_EYE_ENABLED && !eye?.userData.eyePrepared) return;
        // Invalidate after a quiet interval, while the HTML is still opaque.
        pageReturn.warming = true;
        invalidate();
      };
      cancel = scheduleSceneIdle(warm, 21, () => {
        const eye = scene.getObjectByName(EYE_NAME);
        return (
          (!LOGO_PARTICLE_EYE_ENABLED || !!eye?.userData.eyePrepared) &&
          !!document.querySelector(".normal-page")?.scrollTop
        );
      });
    };
    schedule();
    const unsubscribe = journeyControls.subscribe(schedule);
    return () => {
      cancel();
      unsubscribe();
      pageReturn.warming = false;
    };
  }, [scene, invalidate]);
  useEffect(() => {
    let cancel = () => {},
      cancelPulse = () => {},
      cancelBloom = () => {},
      pendingBloom: ReturnType<typeof createStarBloom> | null = null,
      active = true;
    const controller = new AbortController();
    const schedule = (work: () => void, priority: number) =>
      scheduleSceneIdle(work, mobile ? 20 : priority, mobile ? phoneEyePreparationWindow : undefined);
    const waitForQuiet = () => waitForSceneIdle(controller.signal, 20, phoneEyePreparationWindow);
    tones.current = createSilverToneControl();
    const params = new URLSearchParams(location.search);
    const diagnostics = /^(localhost|127\.)/.test(location.hostname) && params.has("diagnostics");
    const disabled = diagnostics && params.get("bloom") === "off";
    grade.current = createSpaceGrade(gl, effectQuality(gl), {
      enabled: !(diagnostics && params.get("grade") === "off"),
      identity: diagnostics && params.get("grade") === "identity",
      grain: !(diagnostics && params.get("grade-grain") === "off"),
    });
    const hdr = gl.getContext().getExtension("EXT_color_buffer_float");
    const timer = window.setInterval(() => {
      if ((disabled || !hdr) && !grade.current?.enabled) {
        clearInterval(timer);
        return;
      }
      const source = scene.getObjectByName(STAR_NAME) as Mesh | undefined;
      if (!source || !(source.material instanceof ShaderMaterial) || !source.material.uniforms.uAtlas.value)
        return;
      // The deferred corridor owns the pupil front; wait for its effect setup
      // too, rather than permanently accepting a null emitter on a mount race.
      const fill = scene.getObjectByName(PUPIL_FILL_NAME),
        eye = scene.getObjectByName(EYE_NAME);
      if (!(fill instanceof Mesh) || !(eye instanceof Mesh) || !(eye.material instanceof ShaderMaterial))
        return;
      clearInterval(timer);
      cancel = schedule(() => {
        if (!active) return;
        pulse.current = createPupilPulse(scene, gl, camera, effectQuality(gl));
        if (pulse.current) {
          const probe = new Scene();
          pulse.current.preparationMeshes.forEach((mesh) => {
            const copy = mesh.clone();
            copy.visible = true;
            probe.add(copy);
          });
          void Promise.all([
            compileHiddenGPU(gl, probe, camera),
            compileByDryRun(gl, () => pulse.current?.prepareContact()),
          ])
            .then(() => {
              if (active)
                cancelPulse = schedule(() => {
                  if (!active) return;
                  if (!mobile) {
                    pulse.current?.prepareContact();
                    prepareHiddenGPU(gl, probe, camera, probe.children);
                    invalidate();
                    return;
                  }
                  const end = traceSpan("Phone eye pulse first draws", "GPU resource submission");
                  void prepareMobileMeshes(gl, probe, camera, probe.children, () => active, waitForQuiet)
                    .then(() => {
                      if (active) {
                        pulse.current?.prepareContact();
                        invalidate();
                      }
                    })
                    .catch((error) => console.error("Pupil light preparation failed", error))
                    .finally(() => end());
                }, 17);
            })
            .catch((error) => {
              if (active) console.error("Pupil light preparation failed", error);
            });
        }
        // Grading also uses this extraction's foreground alpha. Keep that mask
        // when comparing bloom off, otherwise the diagnostic changes the grade.
        // Compile every pass off-thread first (dry run), then do the same private first draw at a later quiet tick.
        const bloom = hdr ? createStarBloom(gl, scene, camera, effectQuality(gl), !disabled) : null;
        pendingBloom = bloom;
        const warm = () => {
          bloom?.draw(false);
          grade.current?.prepare();
        };
        // The dry run also covers the on-screen variants (composite overlay, grade to the canvas).
        void compileByDryRun(gl, () => {
          warm();
          bloom?.draw(true, true);
          if (gl.getRenderTarget() === null) grade.current?.draw(camera, null, false, 1);
        })
          .catch((error) => console.error("Star bloom compile failed", error))
          .then(() => {
            if (!active) return;
            cancelBloom = schedule(() => {
              if (!active) return;
              pendingBloom = null;
              pipeline.current = bloom;
              warm();
              invalidate();
            }, 16);
          });
      }, 16);
    }, 100);
    const replay = () => {
        pulse.current?.restart();
        invalidate();
      },
      preference = matchMedia("(prefers-reduced-motion: reduce)"),
      update = () => {
        reduce.current = preference.matches;
        invalidate();
      };
    update();
    const visibility = () => {
      pulse.current?.pause();
      if (!document.hidden) invalidate();
    };
    preference.addEventListener("change", update);
    window.addEventListener("eye-pupil-replay", replay);
    document.addEventListener("visibilitychange", visibility);
    const responses = legacy.current;
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      cancel();
      cancelPulse();
      cancelBloom();
      pendingBloom?.dispose();
      pendingBloom = null;
      preference.removeEventListener("change", update);
      window.removeEventListener("eye-pupil-replay", replay);
      document.removeEventListener("visibilitychange", visibility);
      pulse.current?.dispose();
      pulse.current = null;
      tones.current?.dispose();
      tones.current = null;
      pipeline.current?.dispose();
      pipeline.current = null;
      grade.current?.dispose();
      grade.current = null;
      if (activeLegacy === responses) activeLegacy = null;
      responses.forEach(({ compile, key }, material) => {
        material.onBeforeCompile = compile;
        material.customProgramCacheKey = key;
        material.needsUpdate = true;
      });
      responses.clear();
    };
  }, [gl, scene, camera, invalidate, mobile]);
  useFrame(() => {
    if (journeyControls.read().finalCovered) return;
    const journeyPhase = journeyControls.read().phase;
    const eye = scene.getObjectByName(EYE_NAME) as Mesh | undefined;
    const eyeReady = !LOGO_PARTICLE_EYE_ENABLED || eye?.userData.eyePrepared;
    if (journeyPhase === "page" && !pageReturn.warming) return;
    const coveredReturn = journeyPhase === "pageReturnLoading";
    const warming = journeyPhase === "page";
    const phase = coveredReturn || warming ? "logoReveal" : journeyPhase;
    const values = resolveCinemaValues(
      cinemaControls.read(),
      cinemaShot.stage,
      cinemaShot.progress,
      tuning.current,
    );
    if (eye?.material instanceof ShaderMaterial)
      eye.material.uniforms.uHeroReactionGain.value = values.particleReaction;
    // Phone skies use the directly drawn grains. Full-screen bokeh softened
    // their subpixel centres and required a second scene draw and a gather.
    if (
      !mobile &&
      values.post &&
      values.dof &&
      (phase === "logoReveal" || phase === "logoDone") &&
      !focus.current
    )
      focus.current = createCinemaFocus(gl, scene, effectQuality(gl));
    // Camera progress drives the early trace; the final pose starts the existing
    // emission clock before its queued public phase notification.
    const pulsePhase = phase === "logoReveal" && cinemaShot.stage === "done" ? "logoDone" : phase;
    if (
      pulse.current?.update(
        pulsePhase,
        performance.now(),
        document.hidden,
        reduce.current,
        values,
        cinemaShot,
      )
    )
      invalidate();
    renderFrame(
      gl,
      scene,
      camera,
      phase,
      legacy.current,
      pipeline.current,
      grade.current,
      tones.current,
      pulse.current?.glow,
      pulse.current?.drawContact,
      values,
      focus.current,
      mobile,
    );
    if (warming) {
      pageReturn.warming = false;
      traceMark("Eye return GPU warmed behind page");
    }
    if (coveredReturn && eyeReady) pageReturn.prepared = true;
  }, 1);
  return null;
}
