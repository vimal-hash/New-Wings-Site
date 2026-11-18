import test from "node:test";
import assert from "node:assert/strict";
import { createReelMotion, REEL } from "../components/film-reel/reel-motion.ts";

const FRAMES = 6;
const run = (motion, seconds) => {
  let shot = motion.read(),
    landed = [],
    raised = 0;
  for (let t = 0; t < seconds; t += 1 / 60) {
    shot = motion.step(1 / 60);
    if (shot.landed >= 0) landed.push(shot.landed);
    if (shot.raised) raised++;
  }
  return { shot, landed, raised };
};
// One gesture as the site hears it (scroll-step.ts): its step, then the rest of it, which moves nothing.
const gesture = (motion, step, rest = 30) => {
  const landed = [];
  motion.input(step);
  motion.step(1 / 60);
  for (let i = 0; i < rest; i++) {
    motion.input(0);
    const shot = motion.step(1 / 60);
    if (shot.landed >= 0) landed.push(shot.landed);
  }
  return landed;
};
const ready = (options = {}) => {
  const motion = createReelMotion({ frames: FRAMES, ...options });
  motion.begin();
  const { landed } = run(motion, REEL.lightsWait + REEL.lightsDown + 1);
  return { motion, landed };
};

test("house lights go down by themselves and frame 1 lands with a flash", () => {
  const motion = createReelMotion({ frames: FRAMES });
  assert.equal(motion.read().white, 1);
  motion.begin();
  const { shot, landed } = run(motion, REEL.lightsWait + REEL.lightsDown + 1);
  assert.equal(shot.white, 0);
  assert.deepEqual(landed, [0]);
  assert.ok(shot.lamp > 0.9);
  assert.equal(shot.moving, false);
});

test("one gesture moves the strip one frame, however long it runs", () => {
  const { motion } = ready();
  const during = gesture(motion, 1, 120);
  const { shot, landed } = run(motion, 2);
  assert.equal(shot.position, 1);
  assert.deepEqual([...during, ...landed], [1]);
});

test("a step starts the move at once and the lamp holds steady while the strip travels", () => {
  const { motion } = ready();
  motion.input(1);
  motion.step(1 / 60);
  let travelled = 0,
    lowest = 2;
  for (let t = 0; t < 0.15; t += 1 / 60) {
    const shot = motion.step(1 / 60);
    travelled = shot.position;
    if (shot.position > 0.1 && shot.position < 0.9) lowest = Math.min(lowest, shot.lamp);
  }
  assert.ok(travelled > 0.2, "the strip is already well on its way");
  assert.ok(lowest > 0.95, "no dip in the light while it moves");
  assert.equal(run(motion, 2).shot.position, 1);
});

test("while the house lights go down the strip holds", () => {
  const motion = createReelMotion({ frames: FRAMES });
  motion.begin();
  run(motion, REEL.lightsWait + 0.5);
  assert.equal(motion.input(1), true);
  assert.equal(run(motion, REEL.lightsDown + 1).shot.position, 0);
});

test("after the last frame one step burns to white, the next is handed to the page, and back runs in reverse", () => {
  const { motion } = ready();
  for (let frame = 1; frame < FRAMES; frame++) {
    gesture(motion, 1);
    run(motion, 2.5);
  }
  assert.equal(motion.read().position, FRAMES - 1);
  gesture(motion, 1);
  let exits = 0;
  for (let t = 0; t < REEL.exit + 0.5; t += 1 / 60) {
    if (motion.step(1 / 60).exited) exits++;
  }
  let shot = motion.read();
  assert.equal(exits, 1, "the page is told once, the moment the frame has burnt white");
  assert.equal(shot.burn, 1);
  assert.equal(shot.white, 1);
  assert.equal(shot.visible, false);
  assert.equal(motion.input(1), false);
  assert.equal(motion.input(-1), true);
  ({ shot } = run(motion, REEL.exit + 0.5));
  assert.equal(shot.burn, 0);
  assert.equal(shot.white, 0);
  assert.equal(shot.visible, true);
  for (let frame = FRAMES - 1; frame > 0; frame--) {
    gesture(motion, -1);
    run(motion, 2.5);
  }
  assert.equal(motion.read().position, 0);
});

test("arriving from the next section starts burnt white on the last frame", () => {
  const motion = createReelMotion({ frames: FRAMES });
  motion.atEnd();
  const { shot } = run(motion, 1);
  assert.equal(shot.position, FRAMES - 1);
  assert.equal(shot.white, 1);
  assert.equal(shot.visible, false);
  assert.equal(motion.input(-1), true);
  assert.equal(run(motion, REEL.exit + 0.5).shot.white, 0);
});

test("on the review page a step back on frame 1 changes nothing", () => {
  const { motion } = ready();
  assert.equal(motion.input(-1), true);
  const { shot, raised } = run(motion, REEL.lightsDown + 1);
  assert.equal(raised, 0);
  assert.equal(shot.white, 0);
  assert.equal(shot.position, 0);
});

test("in the site a step back on frame 1 brings the house lights up, then says so once; the next visit starts over", () => {
  const { motion } = ready({ back: true });
  gesture(motion, -1);
  assert.ok(motion.read().white > 0 && motion.read().white < 0.1, "the lights start coming up");
  gesture(motion, 1); // nothing turns them back: the site is on its way back
  const { shot, raised } = run(motion, REEL.lightsDown + 0.5);
  assert.equal(raised, 1);
  assert.equal(shot.white, 1);
  assert.equal(shot.lights, 1);
  assert.equal(shot.held, 0, "the title line belongs to the way in");
  assert.equal(shot.moving, false);
  motion.begin();
  const again = motion.read();
  assert.equal(again.white, 1);
  assert.equal(again.held, 0);
  assert.ok(run(motion, 0.5).shot.held > 0.45, "the opening white and its line run again");
  const { landed } = run(motion, REEL.lightsWait + REEL.lightsDown + 1);
  assert.deepEqual(landed, [0]);
});

test("a step back during the opening white lets its title line fade before the site goes back", () => {
  const motion = createReelMotion({ frames: FRAMES, hold: 4.25, back: true });
  motion.begin();
  run(motion, 1);
  assert.equal(motion.read().line, 1);
  motion.input(-1);
  let at = 0,
    line = 1;
  for (let t = 0; t < 1 && !at; t += 1 / 60) {
    const shot = motion.step(1 / 60);
    assert.ok(shot.line <= line, "the line only fades");
    line = shot.line;
    if (shot.raised) at = t + 1 / 60;
  }
  assert.ok(at >= REEL.lineOut - 1e-6 && at < REEL.lineOut + 0.05, "told once the line is gone, not before");
  assert.equal(line, 0);
});
