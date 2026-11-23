export const FILM_RATE = 24; // the grain, the flicker and the scratch lines change at the speed film ran through a projector
const noise = (n: number) => {
  const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
};
/** Exposure of film frame n: a small random wobble each frame over a slower drift, never more than a few percent. */
export const flickerAt = (n: number) =>
  1 + 0.048 * (noise(n) - 0.5) + 0.018 * Math.sin(n * 0.083) + 0.012 * Math.sin(n * 0.31 + 1.7);
/** Gate weave: film never sits exactly still in a projector gate. Each frame lands a pixel or so off, over a slow drift. In frame units. */
export const weaveAt = (n: number) => [
  0.0016 * (noise(n * 1.73 + 0.4) - 0.5) + 0.0012 * Math.sin(n * 0.11 + 0.8),
  0.0045 * (noise(n * 2.31 + 9.1) - 0.5) + 0.0035 * Math.sin(n * 0.17 + 2.3),
];
