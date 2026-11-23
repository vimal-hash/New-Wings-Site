import { useLoader } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { TextureLoader, type WebGLRenderer } from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { loadCompressedBuffer } from "./compressed-buffer";
import { preloadBakedSurfaces } from "./baked-surfaces";
import { configureBakedTextureLoader } from "./baked-texture-loader";
import { traceGLTF, traceMark } from "./loading-trace";
import ceiling from "./theatre-ceiling-assets.json";
import leftWall from "./theatre-left-wall-assets.json";
import sofas from "./sofa-assets.json";
import { THEATRE_MODELS, THEATRE_SCREEN_ARTWORK } from "./opening-files";
import { CINEMA_GLASSES } from "./cinema-glasses-state";
import { isMobileDevice } from "./texture-quality";

export { THEATRE_MODELS };
const started = new WeakMap<WebGLRenderer, { sofas: boolean }>();

/** Match each consumer's exact loader/URL batch so Suspense reuses the work.
 * Only opening assets belong here; the corridor still starts after first frame.
 * The file loaders reuse the opening transfers already started by opening-files.ts. */
export function preloadOpeningAssets(gl: WebGLRenderer, includeSofas: boolean, connectedTheatre: boolean) {
  let state = started.get(gl);
  if (!state) {
    state = { sofas: false };
    started.set(gl, state);
    traceMark("Opening asset preloads started");
    // The independent screen paints first; don't put its image behind room atlases.
    useLoader.preload(TextureLoader, [THEATRE_SCREEN_ARTWORK]);
    // The mounted glasses (the older front-only file was still preloaded here: 260 KB nobody used).
    useGLTF.preload(CINEMA_GLASSES, "/draco/", false, traceGLTF);
    // Queue critical models and motion before the much larger atlas batch.
    useGLTF.preload(THEATRE_MODELS, "/draco/", false, traceGLTF);
    useGLTF.preload(ceiling.model, "/draco/", false, traceGLTF);
    if (includeSofas) {
      state.sofas = true;
      useGLTF.preload(sofas.model, "/draco/", false, traceGLTF);
    }
    useLoader.preload(KTX2Loader, ceiling.texture, (loader) => configureBakedTextureLoader(loader, gl));
    useLoader.preload(KTX2Loader, leftWall.texture, (loader) => configureBakedTextureLoader(loader, gl));
    preloadBakedSurfaces("theatre", gl, connectedTheatre);
    if (isMobileDevice()) preloadBakedSurfaces("projector-floor", gl);
    void loadCompressedBuffer("/textures/shared/blender-view.bin.gz").catch(() => {});
    if (includeSofas)
      useLoader.preload(KTX2Loader, sofas.textures, (loader) => configureBakedTextureLoader(loader, gl));
  }
  if (includeSofas && !state.sofas) {
    state.sofas = true;
    useGLTF.preload(sofas.model, "/draco/", false, traceGLTF);
    useLoader.preload(KTX2Loader, sofas.textures, (loader) => configureBakedTextureLoader(loader, gl));
  }
}
