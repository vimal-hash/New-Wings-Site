"use client";
import "./asset-loading";

import {
  lazy,
  memo,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  startTransition,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import {
  BufferGeometry,
  Euler,
  FrontSide,
  Group,
  Light,
  type LightShadow,
  Material,
  Matrix4,
  Mesh,
  type Object3D,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector3,
} from "three";
import type { MetricsStore } from "./metrics";
import placement from "./placement.json";

import referenceCamera from "./reference-camera.json";
import { loadProjector } from "./projector-loader";
import { projectorControls } from "./projector-controls";
import FullJourney from "./full-journey";
import CorridorPage from "./corridor-page";

import { journeyControls } from "./journey-controls";
import Sofas from "./sofas";
import HoverCatalogue from "./hover-catalogue";
import { SOFAS_ENABLED, LOGO_PARTICLE_EYE_ENABLED } from "./scene-features";
import LogoParticleEye from "./logo-particle-eye";
import logoBounds from "./logo-reveal.json";
import TheatreCeiling from "./theatre-ceiling";
import ceilingIds from "./theatre-ceiling-ids.json";
import { withoutTheatreCeiling } from "./theatre-ceiling-geometry";
import TheatreLeftWall from "./theatre-left-wall";
import { leftWallGeometry, leftWallId } from "./left-wall-uv";
import BakedSurfaces, {
  bakedTheatreIds,
  extractNodeSurfaces,
  extractTheatreSurfaces,
  preloadBakedSurfaces,
} from "./baked-surfaces";

import { traceGLTF, traceMark, traceRenderer, traceSync, traceFramePause, traceSpan } from "./loading-trace";
import { instantiateTheatre } from "./theatre-preparation";
import { preloadOpeningAssets, THEATRE_MODELS } from "./opening-assets";
import { extractMoons, moonIds } from "./moon-geometry";
import DesignMoons from "./design-moons";
import ProjectorStage from "./projector-stage";
import { slideMaterial } from "./slide-material";
import { isMobileDevice, textureForDevice } from "./texture-quality";
import ceilingAssets from "./theatre-ceiling-assets.json";
import { OPENING_PROJECTOR_PRIORITY, scheduleSceneIdle } from "./scene-idle";
import { createFrameStatistics } from "./frame-statistics";
import { createResolutionGovernor, mobileEyeDpr, RESOLUTION, targetDpr } from "./render-resolution";
import { compileHiddenGPU, compileHiddenGPUGradually, prepareHiddenGPU } from "./hidden-gpu-preparation";
import { localEnvironment } from "./local-environment";
import { applyLogoMaterial } from "./logo-material";
import StarBloom, { prepareLegacyResponse } from "./star-bloom";
import { createPupilFrontFill, pupilFillState } from "./pupil-fill";
import { TheatreBlueprint, TheatreOpeningOwner, TheatreOpeningScreen } from "./theatre-opening";
import { OPENING_CAMERA_START } from "./theatre-opening-state";
import { applyTheatreOpeningMaterial } from "./theatre-opening-material";
import CinemaGlasses from "./cinema-glasses";
import { describeQuality, effectQuality } from "./effect-quality";
import { diagonalTransition } from "./diagonal-transition";

traceMark("Scene module evaluated");

const MODEL = "/models/corridor-ribbons-balanced.glb";
const UP = new Vector3(0, 1, 0);

const INITIAL_POSITION = OPENING_CAMERA_START;
const INITIAL_ROTATION = new Quaternion().setFromRotationMatrix(
  new Matrix4().lookAt(new Vector3(...INITIAL_POSITION), new Vector3(...referenceCamera.screenCentre), UP),
);
const INITIAL_EULER = new Euler().setFromQuaternion(INITIAL_ROTATION);
const AnimatedProjector = lazy(loadProjector);

function InspectionControls() {
  const camera = useThree((state) => state.camera);
  const target = useMemo(() => {
    const b = logoBounds.blenderBounds;
    return journeyControls.read().phase === "logoDone"
      ? new Vector3((b[0][0] + b[0][1]) / 2, (b[2][0] + b[2][1]) / 2, -(b[1][0] + b[1][1]) / 2)
      : camera.getWorldDirection(new Vector3()).multiplyScalar(21.398).add(camera.position);
  }, [camera]);
  return (
    <OrbitControls
      makeDefault
      target={target}
      enableDamping
      dampingFactor={0.12}
      minDistance={0.1}
      maxDistance={5000}
    />
  );
}
const THEATRE_PLACEMENT = new Matrix4().fromArray(placement.matrix);
function Theatre({ metrics }: { metrics: MetricsStore }) {
  const [theatreModel, platformModel] = useGLTF(THEATRE_MODELS, "/draco/", false, traceGLTF);
  const sourceTheatre = theatreModel.scene,
    sourcePlatform = platformModel.scene;
  // Cache expensive preparation across initial Suspense retries; keep mount-owned
  // copies for materials/UVs/disposal and depend on stable source scene identities.
  const { scenes, leftWall, surfaces, side, platform, moons } = useMemo(
    () =>
      traceSync("Clone prepared theatre for mount", () =>
        instantiateTheatre(sourceTheatre, sourcePlatform, () =>
          traceSync("Construct theatre surface geometry", () => {
            let leftWall: BufferGeometry | undefined,
              surfaces: ReturnType<typeof extractTheatreSurfaces> = [],
              side: Material["side"] = FrontSide;
            let moons: ReturnType<typeof extractMoons> = [];
            const scenes = [sourceTheatre, sourcePlatform].map((scene, i) => {
              const copy = scene.clone(true);
              if (i === 0)
                copy.traverse((object) => {
                  if (!(object instanceof Mesh)) return;
                  const original = object.geometry;
                  // The left wall leaves the diagnostic mesh and is drawn with its baked appearance.
                  leftWall = leftWallGeometry(original);
                  moons = extractMoons(original);
                  // Restored items likewise leave it, each drawn with its own baked atlas.
                  surfaces = extractTheatreSurfaces(original);
                  side = (object.material as Material).side;
                  object.geometry = withoutTheatreCeiling(original, [
                    ...ceilingIds.ids,
                    leftWallId,
                    ...bakedTheatreIds,
                    ...moonIds,
                  ]);
                });
              return copy;
            });
            if (!leftWall) throw new Error("Left wall: diagnostic mesh missing");
            // The projector floor's diagnostic node is hidden in its clone and drawn with its baked appearance.
            const platform = extractNodeSurfaces(scenes[1], "projector-floor");
            return { scenes, leftWall, surfaces, side, platform, moons };
          }),
        ),
      ),
    [sourceTheatre, sourcePlatform],
  );
  const roomSurfaces = useMemo(() => surfaces.filter((surface) => surface.item !== "screen"), [surfaces]);
  const diagnosticMaterials = useMemo(() => {
    const owned: Material[] = [];
    scenes[0].traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const clone = (source: Material) => {
        const material = source.clone();
        applyTheatreOpeningMaterial(material);
        owned.push(material);
        return material;
      };
      object.material = Array.isArray(object.material) ? object.material.map(clone) : clone(object.material);
    });
    return owned;
  }, [scenes]);
  useEffect(
    () => () => {
      scenes[0].traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      leftWall.dispose();
      surfaces.forEach((surface) => surface.geometry.dispose());
      platform.surfaces.forEach((surface) => surface.geometry.dispose());
      moons?.forEach((surface) => surface.geometry.dispose());
      diagnosticMaterials.forEach((material) => material.dispose());
    },
    [scenes, leftWall, surfaces, platform, moons, diagnosticMaterials],
  );
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    traceMark("Theatre committed");
    metrics.update({ loaded: true, modelReady: metrics.read().modelReady || performance.now() });
    invalidate();
  }, [metrics, invalidate]);
  return (
    <group matrixAutoUpdate={false} matrix={THEATRE_PLACEMENT}>
      {scenes.map((scene, i) => (
        <primitive key={THEATRE_MODELS[i]} object={scene} dispose={null} />
      ))}
      <TheatreCeiling />
      <TheatreLeftWall geometry={leftWall} />
      {moons && <DesignMoons surfaces={moons} />}
      {roomSurfaces.length > 0 && <BakedSurfaces source="theatre" surfaces={roomSurfaces} side={side} />}
      {platform.surfaces.length > 0 &&
        (isMobileDevice() ? (
          <BakedSurfaces
            source="projector-floor"
            surfaces={platform.surfaces}
            side={platform.side ?? FrontSide}
          />
        ) : (
          <DeferredPlatform
            metrics={metrics}
            surfaces={platform.surfaces}
            side={platform.side ?? FrontSide}
          />
        ))}
    </group>
  );
}

