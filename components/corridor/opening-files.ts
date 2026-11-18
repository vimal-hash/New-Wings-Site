import { preload } from "react-dom";
import { assetURL } from "./asset-url";
import { traceMark } from "./loading-trace";
import manifest from "./baked-surfaces.json";
import ceiling from "./theatre-ceiling-assets.json";
import leftWall from "./theatre-left-wall-assets.json";
import sofas from "./sofa-assets.json";
import { CINEMA_GLASSES } from "./cinema-glasses-state";
import { SOFAS_ENABLED } from "./scene-features";

/** Kept free of three.js and React Three Fiber, so the page can load it before the 3D code. */
export const THEATRE_MODELS = ["/models/theatre-marked.glb", "/models/projector-floor-marked.glb"];
// Lossless WebP of the supplied PNG: identical pixels (0 differ), 1.28 MB -> 0.59 MB on the first-paint path.
export const THEATRE_SCREEN_ARTWORK = "/images/theatre-screen-ghosted.webp";

let started = false;
/**
 * Computers wait for the graphics speed test before the 3D canvas exists, and the opening's loaders only start
 * once it does. This starts those same downloads while the test runs, so the test costs a first visit little.
 * Same files, order and request kind as preloadOpeningAssets (opening-assets.ts) and preloadBakedSurfaces("theatre")
 * ask for: their loaders then take these responses instead of fetching again. Downloads only; decoding and every GPU
 * step still wait for the canvas, so the test has the graphics chip to itself.
 */
export function startOpeningDownloads() {
  if (started) return;
  started = true;
  traceMark("Opening downloads started early");
  // Three's file loaders fetch with CORS and same-origin credentials; its image loader uses an anonymous <img>.
  const file = (url: string) => preload(assetURL(url), { as: "fetch", crossOrigin: "anonymous" });
  preload(assetURL(THEATRE_SCREEN_ARTWORK), { as: "image", crossOrigin: "anonymous" });
  [CINEMA_GLASSES, ...THEATRE_MODELS, ceiling.model].forEach(file);
  if (SOFAS_ENABLED) file(sofas.model);
  // The KTX2 transcoder, which the first atlas request starts.
  file("/basis/basis_transcoder.js");
  file("/basis/basis_transcoder.wasm");
  file(ceiling.texture);
  file(leftWall.texture);
  const bakes = manifest.items
    .filter(
      (item) =>
        item.active &&
        item.source === "theatre" &&
        item.item !== "corridor-pathway-lights" &&
        item.item !== "screen",
    )
    .flatMap((item) => {
      const { texture, uv } = item as { texture?: string; uv?: string };
      return texture && uv ? [{ texture, uv }] : [];
    });
  bakes.forEach((bake) => file(bake.uv));
  bakes.forEach((bake) => file(bake.texture));
  file("/textures/shared/blender-view.bin.gz");
  if (SOFAS_ENABLED) sofas.textures.forEach(file);
}
