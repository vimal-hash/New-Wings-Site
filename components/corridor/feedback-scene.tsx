"use client";
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { createSpecks, type Specks } from "./feedback-specks";
import { ropeFlightDevice } from "./effect-quality";

/**
 * Section 4, Client Feedback: the whole history of the cinema image, ending in today's.
 *
 * Cards on a dark wall: the one in focus, and half of the next one waiting on the right. The scroll moves them like
 * Section 1's reel: each gesture moves at most one card, following the scroll, then settling softly. Before the first
 * card or after the last, a new gesture belongs to the page again.
 *
 * Arriving, the picture passes through every era, each blending into the next: Section 1's old film (black and white,
 * dark, grain, scratches, flicker) → Section 2's clean black and white → Section 3's faded colour (light grain, lines) →
 * full colour. Only then does the lens come in: real depth and field of view, the card in focus steps forward, the
 * others step back and dim, still facing straight on, and a few tiny specks of dust appear in the air behind the
 * cards (feedback-specks.ts): at the cards sharp, further back a little soft. Last, a deep green
 * light rises in the bottom right corner and up the gap between the cards. None of that depth is present during the older eras.
 * Today's picture is otherwise clean, like print: no glow round the card, no light spot on it, no blurred side cards
 * and no lean towards the mouse (the user found them AI-looking, 2026-11-15).
 */
export type FeedbackHandle = {
  play(): void;
  reset(): void;
  run(on: boolean): void;
  input(pixels: number): boolean;
  root: HTMLElement | null;
};
/** old: waits as old film. play: plays on mount. done: already in today's look (a still copy). */
type Start = "old" | "play" | "done";

export const FEEDBACK_WALL = "#0c0c0e";

/**
 * Runs once the page has settled: no new downloads and a run of steady frames for about two thirds of a second (five
 * seconds at most). Opening Section 4 directly, the rest of the page is still loading and preparing its graphics for a
 * moment; its white waits for that to pass, so nothing stutters once it starts to move. Returns a cancel.
 */
export function whenCalm(run: () => void) {
  let frame = 0,
    last = 0,
    steady = 0,
    loaded = -1,
    nextResourceCheck = 0;
  const start = performance.now();
  const check = (now: number) => {
    // Frame cadence needs a per-frame sample. The growing resource list does not.
    const count = now >= nextResourceCheck ? performance.getEntriesByType("resource").length : loaded;
    if (now >= nextResourceCheck) nextResourceCheck = now + 150;
    steady = last && now - last < 24 && count === loaded ? steady + 1 : 0;
    last = now;
    loaded = count;
    if ((steady >= 40 && now - start > 250) || now - start > 5000) {
      frame = 0;
      run();
      return;
    }
    frame = requestAnimationFrame(check);
  };
  frame = requestAnimationFrame(check);
  return () => cancelAnimationFrame(frame);
}

// Placeholders until the client's own testimonials arrive.
const QUOTES = [
  {
    text: "Placeholder — a theatre owner's words about their new screen and sound.",
    name: "Client name",
    place: "Cinema, City",
    colour: "#efb02e",
  },
  {
    text: "Placeholder — a project partner on planning and delivery with New Wings.",
    name: "Client name",
    place: "Company, City",
    colour: "#2a9fb3",
  },
  {
    text: "Placeholder — a cinema group on the seating and finishes in their halls.",
    name: "Client name",
    place: "Cinema group, City",
    colour: "#d4472f",
  },
];
const LAST = QUOTES.length - 1;

// The scroll, as Section 1's reel answers it.
const PER_CARD = 440,
  NUDGE = 0.12,
  SETTLE = 0.28,
  QUIET = 140,
  GESTURE = 220;
