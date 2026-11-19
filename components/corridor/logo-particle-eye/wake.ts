import { Vector2, Vector4 } from "three";

/**
 * The mouse moving through the eye's grains (user 2026-11-19: "it moves away and coming back like water"): a short
 * trail of where the mouse has just been. Each point pushes the grains near it aside and a little along the stroke,
 * then lets them flow back within about a second, even if the mouse stays where it is. A slow hand barely stirs them.
 * Positions only: no glow, colour or size change, and the stars stay still. Computers only (a mouse), never under
 * reduced motion; View 1, View 2 and the final eye. CSS pixels throughout, measured from the canvas centre, y up.
 */
export const WAKE = {
  points: 8,
  radius: 85,
  push: 14,
  drag: 7,
  max: 16,
  /** Seconds to rise and to fall back (the shape is rise × fall, peaking about 0.12 s after the mouse passes). */
  rise: 0.06,
  fall: 0.4,
  life: 1.4,
  spacing: 10,
  /** Mouse speed (CSS px/s) that stirs the grains fully; slower strokes stir them less, down to `slow`. */
  fast: 700,
  slow: 0.4,
} as const;

export const WAKE_GLSL = /* glsl */ `
uniform vec4 uWake[${WAKE.points}];
uniform vec2 uWakeDir[${WAKE.points}];
uniform vec2 uWakeView;
uniform float uWakeOn;
vec2 wakePush(vec2 at,float seed){
  vec2 push=vec2(0.);
  for(int i=0;i<${WAKE.points};i++){
    vec4 w=uWake[i];
    if(w.z<.001)continue;
    vec2 d=at-w.xy;
    float f=w.z*exp(-dot(d,d)/(w.w*w.w));
    push+=(d/max(length(d),1.)*${WAKE.push.toFixed(1)}+uWakeDir[i]*${WAKE.drag.toFixed(1)})*f;
  }
  // Each grain answers a little differently, and never moves further than the strongest push.
  push*=.75+.5*seed;
  return push*min(1.,${WAKE.max.toFixed(1)}/max(length(push),.001));
}
`;

export function createWake() {
  const points = Array.from({ length: WAKE.points }, () => ({ x: 0, y: 0, t: -1e9, dx: 0, dy: 0, gain: 0 }));
  let next = 0;
  const last = { x: 0, y: 0, t: 0, set: false };
  const uniforms = {
    uWake: { value: points.map(() => new Vector4()) },
    uWakeDir: { value: points.map(() => new Vector2()) },
    uWakeView: { value: new Vector2(1, 1) },
    uWakeOn: { value: 0 },
  };
  return {
    uniforms,
    /** The mouse is here now (CSS px from the canvas centre, y up). True when it left a new point in the trail. */
    add(x: number, y: number, now: number) {
      if (!last.set) {
        Object.assign(last, { x, y, t: now, set: true });
        return false;
      }
      const dx = x - last.x,
        dy = y - last.y,
        distance = Math.hypot(dx, dy);
      if (distance < WAKE.spacing) return false;
      const seconds = Math.max(0.008, (now - last.t) / 1000),
        point = points[next];
      next = (next + 1) % points.length;
      Object.assign(point, {
        x,
        y,
        t: now,
        dx: dx / distance,
        dy: dy / distance,
        gain: Math.min(1, Math.max(WAKE.slow, distance / seconds / WAKE.fast)),
      });
      Object.assign(last, { x, y, t: now });
      return true;
    },
    reset() {
      last.set = false;
      points.forEach((point) => (point.t = -1e9));
      uniforms.uWakeOn.value = 0;
    },
    /** Sets the uniforms for `now`; true while any grain is still out of place. */
    update(now: number, width: number, height: number) {
      uniforms.uWakeView.value.set(width, height);
      let on = 0;
      points.forEach((point, i) => {
        const age = (now - point.t) / 1000,
          strength =
            age < 0 || age > WAKE.life
              ? 0
              : point.gain * (1 - Math.exp(-age / WAKE.rise)) * Math.exp(-age / WAKE.fall);
        uniforms.uWake.value[i].set(point.x, point.y, strength, WAKE.radius);
        uniforms.uWakeDir.value[i].set(point.dx, point.dy);
        on = Math.max(on, strength);
      });
      uniforms.uWakeOn.value = on > 0.002 ? on : 0;
      return on > 0.002;
    },
  };
}
