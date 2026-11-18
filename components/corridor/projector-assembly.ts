/** Assembly clock per part, read from the original 65 Blender poses (frame 0 exploded, frame 64 assembled).
 *  Blender already builds in order: light path, lasers and cooling, lens, then the outer shell and covers. There every
 *  part moves in about three poses and all motion ends by pose 38, so on a fixed 2 s clock the parts snapped into place
 *  and the covers were still closing when the camera left. Here each part keeps its exact Blender path and its place in
 *  that order, but gets its own delay and a longer travel time, eased so it settles into place. */
const ASSEMBLY = {
  /** Seconds before the first part moves. */
  lead: 0.1,
  /** Seconds across which the Blender start order is spread. */
  spread: 2.4,
  /** Shortest travel time of one part, in seconds. */
  travel: 0.5,
  /** Extra travel for parts that moved over more poses in Blender (share of the spread). */
  stretch: 0.6,
  /** Small per-part offset so a group of parts does not land on the same frame. */
  jitter: 0.08,
} as const;

const SAME = 1e-6;

/** vec4 per part: first moving pose, last moving pose, delay (s), travel (s). Static parts hold pose 64. */
export function assemblyClips(poses: Float32Array, parts = 514, frames = 65, width = 1542) {
  const at = (frame: number, part: number, k: number) => poses[(frame * width + part * 3) * 4 + k];
  const same = (part: number, a: number, b: number) => {
    for (let k = 0; k < 12; k++)
      if (k !== 3 && Math.abs(at(a, part, k) - at(b, part, k)) > SAME) return false;
    return true;
  };
  const span: [number, number][] = [];
  let lastMoving = 1;
  for (let i = 0; i < parts; i++) {
    let start = 0,
      end = frames - 1;
    while (start < frames - 1 && same(i, start + 1, 0)) start++;
    while (end > 0 && same(i, end - 1, frames - 1)) end--;
    if (end <= start) {
      span.push([frames - 1, frames - 1]);
      continue;
    }
    span.push([start, end]);
    lastMoving = Math.max(lastMoving, end);
  }
  const out = new Float32Array(parts * 4);
  span.forEach(([start, end], i) => {
    const hash = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    const delay =
      start === end ? 0 : ASSEMBLY.lead + (start / lastMoving) * ASSEMBLY.spread + hash * ASSEMBLY.jitter;
    const travel =
      start === end ? 1 : ASSEMBLY.travel + ((end - start) / lastMoving) * ASSEMBLY.spread * ASSEMBLY.stretch;
    out.set([start, end, delay, travel], i * 4);
  });
  return out;
}

/** Particle formation pacing, 0..1 of its 95 Blender frames for 0..1 of its 4 s. In Blender's linear timeline the
 *  first 20 frames (0.8 s) show no grains and the last 12 (0.5 s) only the glow fading. Here those 20 frames take
 *  0.32 s, slowing smoothly into the flight; the flight itself (frames 20-84) keeps its original speed; the last
 *  12 frames ease to rest over 1 s. Speed is continuous at both joins. */
const PARTICLE_PACE = { quiet: 0.08, flight: 0.75 } as const;
export function particlePace(t: number) {
  const { quiet: a, flight: b } = PARTICLE_PACE,
    v = 64 / (b - a); // flight speed, frames per unit time
  const x = Math.min(1, Math.max(0, t));
  if (x <= a) {
    const v0 = 38 / a - v;
    return (v0 * x + ((v - v0) / (2 * a)) * x * x) / 95;
  }
  if (x <= b) return (19 + (x - a) * v) / 95;
  const u = (x - b) / (1 - b);
  return (83 + 12 * (1 - (1 - u) * (1 - u))) / 95;
}

/** Seconds until the last part has settled. */
export const assemblyEnd = (clips: Float32Array) => {
  let end = 0;
  for (let i = 0; i < clips.length; i += 4)
    if (clips[i] !== clips[i + 1]) end = Math.max(end, clips[i + 2] + clips[i + 3]);
  return end;
};