// The arrival, in seconds after the white has lifted (the user's timings, 2026-11-15): old film at 0, clean black and
// white at 1, faded colour at 1.8, full colour at 3 (ERA_AT, ERA_END); then the depth comes in, 3 to 3.5, with the specks,
// and the green light rises with it, 3 to 3.5; everything has settled at 3.5.
const ERA_AT = [1, 1.8],
  ERA_END = 3,
  DEPTH_WAIT = 0.01,
  DEPTH = 0.49,
  LIGHT_AT = ERA_END + DEPTH_WAIT,
  LIGHT = DEPTH,
  END = Math.max(ERA_END + DEPTH_WAIT + DEPTH, LIGHT_AT + LIGHT);
// How much the motion slows on each era (1 would stop on it for an instant; less keeps it flowing).
const DWELL = 0.8;
// The look of each era: 0 old film, 1 clean B&W, 2 faded colour, 3 today.
const LOOK = {
  grey: [1, 1, 0, 0],
  sepia: [0, 0, 0.3, 0],
  saturate: [1, 1, 0.55, 1],
  contrast: [1.15, 1.3, 0.92, 1],
  bright: [0.8, 1.08, 0.92, 1],
  old: [1, 0, 0, 0],
  vintage: [0, 0, 1, 0],
};
// The lens once today's picture has arrived: field of view (degrees) without and with the depth.
const FOV_FLAT = 44,
  FOV_DEEP = 56;
// The green light and the era films never rest fully at zero: kept just above it (invisible), they are drawn once while
// the white still covers the section, instead of all at once on the frame they begin.
const REST = 0.003;

