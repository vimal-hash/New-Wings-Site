"use client";
import "./asset-loading";

import { lazy, memo, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { BufferGeometry, Euler, FrontSide, Light, Material, Matrix4, Mesh, PerspectiveCamera, Quaternion, Scene, Vector3 } from "three";
import type { MetricsStore } from "./metrics";
import placement from "./placement.json";

import referenceCamera from "./reference-camera.json";
import { loadProjector } from "./projector-loader";
import { projectorControls } from "./projector-controls";
import FullJourney from "./full-journey";
import CorridorPage from "./corridor-page";
import CorridorScreens from "./corridor-screens";
import { journeyControls } from "./journey-controls";
import Sofas from "./sofas";
import { SOFAS_ENABLED,LOGO_PARTICLE_EYE_ENABLED } from "./scene-features";
import LogoParticleEye from "./logo-particle-eye";
import logoBounds from "./logo-reveal.json";
import TheatreCeiling from "./theatre-ceiling";
import ceilingIds from "./theatre-ceiling-ids.json";
import { withoutTheatreCeiling } from "./theatre-ceiling-geometry";
import TheatreLeftWall from "./theatre-left-wall";
import { leftWallGeometry, leftWallId } from "./left-wall-uv";
import BakedSurfaces, { bakedTheatreIds, extractNodeSurfaces, extractTheatreSurfaces, preloadBakedSurfaces } from "./baked-surfaces";

import { traceGLTF, traceMark, traceRenderer, traceSync,traceFramePause,traceSpan } from "./loading-trace";
import { instantiateTheatre } from "./theatre-preparation";
import { preloadOpeningAssets, THEATRE_MODELS } from "./opening-assets";
import { extractMoons,moonIds } from "./moon-geometry";
import DesignMoons from "./design-moons";
import ProjectorStage from "./projector-stage";
import { slideMaterial } from "./slide-material";
import { isMobileDevice,textureForDevice } from "./texture-quality";
import ceilingAssets from "./theatre-ceiling-assets.json";
import { scheduleSceneIdle } from "./scene-idle";
import { startTransition } from "react";
import { createFrameStatistics } from "./frame-statistics";
import { compileHiddenGPU,prepareHiddenGPU } from "./hidden-gpu-preparation";
import { localEnvironment } from "./local-environment";
import { applyLogoMaterial } from "./logo-material";
import StarBloom from "./star-bloom";
import {createPupilFrontFill,pupilFillState} from "./pupil-fill";

traceMark("Scene module evaluated");

const MODEL = "/models/corridor-ribbons-balanced.glb";
const UP = new Vector3(0, 1, 0);

const INITIAL_POSITION = referenceCamera.start as [number, number, number];
const INITIAL_ROTATION = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(new Vector3(...INITIAL_POSITION), new Vector3(...referenceCamera.screenCentre), UP));
const INITIAL_EULER=new Euler().setFromQuaternion(INITIAL_ROTATION);
const AnimatedProjector=lazy(loadProjector);

