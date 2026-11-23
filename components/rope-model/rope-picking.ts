/** Search front to back. Samples in a one-unit depth slice keep their original order for equal-depth hits. */
export function indexRopeSamples(samples: Float32Array) {
  type Slice = { z: number; left: number; right: number; bottom: number; top: number; offsets: number[] };
  const byDepth = new Map<number, Slice>();
  for (let i = 0; i < samples.length; i += 3) {
    const x = samples[i], y = samples[i + 1];
    const z = Math.floor(samples[i + 2]);
    let slice = byDepth.get(z);
    if (!slice) {
      slice = { z, left: x, right: x, bottom: y, top: y, offsets: [] };
      byDepth.set(z, slice);
    }
    slice.left = Math.min(slice.left, x);
    slice.right = Math.max(slice.right, x);
    slice.bottom = Math.min(slice.bottom, y);
    slice.top = Math.max(slice.top, y);
    slice.offsets.push(i);
  }
  const slices = Array.from(byDepth.values()).sort((a, b) => b.z - a.z);

  return function nearest(
    cameraZ: number, dx: number, dy: number, minimumDepth: number, worldReach: number, pixelReach: number,
  ) {
    for (const slice of slices) {
      const far = cameraZ - slice.z;
      if (far < minimumDepth) continue;
      const near = Math.max(minimumDepth, far - 1);
      const margin = Math.max(worldReach, pixelReach * far);
      // Discard only slices entirely outside the picking ray, including its widest tolerance here.
      if (
        Math.min(dx * near, dx * far) - margin > slice.right ||
        Math.max(dx * near, dx * far) + margin < slice.left ||
        Math.min(dy * near, dy * far) - margin > slice.top ||
        Math.max(dy * near, dy * far) + margin < slice.bottom
      ) continue;

      let best = -1, closest = Infinity;
      for (const i of slice.offsets) {
        const depth = cameraZ - samples[i + 2];
        if (depth < minimumDepth || depth >= closest) continue;
        const x = samples[i] - dx * depth, y = samples[i + 1] - dy * depth;
        const reach = Math.max(worldReach, pixelReach * depth);
        if (x * x + y * y <= reach * reach) {
          best = i;
          closest = depth;
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  };
}
