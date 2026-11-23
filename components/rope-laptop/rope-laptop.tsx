"use client";
/* eslint-disable react-hooks/immutability -- This R3F owner updates Three.js uniforms, draw ranges, camera and DOM scroll state from frame/effect/input callbacks. */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import {
  BufferGeometry,
  Matrix4,
  type Mesh,
  PerspectiveCamera,
  ShaderMaterial,
  TextureLoader,
  Vector4,
} from "three";
import { createHover, type RopePointer } from "../rope-model/rope-hover";
import { farHoleMaterial, FLOW, whiteStored } from "../rope-model/rope-materials";
import { TUNING_BASE } from "../rope-model/rope-tuning";
import { createRopeMeter, RopeReportPanel, type RopeMeter } from "../rope-model/rope-report";
import { diagnosticsEnabled, traceMark } from "../corridor/loading-trace";
import { journeyControls } from "../corridor/journey-controls";
import { createLaptopFinish, STORED_RANGE } from "./laptop-finish";
import { loadLaptopRope, type LaptopChunk, type LaptopRope } from "./laptop-data";
import {
  laptopCoreMaterial,
  laptopGreenCore,
  laptopGreenThreads,
  laptopThreadMaterial,
  setLaptopFlow,
  SPREAD_SLOTS,
} from "./laptop-materials";
import { createQuality, firstStep, qualityOverrides, STEPS } from "./laptop-quality";
import {
  BLUE_FLIGHT,
  YELLOW_FLIGHT,
  blueBox,
  blueMatrix,
  createFlightCamera,
  createFlightGlide,
  createFlightScroll,
  curvesRed,
  FLIGHT,
  flightAtStop,
  flightZ,
  GREEN,
  greenBox,
  greenDim,
  greenWidth,
  holeOnScreen,
} from "../rope-model/rope-flight";
import { BLUE_PALETTE_LAPTOP, blueRopeLook, prepareBluePalette } from "../rope-model/rope-blue";
import { YELLOW_PALETTE_LAPTOP } from "../rope-model/rope-yellow";
import { createRopeCard, RopeCard, type RopeCardControl } from "../rope-model/rope-card";
import { observeRopeScroll, type RopeLink } from "../rope-model/rope-link";
import { placePortal, portalMaterial } from "../rope-model/rope-portal";
import { compileFlight } from "../rope-model/prepare-flight";

const ENCODE = `sqrt(colour/${STORED_RANGE.toFixed(1)})`;
const SCROLL_SCREENS = 14;
const TRAVEL = 24;
const SETTLE = 0.14;
const CULL_MARGIN = 0.05;
const LOD_NEAR = 4,
  LOD_FAR = 14,
  LOD_KEEP = 0.2; // world units from the camera, and the share kept at the far end
const THIN_PX = 1.15; // CSS pixels: the width of a thread too thin to matter on its own
const HEAVIEST_Z = 0; // the whole red tunnel, with the whole green drawn beyond it

function fitLens(camera: PerspectiveCamera, rope: LaptopRope, aspect: number) {
  const lens = rope.meta.camera;
  camera.fov = (2 * Math.atan(lens.sensor / 2 / lens.lens / aspect) * 180) / Math.PI;
  camera.near = lens.near;
  camera.far = lens.far;
  camera.position.x = camera.position.y = 0;
  camera.rotation.set(0, 0, 0);
  camera.updateProjectionMatrix();
}

// Test switches only: ?still and ?flowAt show one moment, ?step fixes the quality step, ?bench draws N times a frame to put the chip under load.
function query() {
  const search = new URLSearchParams(window.location.search),
    at = Number(search.get("flowAt"));
  return {
    still: search.has("still"),
    at: search.has("flowAt") ? (Number.isFinite(at) ? at : 0) : null,
    ...qualityOverrides(search),
  };
}