function InspectionControls() {
  const camera = useThree((state) => state.camera);
  const target = useMemo(() => {
    const b=logoBounds.blenderBounds;
    return journeyControls.read().phase==="logoDone"?new Vector3((b[0][0]+b[0][1])/2,(b[2][0]+b[2][1])/2,-(b[1][0]+b[1][1])/2):camera.getWorldDirection(new Vector3()).multiplyScalar(21.398).add(camera.position);
  }, [camera]);
  return <OrbitControls makeDefault target={target} enableDamping dampingFactor={0.12} minDistance={0.1} maxDistance={5000} />;
}
export type StudyView = "corridor" | "theatre" | "floor";
const THEATRE_PLACEMENT = new Matrix4().fromArray(placement.matrix);
function Theatre({ metrics, connected = false }: { metrics: MetricsStore; connected?: boolean }) {
  const [theatreModel, platformModel] = useGLTF(THEATRE_MODELS, "/draco/", false, traceGLTF);
  const sourceTheatre = theatreModel.scene, sourcePlatform = platformModel.scene;
  // Cache expensive preparation across initial Suspense retries; keep mount-owned
  // copies for materials/UVs/disposal and depend on stable source scene identities.
  const { scenes, leftWall, surfaces, side, platform, moons } = useMemo(() => traceSync("Clone prepared theatre for mount", () => instantiateTheatre(sourceTheatre, sourcePlatform, () => traceSync("Construct theatre surface geometry", () => {
    let leftWall: BufferGeometry | undefined, surfaces: ReturnType<typeof extractTheatreSurfaces> = [], side: Material["side"] = FrontSide;
    let moons:ReturnType<typeof extractMoons>=[];
    const scenes = [sourceTheatre, sourcePlatform].map((scene, i) => {
      const copy = scene.clone(true);
      if (i === 0) copy.traverse(object => {
        if (!(object instanceof Mesh)) return;
        const original=object.geometry;
        // The left wall leaves the diagnostic mesh and is drawn with its baked appearance.
        leftWall=leftWallGeometry(original);
        moons=extractMoons(original);
        // Restored items likewise leave it, each drawn with its own baked atlas.
        surfaces=extractTheatreSurfaces(original);side=(object.material as Material).side;
        object.geometry=withoutTheatreCeiling(original,[...ceilingIds.ids,leftWallId,...bakedTheatreIds,...moonIds]);
      });
      return copy;
    });
    if (!leftWall) throw new Error("Left wall: diagnostic mesh missing");
    // The projector floor's diagnostic node is hidden in its clone and drawn with its baked appearance.
    const platform = extractNodeSurfaces(scenes[1], "projector-floor");
    return { scenes, leftWall, surfaces, side, platform,moons };
  }))), [sourceTheatre, sourcePlatform]);
  useEffect(() => () => {
    scenes[0].traverse(object => {
      if (object instanceof Mesh) object.geometry.dispose();
    });
    leftWall.dispose();
    surfaces.forEach(surface => surface.geometry.dispose());
    platform.surfaces.forEach(surface => surface.geometry.dispose());
    moons?.forEach(surface=>surface.geometry.dispose());
  }, [scenes, leftWall, surfaces, platform,moons]);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    traceMark("Theatre committed");
    metrics.update({ loaded: true, modelReady: metrics.read().modelReady || performance.now() });
    invalidate();
  }, [metrics, invalidate]);
  return <group matrixAutoUpdate={!connected} matrix={connected ? THEATRE_PLACEMENT : undefined}>{scenes.map((scene, i) => <primitive key={THEATRE_MODELS[i]} object={scene} dispose={null} />)}<TheatreCeiling /><TheatreLeftWall geometry={leftWall} />{moons&&<DesignMoons surfaces={moons}/>} {surfaces.length > 0 && <BakedSurfaces source="theatre" surfaces={surfaces} side={side} />}{platform.surfaces.length > 0 && <DeferredPlatform metrics={metrics} surfaces={platform.surfaces} side={platform.side ?? FrontSide}/>}</group>;
}

/** The platform is behind the opening camera; it must not delay the first theatre frame. */
function DeferredPlatform({metrics,surfaces,side}:{metrics:MetricsStore;surfaces:{item:string;geometry:BufferGeometry}[];side:Material["side"]}){
  const gl=useThree(s=>s.gl),[started,setStarted]=useState(false);
  useEffect(()=>{let cancel=()=>{};const timer=setInterval(()=>{if(!metrics.read().firstFrame)return;clearInterval(timer);preloadBakedSurfaces("projector-floor",gl);cancel=scheduleSceneIdle(()=>setStarted(true),-100);},50);return()=>{clearInterval(timer);cancel();};},[metrics,gl]);
  return started?<Suspense fallback={null}><BakedSurfaces source="projector-floor" surfaces={surfaces} side={side}/></Suspense>:null;
}

