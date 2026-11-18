import test from "node:test";
import assert from "node:assert/strict";
import {
  createPupilPulseClock,
  samplePupilPulse,
  samplePupilLoop,
  samplePupilFronts,
  samplePupilPreTrace,
  pupilLeaveFade,
  fadePupilState,
  pupilWaveAt,
  PULSE_RELEASE,
  PULSE_END,
  PULSE_CYCLE,
  PUPIL_PULSE,
  PUPIL_WAVE_SLOTS,
} from "../components/corridor/pupil-pulse-state.ts";

test("circle starts immediately, traces completely, then its finite envelope flashes and settles", () => {
  assert.equal(PUPIL_PULSE.pause, 0);
  assert.equal(samplePupilPulse(0).border, 1.25);
  assert.equal(samplePupilPulse(0.4).wave, 0);
  assert.ok(samplePupilPulse(0.01).trace > 0);
  assert.ok(samplePupilPulse(PULSE_RELEASE - 0.01).trace > 0.999);
  assert.equal(samplePupilPulse(PULSE_RELEASE - 0.01).wave, 0);
  assert.equal(samplePupilPulse(PULSE_RELEASE).trace, 1);
  assert.equal(samplePupilPulse(PULSE_RELEASE).wave, 1, "first front launches on the exact completion time");
  const peak = samplePupilPulse(PULSE_RELEASE + 0.2).flash;
  assert.ok(peak > 0.8);
  assert.ok(samplePupilPulse(PULSE_RELEASE + 0.7).flash > peak * 0.4, "slow settle after the fast rise");
  assert.equal(samplePupilPulse(PULSE_END).wave, 0);
  assert.equal(samplePupilPulse(PULSE_END).moving, false);
  for (let t = 0; t < PULSE_END; t += 0.01) {
    const s = samplePupilPulse(t);
    for (const n of [s.wave, s.flash, s.trace, s.travel, s.border]) assert.ok(Number.isFinite(n) && n >= 0);
  }
});

test("natural pullback begins the circle one second before settle and continues into an immediate launch", () => {
  const start = (4.5 - 1) / 4.5;
  assert.equal(samplePupilPreTrace("pullback", start - 0.0001), null);
  const first = samplePupilPreTrace("pullback", start);
  assert.equal(first.trace, 0);
  assert.equal(first.border, 1.25);
  assert.ok(samplePupilPreTrace("pullback", start + 0.02).trace > 0);
  const atSettle = samplePupilPreTrace("pullback", 1);
  assert.ok(atSettle.trace > 0 && atSettle.trace < 1);
  for (let p = start; p <= 1; p += 0.001) {
    const s = samplePupilPreTrace("pullback", p);
    assert.equal(s.wave, 0);
    assert.equal(s.flash, 0);
    assert.deepEqual(s.fronts, []);
    assert.equal(s.moving, false);
  }
  for (const stage of ["slide", "turned", "turn", "done"]) assert.equal(samplePupilPreTrace(stage, 1), null);
  assert.equal(PUPIL_PULSE.traceLead, 1);
  assert.equal(PUPIL_PULSE.hold, 0);
  assert.equal(PULSE_RELEASE, PUPIL_PULSE.trace);
  const clock = createPupilPulseClock();
  let now = 100000;
  const continuing = clock.tick(true, now, false, false, 1, PUPIL_PULSE.traceLead);
  assert.equal(continuing.trace, atSettle.trace, "camera settle cannot reset or finish the trace early");
  assert.equal(continuing.wave, 0);
  let emitted = false;
  for (let step = 1; step <= 80; step++) {
    now += 10;
    const s = clock.tick(true, now, false, false, 1, PUPIL_PULSE.traceLead);
    if (s.trace === 1) {
      assert.equal(s.wave, 1, "completed trace must never wait without a released front");
      if (!emitted) {
        assert.ok(Math.abs(step * 0.01 - (PUPIL_PULSE.trace - PUPIL_PULSE.traceLead)) < 0.011);
        emitted = true;
      }
    }
  }
  assert.ok(emitted, "first release occurs .65 seconds after final settle");
  clock.restart();
  assert.equal(clock.tick(true, now + 1000).trace, 0, "manual replay starts the full trace");
});

test("a step back from the final eye fades its light out over the first second of the reversed pullback", () => {
  assert.equal(pupilLeaveFade(1), 1);
  assert.equal(pupilLeaveFade(1 - PUPIL_PULSE.traceLead / 4.5), 0, "gone where the early trace would begin");
  assert.equal(pupilLeaveFade(0.2), 0);
  let last = 1;
  for (let p = 1; p >= 0.7; p -= 0.01) {
    const fade = pupilLeaveFade(p);
    assert.ok(fade <= last + 1e-12, "only fading on the way back");
    last = fade;
  }
  const lit = samplePupilLoop(PULSE_RELEASE + 2.3),
    half = fadePupilState(lit, 0.5);
  assert.ok(lit.fronts.length > 1 && lit.wave > 0);
  assert.equal(half.border, lit.border * 0.5);
  assert.equal(half.wave, lit.wave * 0.5);
  half.fronts.forEach((front, i) => {
    assert.equal(front.strength, lit.fronts[i].strength * 0.5);
    assert.equal(front.travel, lit.fronts[i].travel, "the rays keep travelling while they fade");
  });
  assert.equal(half.trace, lit.trace);
});

