import type { WebGLRenderer } from "three";
import type { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { traceLoader, traceSpan } from "./loading-trace";

const initialized = new WeakSet<KTX2Loader>();

/** Share Fiber's loader and start its decoder download before the first atlas arrives. */
export function configureBakedTextureLoader(loader: KTX2Loader, gl: WebGLRenderer) {
  traceLoader(loader, "KTX2");
  loader.setTranscoderPath("/basis/").setWorkerLimit(2).detectSupport(gl);
  if (!initialized.has(loader)) {
    initialized.add(loader);
    const finish = traceSpan("Basis transcoder initialization", "decoder initialization");
    // Observe failure here to avoid an unhandled prefetch rejection. The loader's
    // original promise stays rejected and its normal asset load reports the error.
    void loader.init().then(() => finish(), error => finish({ error: String(error) }));
  }
  return loader;
}
