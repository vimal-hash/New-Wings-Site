import { decodeRope, type DecodedRope } from "./laptop-decode";

const worker = self as unknown as {
  onmessage: ((event: MessageEvent<Uint8Array>) => void) | null;
  postMessage: (message: DecodedRope | { error: string }, transfer?: Transferable[]) => void;
};
worker.onmessage = async ({ data }) => {
  try {
    const rope = await decodeRope(data);
    const transfer = [
      ...Object.values(rope.arrays),
      rope.index,
      rope.coreP,
      rope.coreC,
      rope.coreI,
      rope.grain,
      ...rope.chunks.map((chunk) => chunk.ranks),
      ...rope.samples.map((sample) => sample.points),
    ].map((array) => array.buffer);
    worker.postMessage(rope, transfer);
  } catch (error) {
    worker.postMessage({ error: String(error) });
  }
};
