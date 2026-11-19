"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/**
 * Section 3, About the Owner: the era of early colour and wide-screen. A dull, faded colour picture in the brand's
 * colours, lit like a projection and not printed like a card. On arrival it retells the story so far, on one smooth
 * timeline: Section 1's old film (dim black and white, heavy grain, scratches, flicker, dark edges, a little shake) is
 * cleaned to Section 2's bright, crisp black and white, held a moment, then colour soaks in (1 s each). In colour the picture
 * holds still; only a quiet grain and two faint lines remain.
 *
 * Film layers over the words only ever darken and white scratches run beneath the words, so no light can land on the
 * text. Only the live section runs them; the flight's copies of this section are plain stills in colour.
 */
export type OwnerHandle = {
  open(hold?: number): void;
  close(): void;
  run(on: boolean): void;
  root: HTMLElement | null;
};
/** old: the old film, waiting to be played. play: play on mount. done: already in colour. */
type Start = "old" | "play" | "done";

// Seconds from open(). Each step ends before the next begins. The user asked for each era to be on screen for 1 s, joined
// by 1 s soft blends (the quintic ease starts and ends at rest): Section 1's old film, blend 1 s, Section 2's clean black
// and white 1 s, blend 1 s, then Section 3's colour stays. Was 1 / 2 / 1.2 / 3 (7.2 s).
// OLD_HOLD is the old film's hold when nothing else shows it (phones, scrolled into view). Arriving through the white
// portal, the page passes a shorter hold: the old film is already seen through the lifting white.
const OLD_HOLD = 1,
  CLEANING = 1,
  CALM = 1,
  COLOURING = 1;
const SHAKE = 0.6; // px at most, at full old film (the user found more too much)
const smoother = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const wobble = (n: number, seed: number) => {
  const s = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453;
  return s - Math.floor(s) - 0.5;
};

/** The dark wall around the picture. */
export const OWNER_WALL = "#0e0b09";

