"use client";
/* eslint-disable react-hooks/immutability -- The rig moves the strip, the camera and shared uniforms from frame callbacks. */
import {
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
  type RefObject,
} from "react";
import { advance, Canvas, useFrame, useThree } from "@react-three/fiber";
import { type Group, MathUtils, type PerspectiveCamera } from "three";
import { FILM_PRODUCTS, FILM_VOID, FRAME_PITCH } from "./film-data";
import { FilmStrip, type FilmLooks } from "./film-strip";
import { reelClick } from "./reel-click";
import { createReelMotion, type ReelMotion, type ReelShot } from "./reel-motion";
import { sceneMotion } from "../corridor/scene-idle";
import { uploadTexturesGradually } from "../corridor/hidden-gpu-preparation";
import { traceMark, traceSpan } from "../corridor/loading-trace";
import TitleLine, { CARD_WAIT, cardStrength, showTitle, writeTitle } from "../corridor/title-card";

const FOV = 28;
// Review only (?drive on /film-study or /sections): a hand-turned clock, so the reel can be stepped and checked frame by frame in a browser that is not painting.
let driven: number | null = null;
const clock = () => driven ?? performance.now();
const FILM_RATE = 24; // the grain, the flicker and the scratch lines change at the speed film ran through a projector
const noise = (n: number) => {
  const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
};
/** Exposure of film frame n: a small random wobble each frame over a slower drift, never more than a few percent. */
const flickerAt = (n: number) =>
  1 + 0.048 * (noise(n) - 0.5) + 0.018 * Math.sin(n * 0.083) + 0.012 * Math.sin(n * 0.31 + 1.7);
/** Gate weave: film never sits exactly still in a projector gate. Each frame lands a pixel or so off, over a slow drift. In frame units. */
const weaveAt = (n: number) => [
  0.0016 * (noise(n * 1.73 + 0.4) - 0.5) + 0.0012 * Math.sin(n * 0.11 + 0.8),
  0.0045 * (noise(n * 2.31 + 9.1) - 0.5) + 0.0035 * Math.sin(n * 0.17 + 2.3),
];

/** What the page around the reel may ask of it. */
export type ReelHandle = {
  /** One scroll in pixels, down positive. True when the reel used it; false means the page may have it. */
  input(pixels: number): boolean;
  /** Coming back from the next section: be the burnt-white last frame, ready to run backwards. */
  atEnd(): void;
  /** True while the reel covers the screen. */
  showing(): boolean;
};

