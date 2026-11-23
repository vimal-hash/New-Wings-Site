import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

type DecodeArgs = Parameters<typeof MeshoptDecoder.decodeGltfBufferAsync>;
const worker = self as unknown as {
  onmessage: (event: MessageEvent<DecodeArgs>) => void;
  postMessage(message: Uint8Array | { error: string }, transfer?: Transferable[]): void;
};

worker.onmessage = async ({ data }) => {
  try {
    const decoded = await MeshoptDecoder.decodeGltfBufferAsync(...data);
    worker.postMessage(decoded, [decoded.buffer as ArrayBuffer]);
  } catch (error) {
    worker.postMessage({ error: String(error) });
  }
};
