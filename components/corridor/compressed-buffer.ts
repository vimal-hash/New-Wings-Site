import { use } from "react";
import { assetURL } from "./asset-url";

const requests = new Map<string, Promise<ArrayBuffer>>();
const downloads = new Map<string, Promise<Response>>();

/** Keep the original response until the canvas needs to decompress it. */
export function preloadCompressedBuffer(url: string) {
  if (downloads.has(url) || requests.has(url)) return;
  const transfer = fetch(assetURL(url));
  downloads.set(url, transfer);
  void transfer.catch(() => {
    if (downloads.get(url) === transfer) downloads.delete(url);
  });
}

export function loadCompressedBuffer(url: string) {
  let promise = requests.get(url);
  if (!promise) {
    promise = (async () => {
      const transfer = downloads.get(url) ?? fetch(assetURL(url));
      downloads.delete(url);
      const response = await transfer;
      if (!response.ok || !response.body) throw new Error(`Asset failed: ${url}`);
      if (typeof DecompressionStream !== "undefined")
        return new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
      const { gunzipSync } = await import("three/examples/jsm/libs/fflate.module.js");
      const decoded = gunzipSync(new Uint8Array(await response.arrayBuffer()));
      const result = new Uint8Array(decoded.length);
      result.set(decoded);
      return result.buffer;
    })();
    requests.set(url, promise);
    void promise.catch(() => {
      // A later preload or remount can retry a failed transfer. Successful callers still share one decode.
      if (requests.get(url) === promise) requests.delete(url);
    });
  }
  return promise;
}
export function useCompressedBuffer(url: string) {
  return use(loadCompressedBuffer(url));
}
