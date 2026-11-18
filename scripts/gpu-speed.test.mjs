import test from "node:test";
import assert from "node:assert/strict";
import {
  BUDGET_MS,
  REFERENCE,
  RICH_COST,
  richFits,
  savedFits,
  settledMs,
  speedFrom,
} from "../components/corridor/gpu-speed.ts";
import { targetDpr } from "../components/corridor/render-resolution.ts";

/** Readings every `every` ms for `until` ms: `slow` times the full-speed `ms` at first, falling to 1 by `settledAt`, as a
 * graphics chip that starts idle clocks up. `spikes` adds a page hitch to every few readings. */
function readings(ms, { until = 800, every = 10, slow = 9, settledAt = 420, spikes = 0 } = {}) {
  const out = [];
  for (let at = 0, n = 0; at < until; at += every, n++) {
    const ramp = at >= settledAt ? 1 : slow - ((slow - 1) * at) / settledAt;
    out.push([at, ms * ramp * (spikes && n % spikes === 0 ? 1.6 : 1)]);
  }
  return out;
}
const corridorMpx = (width, height, ratio) => {
  const dpr = targetDpr("desktop", width, height, ratio);
  return (width * dpr * height * dpr) / 1e6;
};
const ropeMpx = (width, height, ratio) => {
  const dpr = Math.min(1.5, Math.max(1, ratio));
  return (width * dpr * height * dpr) / 1e6;
};

test("full speed comes from the readings after the chip has clocked up", () => {
  assert.equal(settledMs(readings(REFERENCE.drawMs)), REFERENCE.drawMs);
});

test("page hitches during the test do not make the chip look slower", () => {
  assert.equal(settledMs(readings(REFERENCE.passMs, { spikes: 3 })), REFERENCE.passMs);
});

test("a chip too slow for many readings is judged on its last three", () => {
  const slow = [
    [0, 3],
    [200, 2],
    [420, 1.5],
    [700, 1.4],
  ];
  assert.equal(settledMs(slow), 1.4);
  assert.equal(settledMs([]), null);
});

test("speed is times slower than the reference PC, and unknown without readings", () => {
  const same = speedFrom({ draws: readings(REFERENCE.drawMs), passes: readings(REFERENCE.passMs) });
  assert.deepEqual(same, { geometry: 1, shading: 1 });
  const half = speedFrom({ draws: readings(REFERENCE.drawMs * 2), passes: readings(REFERENCE.passMs * 3) });
  assert.ok(Math.abs(half.geometry - 2) < 1e-9 && Math.abs(half.shading - 3) < 1e-9);
  assert.equal(speedFrom({ draws: readings(REFERENCE.drawMs), passes: [] }), null);
});

test("the reference PC keeps both rich pictures in its own browser window", () => {
  const reference = { geometry: 1, shading: 1 };
  for (const [width, height] of [
    [1920, 947],
    [1920, 1080],
  ]) {
    assert.ok(richFits(RICH_COST.corridor, corridorMpx(width, height, 1), reference));
    assert.ok(richFits(RICH_COST.rope, ropeMpx(width, height, 1), reference));
  }
  // A test reading up to 15% slow on the same PC still keeps it there.
  assert.ok(richFits(RICH_COST.rope, ropeMpx(1920, 947, 1), { geometry: 1.15, shading: 1.15 }));
});

test("the rope flight goes light where it would not hold the budget", () => {
  // A 1440p screen on the reference PC: the corridor stays rich, the flight would take ~13.5 ms.
  assert.ok(richFits(RICH_COST.corridor, corridorMpx(2560, 1305, 1), { geometry: 1, shading: 1 }));
  assert.ok(!richFits(RICH_COST.rope, ropeMpx(2560, 1305, 1), { geometry: 1, shading: 1 }));
  // A card about 1.7 times slower at a 1080p window: rich corridor, light flight.
  const midCard = { geometry: 1.7, shading: 1.7 };
  assert.ok(richFits(RICH_COST.corridor, corridorMpx(1920, 947, 1), midCard));
  assert.ok(!richFits(RICH_COST.rope, ropeMpx(1920, 947, 1), midCard));
});

test("a saved speed is reused only for the same chip, power and test, within a week", () => {
  const now = Date.UTC(2026, 10, 17),
    day = 86400000;
  const saved = {
    version: 1,
    chip: "Chip A",
    charging: true,
    at: now - day,
    speed: { geometry: 1, shading: 1 },
  };
  assert.ok(savedFits(saved, "Chip A", true, now));
  assert.ok(!savedFits(saved, "Chip B", true, now), "another chip");
  assert.ok(!savedFits(saved, "Chip A", false, now), "now on battery");
  assert.ok(!savedFits({ ...saved, at: now - 8 * day }, "Chip A", true, now), "older than a week");
  assert.ok(!savedFits({ ...saved, at: now + day }, "Chip A", true, now), "saved in the future");
  assert.ok(!savedFits({ ...saved, version: 0 }, "Chip A", true, now), "an older test");
  assert.ok(!savedFits({ ...saved, speed: { geometry: NaN, shading: 1 } }, "Chip A", true, now), "broken");
  assert.ok(!savedFits({ ...saved, speed: undefined }, "Chip A", true, now), "no speed");
  assert.ok(!savedFits(null, "Chip A", true, now));
});

test("slow and unknown chips get the lighter picture", () => {
  const officeLaptop = { geometry: 20, shading: 20 };
  assert.ok(!richFits(RICH_COST.corridor, corridorMpx(1366, 651, 1), officeLaptop));
  assert.ok(!richFits(RICH_COST.corridor, corridorMpx(1920, 947, 1), null));
  assert.ok(!richFits(RICH_COST.rope, ropeMpx(1920, 947, 1), undefined));
  assert.ok(BUDGET_MS < 1000 / 65, "the budget leaves room inside a 65 fps frame");
});
