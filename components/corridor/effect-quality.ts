import type { WebGLRenderer } from "three";
import { isMobileDevice } from "./texture-quality";
import { gpuSpeed, measureGpuSpeed, richFits, RICH_COST, speedReused, type DrawingCost } from "./gpu-speed";
import { targetDpr } from "./render-resolution";
import { traceMark } from "./loading-trace";

/** "desktop" is the richer picture, "laptop" the lighter one, "mobile" the phone one. The names are the pictures', not
 * the devices': a fast laptop gets "desktop" and a slow desktop "laptop". */
export type EffectQuality = "desktop" | "laptop" | "mobile";

/** Local diagnostics only: ?diagnostics&fx-test=desktop|laptop|mobile shows that picture on the development PC. */
function testOverride(): EffectQuality | null {
  if (typeof location === "undefined" || !/^(localhost|127\.)/.test(location.hostname)) return null;
  const params = new URLSearchParams(location.search),
    test = params.get("fx-test");
  return params.has("diagnostics") && (test === "laptop" || test === "mobile" || test === "desktop")
    ? test
    : null;
}

/**
 * Starts the graphics speed test (gpu-speed.ts) on computers. Pages wait for it before their first 3D canvas, so each
 * picture below is chosen once, from this device's measured speed. Phones skip it: they always get the phone picture.
 */
export function prepareQuality(): Promise<void> {
  if (testOverride() || isMobileDevice()) return Promise.resolve();
  return measureGpuSpeed().then(() => {
    const speed = gpuSpeed();
    traceMark(
      speed
        ? `Graphics speed ${speed.geometry.toFixed(2)}x threads, ${speed.shading.toFixed(2)}x pixels` +
            (speedReused() ? " (saved)" : "")
        : "Graphics speed unknown",
    );
  });
}

/** The richer picture where this device's measured speed draws its costliest moment within the frame budget at this
 * screen size and pixel ratio; the lighter one otherwise, and whenever the speed is unknown. */
function choose(cost: DrawingCost, pixelRatio: number): EffectQuality {
  if (isMobileDevice()) return "mobile";
  const megapixels = (innerWidth * pixelRatio * innerHeight * pixelRatio) / 1e6;
  return richFits(cost, megapixels, gpuSpeed()) ? "desktop" : "laptop";
}

const selections = new WeakMap<WebGLRenderer, EffectQuality>();
/** The corridor's picture, chosen once per renderer, at the drawing size the richer picture would use. */
export function effectQuality(gl: WebGLRenderer): EffectQuality {
  let choice = selections.get(gl);
  if (!choice) {
    choice =
      testOverride() ??
      choose(RICH_COST.corridor, targetDpr("desktop", innerWidth, innerHeight, devicePixelRatio));
    selections.set(gl, choice);
  }
  return choice;
}

let ropeDevice: EffectQuality | undefined, webgl2: boolean | undefined;
/**
 * The same choice for the rope flight between the sections, which has its own canvas (pixel ratio 1 to 1.5). Phones,
 * and anything without WebGL 2, have no flight yet. Asked before the speed test has finished (only a very early menu
 * jump can), it answers for the lighter flight without keeping that answer.
 */
export function ropeFlightDevice(): EffectQuality {
  if (ropeDevice) return ropeDevice;
  const test = testOverride();
  if (test) return (ropeDevice = test);
  if (isMobileDevice()) return (ropeDevice = "mobile");
  if (webgl2 === undefined) {
    const context = document.createElement("canvas").getContext("webgl2");
    webgl2 = !!context;
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  }
  if (!webgl2) return (ropeDevice = "mobile");
  if (gpuSpeed() === undefined) return "laptop";
  return (ropeDevice = choose(RICH_COST.rope, ropePixelRatio()));
}
const ropePixelRatio = () => Math.min(1.5, Math.max(1, devicePixelRatio || 1));

/** For the performance panel: both pictures and the measured speed behind them. Does not settle the rope's choice. */
export function describeQuality(gl: WebGLRenderer) {
  const corridor = effectQuality(gl),
    rope = ropeDevice ?? testOverride() ?? choose(RICH_COST.rope, ropePixelRatio()),
    name = { desktop: "rich", laptop: "light", mobile: "no" },
    speed = gpuSpeed();
  const pictures = `${corridor === "mobile" ? "phone" : name[corridor]} corridor, ${name[rope]} rope flight`;
  if (!speed) return pictures;
  const reading = `${speed.geometry.toFixed(2)}× / ${speed.shading.toFixed(2)}×`;
  return `${pictures} · ${reading}${speedReused() ? " (saved test)" : ""}`;
}