function Corridor({ metrics }: { metrics: MetricsStore }) {
  const { scene } = useGLTF(MODEL, "/draco/", false, traceGLTF);
  const gl=useThree(s=>s.gl),camera=useThree(s=>s.camera),renderScene=useThree(s=>s.scene);
  // Baked corridor items are drawn from world-space copies; their diagnostic nodes are hidden in this clone only.
  const { connected, surfaces, side,slideMaterials,logoMaterial,pupilFill } = useMemo(() => traceSync("Construct corridor surface geometry", () => {
    const connected = scene.clone(true);
    const logoMaterial=applyLogoMaterial(connected,localEnvironment(gl),()=>journeyControls.read().phase);
    const pupilFill=createPupilFrontFill(connected,logoMaterial);
    const slideMaterials:Material[]=[];
    connected.traverse(object=>{if(object instanceof Mesh&&!Array.isArray(object.material)&&object.material.name.startsWith("ID | Slide ")){const material=slideMaterial(gl,object.material.name.includes("Side"));object.material=material;slideMaterials.push(material);}});
    const { surfaces, side } = extractNodeSurfaces(connected, "corridor");
    return { connected, surfaces, side: side ?? FrontSide,slideMaterials,logoMaterial,pupilFill };
  }), [scene,gl]);
  useEffect(() => () => {pupilFill?.dispose();surfaces.forEach(surface => surface.geometry.dispose());slideMaterials.forEach(material=>material.dispose());logoMaterial?.dispose();}, [surfaces,slideMaterials,logoMaterial,pupilFill]);
  const invalidate = useThree((state) => state.invalidate);
  useFrame(()=>{pupilFill?.update();},.5);
  useEffect(()=>{
    if(!pupilFill)return;
    let active=true,cancelDraw=()=>{};
    const cancel=scheduleSceneIdle(()=>{
      const privateScene=new Scene();renderScene.updateMatrixWorld(true);
      renderScene.traverse(object=>{if(object instanceof Light){const light=object.clone();light.matrixAutoUpdate=false;light.matrix.copy(object.matrixWorld);privateScene.add(light);}});
      const probe=new Mesh(pupilFill.geometry,pupilFill.material);privateScene.add(probe);
      void compileHiddenGPU(gl,privateScene,camera).then(()=>{
        if(!active)return;
        cancelDraw=scheduleSceneIdle(()=>{
          if(!active)return;
          const progress=pupilFillState.value;
          try{pupilFillState.value=1;prepareHiddenGPU(gl,privateScene,camera,[probe]);}
          finally{pupilFillState.value=progress;}
          invalidate();
        },19);
      }).catch(error=>{if(active)console.error('Pupil front preparation failed',error);});
    },19);
    return()=>{active=false;cancel();cancelDraw();};
  },[pupilFill,gl,camera,renderScene,invalidate]);
  useEffect(() => {
    traceMark("Corridor committed");
    metrics.update({ corridorReady: true, waitingForCorridor: false });
    invalidate();
  }, [metrics, invalidate]);
  return <><primitive object={connected} dispose={null} />{surfaces.length > 0 && <BakedSurfaces source="corridor" surfaces={surfaces} side={side} />}<LogoParticleEye enabled={LOGO_PARTICLE_EYE_ENABLED}/></>;
}

/** Start later-room requests only after the complete opening has painted. */
function DeferredCorridor({ metrics }: { metrics: MetricsStore }) {
  const [started, setStarted] = useState(false);
  const gl = useThree(state => state.gl);
  useEffect(() => {
    let cancel=()=>{};const timer = window.setInterval(() => {
      if ((metrics.read().firstFrame && journeyControls.read().phase!=="intro") || journeyControls.read().pageAtEnd) {
        window.clearInterval(timer);
        traceMark("Corridor background loading started");
        preloadBakedSurfaces("corridor", gl);
        cancel=scheduleSceneIdle(()=>startTransition(()=>setStarted(true)));
      }
    }, 50);
    return () => {window.clearInterval(timer);cancel();};
  }, [metrics, gl]);
  return started ? <Suspense fallback={null}><Corridor metrics={metrics} /></Suspense> : null;
}