// The hover logic is the desktop page's own. It writes to one material per rope; here its values are collected for one draw that holds all the ropes.
function hoverAdapter(rope: LaptopRope, matrix: Matrix4) {
  const sources = rope.samples.map(({ index, points }) => ({
    index,
    matrix,
    geometry: {
      getAttribute: () => ({
        count: points.length / 3,
        getX: (i: number) => points[i * 3],
        getY: (i: number) => points[i * 3 + 1],
        getZ: (i: number) => points[i * 3 + 2],
      }),
    } as unknown as BufferGeometry,
  }));
  const collect = {
    uniforms: { uSpread: { value: new Vector4() }, uSpreadAmount: { value: 0 } },
    uniformsNeedUpdate: false,
  } as unknown as ShaderMaterial;
  return { hover: createHover(sources, sources.length), collect };
}

function Scene({
  rope,
  progress,
  pointer,
  flight,
  blue,
  yellow,
  card,
  link,
  onShown,
}: {
  rope: LaptopRope;
  progress: React.RefObject<number>;
  pointer: React.RefObject<RopePointer>;
  flight: boolean;
  blue: boolean;
  yellow: boolean;
  card: RopeCardControl;
  link?: RopeLink;
  onShown: () => void;
}) {
  const profile = yellow ? YELLOW_FLIGHT : blue ? BLUE_FLIGHT : FLIGHT;
  const colourImages = useLoader(
    TextureLoader,
    blue ? [BLUE_PALETTE_LAPTOP] : yellow ? [YELLOW_PALETTE_LAPTOP] : [],
  );
  const palette = useMemo(() => prepareBluePalette(colourImages[0]), [colourImages]),
    bluePalette = blue ? palette : undefined,
    yellowPalette = yellow ? palette : undefined;
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const size = useThree((state) => state.size);
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const embedded = !!link;
  const review = useMemo(() => query(), []);
  // Resizing the viewport resizes the target below. Re-running calibration on a visible canvas exposes its trial steps.
  const [start] = useState(() => review.fixedStep ?? firstStep(size.width * gl.getPixelRatio()));
  const finish = useMemo(
    () =>
      createLaptopFinish(
        blue ? blueRopeLook(rope.meta.look) : rope.meta.look,
        STEPS[start].samples,
        flight,
        blue,
        yellow,
      ),
    [rope, start, flight, blue, yellow],
  );
  // Test switch: ?colour=green or ?colour=red shows the whole tunnel in one colour, for comparing against Blender's pictures.
  const colourFixed = useMemo(
    () => (flight && !blue ? new URLSearchParams(window.location.search).get("colour") : null),
    [flight, blue],
  );
  const threads = useMemo(() => {
    const { grid, zMiddle, meta } = rope;
    return laptopThreadMaterial({
      grain: rope.grain,
      grainGain: meta.grain.gain,
      grainMean: meta.grain.mean,
      encode: ENCODE,
      grid,
      zMiddle,
      radiusScale: meta.ranges.radius[1],
      uvU: meta.ranges.uv_u,
      hot: meta.ranges.rope_hot,
      look: meta.look,
      flight,
      blue: bluePalette,
      yellow: yellowPalette,
    });
  }, [rope, flight, bluePalette, yellowPalette]);
  const core = useMemo(
    () =>
      laptopCoreMaterial(
        blue ? blueRopeLook(rope.meta.look) : rope.meta.look,
        rope.meta.coreGrid,
        ENCODE,
        flight && !blue,
        blue && flight,
        yellow,
      ),
    [rope, flight, blue, yellow],
  );
  useEffect(() => {
    if (!colourFixed) return;
    for (const material of [threads, core]) {
      material.uniforms.uRed.value = yellow
        ? colourFixed === "yellow"
          ? 0
          : 1
        : colourFixed === "green"
          ? 0
          : 1;
      material.uniforms.uJoined.value = 0;
    }
    threads.uniforms.uFadeAt.value = -1e3;
    core.uniforms.uPush.value = 0;
  }, [colourFixed, threads, core, yellow]);
  const flightCamera = useMemo(() => createFlightCamera(), []);
  useEffect(() => flightCamera.place(link?.startZ), [flightCamera, link]);
  const joined = flight && !blue && !colourFixed;
  const placement = useMemo(() => (blue && flight ? blueMatrix() : new Matrix4()), [blue, flight]);
  const chunks = useMemo(
    () =>
      blue && flight
        ? rope.chunks.map((chunk) => ({
            ...chunk,
            ...blueBox(chunk.x0, chunk.x1, chunk.y0, chunk.y1, chunk.z0, chunk.z1),
          }))
        : rope.chunks,
    [blue, flight, rope],
  );
  const { hover, collect } = useMemo(() => hoverAdapter(rope, placement), [rope, placement]);
  // The whole tunnel again, turned and placed beyond the red one's far tip. The same stored threads, so nothing more to download. Each group needs its own draw range, because the two tunnels are at different distances.
  const green = useMemo(() => {
    if (!joined) return null;
    const chunks = rope.chunks.map((chunk): LaptopChunk => {
      const geometry = new BufferGeometry();
      for (const [name, attribute] of Object.entries(chunk.geometry.attributes))
        geometry.setAttribute(name, attribute);
      geometry.setIndex(chunk.geometry.index);
      geometry.boundingSphere = chunk.geometry.boundingSphere;
      return { ...chunk, ...greenBox(chunk.x0, chunk.x1, chunk.y0, chunk.y1, chunk.z0, chunk.z1), geometry };
    });
    return {
      chunks,
      threads: laptopGreenThreads(threads),
      core: laptopGreenCore(core),
      hole: farHoleMaterial(),
    };
  }, [joined, rope, threads, core]);
  useEffect(
    () => () => {
      if (!green) return;
      green.chunks.forEach((chunk) => chunk.geometry.dispose());
      green.threads.dispose();
      green.core.dispose();
      green.hole.dispose();
    },
    [green],
  );
  const meshes = useRef<(Mesh | null)[]>([]);
  const greenMeshes = useRef<(Mesh | null)[]>([]);
  const meter = useRef<RopeMeter | null>(null);
  const share = useRef(STEPS[start].share);
  const flowClock = useRef(0);
  const chained = useRef(false);
  const calm = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)"), []);
  const resize = useRef<(scale: number, samples: number) => void>(() => {});
  const thinRest = useRef(1),
    thinMoving = useRef(1);
  const [settled, setSettled] = useState(false);
  /* eslint-disable react-hooks/refs, react-hooks/purity -- Allocates an owned GPU timer; the resize/settle callbacks run later from the frame loop. */
  const quality = useMemo(() => {
    const named = (index: number) =>
      `${Math.round(gl.domElement.width * STEPS[index].scale)} wide, ${
        STEPS[index].samples
      } edge samples, far threads ${STEPS[index].share}`;
    return createQuality(
      gl,
      start,
      review.fixedStep !== null,
      {
        onChange(step) {
          share.current = step.share;
          finish.setSamples(step.samples);
          resize.current(step.scale, step.samples);
          invalidate();
        },
        onTest(index, chipMs, frameMs) {
          traceMark(
            `Chip test step ${index} (${named(index)}): chip ${
              chipMs === null ? "no timer" : chipMs.toFixed(1) + " ms"
            }, frame ${frameMs.toFixed(1)} ms`,
          );
        },
        onSettled(index) {
          traceMark(`Quality chosen, step ${index}: ${named(index)}`);
          setSettled(true);
          invalidate();
        },
        onStepDown(index) {
          traceMark(
            `Quality stepped down at ${Math.round(performance.now() / 1000)} s, step ${index}: ${named(
              index,
            )}`,
          );
        },
      },
      { sweep: !embedded && diagnosticsEnabled(), adaptWhileWatching: !embedded && !diagnosticsEnabled() },
    );
  }, [gl, finish, start, invalidate, review, embedded]);
  /* eslint-enable react-hooks/refs, react-hooks/purity */
  useEffect(() => () => quality.dispose(), [quality]);
  // The timer can serve only one, so the report starts once the test has finished. Its numbers are then the picture being watched.
  useEffect(() => {
    if (review.fixedStep !== null || settled) onShown();
    if (review.fixedStep === null && !settled) return;
    const made = createRopeMeter(gl, finish.target.samples);
    meter.current = made;
    return () => {
      made?.dispose();
      meter.current = null;
    };
  }, [gl, finish, settled, review, onShown]);
  useEffect(
    () => () => {
      threads.dispose();
      core.dispose();
      finish.dispose();
    },
    [threads, core, finish],
  );
  useEffect(() => {
    resize.current = (scale: number, samples: number) => {
      const width = Math.max(2, Math.round(size.width * gl.getPixelRatio() * scale)),
        height = Math.max(2, Math.round(size.height * gl.getPixelRatio() * scale));
      finish.setSize(width, height, scale);
      threads.uniforms.uResolution.value.set(width, height);
      // A thin thread keeps the same width on screen at every step, and is never narrower than a pixel of the picture, so the rope does not look more sparse.
      // With only 2 edge samples a thread must be a little wider, or it falls between them and looks dashed. On the flight page only while the camera moves: at rest the frames build up and it can keep its true width.
      thinRest.current = Math.max(flight ? 1 : samples < 4 ? 1.3 : 1, THIN_PX * gl.getPixelRatio() * scale);
      thinMoving.current = Math.max(samples < 4 ? 1.3 : 1, THIN_PX * gl.getPixelRatio() * scale);
      threads.uniforms.uThinPx.value = thinMoving.current;
    };
    resize.current(STEPS[quality.step].scale, STEPS[quality.step].samples);
    share.current = STEPS[quality.step].share;
    fitLens(camera, rope, size.width / size.height);
    invalidate();
  }, [size, gl, finish, threads, camera, rope, invalidate, quality, flight]);

  const portal = useMemo(() => (link && flight ? portalMaterial(blue) : null), [link, flight, blue]);
  const portalMesh = useRef<Mesh | null>(null);
  useEffect(() => () => portal?.dispose(), [portal]);
  // Sections only (they pass a link): nothing is drawn, not even the hidden quality test, until this flight's programs
  // have compiled in the background; otherwise the first hidden frame compiles them all at once and the page freezes.
  const compiled = useRef<object | null>(null);
  useEffect(() => {
    if (!link) return;
    let live = true;
    const done = () => {
      if (live) {
        compiled.current = finish;
        invalidate();
      }
    };
    void compileFlight(gl, scene, camera, finish.target, finish.passes).then(done, () => {
      if (live) link.failed();
    });
    return () => {
      live = false;
    };
  }, [link, gl, scene, camera, finish, threads, core, green, portal, invalidate]);
  useFrame((state, delta) => {
    if (link && compiled.current !== finish) return;
    // The hidden quality test must see the heaviest view, not the light one inside the green where the flight begins. The picture is not on screen yet, so the camera can simply be put there.
    if (link?.covered && (!(flight && quality.testing) || link.shouldWarm?.() === false)) {
      chained.current = false;
      return;
    }
    const testing = flight && quality.testing,
      position = state.camera.position,
      cameraWas = position.z,
      target = flight
        ? testing
          ? HEAVIEST_Z
          : flightZ(link ? link.flightShare(progress.current) : progress.current, profile)
        : -progress.current * TRAVEL,
      gap = target - position.z;
    let moving = Math.abs(gap) >= 0.0005;
    if (flight) {
      if (testing) {
        position.z = target;
        flightCamera.place(link?.startZ);
        moving = false;
      } else {
        moving = flightCamera.move(position, target, delta);
        link?.camera(position.z);
      }
    } else if (!moving) position.z = target;
    else position.z += gap * (1 - Math.exp(-Math.min(delta, 0.1) / SETTLE));
    // A pause between scrolls is not a slow frame: only frames that followed straight on from another are measured.
    if (review.fixedStep === null && chained.current) quality.frame(delta * 1000, performance.now());
    const lens = rope.meta.camera,
      across = lens.sensor / 2 / lens.lens,
      up = across / (size.width / size.height),
      look = TUNING_BASE;

    // The green goes a little out of focus only as the camera moves on from the stop.
    if (green) {
      green.threads.uniforms.uWide.value = greenWidth(position.z);
      green.threads.uniforms.uDim.value = greenDim(position.z);
    }
    // The white: same logic as the desktop page, collected into one list per rope.
    const hoverMoving = hover.update(
      Math.min(delta, 0.1),
      pointer.current,
      state.camera as PerspectiveCamera,
      across,
      up,
      size.width,
      calm.matches,
      collect,
      look.white.speed,
      false,
    );
    if (
      flight &&
      card.update(
        performance.now(),
        hover.rope,
        flightAtStop(link ? link.flightShare(progress.current) : progress.current, position.z, profile),
      )
    )
      moving = true;
    const u = threads.uniforms;
    u.uAnyWhite.value = hover.hasWhite ? 1 : 0;
    if (hover.hasWhite) {
      for (let i = 0; i < SPREAD_SLOTS; i++) {
        collect.uniforms.uSpreadAmount.value = 0;
        hover.apply(collect, i < 18 ? i : -1);
        const amount = collect.uniforms.uSpreadAmount.value as number;
        u.uAmounts.value[i] = amount;
        if (amount > 0) u.uSpreads.value[i].copy(collect.uniforms.uSpread.value as Vector4);
      }
    }
    u.uShine.value = look.red.shine;
    u.uWhiteShine.value = look.white.shine;
    u.uWhiteStored.value = whiteStored(look);
    finish.setTuning(look.red.glow, whiteStored(look));

    if (review.still || calm.matches) setLaptopFlow(threads, null);
    else if (review.at !== null) setLaptopFlow(threads, review.at);
    else {
      flowClock.current =
        (flowClock.current + (Math.min(delta, 0.1) * FLOW.speed * look.flow.speed) / FLOW.spacing) % 1;
      setLaptopFlow(threads, flowClock.current);
    }

    // Groups behind or beside the camera are skipped. Far ones draw only their best threads when a slow laptop has stepped down.
    const place = (chunk: LaptopChunk, mesh: Mesh | null, size: number) => {
      if (!mesh) return;
      const reach = position.z - chunk.z0 + CULL_MARGIN;
      mesh.visible =
        reach > 0 &&
        chunk.x0 < across * reach + CULL_MARGIN &&
        chunk.x1 > -across * reach - CULL_MARGIN &&
        chunk.y0 < up * reach + CULL_MARGIN &&
        chunk.y1 > -up * reach - CULL_MARGIN;
      if (!mesh.visible) return;
      // Nearest threads are always all there. Far away a thread is under a pixel wide, and only the best of them still show.
      const far = Math.min(
          Math.max((position.z - chunk.z1 - LOD_NEAR * size) / ((LOD_FAR - LOD_NEAR) * size), 0),
          1,
        ),
        keep = 1 - far * (1 - LOD_KEEP * share.current);
      chunk.geometry.setDrawRange(chunk.start, chunk.ranks[Math.round(keep * 256)] * 6);
    };
    chunks.forEach((chunk, i) => place(chunk, meshes.current[i], 1));
    green?.chunks.forEach((chunk, i) => place(chunk, greenMeshes.current[i], GREEN.scale));

    if (portal)
      placePortal(
        portal,
        portalMesh.current,
        finish.setPortal,
        position.z,
        up,
        size.width / size.height,
        blue,
      );
    let backdrop =
      flight && !blue
        ? finish.backdropAt(yellow ? (colourFixed === "yellow" ? 0 : 1) : colourFixed === "green" ? 0 : 1)
        : finish.backdrop;
    if (green) {
      const h = green.hole.uniforms,
        curves = curvesRed(position.z);
      backdrop = h.uOuter.value.copy(finish.backdropAt(1, curves));
      h.uInner.value.copy(finish.backdropAt(0, curves));
      h.uRadius.value = holeOnScreen(position.z, up);
      h.uAspect.value = size.width / size.height;
    }
    quality.begin();
    // ?bench=N draws every frame N times: under real load the chip's speed shows in the frame time, without its power saving getting in the way.
    for (let i = 1; i < review.bench; i++) {
      state.gl.setRenderTarget(finish.target);
      state.gl.setClearColor(backdrop, 1);
      if (!state.gl.autoClear) state.gl.clear();
      state.gl.render(state.scene, state.camera);
      finish.render(state.gl);
    }
    state.gl.setRenderTarget(finish.target);
    state.gl.setClearColor(backdrop, 1);
    meter.current?.sceneStart(progress.current);
    if (!state.gl.autoClear) state.gl.clear();
    const still = finish.lookAside(state.camera, Math.abs(position.z - cameraWas));
    threads.uniforms.uThinPx.value = thinMoving.current + (thinRest.current - thinMoving.current) * still;
    state.gl.render(state.scene, state.camera);
    finish.lookBack(state.camera);
    meter.current?.sceneEnd();
    finish.render(state.gl);
    meter.current?.frameEnd();
    quality.end();
    chained.current =
      quality.testing || (!calm.matches && !review.still && review.at === null) || moving || hoverMoving || finish.settling;
    if (chained.current) state.invalidate();
  }, 1);

  return (
    <>
      {chunks.map((chunk, i) => (
        <mesh
          key={i}
          ref={(mesh) => {
            meshes.current[i] = mesh;
          }}
          matrix={placement}
          geometry={chunk.geometry}
          material={threads}
          renderOrder={-chunk.z1}
          frustumCulled={false}
          matrixAutoUpdate={false}
        />
      ))}
      <mesh
        matrix={placement}
        geometry={rope.core}
        material={core}
        renderOrder={1e6}
        frustumCulled={false}
        matrixAutoUpdate={false}
      />
      {green ? (
        <>
          {green.chunks.map((chunk, i) => (
            <mesh
              key={i}
              ref={(mesh) => {
                greenMeshes.current[i] = mesh;
              }}
              geometry={chunk.geometry}
              material={green.threads}
              renderOrder={-chunk.z1}
              frustumCulled={false}
              matrixAutoUpdate={false}
            />
          ))}
          <mesh
            geometry={rope.core}
            material={green.core}
            renderOrder={1e6 + 1}
            frustumCulled={false}
            matrixAutoUpdate={false}
          />
          <mesh material={green.hole} renderOrder={2e6} frustumCulled={false}>
            <planeGeometry args={[2, 2]} />
          </mesh>
        </>
      ) : null}
      {portal ? (
        <mesh ref={portalMesh} material={portal} renderOrder={3e6} frustumCulled={false}>
          <planeGeometry args={[2, 2]} />
        </mesh>
      ) : null}
    </>
  );
}