/** The platform is behind the opening camera; it must not delay the first theatre frame. */
function DeferredPlatform({
  metrics,
  surfaces,
  side,
}: {
  metrics: MetricsStore;
  surfaces: { item: string; geometry: BufferGeometry }[];
  side: Material["side"];
}) {
  const gl = useThree((s) => s.gl),
    [started, setStarted] = useState(false);
  useEffect(() => {
    let cancel = () => {};
    const timer = setInterval(() => {
      if (!metrics.read().firstFrame) return;
      clearInterval(timer);
      preloadBakedSurfaces("projector-floor", gl);
      cancel = scheduleSceneIdle(() => setStarted(true), -100);
    }, 50);
    return () => {
      clearInterval(timer);
      cancel();
    };
  }, [metrics, gl]);
  return started ? (
    <Suspense fallback={null}>
      <BakedSurfaces source="projector-floor" surfaces={surfaces} side={side} />
    </Suspense>
  ) : null;
}

function Corridor({ metrics }: { metrics: MetricsStore }) {
  const { scene } = useGLTF(MODEL, "/draco/", false, traceGLTF);
  const gl = useThree((s) => s.gl),
    camera = useThree((s) => s.camera),
    renderScene = useThree((s) => s.scene);
  const room = useRef<Group>(null);
  useFrame(() => {
    if (room.current) {
      const shot = journeyControls.read();
      room.current.visible = projectorControls.read().ready || shot.reviewCamera;
    }
  }, -1);
  // Baked corridor items are drawn from world-space copies; their diagnostic nodes are hidden in this clone only.
  const pupilFill = useRef<ReturnType<typeof createPupilFrontFill> | null>(null);
  const { connected, surfaces, side, slideMaterials, logoMaterial } = useMemo(
    () =>
      traceSync("Construct corridor surface geometry", () => {
        const connected = scene.clone(true);
        const logoMaterial = applyLogoMaterial(
          connected,
          localEnvironment(gl),
          () => journeyControls.read().phase,
        );
        const slideMaterials: Material[] = [];
        connected.traverse((object) => {
          if (
            object instanceof Mesh &&
            !Array.isArray(object.material) &&
            object.material.name.startsWith("ID | Slide ")
          ) {
            const material = slideMaterial(gl, object.material.name.includes("Side"));
            object.material = material;
            slideMaterials.push(material);
          }
        });
        const { surfaces, side } = extractNodeSurfaces(connected, "corridor");
        // Hide every part of the pathway fixtures in this mount-owned clone.
        connected.traverse((object) => {
          if (object instanceof Mesh) {
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            if (materials.some((material) => material.name.startsWith("ID | Pathway ")))
              object.visible = false;
          }
        });
        const visibleSurfaces = surfaces.filter((surface) => surface.item !== "corridor-pathway-lights");
        surfaces
          .filter((surface) => surface.item === "corridor-pathway-lights")
          .forEach((surface) => surface.geometry.dispose());
        return {
          connected,
          surfaces: visibleSurfaces,
          side: side ?? FrontSide,
          slideMaterials,
          logoMaterial,
        };
      }),
    [scene, gl],
  );
  useEffect(
    () => () => {
      surfaces.forEach((surface) => surface.geometry.dispose());
      slideMaterials.forEach((material) => material.dispose());
      logoMaterial?.dispose();
    },
    [surfaces, slideMaterials, logoMaterial],
  );
  const invalidate = useThree((state) => state.invalidate);
  useFrame(() => {
    pupilFill.current?.update();
  }, 0.5);
  useEffect(() => {
    // Strict Mode/Fast Refresh replay effects. Rebuild the owned front after
    // cleanup removes it, including its material registration for pulse bloom.
    const fill = createPupilFrontFill(connected, logoMaterial);
    pupilFill.current = fill;
    if (!fill) return;
    fill.update();
    invalidate();
    let active = true,
      cancelDraw = () => {};
    const cancel = scheduleSceneIdle(() => {
      const privateScene = new Scene();
      renderScene.updateMatrixWorld(true);
      // A cloned spot light gets a new shadow without a map, and the private draw (shadow pass off) then bound an
      // empty colour texture to the sampler2DShadow: an invalid draw in every browser. Share the live shadow instead;
      // it is only read here.
      const shared: LightShadow[] = [];
      renderScene.traverse((object) => {
        if (object instanceof Light) {
          const light = object.clone(),
            shadow = (object as Light & { shadow?: LightShadow }).shadow;
          if (object.castShadow && shadow) {
            (light as Light & { shadow: LightShadow }).shadow = shadow;
            shared.push(shadow);
          }
          light.matrixAutoUpdate = false;
          light.matrix.copy(object.matrixWorld);
          privateScene.add(light);
        }
      });
      const probe = new Mesh(fill.geometry, fill.material);
      privateScene.add(probe);
      void compileHiddenGPU(gl, privateScene, camera)
        .then(() => {
          if (!active) return;
          let waits = 0;
          const draw = () => {
            if (!active) return;
            // The live frame creates each map on its first shadow pass; wait for it (bounded) rather than draw without.
            if (shared.some((shadow) => !shadow.map) && ++waits < 60) {
              cancelDraw = scheduleSceneIdle(draw, 19);
              return;
            }
            const progress = pupilFillState.value;
            try {
              pupilFillState.value = 1;
              prepareHiddenGPU(gl, privateScene, camera, [probe]);
            } finally {
              pupilFillState.value = progress;
            }
            invalidate();
          };
          cancelDraw = scheduleSceneIdle(draw, 19);
        })
        .catch((error) => {
          if (active) console.error("Pupil front preparation failed", error);
        });
    }, 19);
    return () => {
      active = false;
      cancel();
      cancelDraw();
      if (pupilFill.current === fill) pupilFill.current = null;
      fill.dispose();
    };
  }, [connected, logoMaterial, gl, camera, renderScene, invalidate]);
  useEffect(() => {
    traceMark("Corridor committed");
    metrics.update({ corridorReady: true, waitingForCorridor: false });
    invalidate();
  }, [metrics, invalidate]);
  return (
    <group name="Corridor room" ref={room} visible={false}>
      <primitive object={connected} dispose={null} />
      {surfaces.length > 0 && <BakedSurfaces source="corridor" surfaces={surfaces} side={side} />}
      <LogoParticleEye enabled={LOGO_PARTICLE_EYE_ENABLED} />
    </group>
  );
}

