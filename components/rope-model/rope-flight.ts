import { Matrix4, Vector3 } from "three";

/**
 * The flight from section 1 to section 2: a whole green tunnel, joined at its tip to a whole red one, a smooth stop well back in the red, then on to the end.
 * The camera flies backwards. It looks down the tunnel as Blender's camera does, and backs out: from inside the green, past the join (z -30), to the stop (z -9), then to Blender's own start (z 0). What has been passed stays in view, shrinking into the middle. After the stop the green goes a little out of focus, only as the camera moves.
 * All the colours in the Blender files share the same threads, so green needs no extra download: it is the same threads again, with its colours worked out here from the green file's own numbers.
 * The tunnel is a cone: 1.24 across at its near mouth and 2.14 at its far tip. So the green copy is made larger, until its mouth is exactly red's tip, and turned until each green rope carries on from the same red rope.
 */
export const FLIGHT = {
  scrollScreens: 28,
  travel: 59.6, // from inside the green, about as far in as it is at its middle
  stopAt: 50.6, // world units flown when the camera stops, so at z -9: well back in the red, short of its end
  holdFrom: 0.832,
  holdTo: 0.852, // share of the scroll. Even speed on both sides of the stop
  cardTint: "232,52,58", // the glass card's edge at this flight's stop, in the tunnel's own colour
  through: false, // true: no stop and no card, one flight from end to end (the blue tunnel)
};
export type FlightProfile = typeof FLIGHT;
/** The original two-tunnel flight, with yellow at the far end and green at the near stop. */
export const YELLOW_FLIGHT: FlightProfile = { ...FLIGHT, cardTint: "66,210,92" };

// The section becomes white over the same .594 viewport heights in either
// flight. A fraction of the whole flight made the shorter blue entry rush.
export const SECTION_WHITE_SCREENS = 0.022 * (FLIGHT.scrollScreens - 1);
export const sectionWhiteShare = (profile: FlightProfile = FLIGHT) =>
  SECTION_WHITE_SCREENS / (profile.scrollScreens - 1);
export function sectionFlightShare(at: number, profile: FlightProfile = FLIGHT) {
  const white = sectionWhiteShare(profile);
  return at >= profile.holdFrom
    ? at
    : at <= white
      ? 0
      : (profile.holdFrom * (at - white)) / (profile.holdFrom - white);
}

// From the green Blender file.
export const GREEN = {
  tintSide: [0.22, 0.72, 0.32],
  tintFace: [1, 0.86, 0.34],
  core: [0.002, 0.012, 0.006],
  scale: 1.72, // red's rope circle at its far tip (2.14) against the same circle at the near mouth (1.24)
  shift: -22.5, // world units. Green's mouth reaches along red's last stretch, just outside it, so one tunnel's threads rise as the other's fall, and they mix instead of meeting at a line
  turn: 0.62, // radians around the camera's line. Measured: every rope is .91 round from its near mouth to its far tip. This lines the ropes up in the middle of the shared stretch
  join: -24, // world z in the middle of the shared stretch
  softest: 1.5, // the threads' width at the end of the flight, against their normal width: a small blur, nothing more
  holeRadius: 1.95, // world units: the red tunnel's opening at the join. Only what is seen through it is dark green
} as const;

// Match green's entrance in the original model's coordinates. The old -24
// entry looked through a different twist of the very same ropes.
export const BLUE_START = (-FLIGHT.travel - GREEN.shift) / GREEN.scale;
/** One blue tunnel; preserve the original source-space middle stop at -12. */
export const BLUE_FLIGHT: FlightProfile = {
  scrollScreens: 16,
  travel: -BLUE_START,
  stopAt: -12 - BLUE_START,
  // No stop in the middle and no card (user 2026-11-19: "it wont stop in middle and no cards"). The stop's share is
  // its own place on the line, so the camera keeps one even speed through it.
  holdFrom: (-12 - BLUE_START) / -BLUE_START,
  holdTo: (-12 - BLUE_START) / -BLUE_START,
  cardTint: "58,112,232",
  through: true,
};
/** The same rigid orientation as green, without its size or placement beyond red. */
export const blueMatrix = () => new Matrix4().makeRotationZ(GREEN.turn);
export function blueBox(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  const c = Math.cos(GREEN.turn),
    s = Math.sin(GREEN.turn),
    across = (Math.abs(c) * (x1 - x0) + Math.abs(s) * (y1 - y0)) / 2,
    up = (Math.abs(s) * (x1 - x0) + Math.abs(c) * (y1 - y0)) / 2,
    mx = (x0 + x1) / 2,
    my = (y0 + y1) / 2,
    cx = c * mx - s * my,
    cy = s * mx + c * my;
  return { x0: cx - across, x1: cx + across, y0: cy - up, y1: cy + up, z0, z1 };
}

