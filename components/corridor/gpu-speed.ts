/**
 * How fast this device's graphics chip really draws, measured once per visit while the page loads, so the site picks
 * its richer or lighter picture from the chip's speed, not from its name. The test (gpu-speed.worker.ts) runs off the
 * main thread and draws the two kinds of work the site's own drawing is made of: many thin triangles (the rope's
 * threads, the models) and many pixels (glow, blur and large screens). Each is compared with the same test on the
 * reference PC, where the site's drawing costs below were measured. effect-quality.ts makes the choice.
 */

/** A test result: for each kind of work, [ms since the timed test began, ms per unit of work]. */
export type SpeedSamples = { draws: [number, number][]; passes: [number, number][] };
/** Times slower than the reference PC at each kind of work: 1 is as fast, 2 takes twice as long. */
export type GpuSpeed = { geometry: number; shading: number };
/** A picture's drawing cost on the reference PC: a fixed part, plus a part per million drawn pixels. */
export type DrawingCost = { fixedMs: number; perMpxMs: number };

/** The test's own results on the reference PC (RTX 4070 desktop), ms per unit of work, taken as below. */
export const REFERENCE = { drawMs: 0.0453, passMs: 0.0227 };
/** The richer picture's costliest moment on the reference PC at full clock: the corridor's reveal, and the rope flight
 * between the sections. */
export const RICH_COST: Record<"corridor" | "rope", DrawingCost> = {
  corridor: { fixedMs: 0.34, perMpxMs: 0.73 },
  rope: { fixedMs: 8.29, perMpxMs: 1.57 },
};
/** ms of chip work a frame may take. 65 fps is 15.4 ms a frame: the rest is for the browser's own drawing, and for a
 * test that reads a little slow on a busy machine. */
export const BUDGET_MS = 13;
/** ms into the test after which a chip that started idle runs at full speed (a desktop card takes about half a second
 * to clock up); earlier readings are slow for that reason alone. */
export const SETTLED_MS = 450;
const GIVE_UP_MS = 3000; // ms: a test that has not answered by then counts as unknown, and the page goes on lighter

/** ms per unit at full speed: the readings after the chip settled (or the last three, from a chip too slow to give
 * more), then the lower quarter of them, as the page's own loading can only slow the test down, never speed it up. */
export function settledMs(samples: [number, number][]): number | null {
  if (!samples.length) return null;
  let late = samples.filter(([at]) => at >= SETTLED_MS);
  if (late.length < 3) late = samples.slice(-3);
  const sorted = late.map(([, ms]) => ms).sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 4)];
}

/** The speed from one test, or null when it gave no usable reading. */
export function speedFrom(samples: SpeedSamples): GpuSpeed | null {
  const draw = settledMs(samples.draws),
    pass = settledMs(samples.passes);
  return draw && pass ? { geometry: draw / REFERENCE.drawMs, shading: pass / REFERENCE.passMs } : null;
}

/** Whether a chip of this speed draws the richer picture's costliest moment within the budget, at this many million
 * drawn pixels. An unknown speed never does. */
export function richFits(cost: DrawingCost, megapixels: number, speed: GpuSpeed | null | undefined) {
  return !!speed && cost.fixedMs * speed.geometry + cost.perMpxMs * megapixels * speed.shading <= BUDGET_MS;
}

/** A speed kept on the device, so a later visit need not wait for the test again. */
export type SavedSpeed = {
  version: number;
  chip: string;
  charging: boolean | null;
  at: number;
  speed: GpuSpeed;
};
const SAVED = { key: "nw-graphics-speed", version: 1, days: 7 };

/** A saved speed still fits this visit: same test, same graphics chip, same power (a laptop on battery can run its
 * chip much slower than when plugged in), and not older than a week. */
export function savedFits(saved: SavedSpeed | null, chip: string, charging: boolean | null, now: number) {
  return (
    !!saved &&
    saved.version === SAVED.version &&
    saved.chip === chip &&
    saved.charging === charging &&
    now - saved.at >= 0 &&
    now - saved.at < SAVED.days * 86400000 &&
    [saved.speed?.geometry, saved.speed?.shading].every((n) => typeof n === "number" && n > 0 && n < 1000)
  );
}

/** The worker's answer: the chip's name, and either the test's readings or that the saved speed is this chip's. */
type Reply = ({ chip: string } & (SpeedSamples | { saved: true })) | { error: string };

let measured: GpuSpeed | null | undefined; // undefined until the test has finished; null when it could not run
let reused = false;
let running: Promise<void> | undefined;

/** The measured speed: undefined while the test has not finished, null when it could not run. */
export const gpuSpeed = () => measured;
/** Whether this visit's speed came from an earlier visit's test. */
export const speedReused = () => reused;

/** Runs the test once per visit, or reuses a saved result for the same chip. Resolves when it has finished, failed or
 * been given up. */
export function measureGpuSpeed(): Promise<void> {
  running ??= charging().then(
    (power) =>
      new Promise<void>((resolve) => {
        const saved = readSaved();
        let worker: Worker | undefined,
          hidden = document.hidden;
        // A test in a background tab may read slow: this visit uses it, but it is not kept for later visits.
        const onVisibility = () => {
          if (document.hidden) hidden = true;
        };
        document.addEventListener("visibilitychange", onVisibility);
        const finish = (reply?: Reply) => {
          if (measured !== undefined) return;
          clearTimeout(timer);
          document.removeEventListener("visibilitychange", onVisibility);
          worker?.terminate();
          try {
            if (reply && "saved" in reply && saved && savedFits(saved, reply.chip, power, Date.now())) {
              measured = saved.speed;
              reused = true;
            } else {
              measured = reply && "draws" in reply ? speedFrom(reply) : null;
              if (measured && reply && "chip" in reply && !hidden)
                writeSaved({
                  version: SAVED.version,
                  chip: reply.chip,
                  charging: power,
                  at: Date.now(),
                  speed: measured,
                });
            }
          } catch {
            // An answer that cannot be read counts as no answer; the page must never wait on the test.
          }
          measured ??= null;
          resolve();
        };
        const timer = setTimeout(() => finish(), GIVE_UP_MS);
        try {
          worker = new Worker(new URL("./gpu-speed.worker.ts", import.meta.url), { type: "module" });
          worker.onmessage = (event: MessageEvent<Reply>) => finish(event.data);
          worker.onerror = () => finish();
          // The worker names its chip first; only a saved speed that fits that chip skips the drawing.
          worker.postMessage({
            savedChip: saved && savedFits(saved, saved.chip, power, Date.now()) ? saved.chip : null,
          });
        } catch {
          finish();
        }
      }),
  );
  return running;
}

/** Plugged in or on battery, where the browser tells (Chrome and Edge); null elsewhere, or if it is slow to answer. */
function charging(): Promise<boolean | null> {
  const nav = navigator as Navigator & { getBattery?: () => Promise<{ charging: boolean }> };
  if (!nav.getBattery) return Promise.resolve(null);
  return Promise.race([
    nav.getBattery().then(
      (battery) => battery.charging,
      () => null,
    ),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 200)),
  ]);
}

function readSaved(): SavedSpeed | null {
  try {
    return JSON.parse(localStorage.getItem(SAVED.key) ?? "null") as SavedSpeed | null;
  } catch {
    return null;
  }
}
function writeSaved(saved: SavedSpeed) {
  try {
    localStorage.setItem(SAVED.key, JSON.stringify(saved));
  } catch {
    // Storage may be full or blocked; the next visit simply tests again.
  }
}