/** The corridor wall is already visible behind the projector. Load it at the theatre stop. */
function DeferredCorridor({ metrics }: { metrics: MetricsStore }) {
  const [started, setStarted] = useState(false);
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    let cancel = () => {};
    const timer = window.setInterval(() => {
      if (metrics.read().firstFrame || journeyControls.read().pageAtEnd) {
        window.clearInterval(timer);
        traceMark("Corridor background loading started");
        useGLTF.preload(MODEL, "/draco/", false, traceGLTF);
        preloadBakedSurfaces("corridor", gl);
        cancel = scheduleSceneIdle(() => startTransition(() => setStarted(true)), OPENING_PROJECTOR_PRIORITY);
      }
    }, 50);
    return () => {
      window.clearInterval(timer);
      cancel();
    };
  }, [metrics, gl]);
  return started ? (
    <Suspense fallback={null}>
      <Corridor metrics={metrics} />
    </Suspense>
  ) : null;
}

/** The projector is outside the opening shot. Its model, programs and FX must not suspend the theatre. */
function DeferredProjector({ metrics }: { metrics: MetricsStore }) {
  const [started, setStarted] = useState(false),
    gl = useThree((s) => s.gl);
  useEffect(() => {
    let cancel = () => {},
      active = true;
    const timer = setInterval(() => {
      if (!metrics.read().firstFrame) return;
      clearInterval(timer);
      traceMark("Projector deferred loading started");
      // Overlap fetching and worker decode with the theatre's opening setup.
      void loadProjector()
        .then((module) => {
          if (active) module.preloadProjector(gl);
        })
        .catch(() => {});
      cancel = scheduleSceneIdle(() => {
        if (active) startTransition(() => setStarted(true));
      }, OPENING_PROJECTOR_PRIORITY);
    }, 50);
    return () => {
      active = false;
      clearInterval(timer);
      cancel();
    };
  }, [metrics, gl]);
  useEffect(
    () =>
      projectorControls.subscribe(() => metrics.update({ projectorReady: projectorControls.read().ready })),
    [metrics],
  );
  return started ? (
    <Suspense fallback={null}>
      <AnimatedProjector metrics={metrics} />
    </Suspense>
  ) : null;
}