const TAU = Math.PI * 2;
const clamp = (v: number, low: number, high: number) => Math.min(high, Math.max(low, v));
const smoother = (x: number) => {
  const t = clamp(x, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
/**
 * The base ease (out of the old film, into today) is bent just enough to reach each look at its time in ERA_AT: it adds
 * sin²·(a + b·cos) of the same angle, which is zero, and flat, at both ends, so the start and the finish stay soft.
 * a and b are solved once here from the two times (it stays monotonic for these; keep checking if they change).
 */
const ERA_BEND = (() => {
  const base = (t: number) => (3 * (1 - Math.cos((Math.PI * t) / ERA_END))) / 2;
  const terms = (t: number) => {
    const angle = (Math.PI * t) / ERA_END,
      s2 = Math.sin(angle) ** 2;
    return [s2, s2 * Math.cos(angle)];
  };
  const [p, q] = terms(ERA_AT[0]),
    [r, w] = terms(ERA_AT[1]),
    e1 = 1 - base(ERA_AT[0]),
    e2 = 2 - base(ERA_AT[1]),
    det = p * w - q * r;
  return [(e1 * w - q * e2) / det, (p * e2 - e1 * r) / det];
})();
/**
 * Seconds since the white lifted → era (0..3). One unbroken curve: it eases out of the old film and into today, and
 * slows as it passes each era, so every look is seen in turn, without ever stopping or jerking (its speed and
 * acceleration change smoothly everywhere).
 */
function eraAt(t: number) {
  const u = clamp(t / ERA_END, 0, 1);
  if (u >= 1) return 3;
  const angle = Math.PI * u,
    x =
      (3 * (1 - Math.cos(angle))) / 2 + Math.sin(angle) ** 2 * (ERA_BEND[0] + ERA_BEND[1] * Math.cos(angle));
  return clamp(x - (DWELL * Math.sin(TAU * x)) / TAU, 0, 3);
}
const look = (key: keyof typeof LOOK, era: number) => {
  const k = LOOK[key],
    i = Math.min(2, Math.floor(era)),
    f = era - i;
  return k[i] + (k[i + 1] - k[i]) * f;
};

// The light in the bottom right corner: a deep emerald green the user chose (2026-11-15; it was a cinema red), a little
// brighter and paler right in the corner, falling off smoothly through dark green into the wall. Taller than it is wide,
// so it rises up the gap between the cards. Many stops keep the fall-off free of visible bands.
const CORNER_LIGHT = (() => {
  const core = [60, 226, 112],
    deep = [8, 82, 38],
    stops = [];
  for (let k = 0; k <= 24; k++) {
    const t = k / 24,
      a = 0.9 * Math.pow(1 - t, 2.3),
      m = Math.min(1, t * 1.4),
      hot = 0.175 * Math.max(0, 1 - t / 0.18);
    const colour = core.map((v, i) => Math.round(v + (deep[i] - v) * m + (255 - v) * hot));
    stops.push(`rgba(${colour.join(",")},${a.toFixed(3)}) ${(t * 100).toFixed(1)}%`);
  }
  return `radial-gradient(ellipse 90% 160% at 100% 100%,${stops.join(",")})`;
})();

const CSS = `
.nw-fb{--w:min(50vw,(100dvh - 18dvh - 40px)*1.6,1500px);--h:calc(var(--w)/1.6);--gap:calc(var(--w)*.07);--left:max(24px,100vw - var(--w)*1.5 - var(--gap));position:absolute;inset:0;overflow:hidden;background:${FEEDBACK_WALL};color:#111214}
.nw-fb-light{position:absolute;inset:0;pointer-events:none;opacity:.003;transform-origin:100% 100%;will-change:opacity,transform;background:${CORNER_LIGHT}}
.nw-fb-specks{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.nw-fb-stage{position:absolute;inset:0;perspective:900px}
.nw-fb[data-era="old"] .nw-fb-card{filter:grayscale(1) contrast(1.15) brightness(.8)}
.nw-fb-track{position:absolute;left:var(--left);top:calc(50% - var(--h)/2);display:flex;gap:var(--gap);transform-style:preserve-3d;will-change:transform}
.nw-fb-card{flex:none;position:relative;width:var(--w);height:var(--h);backface-visibility:hidden;will-change:transform}
.nw-fb-face{position:absolute;inset:0;box-sizing:border-box;margin:0;padding:clamp(12px,calc(var(--w)*.05),72px);display:grid;grid-template-rows:auto 1fr auto}
.nw-fb-top,.nw-fb-who{display:flex;justify-content:space-between;align-items:baseline;gap:16px;font:500 clamp(9px,calc(var(--w)*.015),15px)/1.3 var(--font-geist-mono),monospace;letter-spacing:.16em;text-transform:uppercase}
.nw-fb-text{align-self:center;max-width:22ch;margin:0;font-size:clamp(13px,calc(var(--w)*.046),68px);font-weight:500;line-height:1.08;letter-spacing:-.03em}
.nw-fb-name{font:500 clamp(12px,calc(var(--w)*.024),30px)/1.2 var(--font-geist-sans),system-ui,sans-serif;letter-spacing:-.01em;text-transform:none}
/* The films of the older eras, over the whole picture. Each fades as a whole; its parts animate inside it. */
.nw-fb-film,.nw-fb-scratches{position:absolute;inset:0;overflow:hidden;pointer-events:none}
/* Their strength is written straight onto each layer (no custom properties: those would restyle every layer inside,
   grain image included, on every frame). */
.nw-fb-old,.nw-fb-scratches,.nw-fb-vintage{opacity:.003}
.nw-fb[data-era="old"] .nw-fb-old,.nw-fb[data-era="old"] .nw-fb-scratches{opacity:1}
.nw-fb[data-era="hd"] .nw-fb-film,.nw-fb[data-era="hd"] .nw-fb-scratches{display:none}
.nw-fb-film>*,.nw-fb-scratches>*{position:absolute}
.nw-fb-scratches i{inset:0;background:linear-gradient(90deg,transparent 12%,rgba(255,255,255,.784) 12%,rgba(255,255,255,.784) calc(12% + 1px),transparent calc(12% + 1px),transparent 44%,#fff 44%,#fff calc(44% + 1px),transparent calc(44% + 1px),transparent 71%,rgba(255,255,255,.659) 71%,rgba(255,255,255,.659) calc(71% + 1px),transparent calc(71% + 1px),transparent 89%,rgba(255,255,255,.878) 89%,rgba(255,255,255,.878) calc(89% + 1px),transparent calc(89% + 1px))}
.nw-fb-oldgrain{inset:-192px;opacity:.8}
.nw-fb-oldedge{inset:0;background:radial-gradient(80% 95% at 50% 50%,rgba(0,0,0,0) 45%,rgba(0,0,0,.773) 100%)}
.nw-fb-oldflicker{inset:0;background:#000;opacity:.1}
.nw-fb-grain{inset:-192px;opacity:.22}
.nw-fb-lines{inset:0;opacity:.3;background:linear-gradient(90deg,transparent 19%,rgba(0,0,0,.58) 19%,rgba(0,0,0,.58) calc(19% + 1px),transparent calc(19% + 1px),transparent 67%,rgba(0,0,0,.52) 67%,rgba(0,0,0,.52) calc(67% + 1px),transparent calc(67% + 1px))}
.nw-fb-flicker{inset:0;background:#0a0705;opacity:.04}
.nw-fb[data-run]:not([data-era="hd"]) .nw-fb-oldgrain{animation:nw-fb-grain .36s steps(1) infinite}
.nw-fb[data-run]:not([data-era="hd"]) .nw-fb-oldflicker{animation:nw-fb-oldflicker .29s steps(1) infinite}
.nw-fb[data-run]:not([data-era="hd"]) .nw-fb-scratches i{animation:nw-fb-scratch 1.1s steps(1) infinite}
.nw-fb[data-run]:not([data-era="hd"]) .nw-fb-grain{animation:nw-fb-grain .5s steps(1) infinite}
.nw-fb[data-run]:not([data-era="hd"]) .nw-fb-lines{animation:nw-fb-drift 7s steps(1) infinite}
.nw-fb[data-run]:not([data-era="hd"]) .nw-fb-flicker{animation:nw-fb-flicker .46s steps(1) infinite}
@keyframes nw-fb-oldflicker{0%{opacity:.06}25%{opacity:.18}50%{opacity:.03}75%{opacity:.14}}
@keyframes nw-fb-grain{0%{transform:translate(0,0)}17%{transform:translate(-71px,43px)}33%{transform:translate(38px,-97px)}50%{transform:translate(-113px,-29px)}67%{transform:translate(89px,67px)}83%{transform:translate(-23px,121px)}}
@keyframes nw-fb-scratch{0%{transform:translateX(0);opacity:.45}21%{transform:translateX(5px);opacity:.22}38%{transform:translateX(-9px);opacity:.5}62%{transform:translateX(14px);opacity:.28}83%{transform:translateX(-4px);opacity:.45}}
@keyframes nw-fb-drift{0%{transform:translateX(0);opacity:.3}25%{transform:translateX(2px);opacity:.2}50%{transform:translateX(1px);opacity:.32}75%{transform:translateX(-1px);opacity:.24}}
@keyframes nw-fb-flicker{0%{opacity:.03}20%{opacity:.08}40%{opacity:.02}60%{opacity:.1}80%{opacity:.05}}
@media (max-aspect-ratio:1/1){
  .nw-fb{--w:min(58vw,(100dvh - 22dvh - 40px)/1.45,520px);--h:calc(var(--w)*1.45);--left:max(16px,100vw - var(--w)*1.5 - var(--gap))}
  .nw-fb-face{padding:clamp(14px,calc(var(--w)*.07),28px)}
  .nw-fb-text{font-size:clamp(14px,calc(var(--w)*.078),36px)}
  .nw-fb-who{flex-direction:column;align-items:flex-start;gap:6px}
}
@media (orientation:landscape) and (max-height:500px){
  .corridor-study .nw-fb{--contact-space:calc(var(--contact-bottom) + var(--contact-icon-height) + 2 * var(--contact-padding) + 12px);--w:min(50vw,(100dvh - var(--contact-space) - 36px)*1.6,1500px)}
  .corridor-study .nw-fb-track{top:calc((100% - var(--contact-space) - var(--h))/2 + 8px)}
}
@media (prefers-reduced-motion:reduce){.nw-fb *{animation:none!important}}
`;

type Controller = FeedbackHandle & {
  settle(era: number, depth: number): void;
  resize(): void;
  specks(canvas: HTMLCanvasElement): () => void;
};
type Parts = {
  root: { current: HTMLDivElement | null };
  light: { current: HTMLDivElement | null };
  stage: { current: HTMLDivElement | null };
  track: { current: HTMLDivElement | null };
  cards: { current: (HTMLElement | null)[] };
  shown: (i: number) => void;
  card: number;
};

function createController({ root, light, stage, track, cards, shown, card }: Parts): Controller {
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // One clock for the arrival, the cards and the specks. pos follows goal like a soft spring; while a gesture is held,
  // goal follows the scroll (at most one card from where it began); once the scroll is quiet, goal is a whole card.
  // pitch: pixels from one card to the next, which carries the specks with the cards.
  const c = {
    frame: 0,
    playing: false,
    start: 0,
    era: 0,
    depth: 0,
    pos: card,
    vel: 0,
    goal: card,
    origin: card,
    drag: 0,
    held: false,
    mine: false,
    last: -1e9,
    time: 0,
    shown: card,
    drawnDepth: NaN,
    light: 0,
    pitch: 0,
    specks: null as Specks | null,
    // Where the flat strip puts things, in pixels from the stage's centre (the lens's centre): measured on resize.
    layout: { lefts: [] as number[], height: 0 },
  };
  const running = () => root.current?.dataset.run !== undefined;
  const fov = () => FOV_FLAT + (FOV_DEEP - FOV_FLAT) * c.depth;
  // Writes a style only when it changes (the cards are placed every frame while the lens is live).
  const written = new WeakMap<HTMLElement, Record<string, string>>();
  const put = (el: HTMLElement, name: string, value: string) => {
    let seen = written.get(el);
    if (!seen) {
      seen = {};
      written.set(el, seen);
    }
    if (seen[name] === value) return;
    seen[name] = value;
    el.style.setProperty(name, value);
  };
  // The era's look on the picture and its films.
  const paintEra = () => {
    const el = root.current;
    if (!el) return;
    const tint = (value: string) => {
      for (const card of cards.current) if (card) put(card, "filter", value);
    };
    const film = (name: string) => el.querySelector<HTMLElement>(name);
    const old = film(".nw-fb-old"),
      scratches = film(".nw-fb-scratches"),
      vintage = film(".nw-fb-vintage");
    const films = (o: number, v: number) => {
      for (const layer of [old, scratches]) if (layer) put(layer, "opacity", o.toFixed(3));
      if (vintage) put(vintage, "opacity", v.toFixed(3));
    };
    if (c.era >= 3) {
      tint("none");
      films(0, 0);
      return;
    }
    const e = c.era;
    tint(
      `grayscale(${look("grey", e).toFixed(3)}) sepia(${look("sepia", e).toFixed(3)}) saturate(${look(
        "saturate",
        e,
      ).toFixed(3)}) contrast(${look("contrast", e).toFixed(3)}) brightness(${look("bright", e).toFixed(3)})`,
    );
    // Never quite zero while the eras run: each film is then already drawn before its era comes (see REST).
    films(Math.max(REST, look("old", e)), Math.max(REST, look("vintage", e)));
  };
  // The cards: where the strip is and, with the depth, how far each stands from the lens. All face straight on.
  const placeCards = () => {
    const d = c.depth;
    if (track.current)
      put(track.current, "transform", `translateX(calc(${(-c.pos).toFixed(4)} * (var(--w) + var(--gap))))`);
    const lens = c.layout.height / 2 / Math.tan((fov() * Math.PI) / 360);
    if (stage.current && c.depth !== c.drawnDepth) {
      c.drawnDepth = c.depth;
      stage.current.style.perspective = `${lens.toFixed(1)}px`;
    }
    cards.current.forEach((el, i) => {
      if (!el) return;
      const a = Math.abs(clamp(i - c.pos, -1, 1)),
        z = ((1 - a) * 34 - a * 70) * d;
      // The lens only changes a card's size, not where it stands: each card's centre stays where the flat strip puts it
      // (moved back by z, a card would otherwise slide towards the lens's centre and close the gap to its neighbour).
      const centre = (c.layout.lefts[i] ?? 0) - c.pos * c.pitch,
        shift = lens > 0 ? (-centre * z) / lens : 0;
      put(el, "opacity", (1 - (0.12 + 0.18 * d) * a).toFixed(3));
      put(
        el,
        "transform",
        d > 0 ? `translateX(${shift.toFixed(2)}px) translateZ(${z.toFixed(2)}px)` : "none",
      );
    });
    const near = Math.round(c.pos);
    if (near !== c.shown) {
      c.shown = near;
      shown(near);
    }
  };
  // The green light in the corner, last of all: it rises and opens out from the corner.
  const paintLight = () => {
    const el = light.current;
    if (!el) return;
    const e = smoother(c.light);
    put(el, "opacity", Math.max(REST, e).toFixed(3));
    put(el, "transform", `scale(${(0.82 + 0.18 * e).toFixed(4)})`);
  };
  const finish = () => {
    c.playing = false;
    c.era = 3;
    c.depth = 1;
    c.light = 1;
    const el = root.current;
    if (el) el.dataset.era = "hd";
    paintEra();
    placeCards();
    paintLight();
  };
  const tick = (now: number) => {
    c.frame = 0;
    if (!root.current) return;
    const dt = c.time ? Math.min(0.05, (now - c.time) / 1000) : 1 / 60;
    c.time = now;
    let busy = false;
    if (c.playing) {
      const t = (now - c.start) / 1000;
      if (t >= END) finish();
      else {
        busy = true;
        c.era = eraAt(t);
        c.depth = smoother((t - ERA_END - DEPTH_WAIT) / DEPTH);
        c.light = clamp((t - LIGHT_AT) / LIGHT, 0, 1);
        if (c.era >= 3 && root.current.dataset.era !== "now") root.current.dataset.era = "now";
        paintEra();
        paintLight();
      }
    }
    if (c.held && performance.now() - c.last > QUIET) {
      c.held = false;
      const share = c.drag / PER_CARD;
      c.goal = clamp(Math.abs(share) > NUDGE ? c.origin + Math.sign(share) : c.origin, 0, LAST);
    }
    if (reduced()) {
      c.pos = Math.round(c.goal);
      c.vel = 0;
    } else {
      // A critically damped spring towards the goal.
      const w = 2 / SETTLE,
        x = w * dt,
        e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x),
        change = c.pos - c.goal,
        temp = (c.vel + w * change) * dt;
      c.vel = (c.vel - w * temp) * e;
      c.pos = c.goal + (change + temp) * e;
      if (Math.abs(c.pos - c.goal) < 1e-4 && Math.abs(c.vel) < 1e-4) {
        c.pos = c.goal;
        c.vel = 0;
      }
    }
    placeCards();
    if (c.held || c.pos !== c.goal) busy = true;
    // The specks drift in the air and move with the cards by their distance; they come in with the depth.
    if (c.specks) {
      const view = { shift: c.pos * c.pitch, strength: c.depth };
      if (c.depth > 0 && !reduced()) {
        c.specks.draw(dt, view);
        busy = true;
      } else if (c.depth > 0) c.specks.draw(0, view); // reduced motion: still
      else c.specks.clear();
    }
    if (busy && running()) c.frame = requestAnimationFrame(tick);
    else c.time = 0;
  };
  const wake = () => {
    if (!c.frame && running()) c.frame = requestAnimationFrame(tick);
  };
  const made: Controller = {
    run(on) {
      const el = root.current;
      if (!el) return;
      if (on) {
        el.dataset.run = "";
        wake();
      } else {
        delete el.dataset.run;
        cancelAnimationFrame(c.frame);
        c.frame = 0;
        c.time = 0;
      }
    },
    // From the moment the white has lifted.
    play() {
      const el = root.current;
      if (!el) return;
      made.run(true);
      if (el.dataset.era !== "old" || c.playing) return;
      if (reduced()) {
        finish();
        wake();
        return;
      }
      c.playing = true;
      c.start = performance.now();
      c.time = 0;
      c.specks?.warm();
      wake();
    },
    reset() {
      const el = root.current;
      c.playing = false;
      c.era = 0;
      c.depth = 0;
      c.light = 0;
      c.pos = c.goal = c.origin = 0;
      c.vel = 0;
      c.drag = 0;
      c.held = false;
      c.mine = false;
      if (el) el.dataset.era = "old";
      paintEra();
      c.specks?.clear();
      placeCards();
      paintLight();
    },
    // One scroll event in pixels (down is positive). True when the cards used it; false when it belongs to the page.
    input(pixels) {
      const now = performance.now();
      if (!root.current) return false;
      const fresh = now - c.last > GESTURE;
      c.last = now;
      if (fresh) {
        c.origin = Math.round(c.goal);
        c.drag = 0;
        // Before the first card or after the last, a new gesture goes on to the page (back up, or on to the end).
        c.mine = !((pixels < 0 && c.origin <= 0) || (pixels > 0 && c.origin >= LAST));
      }
      if (!c.mine) return false;
      c.drag += pixels;
      c.held = true;
      c.goal = clamp(c.origin + clamp(c.drag / PER_CARD, -1, 1), 0, LAST);
      wake();
      return true;
    },
    settle(era, depth) {
      c.era = era;
      c.depth = depth;
      c.light = era >= 3 && depth >= 1 ? 1 : 0;
      paintEra();
      placeCards();
      paintLight();
    },
    // The lens's perspective follows the section's height; the specks follow its size and the cards' spacing.
    resize() {
      const el = root.current,
        first = cards.current[0],
        next = cards.current[1];
      c.pitch = first && next ? next.offsetLeft - first.offsetLeft : 0;
      if (el) {
        // Each card's centre (with the strip at its first card) from the stage's centre; the strip's own left included.
        const from = (track.current?.offsetLeft ?? 0) - el.clientWidth / 2;
        c.layout = {
          lefts: cards.current.map((card) => (card ? from + card.offsetLeft + card.offsetWidth / 2 : 0)),
          height: el.clientHeight,
        };
        c.specks?.resize(el.clientWidth, el.clientHeight);
      }
      c.drawnDepth = NaN;
      placeCards();
      wake();
    },
    specks(canvas) {
      const device = ropeFlightDevice();
      // Fewer on phones; the canvas at one pixel per CSS pixel on computers, a little sharper on phones.
      c.specks = createSpecks(canvas, device === "mobile" ? 0.6 : 1, device === "mobile" ? 1.25 : 1);
      made.resize();
      c.specks.warm(); // its sprites are first drawn now, while the section is still hidden
      return () => {
        c.specks?.clear();
        c.specks = null;
      };
    },
    get root() {
      return root.current;
    },
  };
  return made;
}

const FeedbackScene = forwardRef<FeedbackHandle, { live?: boolean; start?: Start; card?: number }>(
  function FeedbackScene({ live = false, start = "done", card = 0 }, ref) {
    const root = useRef<HTMLDivElement>(null),
      light = useRef<HTMLDivElement>(null),
      stage = useRef<HTMLDivElement>(null),
      track = useRef<HTMLDivElement>(null),
      cards = useRef<(HTMLElement | null)[]>([]);
    const specks = useRef<HTMLCanvasElement>(null),
      first = useRef(start),
      ctl = useRef<Controller | null>(null);
    const [shown, setShown] = useState(card);
    const ensure = () =>
      (ctl.current ??= createController({ root, light, stage, track, cards, shown: setShown, card }));
    useImperativeHandle(ref, () => ensure(), []); // eslint-disable-line react-hooks/exhaustive-deps -- one controller for the component's life
    useLayoutEffect(() => {
      const made = ensure();
      made.resize(); // the strip's layout, for the lens
      if (first.current === "done") made.settle(3, 1);
      else made.settle(0, 0);
      return () => made.run(false); // its frame is cancelled, so a remount (React's dev double mount) can start it again
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
      const section = root.current;
      if (!live || !section) return;
      const tile = document.createElement("canvas");
      tile.width = tile.height = 192;
      const paint = tile.getContext("2d");
      if (!paint) return;
      const image = paint.createImageData(192, 192);
      for (let i = 0; i < image.data.length; i += 4)
        image.data[i + 3] = Math.round(255 - (165 + Math.random() * 90));
      paint.putImageData(image, 0, 0);
      const layers = section.querySelectorAll<HTMLElement>(".nw-fb-oldgrain,.nw-fb-grain");
      let gone = false,
        link = "";
      tile.toBlob((blob) => {
        if (!blob || gone) return;
        link = URL.createObjectURL(blob);
        layers.forEach((layer) => {
          layer.style.backgroundImage = `url("${link}")`;
        });
      }, "image/png");
      return () => {
        gone = true;
        if (link) {
          layers.forEach((layer) => {
            layer.style.backgroundImage = "";
          });
          URL.revokeObjectURL(link);
        }
      };
    }, [live]);
    useEffect(() => {
      const el = root.current;
      if (!el) return;
      const made = ensure(),
        watch = new ResizeObserver(() => made.resize());
      watch.observe(el);
      return () => watch.disconnect();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
      if (!live || !specks.current) return;
      return ensure().specks(specks.current);
    }, [live]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
      if (!live || first.current !== "play") return;
      const wait = requestAnimationFrame(() => ensure().play());
      return () => cancelAnimationFrame(wait);
    }, [live]); // eslint-disable-line react-hooks/exhaustive-deps
    return (
      <div
        ref={root}
        className="nw-fb"
        data-live={live || undefined}
        data-era={start === "done" ? "hd" : "old"}
      >
        <style href="nw-feedback-scene" precedence="default">
          {CSS}
        </style>
        <div ref={light} className="nw-fb-light" aria-hidden="true" />
        {live ? <canvas ref={specks} className="nw-fb-specks" aria-hidden="true" /> : null}
        <div
          ref={stage}
          className="nw-fb-stage"
          role="group"
          aria-roledescription="carousel"
          aria-label="Client feedback"
        >
          <div ref={track} className="nw-fb-track">
            {QUOTES.map((q, i) => (
              <div
                key={i}
                ref={(el) => {
                  cards.current[i] = el;
                }}
                className="nw-fb-card"
                aria-hidden={i !== shown}
              >
                <figure className="nw-fb-face" style={{ background: q.colour }}>
                  <div className="nw-fb-top">
                    <span>Client feedback</span>
                    <span>
                      {String(i + 1).padStart(2, "0")} / {String(QUOTES.length).padStart(2, "0")}
                    </span>
                  </div>
                  <blockquote className="nw-fb-text">{q.text}</blockquote>
                  <figcaption className="nw-fb-who">
                    <span className="nw-fb-name">{q.name}</span>
                    <span>{q.place}</span>
                  </figcaption>
                </figure>
              </div>
            ))}
          </div>
        </div>
        <div className="nw-fb-film nw-fb-old" aria-hidden="true">
          <div className="nw-fb-oldgrain" />
          <div className="nw-fb-oldedge" />
          <div className="nw-fb-oldflicker" />
        </div>
        <div className="nw-fb-scratches" aria-hidden="true">
          <i />
        </div>
        <div className="nw-fb-film nw-fb-vintage" aria-hidden="true">
          <div className="nw-fb-grain" />
          <div className="nw-fb-lines" />
          <div className="nw-fb-flicker" />
        </div>
      </div>
    );
  },
);
export default FeedbackScene;