/** Where the tunnels share a stretch, each thread thins to a point and dims, each at its own length, so there is no cut and no line. */
export const JOIN = {
  redEnd: -30, // no red thread reaches past this
  greenStart: 2.6 * GREEN.scale + GREEN.shift, // green's mouth
  spread: 5, // world units: how differently threads end
  length: 7, // world units: how long a thread takes to thin out
  hueRed: -18,
  hueGreen: -36, // world z: the threads' colour goes from red to green over this stretch, and only here
  coreFrom: -16,
  coreTo: -24,
  corePush: 0.9, // red's dark core moves out from the tunnel's line over this stretch, by this share, until it is behind the green: otherwise it hides the green with a hard round edge
};
/** GLSL: 0 at a thread's point, 1 where it has its full width. Which end depends on the tunnel. */
export const joinFadeGlsl = /* glsl */ `
  uniform float uFadeAt,uFadeWay;
  float joinFade(float z,float random){float u=clamp((uFadeWay*(z-uFadeAt)-random*${JOIN.spread.toFixed(
    3,
  )})/${JOIN.length.toFixed(3)},0.,1.);return u*u*(3.-2.*u);}`;
// How near the middle of the screen a point this far along is, seen from the stop. Perspective squeezes the far end into few pixels, so the colour change is even in this, not in distance: from the stop it reads as a wide soft ring.
const seenAt = (z: number) => 1 / (FLIGHT.stopAt - FLIGHT.travel - z);
/** GLSL: the colour along the shared stretch, the same in both tunnels, so no thread in front of another can show a colour edge. Pure red before it and pure green after it. uJoined is 0 only for the single-colour test switch. */
export const joinHueGlsl = /* glsl */ `
  uniform float uRed,uJoined;
  varying float vRed;
  float joinRed(float z){float u=clamp((1./max(${(FLIGHT.stopAt - FLIGHT.travel).toFixed(3)}-z,.01)-${seenAt(
    JOIN.hueGreen,
  ).toFixed(5)})/${(seenAt(JOIN.hueRed) - seenAt(JOIN.hueGreen)).toFixed(
    5,
  )},0.,1.);return mix(uRed,u*u*(3.-2.*u),uJoined);}`;
/** GLSL: moves red's core out of the way near the join. uPush is 1 for red, 0 for green. */
export const corePushGlsl = /* glsl */ `
  uniform float uPush;
  vec3 corePush(vec3 world){float u=clamp((world.z-(${JOIN.coreFrom.toFixed(3)}))/(${(
    JOIN.coreTo - JOIN.coreFrom
  ).toFixed(3)}),0.,1.);world.xy*=1.+uPush*${JOIN.corePush.toFixed(3)}*u*u*(3.-2.*u);return world;}`;

// Each colour file was made from the green one by one rule, so a baked red value goes back to green exactly: main channel moves over, the small one doubles, blue is 2.5 times.
export const greenFromRed = (c: readonly number[]) => [2 * c[1], c[0], 2.5 * c[2]];

/** GLSL: a baked red value, in this tunnel's colour. 0 is green, 1 is red. */
export const flightHueGlsl = /* glsl */ `
  vec3 flightHue(vec3 c,float red){return mix(vec3(2.*c.g,c.r,2.5*c.b),c,red);}`;

const smooth = (u: number) => u * u * (3 - 2 * u);
const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

/** Places the red tunnel's threads as the green tunnel. */
export const greenMatrix = () =>
  new Matrix4()
    .makeRotationZ(GREEN.turn)
    .scale(new Vector3(GREEN.scale, GREEN.scale, GREEN.scale))
    .setPosition(0, 0, GREEN.shift);

/** A box around a group of the red tunnel's threads, moved to where the green copy of them is. Turning a box makes it bigger, so this is the box around the turned one. */
export function greenBox(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  const k = GREEN.scale,
    c = Math.cos(GREEN.turn),
    s = Math.sin(GREEN.turn),
    across = ((Math.abs(c) * (x1 - x0)) / 2 + (Math.abs(s) * (y1 - y0)) / 2) * k,
    up = ((Math.abs(s) * (x1 - x0)) / 2 + (Math.abs(c) * (y1 - y0)) / 2) * k,
    mx = (x0 + x1) / 2,
    my = (y0 + y1) / 2,
    cx = (c * mx - s * my) * k,
    cy = (s * mx + c * my) * k;
  return {
    x0: cx - across,
    x1: cx + across,
    y0: cy - up,
    y1: cy + up,
    z0: z0 * k + GREEN.shift,
    z1: z1 * k + GREEN.shift,
  };
}