/** The projector is outside the opening shot. Its model, programs and FX must not suspend the theatre. */
function DeferredProjector({metrics}:{metrics:MetricsStore}){
  const [started,setStarted]=useState(false),gl=useThree(s=>s.gl);
  useEffect(()=>{
    let cancel=()=>{},active=true;const timer=setInterval(()=>{if(!metrics.read().firstFrame)return;clearInterval(timer);traceMark("Projector deferred loading started");
      // Overlap fetching/worker decode with the authored opening shot. Mounting
      // and driver uploads still wait for a stationary stop after that shot.
      void loadProjector().then(module=>module.preloadProjector(gl)).catch(()=>{});
      cancel=scheduleSceneIdle(()=>{if(active)startTransition(()=>setStarted(true));},-20);
    },50);return()=>{active=false;clearInterval(timer);cancel();};
  },[metrics,gl]);
  useEffect(()=>projectorControls.subscribe(()=>metrics.update({projectorReady:projectorControls.read().ready})),[metrics]);
  return started?<Suspense fallback={null}><AnimatedProjector/></Suspense>:null;
}

function CameraJourney({ metrics, view, orbit }: { metrics: MetricsStore; view: StudyView; orbit: boolean }) {
  const { camera, gl, invalidate, size } = useThree();
  const timing = useRef({ last: 0, frames: [] as number[], firstFrameRequest: 0 });
  useEffect(() => {
    if (camera instanceof PerspectiveCamera) {
      if(journeyControls.read().phase==="logoReveal")return;
      const aspect = size.width / Math.max(1, size.height);
      const fov = journeyControls.read().phase==="logoDone"?40:Math.max(40, 2 * Math.atan(11.64 * 1.06 / (2 * 9.6 * aspect)) * 180 / Math.PI);
      camera.setFocalLength(camera.getFilmHeight() / (2 * Math.tan(fov*Math.PI/360)));
      camera.updateProjectionMatrix(); invalidate();
    }
  }, [camera, size.width, size.height, invalidate]);
  useEffect(() => {
    const statistics=createFrameStatistics(),timingState=timing.current;let raf=0;
    const visibility=()=>statistics.resetClock();document.addEventListener("visibilitychange",visibility);
    const sample=(now:number)=>{if(document.hidden)statistics.resetClock();else{const result=statistics.sample(now);if(result){metrics.update(result);traceFramePause(now,result.gap,journeyControls.read().phase);}}raf=requestAnimationFrame(sample);};
    raf=requestAnimationFrame(sample);return()=>{document.removeEventListener("visibilitychange",visibility);cancelAnimationFrame(raf);cancelAnimationFrame(timingState.firstFrameRequest);};
  },[metrics]);
  useFrame(() => {
    if(!orbit && view !== "corridor") {
      if(view === "theatre") { camera.position.set(0,4.3,size.width<size.height?-29:-25);camera.lookAt(0,3.2,-.8); }
      else {camera.position.set(size.width<size.height?22:18,18,-49);camera.lookAt(0,.8,-27);}
    }
    const state=timing.current,now=performance.now();
    metrics.update({lastFrame:now,calls:gl.info.render.calls,triangles:gl.info.render.triangles,textures:gl.info.memory.textures,geometries:gl.info.memory.geometries,width:Math.round(size.width*gl.getPixelRatio()),height:Math.round(size.height*gl.getPixelRatio()),dpr:gl.getPixelRatio()});
    if(metrics.read().loaded && !metrics.read().firstFrame && !state.firstFrameRequest) {
      state.firstFrameRequest=requestAnimationFrame(()=>{traceMark("Existing first-frame metric");metrics.update({firstFrame:performance.now()});invalidate();});
    }
  });
  return null;
}