const PORTRAIT_FOV_CAP = 88;
function CameraJourney({ metrics }: { metrics: MetricsStore }) {
  const { camera, gl, invalidate, size } = useThree();
  const timing = useRef({ last: 0, frames: [] as number[], firstFrameRequest: 0 });
  useEffect(() => {
    if (camera instanceof PerspectiveCamera) {
      if (journeyControls.read().phase === "logoReveal") return;
      const aspect = size.width / Math.max(1, size.height);
      // Portrait screens widen the lens to keep the cinema screen in view. Above about 88° the rectilinear stretch at
      // the edges reaches 3x (108° on a phone) and seats/walls look pulled; at 88° the whole screen and its opening outline fit (~86% of width, edge stretch 1.9x).
      const fov =
        journeyControls.read().phase === "logoDone"
          ? 40
          : Math.max(
              40,
              Math.min(
                PORTRAIT_FOV_CAP,
                (2 * Math.atan((11.64 * 1.06) / (2 * 9.6 * aspect)) * 180) / Math.PI,
              ),
            );
      camera.setFocalLength(camera.getFilmHeight() / (2 * Math.tan((fov * Math.PI) / 360)));
      camera.updateProjectionMatrix();
      invalidate();
    }
  }, [camera, size.width, size.height, invalidate]);
  useEffect(() => {
    const statistics = createFrameStatistics(),
      timingState = timing.current;
    let raf = 0;
    const visibility = () => statistics.resetClock();
    document.addEventListener("visibilitychange", visibility);
    const sample = (now: number) => {
      if (document.hidden) statistics.resetClock();
      else {
        const result = statistics.sample(now);
        if (result) {
          metrics.update(result);
          const shot = journeyControls.read();
          traceFramePause(
            now,
            result.gap,
            shot.phase,
            shot.phase === "logoReveal"
              ? shot.revealStage
              : shot.phase === "intro"
                ? shot.openingStage
                : undefined,
          );
        }
      }
      raf = requestAnimationFrame(sample);
    };
    raf = requestAnimationFrame(sample);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      cancelAnimationFrame(raf);
      cancelAnimationFrame(timingState.firstFrameRequest);
    };
  }, [metrics]);
  useFrame(() => {
    // Written in place every frame: the panel polls these, so no object is made per frame.
    const state = timing.current,
      current = metrics.read(),
      dpr = gl.getPixelRatio();
    current.lastFrame = performance.now();
    current.calls = gl.info.render.calls;
    current.triangles = gl.info.render.triangles;
    current.textures = gl.info.memory.textures;
    current.geometries = gl.info.memory.geometries;
    current.width = Math.round(size.width * dpr);
    current.height = Math.round(size.height * dpr);
    current.dpr = dpr;
    if (current.loaded && !current.firstFrame && !state.firstFrameRequest) {
      state.firstFrameRequest = requestAnimationFrame(() => {
        traceMark("Existing first-frame metric");
        metrics.update({ firstFrame: performance.now() });
        invalidate();
      });
    }
  });
  return null;
}