// --old and --colour (0..1) drive every film layer and the black-and-white; the timeline sets them on the root.
const CSS = `
.nw-owner{--h:min(100dvh - 96px,(100vw - 48px)/2.39);--cols:1fr calc(var(--h)*.6) 1fr;--old:0;--colour:1;position:absolute;inset:0;display:grid;place-items:center;overflow:hidden;background:${OWNER_WALL}}
.nw-owner[data-era="old"]{--old:1;--colour:0}
.nw-owner::after{content:"";position:absolute;inset:0;pointer-events:none;background:var(--nw-owner-grain,none);mix-blend-mode:multiply;opacity:.5}
.nw-owner-stage{position:relative;width:calc(var(--h)*2.39);height:var(--h);filter:grayscale(calc(1 - var(--colour))) contrast(calc(1 + (1 - var(--colour))*(.3 - .15*var(--old)))) brightness(calc(1 + (1 - var(--colour))*(.08 - .28*var(--old))))}
.nw-owner[data-era="colour"] .nw-owner-stage{filter:none}
.nw-owner-spill{position:absolute;inset:-16% -5%;background:radial-gradient(closest-side,rgba(176,134,96,.34),rgba(126,96,76,.14) 66%,transparent)}
.nw-owner-frame{position:absolute;inset:0;overflow:hidden}
.nw-owner-picture{position:absolute;inset:-3px}
.nw-owner-blocks{position:absolute;inset:0;background:#c4a461}
/* Red meets yellow on one straight line through the portrait. */
.nw-owner-blocks::after{content:"";position:absolute;inset:0 0 0 50%;background:#a05848}
.nw-owner-circle{position:absolute;z-index:1;left:50%;top:50%;width:calc(var(--h)*.74);height:calc(var(--h)*.74);transform:translate(-50%,-50%);border-radius:50%;overflow:hidden;background:#6b8c92}
.nw-owner-circle svg{position:absolute;inset:18% 0 0;width:100%;height:82%;fill:#527078}
.nw-owner-words{position:absolute;inset:0;display:grid;grid-template-columns:var(--cols)}
.nw-owner-hot,.nw-owner-lamp{position:absolute;pointer-events:none}
.nw-owner-hot{inset:0;mix-blend-mode:screen;background:radial-gradient(46% 72% at 50% 46%,rgba(255,238,206,.26),rgba(255,238,206,0) 100%)}
.nw-owner-lamp{inset:0;background:radial-gradient(74% 104% at 50% 47%,rgba(12,9,7,0) 38%,rgba(12,9,7,.5) 100%)}
.nw-owner-side{box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;padding:calc(var(--h)*.07)}
.nw-owner-name{color:#231a10}
.nw-owner-note{color:#f1e6cf;justify-content:flex-end;padding-left:calc(var(--h)*.27)}
.nw-owner-label{font:500 11px/1.4 var(--font-geist-mono),monospace;letter-spacing:.18em;text-transform:uppercase}
.nw-owner-title{margin:0;font:400 calc(var(--h)*.125)/1 var(--font-brand),sans-serif;letter-spacing:-.015em}
.nw-owner-text{margin:0;font-size:max(15px,calc(var(--h)*.036));line-height:1.3}
/* Each film is one blended layer that fades as a whole; its parts animate inside it. */
.nw-owner-film,.nw-owner-scratches{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.nw-owner-film{mix-blend-mode:multiply;background:#fff}
.nw-owner-scratches{mix-blend-mode:screen;background:#000}
.nw-owner-old,.nw-owner-scratches{opacity:var(--old)}
.nw-owner-now{opacity:var(--colour)}
.nw-owner-film>*,.nw-owner-scratches>*{position:absolute}
.nw-owner-scratches i{inset:0;background:linear-gradient(90deg,transparent 12%,#c8c8c8 12%,#c8c8c8 calc(12% + 1px),transparent calc(12% + 1px),transparent 44%,#fff 44%,#fff calc(44% + 1px),transparent calc(44% + 1px),transparent 71%,#a8a8a8 71%,#a8a8a8 calc(71% + 1px),transparent calc(71% + 1px),transparent 89%,#e0e0e0 89%,#e0e0e0 calc(89% + 1px),transparent calc(89% + 1px))}
.nw-owner-oldgrain{inset:-192px;background:var(--nw-owner-grain,none);opacity:.8}
.nw-owner-oldedge{inset:0;background:radial-gradient(80% 95% at 50% 50%,transparent 45%,#3a3a3a 100%)}
.nw-owner-oldflicker{inset:0;background:#000;opacity:.1}
.nw-owner-flicker{inset:0;background:#0a0705;opacity:.04}
.nw-owner-grain{inset:-192px;background:var(--nw-owner-grain,none);opacity:.18}
.nw-owner-lines{inset:0;opacity:.3;background:linear-gradient(90deg,transparent 19%,#6b5a4a 19%,#6b5a4a calc(19% + 1px),transparent calc(19% + 1px),transparent 67%,#7d6c5c 67%,#7d6c5c calc(67% + 1px),transparent calc(67% + 1px))}
.nw-owner[data-run]:not([data-era="colour"]) .nw-owner-oldgrain{animation:nw-owner-grain .36s steps(1) infinite}
.nw-owner[data-run]:not([data-era="colour"]) .nw-owner-oldflicker{animation:nw-owner-oldflicker .29s steps(1) infinite}
.nw-owner[data-run]:not([data-era="colour"]) .nw-owner-scratches i{animation:nw-owner-lines 1.1s steps(1) infinite}
.nw-owner[data-run] .nw-owner-grain{animation:nw-owner-grain .5s steps(1) infinite}
.nw-owner[data-run] .nw-owner-lines{animation:nw-owner-drift 7s steps(1) infinite}
.nw-owner[data-run] .nw-owner-flicker{animation:nw-owner-flicker .46s steps(1) infinite}
@keyframes nw-owner-oldflicker{0%{opacity:.06}25%{opacity:.18}50%{opacity:.03}75%{opacity:.14}}
@keyframes nw-owner-grain{0%{transform:translate(0,0)}17%{transform:translate(-71px,43px)}33%{transform:translate(38px,-97px)}50%{transform:translate(-113px,-29px)}67%{transform:translate(89px,67px)}83%{transform:translate(-23px,121px)}}
@keyframes nw-owner-lines{0%{transform:translateX(0);opacity:.45}21%{transform:translateX(5px);opacity:.22}38%{transform:translateX(-9px);opacity:.5}62%{transform:translateX(14px);opacity:.28}83%{transform:translateX(-4px);opacity:.45}}
@keyframes nw-owner-drift{0%{transform:translateX(0);opacity:.3}25%{transform:translateX(2px);opacity:.2}50%{transform:translateX(1px);opacity:.32}75%{transform:translateX(-1px);opacity:.24}}
@keyframes nw-owner-flicker{0%{opacity:.03}20%{opacity:.08}40%{opacity:.02}60%{opacity:.1}80%{opacity:.05}}
@media (max-aspect-ratio:1/1){
  .nw-owner{--h:min(100dvh - 48px,(100vw - 32px)*1.6)}
  .nw-owner-stage{width:calc(var(--h)/1.6)}
  .nw-owner-words{grid-template-columns:1fr;grid-template-rows:1fr .8fr 1fr}
  .nw-owner-blocks::after{inset:50% 0 0}
  .nw-owner-circle{width:calc(var(--h)*.32);height:calc(var(--h)*.32)}
  .nw-owner-title{font-size:calc(var(--h)*.075)}
  .nw-owner-note{padding-left:calc(var(--h)*.05)}
}
@media (prefers-reduced-motion:reduce){.nw-owner *{animation:none!important}}
`;