function Rig({
  motion,
  looks,
  calm,
  onReady,
  onShot,
  wake,
}: {
  motion: ReelMotion;
  looks: RefObject<FilmLooks | null>;
  calm: boolean;
  onReady: () => void;
  onShot: (shot: ReelShot) => void;
  wake: RefObject<(() => void) | null>;
}) {
  const slide = useRef<Group>(null),
    last = useRef(0),
    prepared = useRef(false),
    tick = useRef(0);
  const preparation = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      clearTimeout(tick.current);
      preparation.current?.abort();
    },
    [],
  );
  const gl = useThree((state) => state.gl),
    scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera) as PerspectiveCamera,
    size = useThree((state) => state.size),
    invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    wake.current = invalidate;
    invalidate();
    return () => {
      wake.current = null;
    };
  }, [wake, invalidate, size]);
  const setLooks = useCallback(
    (made: FilmLooks) => {
      looks.current = made;
    },
    [looks],
  );
  // Compile the visible program variants, then upload the original textures a
  // frame at a time before the reel can start drawing.
  const stripReady = useCallback(() => {
    preparation.current?.abort();
    const controller = new AbortController();
    preparation.current = controller;
    const alive = () => !controller.signal.aborted;
    const end = traceSpan("Products reel GPU preparation", "shader/resource preparation");
    void gl
      .compileAsync(scene, camera)
      .then(() => {
        if (alive()) return uploadTexturesGradually(gl, scene, alive);
      })
      .then(() => {
        if (!alive()) return;
        prepared.current = true;
        traceMark("Products reel GPU ready");
        invalidate();
      })
      .catch((error) => {
        if (!alive()) return;
        end({ error: String(error) });
        // Allow the renderer's regular draw path to try if prewarming failed.
        prepared.current = true;
        invalidate();
      })
      .finally(() => end());
  }, [gl, scene, camera, invalidate]);
  const told = useRef(false);
  useFrame(() => {
    if (!prepared.current) return;
    const now = clock(),
      gap = (now - last.current) / 1000;
    last.current = now;
    // Time the page spent idle never reaches the motion: after a pause the first step is one ordinary frame.
    const shot = motion.step(gap > 0.1 ? 1 / 60 : gap);
    const film = looks.current;
    const reel = calm ? 0 : Math.floor((now / 1000) * FILM_RATE),
      flicker = calm ? 1 : flickerAt(reel);
    const [weaveX, weaveY] = calm ? [0, 0] : weaveAt(reel);
    if (slide.current)
      slide.current.position.set(
        -shot.position * FRAME_PITCH + weaveX * FRAME_PITCH,
        weaveY * FRAME_PITCH,
        0,
      );
    if (film) {
      film.lamp.uLampX.value = shot.position * FRAME_PITCH;
      film.lamp.uLamp.value = shot.lamp * (1 + (flicker - 1) * 1.6);
      film.look.uFrame.value = reel;
      film.look.uFlicker.value = flicker;
      film.look.uScratch.value = calm ? 0 : 1;
      film.look.uScreen.value.set(size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio());
      film.void.uniforms.uAspect.value = size.width / Math.max(1, size.height);
    }
    // Fit one frame and a little of its neighbours: by height on a wide screen, by width on a tall one.
    const half = Math.tan(MathUtils.degToRad(FOV / 2)),
      aspect = size.width / Math.max(1, size.height);
    const fit = Math.max(FRAME_PITCH / 0.58 / (2 * half), FRAME_PITCH / 0.84 / (2 * half * aspect));
    camera.position.set(0, 0, fit); // leaving, the white simply fades over the still strip, just as it fades off it coming in
    if (camera.fov !== FOV) {
      camera.fov = FOV;
      camera.updateProjectionMatrix();
    }
    if (shot.landed >= 0) reelClick();
    onShot(shot);
    gl.render(scene, camera);
    if (!told.current) {
      told.current = true;
      queueMicrotask(onReady);
    }
    // Moving: draw every frame. Still: draw only when the next film frame is due, so the grain lives on at 24 a second for little cost.
    clearTimeout(tick.current);
    // Background 3D preparation behind the page (the final eye, on phones) waits while the reel moves.
    if (shot.moving) {
      invalidate();
      sceneMotion.at = performance.now();
    } else if (shot.visible && !calm)
      tick.current = window.setTimeout(invalidate, 1000 / FILM_RATE - (now % (1000 / FILM_RATE)));
  }, 1);
  return (
    <group ref={slide}>
      <FilmStrip onLooks={setLooks} onReady={stripReady} />
    </group>
  );
}

const live = (shot: ReelShot) => {
  const index = Math.round(shot.position),
    product = FILM_PRODUCTS[index];
  return `Frame ${index + 1} of ${FILM_PRODUCTS.length}: ${product.name}, ${product.brand}`;
};

/**
 * Section 1, the film reel, as one full-screen layer: the canvas, the white of the house lights and the last flash, and a spoken line for screen readers.
 * `running` starts the house lights once the strip is ready. With `listen`, the layer reads the wheel, touch and keys itself (the review page);
 * in the site the page routes the scroll through `handle` instead.
 */