function OpeningReady() {
  const gl = useThree((s) => s.gl),
    get = useThree((s) => s.get),
    invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    traceMark("Opening scene committed");
  }, []);
  useEffect(() => {
    if (journeyControls.read().phase !== "intro") return;
    let active = true,
      frame = 0,
      cancel = () => {};
    const prepare = () => {
      if (!active) return;
      const { scene, camera } = get();
      // The late theatre screen adds a RectAreaLight. Linking before it mounts
      // misses the lit room variants in both the main draw and the reflections.
      if (!scene.getObjectByName("Cinema screen | Broad soft seating illumination")) {
        frame = requestAnimationFrame(prepare);
        return;
      }
      prepareLegacyResponse(scene);
      const end = traceSpan("Opening scene GPU preflight", "shader/resource preparation");
      const fail = (error: unknown) => {
        end({ error: String(error) });
        if (active) {
          projectorControls.fail();
          console.error("Opening GPU preparation failed", error);
        }
      };
      void compileHiddenGPUGradually(gl, scene, camera, () => active, scene, true)
        .then(() => {
          if (!active) return;
          cancel = scheduleSceneIdle(() => {
            const current = get();
            const roots: Object3D[] = [];
            current.scene.traverseVisible((object) => {
              if (object instanceof Mesh) roots.push(object);
            });
            try {
              prepareHiddenGPU(gl, current.scene, current.camera, roots);
              end();
              traceMark("Opening GPU prepared");
              journeyControls.update({ openingPrepared: true });
              invalidate();
            } catch (error) {
              fail(error);
            }
          }, -100);
        })
        .catch(fail);
    };
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(prepare);
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      cancel();
    };
  }, [gl, get, invalidate]);
  return null;
}

