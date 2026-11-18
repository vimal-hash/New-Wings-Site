/** Extend the approved ends to the viewport; retain authored vertical clearance. */
export function eyeDimensions(diameter: number, finalDistance: number, aspect: number, fov: number) {
  const halfHeight = finalDistance * Math.tan((fov * Math.PI) / 360),
    base = diameter / 3.5;
  // Revision 16's front-projected end noses reach about ±10.9 authoring units.
  // A tiny overscan lets the grain silhouettes touch both sides without a gap.
  // Horizontal expansion is allowed on wide screens; never scale the lids in Y.
  const fit = (halfHeight * aspect) / (10.88 * base);
  return { scale: base, scaleX: base * fit, front: 0, fit, sourceDiameter: 3.5 };
}
type EyePointData = {
  count: number;
  min: number[];
  extent: number[];
  radiusMax: number;
  positions: Uint16Array;
  grains: Uint8Array;
  loadDecodeMs: number;
};
/** Separate worker; transfer compact arrays without a frame-by-frame CPU loop. */
export function loadEyePoints(workerURL: string, url: string, signal: AbortSignal): Promise<EyePointData> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerURL);
    const abort = () => {
      worker.terminate();
      reject(new DOMException("Eye load cancelled", "AbortError"));
    };
    const finish = () => {
      signal.removeEventListener("abort", abort);
      worker.terminate();
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event) => {
      finish();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data as EyePointData);
    };
    worker.onerror = (event) => {
      finish();
      reject(new Error(event.message || "Eye decoder failed"));
    };
    worker.postMessage({ url });
  });
}