test("emissions repeat every two seconds while older fronts keep their complete travel and tail", () => {
  const first = samplePupilLoop(PULSE_RELEASE + 0.3, 1),
    second = samplePupilLoop(PULSE_RELEASE + 2 + 0.3, 1);
  for (const key of ["flash", "wave", "travel", "border"])
    assert.ok(Math.abs(first[key] - second[key]) < 1e-10, key);
  assert.equal(PULSE_CYCLE, 2);
  assert.ok(PUPIL_WAVE_SLOTS >= Math.ceil((PUPIL_PULSE.travel + PUPIL_PULSE.tail) / PULSE_CYCLE));
  for (let cycle = 0; cycle < 20; cycle++) {
    const release = PULSE_RELEASE + cycle * PULSE_CYCLE,
      next = samplePupilLoop(release + 0.2, 1);
    assert.equal(next.cycle, cycle);
    assert.equal(next.trace, 1);
    assert.equal(next.moving, true);
    assert.ok(next.flash > 0.8 && next.wave > 0.99);
    const before = samplePupilLoop(release - 0.00001, 1),
      after = samplePupilLoop(release + 0.00001, 1);
    assert.ok(
      Math.abs(before.border - after.border) < 0.002,
      "new launch has no hard border brightness reset",
    );
    if (cycle) {
      assert.equal(after.fronts[1].strength, 1);
      assert.ok(
        Math.abs(after.fronts[1].age - 2) < 0.0001,
        "previous front stays alive when a new front is emitted",
      );
    }
  }
  const three = samplePupilFronts(PULSE_RELEASE + 4.5);
  assert.equal(three.length, 3);
  assert.deepEqual(
    three.map((f) => f.age),
    [0.5, 2.5, 4.5],
  );
  assert.ok(three.every((f) => f.strength === 1));
  assert.ok(samplePupilFronts(PULSE_RELEASE + 5.5)[2].strength > 0);
  assert.equal(samplePupilFronts(PULSE_RELEASE + 5.9)[2].strength, 0, "oldest tail finishes naturally");
});

test("continuous loop clock excludes hidden time, caps stalls and resets all fronts for reduced motion/exit", () => {
  const clock = createPupilPulseClock();
  let now = 100000;
  clock.tick(true, now);
  let state;
  for (let i = 0; i < 166; i++) {
    now += 50;
    state = clock.tick(true, now);
  }
  assert.equal(state.moving, true);
  assert.equal(state.fronts.length, 3);
  const age = state.fronts[0].age;
  state = clock.tick(true, now + 30000);
  assert.ok(
    Math.abs(state.fronts[0].age - age - 0.05) < 1e-8,
    "a foreground stall cannot skip the light travel",
  );
  const before = state;
  clock.pause();
  state = clock.tick(true, now + 50000, true);
  assert.equal(state.wave, 0);
  assert.deepEqual(state.fronts, []);
  state = clock.tick(true, now + 90000);
  assert.deepEqual(state, before, "hidden time does not advance any front");
  const reduced = clock.tick(true, now + 90010, false, true);
  assert.equal(reduced.moving, false);
  assert.equal(reduced.wave, 0);
  assert.deepEqual(reduced.fronts, []);
  assert.equal(clock.tick(false, now + 100000), null);
  assert.equal(clock.tick(true, now + 200000).trace, 0);
});

test("pulse clock excludes previous idle time, resets on review, pauses when hidden and honours reduced motion", () => {
  const clock = createPupilPulseClock();
  assert.equal(clock.tick(false, 200000), null);
  assert.equal(clock.tick(true, 400000).trace, 0);
  for (let n = 1; n <= 100; n++) clock.tick(true, 400000 + n * 10);
  const before = clock.tick(true, 401000);
  clock.pause();
  const resumed = clock.tick(true, 501000);
  assert.deepEqual(resumed, before);
  assert.equal(clock.tick(false, 502000), null);
  assert.equal(clock.tick(true, 700000).trace, 0);
  const reduced = clock.tick(true, 700001, false, true);
  assert.equal(reduced.wave, 0);
  assert.equal(reduced.flash < 0.003, true);
  assert.equal(reduced.moving, false);
  clock.restart();
  assert.equal(clock.tick(true, 800000).trace, 0);
});

test("only the launch border peak is reduced, preserving the first trace and travelling wave", () => {
  assert.equal(samplePupilPulse(PULSE_RELEASE - 0.01).border, 1.25, "retain the approved complete circle");
  let maxBorder = 0;
  for (let age = 0; age < 1.4; age += 0.01) {
    const s = samplePupilPulse(PULSE_RELEASE + age),
      previousBorder = 1.25 + s.flash * 4.15;
    assert.equal(s.wave, 1, "grain and empty-side ray energy stay intact");
    assert.ok(Math.abs(s.travel - age / PUPIL_PULSE.travel) < 1e-12);
    assert.ok(s.border <= previousBorder);
    maxBorder = Math.max(maxBorder, s.border);
  }
  assert.ok(maxBorder > 2.7 && maxBorder < 3.1, "a strong but controlled silver-white pulse");
});

test("only the travelling front and short trailing region illuminate; authored depth changes arrival", () => {
  const radius = 650,
    width = 200 * PUPIL_PULSE.width;
  assert.ok(pupilWaveAt(radius, radius, width) > 0.9);
  assert.equal(pupilWaveAt(radius + width, radius, width), 0, "particles ahead remain matte");
  assert.ok(pupilWaveAt(radius - width * 3, radius, width) < 0.005, "particles well behind return to steel");
  const planarDistance = 640,
    deepDistance = Math.hypot(640, 220);
  assert.ok(
    pupilWaveAt(planarDistance, radius, width) > pupilWaveAt(deepDistance, radius, width) * 2,
    "3D depth affects arrival",
  );
  const strengths = Array.from({ length: 150 }, (_, i) => pupilWaveAt(200 + i * 10, radius, width));
  assert.ok(strengths.filter((s) => s > 0.1).length < 30, "a narrow subset is bright at a time");
});