/** Sharp on Retina and phone screens within each GPU class's pixel budget; lowered only after sustained slow frames. */
function AdaptiveResolution({ onDpr }: { onDpr: (dpr: number) => void }) {
  const gl = useThree((s) => s.gl),
    size = useThree((s) => s.size);
  const [governor] = useState(createResolutionGovernor);
  const phone = useRef({
    samples: [] as number[],
    backoff: false,
    triedEye: false,
    boosted: false,
    phase: "",
  });
  const device = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const tier = effectQuality(gl),
    target = targetDpr(tier, size.width, size.height, device),
    minScale = Math.min(1, Math.min(RESOLUTION.floor, device) / target);
  const mobile = tier === "mobile";
  const apply = (scale: number) => {
    const base = phone.current.backoff ? Math.min(target, 1.5) : target;
    const resolution = mobile
      ? phone.current.boosted
        ? Math.max(base, mobileEyeDpr(size.width, size.height, device))
        : base
      : target * Math.max(scale, minScale);
    onDpr(Math.round(resolution * 20) / 20);
  };
  useEffect(() => {
    apply(governor.scale);
  });
  useEffect(() => {
    const reset = () => governor.resetClock();
    document.addEventListener("visibilitychange", reset);
    return () => document.removeEventListener("visibilitychange", reset);
  }, [governor]);
  useFrame((_, delta) => {
    if (document.hidden) return;
    if (!mobile) {
      if (governor.sample(performance.now(), minScale)) apply(governor.scale);
      return;
    }
    const state = phone.current,
      shot = journeyControls.read();
    if (state.phase !== shot.phase) {
      if (shot.phase !== "idle") state.samples.length = 0;
      state.phase = shot.phase;
      if (state.boosted && shot.phase !== "logoDone") {
        state.boosted = false;
        apply(1);
      }
    }
    const eye =
      shot.phase === "logoDone" &&
      !shot.finalCovered &&
      diagonalTransition.progress === 0 &&
      !shot.cameraMoving;
    if (shot.phase !== "intro" && shot.phase !== "idle" && !eye) return;
    if (delta <= 0 || delta > 0.1) {
      state.samples.length = 0;
      return;
    }
    state.samples.push(delta * 1000);
    if (state.samples.length < 36) return;
    const times = state.samples.sort((a, b) => a - b),
      median = times[18],
      p90 = times[32];
    state.samples = [];
    if (shot.phase === "idle" && !state.backoff && target > 1.5 && median > 22) {
      state.backoff = true;
      apply(1);
      traceMark("Phone render scale reduced at theatre stop");
    } else if (
      eye &&
      !state.triedEye &&
      mobileEyeDpr(size.width, size.height, device) > target + 0.05 &&
      median <= 17.5 &&
      p90 <= 21
    ) {
      state.triedEye = true;
      state.boosted = true;
      apply(1);
      traceMark("Phone higher-resolution eye trial");
    } else if (eye && state.boosted && (median > 20 || p90 > 26)) {
      state.boosted = false;
      apply(1);
      traceMark("Phone eye render scale restored");
    }
  });
  return null;
}

