import { use } from "react";
import { assetURL } from "./asset-url";

const requests = new Map<string, Promise<ArrayBuffer>>();
export function loadCompressedBuffer(url: string) {
  let promise = requests.get(url);
  if (!promise) {
    promise = (async () => {
      const response = await fetch(assetURL(url));
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
  }
  return promise;
}
export function useCompressedBuffer(url: string) {
  return use(loadCompressedBuffer(url));
}