/** How out of focus the green is, 0 at the stop and before, 1 at the end of the flight. Depends only on where the camera is, so it comes back the same way on scrolling back. */
const greenSoft = (z: number) =>
  smooth(clamp01((z + FLIGHT.travel - FLIGHT.stopAt) / (FLIGHT.travel - FLIGHT.stopAt)));
/** Wider threads look out of focus. */
export const greenWidth = (z: number) => 1 + (GREEN.softest - 1) * greenSoft(z);
/** Dimmer in step with the extra width, so the green's overall brightness stays as it was: it blurs, it does not fade. */
export const greenDim = (z: number) => 1 / greenWidth(z);

/** Scroll share to distance flown. Even along the scroll: the smooth starts and ends come from the glide and the camera's own follow below. */
export function flightDistance(share: number, profile: FlightProfile = FLIGHT) {
  const { holdFrom, holdTo, stopAt, travel } = profile;
  if (share <= holdFrom) return (stopAt * Math.max(share, 0)) / holdFrom;
  if (share < holdTo) return stopAt;
  return stopAt + (travel - stopAt) * Math.min((share - holdTo) / (1 - holdTo), 1);
}

/** Where the camera belongs on the tunnel's line for this scroll share. */
export const flightZ = (share: number, profile: FlightProfile = FLIGHT) =>
  flightDistance(share, profile) - profile.travel;

/** The scroll is held at the stop and the camera has come to rest there. While it is still settling, the rope under a still mouse can change. Measured from the stop itself, not from the scroll: the scroll rests on whole pixels, a pixel is worth about .003 of camera travel, and that step must not count as leaving. */
export const flightAtStop = (share: number, z: number, profile: FlightProfile = FLIGHT) =>
  !profile.through &&
  share >= profile.holdFrom - 0.002 &&
  share <= profile.holdTo + 0.002 &&
  Math.abs(z - flightZ(profile.holdFrom, profile)) < 0.01;

const FOLLOW = 0.35; // seconds. The camera has weight: its speed builds up and dies away, whatever the scroll does, so it can never start or stop at once

/** Moves a camera towards its place with no sudden change of speed. The first move after `place` goes straight there. */
export function createFlightCamera() {
  let speed = 0,
    placed = false,
    seed: number | undefined;
  return {
    place(z?: number) {
      placed = false;
      speed = 0;
      seed = z;
    },
    /** Returns whether the camera is still moving. */
    move(position: { z: number }, target: number, delta: number) {
      if (!placed) {
        placed = true;
        position.z = seed ?? target;
        speed = 0;
        if (seed === undefined) return false;
      }
      const step = Math.min(delta, 0.1),
        pull = 2 / FOLLOW,
        x = pull * step,
        fade = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x),
        gap = position.z - target,
        push = (speed + pull * gap) * step;
      speed = (speed - pull * push) * fade;
      position.z = target + (gap + push) * fade;
      if (Math.abs(position.z - target) < 0.0005 && Math.abs(speed) < 0.002) {
        position.z = target;
        speed = 0;
        return false;
      }
      return true;
    },
  };
}

/** How wide the opening at the join looks from the camera, as a share of half the screen's height. Grows without limit as the camera reaches the join, so inside the green all empty space is green. */
export const holeOnScreen = (z: number, up: number) => GREEN.holeRadius / Math.max(z - GREEN.join, 0.01) / up;
/** Which colour curves a doubtful pixel takes: orange threads go through the curves of the tunnel the camera is in, as in that colour's file. */
export const curvesRed = (z: number) => smooth(clamp01((z - GREEN.join + 2) / 4));

const IDLE = 180; // ms with no scrolling: the gesture has ended
const GLIDE_PER_SCREEN = 400; // ms

/** Short entry legs need the first flight's acceleration, not its compressed duration. */
export function flightGlideTime(screens: number, profile: FlightProfile = FLIGHT, entryLeg = false) {
  const reference = FLIGHT.holdFrom * (FLIGHT.scrollScreens - 1),
    length = profile.holdFrom * (profile.scrollScreens - 1);
  return (
    Math.max(screens * GLIDE_PER_SCREEN, 400) * (entryLeg ? Math.sqrt(Math.max(reference / length, 1)) : 1)
  );
}