const OwnerCard = forwardRef<OwnerHandle, { live?: boolean; start?: Start }>(function OwnerCard(
  { live = false, start = "done" },
  ref,
) {
  const root = useRef<HTMLDivElement>(null),
    picture = useRef<HTMLDivElement>(null),
    first = useRef(start),
    api = useRef<OwnerHandle | null>(null);
  const clock = useRef({ frame: 0, playing: false, start: 0, hold: OLD_HOLD, shot: -1 });
  useImperativeHandle(ref, () => {
    const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const still = () => {
      const c = clock.current;
      cancelAnimationFrame(c.frame);
      c.frame = 0;
      if (picture.current) picture.current.style.translate = "";
    };
    const finish = () => {
      clock.current.playing = false;
      still();
      const el = root.current;
      if (!el) return;
      el.dataset.era = "colour";
      el.style.removeProperty("--old");
      el.style.removeProperty("--colour");
    };
    // One clock for the old film's shake and, once played, the whole old → clean → colour timeline.
    const tick = (now: number) => {
      const c = clock.current,
        el = root.current;
      c.frame = 0;
      if (!el || el.dataset.run === undefined || el.dataset.era !== "old") return;
      let old = 1;
      if (c.playing) {
        const t = (now - c.start) / 1000;
        if (t >= c.hold + CLEANING + CALM + COLOURING) {
          finish();
          return;
        }
        old = 1 - smoother((t - c.hold) / CLEANING);
        el.style.setProperty("--old", old.toFixed(4));
        el.style.setProperty("--colour", smoother((t - c.hold - CLEANING - CALM) / COLOURING).toFixed(4));
      }
      const shot = Math.floor(now * 0.012); // a new shake position 12 times a second, fading with the old film
      if (shot !== c.shot && picture.current) {
        c.shot = shot;
        const a = reduced() ? 0 : SHAKE * 2 * old;
        picture.current.style.translate =
          a > 0.02 ? `${(a * wobble(shot, 1)).toFixed(2)}px ${(a * wobble(shot, 2)).toFixed(2)}px` : "";
      }
      c.frame = requestAnimationFrame(tick);
    };
    const run = (on: boolean) => {
      const el = root.current;
      if (!el) return;
      if (!on) {
        delete el.dataset.run;
        still();
        return;
      }
      el.dataset.run = "";
      if (!clock.current.frame) clock.current.frame = requestAnimationFrame(tick);
    };
    const made: OwnerHandle = {
      run,
      // Starts the timeline; `hold`: seconds of old film before it is cleaned. Coming back to a section already in colour,
      // nothing replays.
      open(hold = OLD_HOLD) {
        run(true);
        const el = root.current,
          c = clock.current;
        if (!el || el.dataset.era !== "old" || c.playing) return;
        if (reduced()) {
          finish();
          return;
        }
        c.playing = true;
        c.hold = hold;
        c.start = performance.now();
      },
      close() {
        clock.current.playing = false;
        run(false);
        const el = root.current;
        if (!el) return;
        el.dataset.era = "old";
        el.style.removeProperty("--old");
        el.style.removeProperty("--colour");
      },
      get root() {
        return root.current;
      },
    };
    api.current = made;
    return made;
  });
  useEffect(() => {
    const c = clock.current;
    return () => {
      cancelAnimationFrame(c.frame);
      c.frame = 0;
    }; // cleared, so a remount (React's dev double mount) can start it again
  }, []);
  useEffect(() => {
    if (!live) return;
    // One small tile of grain, shared with the flight's copies. Light grey to white, so under multiply it can only darken.
    const tile = document.createElement("canvas");
    tile.width = tile.height = 192;
    const paint = tile.getContext("2d");
    // The page-wide variable holds a short blob link, not the picture itself: a long data text in a variable is read
    // again every time a grain layer is restyled, which cost frames on slower computers during the yellow flight.
    let link = "",
      gone = false;
    if (paint) {
      const image = paint.createImageData(192, 192);
      for (let i = 0; i < image.data.length; i += 4) {
        const v = 165 + Math.random() * 90;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
        image.data[i + 3] = 255;
      }
      paint.putImageData(image, 0, 0);
      tile.toBlob((blob) => {
        if (!blob || gone) return;
        link = URL.createObjectURL(blob);
        document.documentElement.style.setProperty("--nw-owner-grain", `url("${link}")`);
      }, "image/png");
    }
    const wait = first.current === "play" ? requestAnimationFrame(() => api.current?.open()) : 0; // after one painted frame, so the old film is seen first
    return () => {
      gone = true;
      cancelAnimationFrame(wait);
      if (link) {
        document.documentElement.style.removeProperty("--nw-owner-grain");
        URL.revokeObjectURL(link);
      }
    };
  }, [live]);
  return (
    <div
      ref={root}
      className="nw-owner"
      data-live={live || undefined}
      data-era={start === "done" ? "colour" : "old"}
    >
      <style href="nw-owner-card" precedence="default">
        {CSS}
      </style>
      <div className="nw-owner-stage">
        <div className="nw-owner-spill" aria-hidden="true" />
        <div className="nw-owner-frame">
          <div ref={picture} className="nw-owner-picture">
            <div className="nw-owner-blocks" aria-hidden="true">
              <div className="nw-owner-circle">
                <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMax meet">
                  <circle cx="50" cy="38" r="17" />
                  <path d="M12 100c0-26 17-42 38-42s38 16 38 42z" />
                </svg>
              </div>
            </div>
            <div className="nw-owner-hot" aria-hidden="true" />
            <div className="nw-owner-lamp" aria-hidden="true" />
            <div className="nw-owner-scratches" aria-hidden="true">
              <i />
            </div>
            {/* Placeholders until the team's own names, portrait and words arrive; the note is a draft to confirm. */}
            <div className="nw-owner-words">
              <div className="nw-owner-side nw-owner-name">
                <span className="nw-owner-label">New Wings Solutions</span>
                <h2 className="nw-owner-title">The team</h2>
              </div>
              <div />
              <div className="nw-owner-side nw-owner-note">
                <p className="nw-owner-text">
                  The people who plan, fit and tune each room, and care how every film looks and sounds. Names
                  and faces coming soon.
                </p>
              </div>
            </div>
            <div className="nw-owner-film nw-owner-old" aria-hidden="true">
              <div className="nw-owner-oldgrain" />
              <div className="nw-owner-oldedge" />
              <div className="nw-owner-oldflicker" />
            </div>
            <div className="nw-owner-film nw-owner-now" aria-hidden="true">
              <div className="nw-owner-grain" />
              <div className="nw-owner-lines" />
              <div className="nw-owner-flicker" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
export default OwnerCard;
