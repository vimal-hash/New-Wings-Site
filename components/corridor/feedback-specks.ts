// Section 4's specks: a little dust in the air of the room, seen through today's lens. Kept simple on purpose: the user
// found the earlier dust (hundreds of lit spheres and orbs inside an invisible beam) AI-looking, and then the big soft
// discs near the lens too (removed 2026-11-15).
//
// - About thirty-five tiny specks, all behind the cards, at two distances: some at the cards' own distance (tiny and
//   sharp) and the rest further back (small, a little soft and dimmer).
// - Each keeps its brightness: no twinkle, no glow, no flashing. A warm white, like dust in a projector's light.
// - The air carries them slowly, all a little the same way, each with its own small wander; nearer ones move faster.
// - Parallax: when the cards move, each speck moves with the camera by its distance (those at the cards' distance move
//   exactly with them, further ones less), and the cards hide the specks behind them.
//
// One canvas, under the cards. One sprite per speck.

type SpeckView = { shift: number; strength: number };
export type Specks = {
  resize(width: number, height: number): void;
  draw(dt: number, view: SpeckView): void;
  clear(): void;
  warm(): void;
};

type Band = { count: number; depth: [number, number]; radius: [number, number]; alpha: [number, number] };
// Distances are in units of the cards' distance (1). Radii are CSS pixels at a 1440-pixel-wide view, nearest first.
const BANDS: Band[] = [
  { count: 14, depth: [0.94, 1.06], radius: [1.5, 1], alpha: [0.7, 0.5] }, // at the cards: in focus
  { count: 22, depth: [1.7, 3.2], radius: [2.6, 1.4], alpha: [0.3, 0.16] }, // behind them: a little soft, dimmer
];
// The air, in CSS pixels per second at the cards' distance: a slow common drift, and each speck's own wander.
const DRIFT = [3.2, -2.2],
  WANDER = 7;
const COLOUR = [255, 242, 224];
const SIZES = [4, 8, 16];
const TAU = Math.PI * 2;
const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** One round speck, evenly filled with a soft edge, drawn at a few sizes so each is drawn from a copy near its own. */
function sprites() {
  const images = SIZES.map((size) => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d")!,
      img = g.createImageData(size, size),
      n = 4;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        let sum = 0;
        for (let sy = 0; sy < n; sy++)
          for (let sx = 0; sx < n; sx++) {
            const px = ((x + (sx + 0.5) / n) / size) * 2 - 1,
              py = ((y + (sy + 0.5) / n) / size) * 2 - 1;
            sum += 1 - smooth(0.62, 1, Math.hypot(px, py));
          }
        const i = (y * size + x) * 4;
        img.data[i] = COLOUR[0];
        img.data[i + 1] = COLOUR[1];
        img.data[i + 2] = COLOUR[2];
        img.data[i + 3] = Math.round((sum / (n * n)) * 255);
      }
    g.putImageData(img, 0, 0);
    return c;
  });
  return (devicePixels: number) => {
    for (let k = 0; k < SIZES.length; k++) if (SIZES[k] >= devicePixels) return images[k];
    return images[images.length - 1];
  };
}

export function createSpecks(canvas: HTMLCanvasElement, share: number, maxDpr: number): Specks {
  const pick = sprites(),
    ctx = canvas.getContext("2d")!;
  type Speck = {
    u: number;
    v: number;
    d: number;
    r: number;
    a: number;
    phase: number;
    speed: number;
    dx: number;
    dy: number;
  };
  const specks: Speck[] = [];
  for (const band of BANDS) {
    const n = Math.max(1, Math.round(band.count * share));
    for (let k = 0; k < n; k++) {
      const t = Math.random(),
        d = band.depth[0] + (band.depth[1] - band.depth[0]) * t;
      specks.push({
        u: Math.random(),
        v: Math.random(),
        d,
        r: band.radius[0] + (band.radius[1] - band.radius[0]) * t,
        a: band.alpha[0] + (band.alpha[1] - band.alpha[0]) * t,
        phase: Math.random() * TAU,
        speed: 0.06 + Math.random() * 0.06,
        dx: 0,
        dy: 0,
      });
    }
  }
  let width = 1,
    height = 1,
    dpr = 1,
    scale = 1,
    time = 0,
    blank = true;
  return {
    resize(w, h) {
      width = Math.max(1, w);
      height = Math.max(1, h);
      dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
      scale = Math.min(width, height * 1.6) / 1440;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      blank = true;
    },
    // Draws the sprites once, far too faint to see, so the browser has them ready before the specks first appear.
    warm() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 0.002;
      for (const size of SIZES) ctx.drawImage(pick(size), 0, 0, 2, 2);
      ctx.globalAlpha = 1;
      blank = false;
    },
    clear() {
      if (blank) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      blank = true;
    },
    draw(dt, { shift, strength }) {
      time += dt;
      for (const s of specks) {
        const near = 1 / s.d;
        s.dx += (DRIFT[0] + WANDER * Math.sin(time * s.speed + s.phase)) * near * dt;
        s.dy += (DRIFT[1] + WANDER * Math.cos(time * s.speed * 0.8 + s.phase * 1.7)) * near * dt;
      }
      if (strength <= 0.001) {
        this.clear();
        return;
      }
      blank = false;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      for (const s of specks) {
        const r = Math.max(s.r * scale, 0.6 / dpr),
          margin = r + 2,
          spanX = width + 2 * margin,
          spanY = height + 2 * margin;
        // Wrapped round the view, so a speck that drifts or is carried off one side comes back in on the other.
        const x = ((((s.u * spanX + s.dx * scale - shift / s.d) % spanX) + spanX) % spanX) - margin;
        const y = ((((s.v * spanY + s.dy * scale) % spanY) + spanY) % spanY) - margin;
        ctx.globalAlpha = Math.min(1, s.a * strength);
        ctx.drawImage(pick(r * 2 * dpr), x - r, y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    },
  };
}