/** units: world units the camera has flown at this scroll share (the page's own mapping). take: filled in by the glide
 *  while it runs, for the page to pass on the site's scroll steps (1 forward, -1 back, 0 the rest of a gesture). */
export type FlightGlide = {
  lead: number;
  leadShare: number;
  units: (share: number) => number;
  take?: ((step: number) => boolean) | null;
  driving?: boolean;
  publish?: (share: number) => void;
};

/** A leg's shape over its time, from its speed: 0 at the start, 1 at the end. */
const legShape = (speed: (u: number) => number) => {
  const steps = 256,
    sum = new Float64Array(steps + 1);
  for (let i = 1; i <= steps; i++) sum[i] = sum[i - 1] + speed((i - 0.5) / steps);
  return (u: number) => {
    const x = clamp01(u) * steps,
      i = Math.min(Math.floor(x), steps - 1);
    return (sum[i] + (sum[i + 1] - sum[i]) * (x - i)) / sum[steps];
  };
};
const ease = (u: number) => smooth(clamp01(u));
// Out of the white to the stop: it starts slowly, so the white's edge is seen opening, then gathers speed, and brakes
// softly but briefly. From the stop into the white: a gentle start, then on at speed into the light, where it lands.
const toStop = legShape((u) => ease(u / 0.42) * ease((1 - u) / 0.24));
const toWhite = legShape((u) => ease(u / 0.38));
const legSeconds = (units: number, stopping: boolean) =>
  stopping ? 3.4 + 0.03 * units : 2.2 + 0.025 * units;

/**
 * The page's flight: each step of the site's scroll (one gesture, scroll-step.ts; the page passes it on through
 * `glide.take`) sets off one unbroken leg to the next resting place (the section, or the stop in the tunnel's colour).
 * It cannot halt half way: a step the same way while it flies is spent, and only a step the opposite way turns it round.
 * The layer never scrolls by itself (the page keeps the browser's own scrolling off); a scroll the page makes itself
 * (its entry into the connection) sets off the first leg. lead holds a leg at the section's white for that many seconds
 * first, while the white rises.
 */
export function createFlightGlide(element: HTMLElement, profile: FlightProfile, glide: FlightGlide) {
  const { lead, leadShare, units } = glide;
  let last = element.scrollTop,
    direction = 0,
    frame = 0,
    scrollRange = 0;
  const room = () => element.scrollHeight - element.clientHeight;
  const resized = () => {
    scrollRange = room();
  };
  const launch = (way: number) => {
    cancelAnimationFrame(frame);
    const total = room();
    scrollRange = total;
    if (total <= 0) {
      glide.driving = false;
      direction = 0;
      return;
    }
    element.style.overflowY = "hidden";
    const from = profile.holdFrom * total,
      to = profile.holdTo * total;
    let top = element.scrollTop,
      wait = 0;
    const atStop = !profile.through && top >= from - 2 && top <= to + 2;
    if (atStop) top = way > 0 ? to : from; // the held stretch shows no change, so leave from its far side at once
    const target = profile.through
      ? way > 0
        ? total
        : 0
      : atStop
        ? way > 0
          ? total
          : 0
        : top < from
          ? way > 0
            ? from
            : 0
          : way > 0
            ? total
            : to;
    // Leaving a section, the leg starts where its white is whole: the camera is already at the white opening.
    if (way > 0 && top < leadShare * total) {
      top = leadShare * total;
      wait = lead * 1000;
    }
    glide.driving = true;
    element.scrollTop = top;
    glide.publish?.(top / total);
    // A whole leg's time comes from its length on this side of the stop; a leg turned round part way takes less.
    const stopping = !profile.through && (target === from || target === to),
      below = target <= from && top <= from;
    const side = profile.through
        ? units(1) - units(leadShare)
        : below
          ? units(profile.holdFrom) - units(leadShare)
          : units(1) - units(profile.holdTo),
      span = Math.abs(units(target / total) - units(top / total));
    const begin = performance.now() + wait,
      time = legSeconds(side, stopping) * Math.sqrt(Math.min(span / Math.max(side, 1e-3), 1)) * 1000 + 1,
      shape = stopping ? toStop : toWhite;
    direction = way;
    const step = (now: number) => {
      const u = Math.min(Math.max((now - begin) / time, 0), 1);
      const share = (top + (target - top) * shape(u)) / total;
      element.scrollTop = share * scrollRange;
      if (u < 1) {
        glide.publish?.(share);
        frame = requestAnimationFrame(step);
        return;
      }
      last = element.scrollTop;
      glide.driving = false;
      const currentRoom = room();
      glide.publish?.(currentRoom > 0 ? last / currentRoom : 0);
      direction = 0;
    };
    frame = requestAnimationFrame(step);
  };
  const scrolled = () => {
    if (glide.driving) return;
    const top = element.scrollTop,
      way = Math.sign(top - last);
    last = top;
    if (!way || top <= 1 || top >= room() - 1) return;
    launch(way);
  };
  // One step: a leg, or the leg in flight turned round. At either end the step belongs to the page.
  const take = (step: number) => {
    const way = Math.sign(step);
    if (!way) return true;
    if (glide.driving) {
      if (way === -direction) launch(way);
      return true;
    }
    const top = element.scrollTop;
    if ((way < 0 && top <= 1) || (way > 0 && top >= room() - 1)) return false;
    launch(way);
    return true;
  };
  glide.take = take;
  element.style.overflowY = "hidden";
  element.addEventListener("scroll", scrolled, { passive: true });
  window.addEventListener("resize", resized);
  return () => {
    cancelAnimationFrame(frame);
    element.removeEventListener("scroll", scrolled);
    window.removeEventListener("resize", resized);
    if (glide.take === take) {
      glide.driving = false;
      glide.take = null;
    }
  };
}

