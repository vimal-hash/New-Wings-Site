import test from "node:test";
import assert from "node:assert/strict";
import {
  createCinemaControls,
  cleanCinemaValues,
  resolveCinemaValues,
  CINEMA_DEFAULTS,
  CINEMA_PRESETS,
  CINEMA_STORAGE_KEY,
  CINEMA_STORAGE_VERSION,
} from "../components/corridor/cinema-controls.ts";
import { samplePupilPulse, PULSE_RELEASE, PUPIL_PULSE } from "../components/corridor/pupil-pulse-state.ts";
import { GRAIN_REACTION } from "../components/corridor/pupil-grain-reaction.ts";

test("view presets are isolated, baseline is reversible, and reset affects only the chosen stop", () => {
  assert.equal(CINEMA_DEFAULTS.logoPeak, PUPIL_PULSE.flashGain);
  assert.equal(CINEMA_DEFAULTS.particleReaction, GRAIN_REACTION.brightness);
  const controls = createCinemaControls(),
    out = { ...CINEMA_DEFAULTS };
  let events = 0;
  const unsubscribe = controls.subscribe(() => events++);
  controls.set("view1", "contrast", 0.4);
  controls.set("view2", "starBloom", 0.7);
  controls.set("final", "logoPeak", 3.5);
  assert.equal(controls.read().presets.view2.contrast, CINEMA_DEFAULTS.contrast);
  controls.baseline(true);
  resolveCinemaValues(controls.read(), "done", 1, out);
  for (const key of Object.keys(CINEMA_DEFAULTS))
    assert.equal(out[key], key === "bokeh" ? 0 : CINEMA_PRESETS.final[key]);
  controls.baseline(false);
  assert.equal(resolveCinemaValues(controls.read(), "done", 1, out).logoPeak, 3.5);
  controls.reset("view1");
  assert.equal(controls.read().presets.view1.contrast, CINEMA_DEFAULTS.contrast);
  assert.equal(controls.read().presets.view2.starBloom, 0.7);
  unsubscribe();
  assert.equal(events, 6);
});

test("presets persist/export all three views and reject corrupt or unsafe browser values", () => {
  const data = new Map(),
    storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) },
    a = createCinemaControls();
  a.set("final", "logoPeak", 2.25);
  a.set("view1", "dof", true);
  assert.equal(a.save(storage), true);
  const b = createCinemaControls();
  b.load(storage);
  assert.equal(b.read().presets.final.logoPeak, 2.25);
  assert.equal(b.read().presets.view1.dof, true);
  assert.equal(JSON.parse(b.export()).version, CINEMA_STORAGE_VERSION);
  data.set(CINEMA_STORAGE_KEY, "invalid");
  b.load(storage);
  assert.deepEqual(b.read().presets.final, CINEMA_PRESETS.final);
  const clean = cleanCinemaValues({
    contrast: 999,
    starBloom: -2,
    grain: NaN,
    logoPeak: Infinity,
    post: "false",
    dof: true,
    unknown: 42,
  });
  assert.equal(clean.contrast, 0.6);
  assert.equal(clean.starBloom, 0);
  assert.equal(clean.grain, 1);
  assert.equal(clean.logoPeak, 1.8);
  assert.equal(clean.post, true);
  assert.equal(clean.dof, true);
  assert.equal("unknown" in clean, false);
  assert.equal(
    a.save({
      getItem: () => null,
      setItem: () => {
        throw Error("blocked");
      },
    }),
    false,
  );
});

test("approved screenshot settings become defaults and migrate only the requested older draft fields", () => {
  const controls = createCinemaControls(),
    p = controls.read().presets;
  assert.deepEqual(
    [p.view1.dof, p.view1.autofocus, p.view1.focusDistance, p.view1.focusRange, p.view1.bokeh],
    [true, false, 3000, 3000, 4],
  );
  assert.deepEqual(
    [p.view2.dof, p.view2.autofocus, p.view2.focusDistance, p.view2.focusRange, p.view2.bokeh],
    [true, false, 2070, 2800, 12],
  );
  assert.deepEqual(
    [
      p.final.bloom,
      p.final.heroBloom,
      p.final.heroRadius,
      p.final.logoGlow,
      p.final.logoPeak,
      p.final.rayStrength,
      p.final.particleReaction,
    ],
    [true, 0.58, 0.65, 1, 1, 1, 1.5],
  );
  const old = {
    version: 1,
    presets: {
      view1: { ...CINEMA_DEFAULTS, contrast: 0.31, focusDistance: 600 },
      view2: { ...CINEMA_DEFAULTS, starBloom: 0.4 },
      final: { ...CINEMA_DEFAULTS, logoPeak: 4 },
    },
  };
  controls.load({ getItem: () => JSON.stringify(old), setItem: () => {} });
  assert.equal(controls.read().presets.view1.focusDistance, 3000);
  assert.equal(controls.read().presets.view1.contrast, 0.31);
  assert.equal(controls.read().presets.view2.starBloom, 0.4);
  assert.equal(controls.read().presets.final.logoPeak, 1);
  controls.set("view2", "bokeh", 8);
  controls.reset("view2");
  assert.equal(controls.read().presets.view2.bokeh, 12);
});

test("shot interpolation is continuous, deterministic and lands on exact saved stops", () => {
  const controls = createCinemaControls(),
    out = { ...CINEMA_DEFAULTS };
  controls.set("view1", "contrast", 0.1);
  controls.set("view2", "contrast", 0.5);
  controls.set("final", "contrast", 0.3);
  const read = (stage, t) => resolveCinemaValues(controls.read(), stage, t, out).contrast;
  assert.equal(read("slide", 0.985), 0.1);
  assert.equal(read("turn", 0), 0.1);
  assert.ok(Math.abs(read("turn", 0.5) - 0.3) < 1e-12);
  assert.equal(read("turn", 1), 0.5);
  assert.equal(read("turned", 1), 0.5);
  assert.equal(read("pullback", 0), 0.5);
  assert.equal(read("pullback", 1), 0.3);
  assert.equal(read("done", 1), 0.3);
  assert.ok(Math.abs(read("turn", 0.5) - read("turn", 0.500001)) < 0.000001);
});

test("logo peak control changes only the extra flash, not the first circle, ray energy or timing", () => {
  const first = samplePupilPulse(PULSE_RELEASE - 0.01, 0),
    brightFirst = samplePupilPulse(PULSE_RELEASE - 0.01, 6);
  assert.deepEqual(first, brightFirst);
  for (let t = 0; t < 10; t += 0.03) {
    const low = samplePupilPulse(t, 0.5),
      high = samplePupilPulse(t, 4);
    for (const key of ["wave", "travel", "flash", "trace", "moving"]) assert.equal(low[key], high[key]);
    assert.ok(high.border >= low.border);
  }
});

test("optional effects fade continuously between enabled and disabled view presets", () => {
  const controls = createCinemaControls(),
    out = { ...CINEMA_DEFAULTS };
  controls.set("view1", "dof", true);
  controls.set("view2", "post", false);
  resolveCinemaValues(controls.read(), "turn", 0.5, out);
  assert.equal(out.dof, true);
  assert.equal(out.bokeh, 2);
  assert.equal(out.gradeMix, 0.5);
  assert.equal(out.starBloom, 0.12);
  resolveCinemaValues(controls.read(), "turned", 1, out);
  assert.equal(out.post, false);
  assert.equal(out.dof, false);
  assert.equal(out.bokeh, 0);
  assert.equal(out.gradeMix, 0);
});