export default function RopeLaptop({
  flight = false,
  blue = false,
  yellow = false,
  link,
  over,
}: {
  flight?: boolean;
  blue?: boolean;
  yellow?: boolean;
  link?: RopeLink;
  over?: React.ReactNode;
}) {
  const profile = yellow ? YELLOW_FLIGHT : blue ? BLUE_FLIGHT : FLIGHT;
  const scroller = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const pointer = useRef<RopePointer>({ x: 0, y: 0, on: false, moved: false });
  const invalidate = useRef<(() => void) | null>(null);
  const [rope, setRope] = useState<LaptopRope | null>(null);
  const [loaded, setLoaded] = useState(0);
  const [failed, setFailed] = useState(false);
  const colour = yellow ? "yellow-green" : blue ? "blue" : "green-red";
  const [shownColour, setShownColour] = useState("");
  const shown = shownColour === colour;
  const show = useCallback(() => setShownColour(colour), [colour]);
  const [cards] = useState(() => ({
    red: createRopeCard(),
    blue: createRopeCard(),
    green: createRopeCard(),
  }));
  const card = yellow ? cards.green : blue ? cards.blue : cards.red;
  useEffect(() => {
    if (!link) return;
    link.wake = () => invalidate.current?.();
    link.attach(scroller.current!);
    const unsubscribe = journeyControls.subscribe(link.wake);
    return () => {
      link.wake = null;
      unsubscribe();
    };
  }, [link]);
  useEffect(() => {
    if (shown) link?.ready();
  }, [shown, link]);
  useEffect(() => {
    if (failed) link?.failed();
  }, [failed, link]);
  useEffect(() => {
    let live = true,
      made: LaptopRope | null = null;
    void loadLaptopRope(flight, (share) => {
      if (live) setLoaded(share);
    })
      .then((loaded) => {
        made = loaded;
        if (live) setRope(made);
        else made.dispose();
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
      made?.dispose();
    };
  }, [flight]);
  useEffect(() => {
    const element = scroller.current!;
    const stopScroll = observeRopeScroll(element, (share) => {
      progress.current = share;
      invalidate.current?.();
    }, link);
    // Only a real mouse. It never moves the camera, it only says which rope turns white.
    const hover = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      if (card.holdsPointer(event.clientX, event.clientY)) {
        invalidate.current?.();
        return;
      }
      card.moved();
      const box = element.getBoundingClientRect();
      pointer.current.x = ((event.clientX - box.left) / box.width) * 2 - 1;
      pointer.current.y = 1 - ((event.clientY - box.top) / box.height) * 2;
      pointer.current.on = pointer.current.moved = true;
      invalidate.current?.();
    };
    // The card's close button sits above this layer, so reaching it reads as leaving. The mouse is still on the card.
    const away = (event: PointerEvent) => {
      if (card.holdsPointer(event.clientX, event.clientY)) {
        invalidate.current?.();
        return;
      }
      pointer.current.on = false;
      card.release();
      invalidate.current?.();
    };
    element.addEventListener("pointermove", hover, { passive: true });
    element.addEventListener("pointerleave", away);
    return () => {
      element.removeEventListener("pointermove", hover);
      element.removeEventListener("pointerleave", away);
      stopScroll();
    };
  }, [card, link]);
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    if (
      !flight ||
      search.has("still") ||
      search.has("flowAt") ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    return link
      ? createFlightGlide(scroller.current!, profile, link.glide)
      : createFlightScroll(scroller.current!, profile);
  }, [flight, profile, link]);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      <Canvas
        frameloop="demand"
        resize={{ scroll: false }}
        dpr={[1, 1.5]}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
          stencil: false,
          depth: false,
        }}
        camera={{ position: [0, 0, 0], fov: 50 }}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: shown ? 1 : 0,
          transition: "opacity .5s",
        }}
        onCreated={(state) => {
          invalidate.current = state.invalidate;
          if (link) link.wake = state.invalidate;
          traceMark("Canvas created");
        }}
      >
        <Suspense fallback={null}>
          {rope ? (
            <Scene
              key={colour}
              rope={rope}
              progress={progress}
              pointer={pointer}
              flight={flight}
              blue={blue}
              yellow={yellow}
              card={card}
              link={link}
              onShown={show}
            />
          ) : null}
        </Suspense>
      </Canvas>
      {over}
      {shown || ((blue || yellow) && link) ? null : (
        <div
          style={{
            position: "absolute",
            left: 24,
            bottom: 20,
            color: "#888",
            font: "13px/1 system-ui,sans-serif",
            pointerEvents: "none",
          }}
        >
          {failed ? "The model could not load" : `Loading model ${Math.round(loaded * 100)}%`}
        </div>
      )}
      <div
        ref={scroller}
        data-rope-scroller
        data-rope-colour={colour}
        style={{
          position: "absolute",
          inset: 0,
          overflowY: "auto",
          overscrollBehavior: "contain",
          scrollbarWidth: "none",
          outline: "none",
        }}
      >
        <div style={{ height: `${(flight ? profile.scrollScreens : SCROLL_SCREENS) * 100}dvh` }} />
      </div>
      {flight && !profile.through ? <RopeCard card={card} tint={profile.cardTint} /> : null}
      <RopeReportPanel />
    </div>
  );
}