/**
 * The camera never rests in the green, and always rests at the stop.
 * One gesture cannot scroll past the stop: it is held there until a fresh gesture. When scrolling ends anywhere else, the page carries on by itself to the next resting place, in the direction it was going.
 */
export function createFlightScroll(element: HTMLElement, profile: FlightProfile = FLIGHT) {
  let last = element.scrollTop,
    direction = 0,
    startedAt = element.scrollTop,
    idleTimer = 0,
    frame = 0,
    gliding = false,
    lastInput = -1e9;
  const room = () => element.scrollHeight - element.clientHeight;
  const cancel = () => {
    if (gliding) {
      cancelAnimationFrame(frame);
      gliding = false;
    }
  };
  const settle = () => {
    const total = room(),
      top = element.scrollTop,
      from = profile.holdFrom * total,
      to = profile.holdTo * total;
    if (total <= 0 || top <= 1 || top >= total - 1 || direction === 0) return;
    // At the stop: a gesture that arrived here stays. One that began here is leaving, however small it was.
    const atStop = !profile.through && top >= from - 2 && top <= to + 2,
      beganAtStop = !profile.through && startedAt >= from - 2 && startedAt <= to + 2;
    if (atStop && !beganAtStop) {
      direction = 0;
      return;
    }
    const target = profile.through
        ? direction > 0
          ? total
          : 0
        : atStop
        ? direction > 0
          ? total
          : 0
        : top < from
          ? direction > 0
            ? from
            : 0
          : direction > 0
            ? total
            : to,
      begin = performance.now(),
      span = Math.abs(target - top),
      time = flightGlideTime(span / element.clientHeight, profile, top <= to && target <= from);
    gliding = true;
    const step = (now: number) => {
      if (!gliding) return;
      const u = Math.min((now - begin) / time, 1);
      element.scrollTop = top + (target - top) * smooth(u);
      last = element.scrollTop;
      if (u < 1) frame = requestAnimationFrame(step);
      else {
        gliding = false;
        direction = 0;
      }
    };
    frame = requestAnimationFrame(step);
  };
  const scrolled = () => {
    if (gliding) return;
    const now = performance.now(),
      total = room(),
      from = profile.holdFrom * total,
      to = profile.holdTo * total;
    if (now - lastInput > IDLE) startedAt = last;
    lastInput = now;
    let top = element.scrollTop;
    // One gesture stops at the stop, whichever way it comes.
    if (!profile.through && startedAt < from && top > to) top = to;
    else if (!profile.through && startedAt > to && top < from) top = from;
    if (top !== element.scrollTop) element.scrollTop = top;
    if (top !== last) direction = Math.sign(top - last);
    last = top;
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(settle, IDLE);
  };
  const interrupt = () => {
    cancel();
  };
  element.addEventListener("scroll", scrolled, { passive: true });
  for (const name of ["wheel", "touchstart", "pointerdown"] as const)
    element.addEventListener(name, interrupt, { passive: true });
  window.addEventListener("keydown", interrupt);
  return () => {
    cancel();
    window.clearTimeout(idleTimer);
    element.removeEventListener("scroll", scrolled);
    for (const name of ["wheel", "touchstart", "pointerdown"] as const)
      element.removeEventListener(name, interrupt);
    window.removeEventListener("keydown", interrupt);
  };
}
