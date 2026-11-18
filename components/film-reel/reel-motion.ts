// How the reel answers the scroll. Pure numbers, no DOM and no three.js, so it can be tested on its own.
//
// The order of one visit:
//   1. house lights: the white page dims to black by itself, then the lamp finds frame 1;
//   2. the reel: each step (one gesture, scroll-step.ts) moves the strip right to left by one frame, and the strip settles
//      softly on that frame; a frame lights up only when it rests in the gate, with a short flash, and goes dark again as
//      it leaves;
//   3. the exit: one more step after the last frame burns that frame up into white, ready for the white portal.
// Scrolling back runs the same way in reverse. In the site (`back`), one step back on frame 1 brings the house lights up
// again, and once the page is all white the site goes back the way it came (the page turns back into the liquid sphere).

export const REEL = {
  settle: 0.28, // seconds: how softly the strip moves and lands
  gesture: 0.22, // seconds without input before a burnt-white reel stops drawing
  lightsDown: 2.1, // seconds for the house lights to go down (and to come up again, going back)
  lightsWait: 0.35, // seconds of white before they start to dim
  exit: 1.2, // seconds for the last flash to grow into white
  flash: 0.22, // seconds: decay of the flash when a frame lands
  lineOut: 0.35, // seconds: a title line still on the opening white fades before the site goes back
};

export type ReelShot = {
  lights: number; // 1 = the white page, 0 = dark theatre
  position: number; // which frame is in the gate, as a continuous number from 0 to frames - 1
  lamp: number; // light through the gate, about 0 to 1.5 with the flash
  burn: number; // 0 to 1: the last frame burning up into white
  white: number; // opacity of the white cover over everything
  held: number; // seconds since the opening white began, until the lights are down (its title line runs on this clock)
  line: number; // 1, falling to 0 once the visitor goes back (the title line belongs to the way in)
  visible: boolean; // false once the reel has handed over to the white portal
  moving: boolean; // anything still changing, so the canvas must draw again
  landed: number; // the frame that has just come to rest this step, or -1
  exited: boolean; // true on the one step the last frame has burnt fully white, so the page can carry the same scroll on
  raised: boolean; // true on the one step the house lights are up again after a step back on frame 1: the site goes back
};

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const smooth = (value: number) => {
  const v = clamp(value, 0, 1);
  return v * v * (3 - 2 * v);
};
const smoother = (value: number) => {
  const v = clamp(value, 0, 1);
  return v * v * v * (v * (v * 6 - 15) + 10);
};

export type ReelMotion = ReturnType<typeof createReelMotion>;