const readPhase = () => journeyControls.read().phase;
function CorridorScene({ metrics, orbit = false }: { metrics: MetricsStore; orbit?: boolean }) {
  // Only the phase: any other journey update would re-render the whole 3D tree for nothing.
  const phase = useSyncExternalStore(journeyControls.subscribe, readPhase, readPhase);
  // A fixed number, not a range: R3F resets a range on every re-render of this component, undoing the adaptive value.
  const [dpr, setDpr] = useState(() =>
    typeof window === "undefined"
      ? 1
      : Math.round(
          targetDpr(isMobileDevice() ? "mobile" : "laptop", innerWidth, innerHeight, devicePixelRatio || 1) *
            20,
        ) / 20,
  );
  return (
    <Canvas
      flat
      shadows="soft"
      frameloop="demand"
      dpr={dpr}
      onCreated={({ gl, camera }) => {
        gl.transmissionResolutionScale = isMobileDevice() ? 0.5 : 0.75;
        camera.position.fromArray(INITIAL_POSITION);
        camera.up.copy(UP);
        camera.lookAt(...(referenceCamera.screenCentre as [number, number, number]));
        traceMark("Canvas created");
        traceRenderer(gl);
        metrics.update({
          desktopTextures:
            textureForDevice(ceilingAssets.texture, gl, effectQuality(gl) === "desktop") !==
            ceilingAssets.texture,
          picture: describeQuality(gl),
        });
        preloadOpeningAssets(gl, SOFAS_ENABLED, true);
        scheduleSceneIdle(() => {
          const end = traceSpan("Prepare shared cinema environment", "GPU preparation");
          localEnvironment(gl);
          end();
        }, -110);
        // Desktop/laptop particle evaluation: its ~3.5 s Windows compile overlaps the opening downloads instead of freezing the first seated stop.
        if (effectQuality(gl) !== "mobile")
          void import("./projector-fx/particle-cache")
            .then((m) => m.warmParticleCacheProgram(gl))
            .catch(() => {});
      }}
      camera={{
        position: INITIAL_POSITION,
        rotation: [INITIAL_EULER.x, INITIAL_EULER.y, INITIAL_EULER.z],
        up: [0, 1, 0],
        fov: 40,
        near: referenceCamera.near,
        far: referenceCamera.far,
      }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      fallback={<p>Colour-coded 3D corridor. Scroll down to travel backward, or up to return.</p>}
    >
      <color attach="background" args={["#11151a"]} />
      <AdaptiveResolution onDpr={setDpr} />
      <StarBloom />
      <TheatreOpeningOwner />
      <ProjectorStage />
      <CameraJourney metrics={metrics} />
      <FullJourney metrics={metrics} orbit={orbit} />
      {!orbit && <HoverCatalogue />}
      {orbit && <InspectionControls />}
      <CorridorPage phase={phase} />
      <Suspense fallback={null}>
        <TheatreOpeningScreen metrics={metrics} />
        <CinemaGlasses />
      </Suspense>
      <Suspense fallback={null}>
        <TheatreBlueprint />
      </Suspense>
      <Suspense fallback={null}>
        <Theatre metrics={metrics} />
        {SOFAS_ENABLED && <Sofas />}
        <OpeningReady />
      </Suspense>
      <DeferredProjector metrics={metrics} />
      <DeferredCorridor metrics={metrics} />
    </Canvas>
  );
}

export default memo(CorridorScene);