export default function FilmReel({
  handle,
  running = true,
  ended = false,
  listen = false,
  line,
  onIdle,
  onExit,
}: {
  handle?: Ref<ReelHandle>;
  running?: boolean;
  ended?: boolean;
  listen?: boolean;
  line?: string;
  onIdle?: (showing: boolean) => void;
  onExit?: () => void;
}) {
  const [calm] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  // Arriving from a later section, the reel has already run: it waits, burnt white and out of sight, for a scroll back up.
  // With a title line, the opening white is held while it is written, read and half faded (as every section's white);
  // then the house lights go down as before.
  const [motion] = useState(() => {
    const made = createReelMotion({ frames: FILM_PRODUCTS.length, calm, hold: line ? CARD_WAIT : undefined });
    if (ended) made.atEnd();
    return made;
  });
  const layer = useRef<HTMLDivElement>(null),
    white = useRef<HTMLDivElement>(null),
    voice = useRef<HTMLParagraphElement>(null);
  // `line`: the section's title line, on the opening white page only (the house lights), never on the last frame's burn.
  // It writes in on the reel's own clock, holds, then fades into the still-white page, gone as the lights start down.
  const title = useRef<HTMLParagraphElement>(null);
  const looks = useRef<FilmLooks | null>(null),
    wake = useRef<(() => void) | null>(null),
    showing = useRef(!ended);
  const [ready, setReady] = useState(false),
    markReady = useCallback(() => setReady(true), [setReady]);

  useEffect(() => {
    if (ready && running) {
      motion.begin();
      wake.current?.();
    }
  }, [ready, running, motion]);

  const onShot = useCallback(
    (shot: ReelShot) => {
      if (white.current) white.current.style.opacity = shot.white.toFixed(4);
      if (title.current) {
        showTitle(title.current, shot.burn === 0 && shot.held > 0 ? cardStrength(shot.held) : 0);
        writeTitle(title.current, calm ? Infinity : shot.held);
      }
      if (shot.exited) onExit?.();
      if (layer.current && shot.visible !== showing.current) {
        showing.current = shot.visible;
        layer.current.style.visibility = shot.visible ? "visible" : "hidden";
        onIdle?.(shot.visible);
      }
      if (shot.landed >= 0 && voice.current) voice.current.textContent = live(shot);
    },
    [onIdle, onExit, calm],
  );

  const take = useCallback(
    (pixels: number) => {
      const used = motion.input(pixels);
      if (used && !showing.current && layer.current) {
        showing.current = true;
        layer.current.style.visibility = "visible";
        onIdle?.(true);
      }
      wake.current?.();
      return used;
    },
    [motion, onIdle],
  );

  useImperativeHandle(
    handle,
    () => ({
      input: take,
      atEnd() {
        motion.atEnd();
        showing.current = false;
        showTitle(title.current, 0);
        if (layer.current) layer.current.style.visibility = "hidden";
        if (white.current) white.current.style.opacity = "1";
        wake.current?.();
      },
      showing: () => showing.current,
    }),
    [take, motion],
  );

  useEffect(() => {
    if (!new URLSearchParams(location.search).has("drive")) return;
    const review = window as Window & {
      __reel?: { go(seconds: number, pixels?: number, events?: number): string };
    };
    driven = performance.now();
    review.__reel = {
      go(seconds, pixels = 0, events = 1) {
        const steps = Math.max(1, Math.round(seconds * 60));
        for (let index = 0; index < steps; index++) {
          if (index < events && pixels) take(pixels / events);
          driven! += 1000 / 60;
          advance(driven!);
        }
        const shot = motion.read();
        return JSON.stringify({
          position: +shot.position.toFixed(3),
          lamp: +shot.lamp.toFixed(3),
          burn: +shot.burn.toFixed(3),
          white: +shot.white.toFixed(3),
          visible: shot.visible,
        });
      },
    };
    return () => {
      driven = null;
      delete review.__reel;
    };
  }, [take, motion]);

  useEffect(() => {
    const node = layer.current;
    if (!listen || !node) return;
    let touchY = 0;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      const pixels =
        event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
      if (take(pixels)) event.preventDefault();
    };
    const start = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? 0;
    };
    const move = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? touchY;
      if (take((touchY - y) * 1.6)) event.preventDefault();
      touchY = y;
    };
    const key = (event: KeyboardEvent) => {
      const step = ["ArrowDown", "PageDown", " "].includes(event.key)
        ? 120
        : ["ArrowUp", "PageUp"].includes(event.key)
          ? -120
          : 0;
      if (step && take(step)) event.preventDefault();
    };
    window.addEventListener("wheel", wheel, { passive: false });
    node.addEventListener("touchstart", start, { passive: true });
    node.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("wheel", wheel);
      node.removeEventListener("touchstart", start);
      node.removeEventListener("touchmove", move);
      window.removeEventListener("keydown", key);
    };
  }, [listen, take]);

  return (
    <div
      ref={layer}
      className="film-reel"
      data-film-reel
      style={{
        position: "fixed",
        inset: 0,
        background: FILM_VOID,
        touchAction: "none",
        visibility: ended ? "hidden" : undefined,
      }}
    >
      <Canvas
        flat
        frameloop="demand"
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 14], fov: FOV, near: 0.1, far: 120 }}
        style={{ position: "absolute", inset: 0 }}
        aria-hidden="true"
      >
        <color attach="background" args={[FILM_VOID]} />
        <Suspense fallback={null}>
          <Rig
            motion={motion}
            looks={looks}
            calm={calm || !running}
            onReady={markReady}
            onShot={onShot}
            wake={wake}
          />
        </Suspense>
      </Canvas>
      <div ref={white} style={{ position: "absolute", inset: 0, background: "#fff", pointerEvents: "none" }}>
        {line ? <TitleLine ref={title} text={line} /> : null}
      </div>
      <h2 className="film-reel-title">Products</h2>
      <ol className="film-reel-list">
        {FILM_PRODUCTS.map((product) => (
          <li key={product.picture}>
            {product.name}, {product.brand}
          </li>
        ))}
      </ol>
      <p ref={voice} className="film-reel-list" aria-live="polite" />
    </div>
  );
}
