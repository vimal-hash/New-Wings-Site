import { preload } from "react-dom";
import { Cache, FileLoader } from "three";
import { assetURL } from "./asset-url";
import { preloadCompressedBuffer } from "./compressed-buffer";
import { traceMark } from "./loading-trace";
import manifest from "./baked-surfaces.json";
import ceiling from "./theatre-ceiling-assets.json";
import leftWall from "./theatre-left-wall-assets.json";
import sofas from "./sofa-assets.json";
import { CINEMA_GLASSES } from "./cinema-glasses-state";
import { SOFAS_ENABLED } from "./scene-features";

export const THEATRE_MODELS = ["/models/theatre-marked.glb", "/models/projector-floor-marked.glb"];
// Lossless WebP of the supplied PNG: identical pixels (0 differ), 1.28 MB -> 0.59 MB on the first-paint path.
export const THEATRE_SCREEN_ARTWORK = "/images/theatre-screen-ghosted.webp";

let started = false;
let releaseFiles: (() => void) | undefined;

export function releaseOpeningDownloads() {
  releaseFiles?.();
  releaseFiles = undefined;
}

/** Start the real loaders' transfers while the graphics test runs. Decoding still starts at the canvas. */
export function startOpeningDownloads() {
  if (started) return;
  started = true;
  traceMark("Opening downloads started early");
  // FileLoader shares in-flight requests. Keep completed responses just until the opening is ready as well.
  // WebKit can download a fetch preload and the real loader's request separately, even with identical headers.
  if (!Cache.enabled) {
    const previousFiles = Cache.files;
    Cache.files = {};
    Cache.enabled = true;
    releaseFiles = () => {
      Cache.enabled = false;
      Cache.files = previousFiles;
      window.removeEventListener("pagehide", releaseOpeningDownloads);
    };
    window.addEventListener("pagehide", releaseOpeningDownloads, { once: true });
  }
  const binary = new FileLoader().setResponseType("arraybuffer");
  const script = new FileLoader().setResponseType("text");
  // A failed early transfer is retried by the normal loader. Use the response type it will read.
  const file = (url: string) => {
    const loader = url.endsWith(".js") ? script : binary;
    loader.load(assetURL(url), undefined, undefined, () => {});
  };
  file("/draco/draco_wasm_wrapper.js");
  file("/draco/draco_decoder.wasm");
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
  preloadCompressedBuffer("/textures/shared/blender-view.bin.gz");
  if (SOFAS_ENABLED) sofas.textures.forEach(file);
}
