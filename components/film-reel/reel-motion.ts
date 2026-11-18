// How the reel answers the scroll. Pure numbers, no DOM and no three.js, so it can be tested on its own.
//
// The order of one visit:
//   1. house lights: the white page dims to black by itself, then the lamp finds frame 1;
//   2. the reel: each gesture moves the strip right to left by at most one frame, and the strip settles softly on that frame;
//      a frame lights up only when it rests in the gate, with a short flash, and goes dark again as it leaves;
//   3. the exit: one more gesture after the last frame burns that frame up into white, ready for the white portal.
// Scrolling back runs the same way in reverse.

export const REEL = {
  perFrame: 440, // scroll pixels that move the strip one whole frame while a gesture is held
  nudge: 0.12, // a gesture that moved more than this share of a frame goes on to the next frame when it ends
  settle: 0.28, // seconds: how softly the strip follows and lands
  quiet: 0.14, // seconds without input before the strip settles on a whole frame
  gesture: 0.22, // seconds without input that end one gesture, so the next input starts a new one
  lightsDown: 2.1, // seconds for the house lights to go down
  lightsWait: 0.35, // seconds of white before they start to dim
  exit: 1.2, // seconds for the last flash to grow into white
  flash: 0.22, // seconds: decay of the flash when a frame lands
};

export type ReelShot = {
  lights: number; // 1 = the white page, 0 = dark theatre
  position: number; // which frame is in the gate, as a continuous number from 0 to frames - 1
  lamp: number; // light through the gate, about 0 to 1.5 with the flash
  burn: number; // 0 to 1: the last frame burning up into white
  white: number; // opacity of the white cover over everything
  held: number; // seconds since the opening white began, until the lights are down (its title line runs on this clock)
  visible: boolean; // false once the reel has handed over to the white portal
  moving: boolean; // anything still changing, so the canvas must draw again
  landed: number; // the frame that has just come to rest this step, or -1
  exited: boolean; // true on the one step the last frame has burnt fully white, so the page can carry the same scroll on
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
export function createReelMotion({
  frames,
  calm = false,
  hold = REEL.lightsWait,
}: {
  frames: number;
  calm?: boolean;
  hold?: number;
}) {
  const last = frames - 1,
    lightsTime = calm ? 0.6 : REEL.lightsDown,
    exitTime = calm ? 0.6 : REEL.exit;
  let lights = 1,
    dimming = false,
    wait = hold; // lights runs 1 -> 0 while dimming
  let position = 0,
    velocity = 0,
    target = 0,
    origin = 0,
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
    const settled =
      Math.abs(position - target) < 1e-4 && Math.abs(velocity) < 1e-4 && Number.isInteger(target);
    const moving =
      (dimming && lights > 0) ||
      (started && lights > 0 && !dimming) ||
      !settled ||
      flash > 1e-3 ||
      kick > 1e-3 ||
      (exitRaw > 0 && exitRaw < 1) ||
      exitRaw !== exitTarget ||
      (exitRaw >= 1 && !quiet);
    const held = started ? opened : 0;
    return {
      lights: smooth(lights),
      position,
      lamp,
      burn,
      white,
      held,
      visible: !(exitRaw >= 1 && exitTarget === 1),
      moving,
      landed: -1,
      exited: false,
    };
  };

  return {
    /** The section is on screen and ready: start the house lights going down. */
    begin() {
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
      lights = 0;
      position = target = origin = rested = last;
      velocity = 0;
      exitRaw = exitTarget = 1;
      flash = kick = 0;
      out = true;
    },
    /** Back to the very start: white, frame 1, nothing running. */
    reset() {
      started = false;
      dimming = false;
      wait = hold;
      opened = 0;
      lights = 1;
      position = target = origin = 0;
      rested = -1;
      velocity = 0;
      exitRaw = exitTarget = 0;
      flash = kick = 0;
      out = false;
    },
    /** True while the reel would take a scroll in this direction instead of letting the page have it. */
    wants(pixels: number) {
      if (exitRaw >= 1 && exitTarget === 1 && pixels > 0) return false; // finished: the page carries the scroll on into the white portal
      return true;
    },
    /** One scroll event, in pixels (down is positive). Returns true when the reel used it. */
    input(pixels: number) {
      const fresh = clock - lastInput > REEL.gesture;
      if (exitRaw >= 1 && exitTarget === 1 && pixels > 0) return false; // burnt white: the rest of this scroll belongs to the white portal
      lastInput = clock;
      if (!started) started = true;
      if (lights > 0.35) return true; // the house lights are still going down: hold the strip
      if (fresh) origin = Math.round(target);
      if (exitTarget === 1 || exitRaw > 0) {
        if (fresh) exitTarget = pixels > 0 ? 1 : 0;
        return true;
      }
      if (pixels > 0 && fresh && origin === last && Math.abs(position - last) < 0.02) {
        exitTarget = 1;
        return true;
      }
      target = clamp(target + pixels / REEL.perFrame, Math.max(0, origin - 1), Math.min(last, origin + 1));
      if (Math.abs(target - origin) > REEL.nudge)
        target = clamp(origin + Math.sign(target - origin), 0, last); // far enough: go now, do not wait for the scroll to stop
      return true;
    },
    /** Advance time. Returns what the reel looks like now. */
    step(delta: number): ReelShot {
      const dt = clamp(delta, 0, 0.1);
      clock += dt;
      if (started && lights > 0) opened += dt;
      if (started && !dimming) {
        wait -= dt;
        if (wait <= 0) dimming = true;
      }
      if (dimming && lights > 0) lights = Math.max(0, lights - dt / lightsTime);
      // When input stops, land on a whole frame: the next one if the gesture moved far enough, otherwise back where it began.
      if (!Number.isInteger(target) && clock - lastInput > REEL.quiet) {
        const moved = target - origin;
        target = clamp(moved > REEL.nudge ? origin + 1 : moved < -REEL.nudge ? origin - 1 : origin, 0, last);
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
      const result = shot();
      result.exited = !result.visible && !out;
      out = !result.visible;
      // A frame lands when it is all but still in the gate, with the lamp up. That is when the claw clicks and the lamp flashes.
      const near = Math.round(position);
      if (
        lights < 0.4 &&
        Number.isInteger(target) &&
        near === target &&
        Math.abs(position - near) < 0.012 &&
        near !== rested
      ) {
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