// hold: seconds of opening white before the house lights go down (the site holds it while its title line is written).
// back: a step back on frame 1 brings the house lights up again and reports `raised` (the site, which can go back).
export function createReelMotion({
  frames,
  calm = false,
  hold = REEL.lightsWait,
  back = false,
}: {
  frames: number;
  calm?: boolean;
  hold?: number;
  back?: boolean;
}) {
  const last = frames - 1,
    lightsTime = calm ? 0.6 : REEL.lightsDown,
    exitTime = calm ? 0.6 : REEL.exit;
  let lights = 1,
    dimming = false,
    raising = false, // lights runs back up to 1: a step back on frame 1
    up = false, // the lights are up again and the site has been told; the visit starts over at the next begin()
    line = 1,
    wait = hold; // lights runs 1 -> 0 while dimming
  let position = 0,
    velocity = 0,
    target = 0,
    rested = -1;
  let exitRaw = 0,
    exitTarget = 0;
  let flash = 0,
    kick = 0,
    clock = 0,
    lastInput = -1e9,
    started = false,
    out = false,
    opened = 0;

  const shot = (): ReelShot => {
    const burn = smoother(exitRaw);
    const lamp = (1 - smooth(lights / 0.6)) * (1 + (calm ? 0 : 0.6) * flash); // each frame takes its share of this by its distance from the gate, in the shader
    // The white fades out and back in along a soft curve that starts and ends at rest, with no visible edge to the change.
    const white = Math.max(smoother(lights), smoother(exitRaw));
    const quiet = clock - lastInput > REEL.gesture;
    const settled = Math.abs(position - target) < 1e-4 && Math.abs(velocity) < 1e-4;
    const moving =
      (dimming && lights > 0) ||
      (started && !dimming && !raising && !up && wait > 0) || // the opening white, while its title line is written
      raising ||
      !settled ||
      flash > 1e-3 ||
      kick > 1e-3 ||
      (exitRaw > 0 && exitRaw < 1) ||
      exitRaw !== exitTarget ||
      (exitRaw >= 1 && !quiet);
    return {
      lights: smooth(lights),
      position,
      lamp,
      burn,
      white,
      held: started && !up ? opened : 0,
      line: smoother(line),
      visible: !(exitRaw >= 1 && exitTarget === 1),
      moving,
      landed: -1,
      exited: false,
      raised: false,
    };
  };
  /** Back to the very start: white, frame 1, nothing running. */
  const reset = () => {
    started = false;
    dimming = false;
    raising = false;
    up = false;
    line = 1;
    wait = hold;
    opened = 0;
    lights = 1;
    position = target = 0;
    rested = -1;
    velocity = 0;
    exitRaw = exitTarget = 0;
    flash = kick = 0;
    out = false;
  };

  return {
    /** The section is on screen and ready: start the house lights going down. Back again after the site went back from
     *  here, the visit starts over from the white page. */
    begin() {
      if (up) reset();
      if (!started) {
        started = true;
        wait = hold;
        opened = 0;
      }
    },
    /** Arrive from the far side (coming back from Section 2): dark, last frame, already burnt to white. */
    atEnd() {
      started = true;
      dimming = true;
      raising = false;
      up = false;
      lights = 0;
      position = target = rested = last;
      velocity = 0;
      exitRaw = exitTarget = 1;
      flash = kick = 0;
      out = true;
    },
    reset,
    /** One step of the site's scroll (scroll-step.ts): 1 forward, -1 back, 0 the rest of a gesture. Returns true when the
     *  reel used it; false hands it to the page (forward from the burnt-white last frame, into the white portal). */
    input(step: number) {
      if (exitRaw >= 1 && exitTarget === 1 && step > 0) return false; // burnt white: this step belongs to the white portal
      if (!step) return true;
      lastInput = clock;
      if (raising || up) return true; // on the way back: the lights are coming up
      if (!started) started = true;
      if (exitTarget === 1 || exitRaw > 0) {
        exitTarget = step > 0 ? 1 : 0; // the last frame burns up, or comes back out of the white
        return true;
      }
      if (step < 0 && (lights > 0.35 || target === 0)) {
        // Back on frame 1, or while the lights are still going down: in the site the house lights come up again.
        if (back) {
          raising = true;
          dimming = false;
        }
        return true;
      }
      if (lights > 0.35) return true; // the house lights are still going down: hold the strip
      if (step > 0 && target === last) exitTarget = 1; // one more after the last frame: it burns up into white
      else target = clamp(target + Math.sign(step), 0, last);
      return true;
    },
    /** Advance time. Returns what the reel looks like now. */
    step(delta: number): ReelShot {
      const dt = clamp(delta, 0, 0.1);
      clock += dt;
      if (started && lights > 0) opened += dt;
      if (started && !dimming && !raising && !up) {
        wait -= dt;
        if (wait <= 0) dimming = true;
      }
      if (dimming && lights > 0) lights = Math.max(0, lights - dt / lightsTime);
      if (raising) {
        lights = Math.min(1, lights + dt / lightsTime);
        line = calm ? 0 : Math.max(0, line - dt / REEL.lineOut);
      }
      // A critically damped follow: soft, never overshooting the frame.
      const omega = 2 / (calm ? 0.18 : REEL.settle),
        x = omega * dt,
        decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
      const change = position - target,
        carry = (velocity + omega * change) * dt;
      velocity = (velocity - omega * carry) * decay;
      position = target + (change + carry) * decay;
      if (Math.abs(position - target) < 5e-4 && Math.abs(velocity) < 2e-3) {
        position = target;
        velocity = 0;
      } // a fraction of a pixel
      // The flash rises over a few frames instead of popping on, then fades.
      flash += (kick - flash) * (1 - Math.exp(-dt / 0.05));
      kick *= Math.exp(-dt / REEL.flash);
      if (kick < 1e-3 && flash < 1e-3) flash = kick = 0;
      if (exitRaw !== exitTarget)
        exitRaw =
          exitTarget > exitRaw
            ? Math.min(exitTarget, exitRaw + dt / exitTime)
            : Math.max(exitTarget, exitRaw - dt / exitTime);
      // The house lights are up and any title line has gone: the page is all white, and the site can go back.
      const raised = raising && lights >= 1 && line <= 0;
      if (raised) {
        raising = false;
        up = true;
      }
      const result = shot();
      result.exited = !result.visible && !out;
      out = !result.visible;
      if (raised) result.raised = true;
      // A frame lands when it is all but still in the gate, with the lamp up. That is when the claw clicks and the lamp flashes.
      const near = Math.round(position);
      if (lights < 0.4 && near === target && Math.abs(position - near) < 0.012 && near !== rested) {
        rested = near;
        kick = 1;
        result.landed = near;
        result.moving = true;
      } else if (Math.abs(position - near) > 0.3) rested = -1;
      return result;
    },
    read: shot,
  };
}
