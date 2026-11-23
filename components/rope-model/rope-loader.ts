import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { traceGLTF } from "../corridor/loading-trace";

type DecodeArgs = Parameters<typeof MeshoptDecoder.decodeGltfBufferAsync>;
let worker: Worker | undefined;
let useLocalDecoder = false;
let pending = 0;
let tail = Promise.resolve();
let localSliceStarted = 0;

async function decode(args: DecodeArgs) {
  if (!useLocalDecoder) {
    let reply: Uint8Array | { error: string } | undefined;
    try {
      const decoder = (worker ??= new Worker(new URL("./rope-buffer.worker.ts", import.meta.url), {
        type: "module",
      }));
      reply = await new Promise<Uint8Array | { error: string }>((resolve, reject) => {
        decoder.onmessage = (event) => resolve(event.data);
        decoder.onerror = decoder.onmessageerror = () => reject(new Error("Tunnel decoder worker unavailable"));
        // The source is a view into the whole GLB. Transfer only this view's packed bytes.
        const [count, stride, source, mode, filter] = args;
        const packed = source.slice();
        decoder.postMessage([count, stride, packed, mode, filter], [packed.buffer]);
      });
    } catch {
      worker?.terminate();
      worker = undefined;
      useLocalDecoder = true;
    }
    if (reply) {
      if ("error" in reply) throw new Error(reply.error);
      return reply;
    }
  }
  // A browser that blocks workers can still open the same model. Give scrolling a turn between decode slices.
  if (performance.now() - localSliceStarted > 6) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    localSliceStarted = performance.now();
  }
  return MeshoptDecoder.decodeGltfBufferAsync(...args);
}

const decoder = {
  ...MeshoptDecoder,
  decodeGltfBufferAsync(...args: DecodeArgs) {
    pending++;
    // Only one packed view is copied at a time, leaving the browser free between transfers.
    const next = tail.then(() => decode(args));
    const release = () => {
      if (--pending === 0) {
        worker?.terminate();
        worker = undefined;
      }
    };
    tail = next.then(release, release);
    return next;
  },
};

export function configureRopeLoader(loader: GLTFLoader) {
  loader.setMeshoptDecoder(decoder);
  traceGLTF(loader);
}