function OpeningReady() {
  const gl=useThree(s=>s.gl),get=useThree(s=>s.get),invalidate=useThree(s=>s.invalidate);
  useLayoutEffect(() => { traceMark("Opening scene committed"); }, []);
  useEffect(()=>{
    if(journeyControls.read().phase!=="intro")return;
    let active=true,frame=0,cancel=()=>{};
    frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{
      const {scene,camera}=get(),end=traceSpan("Opening scene GPU preflight","shader/resource preparation");
      void compileHiddenGPU(gl,scene,camera).then(()=>{if(!active)return;
        cancel=scheduleSceneIdle(()=>{const current=get();
          try{prepareHiddenGPU(gl,current.scene,current.camera,[current.scene]);end();traceMark("Opening GPU prepared");journeyControls.update({openingPrepared:true});invalidate();}
          catch(error){end({error:String(error)});console.error("Opening preparation failed",error);}
        },-100);
      }).catch(error=>{end({error:String(error)});console.error("Opening shader preparation failed",error);});
    });});
    return()=>{active=false;cancelAnimationFrame(frame);cancel();};
  },[gl,get,invalidate]);
  return null;
}

function CorridorScene({ metrics, view = "corridor", orbit = false }: { metrics: MetricsStore; view?: StudyView; orbit?: boolean }) {
  const journey = useSyncExternalStore(journeyControls.subscribe, journeyControls.read, journeyControls.read);
  return (
    <Canvas flat={view==="corridor"} shadows="soft" frameloop="demand" dpr={[1, isMobileDevice()?1.5:1.25]}
      onCreated={({ gl,camera }) => {gl.transmissionResolutionScale=isMobileDevice()?.5:.75;camera.position.fromArray(INITIAL_POSITION);camera.up.copy(UP);camera.lookAt(...referenceCamera.screenCentre as [number,number,number]);traceMark("Canvas created"); traceRenderer(gl); metrics.update({desktopTextures:textureForDevice(ceilingAssets.texture,gl)!==ceilingAssets.texture}); preloadOpeningAssets(gl, SOFAS_ENABLED && view !== "floor");
        scheduleSceneIdle(()=>{const end=traceSpan("Prepare shared cinema environment","GPU preparation");localEnvironment(gl);end();},-110);
      }}
      camera={{ position: INITIAL_POSITION, rotation:[INITIAL_EULER.x,INITIAL_EULER.y,INITIAL_EULER.z], up: [0, 1, 0], fov: 40, near: referenceCamera.near, far: referenceCamera.far }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      fallback={<p>{view === "corridor" ? "Colour-coded 3D corridor. Scroll down to travel backward, or up to return." : "Colour-coded theatre and projector floor geometry review."}</p>}
    >
      <color attach="background" args={["#11151a"]} />
      {view==="corridor"&&<StarBloom/>}
      <ProjectorStage/>
      <CameraJourney metrics={metrics} view={view} orbit={orbit} />
      {view === "corridor" && <FullJourney metrics={metrics} orbit={orbit} />}
      {orbit && <InspectionControls />}
      {view === "corridor" && <CorridorScreens />}
      {view === "corridor" && <CorridorPage stage={journey.panelStage} phase={journey.phase} />}
      <Suspense fallback={null}>{view === "corridor" ? <Theatre metrics={metrics} connected /> : <Theatre metrics={metrics} />}{SOFAS_ENABLED && view !== "floor" && <Sofas />}<OpeningReady /></Suspense>
      <DeferredProjector metrics={metrics}/>
      {view === "corridor" && <DeferredCorridor metrics={metrics} />}
    </Canvas>
  );
}

export default memo(CorridorScene);






