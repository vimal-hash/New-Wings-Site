"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { createAboutFilm, wallStill, WALL, type AboutFilm } from "./about-film";
import { ropeFlightDevice } from "./effect-quality";
import TitleLine, { CARD_WAIT, cardStrength, showTitle, writeTitle } from "./title-card";

/**
 * Section 2, About Us. It is revealed from white, the way Section 1 is: the flight ends in a white portal, and the white
 * lifts off About Us while Section 1's old film already runs on it. Then the print is cleaned in front of the visitor
 * (about-film.ts). Once it is clean the card is left with a slow drift so it never looks frozen. One sharp-edged card,
 * clean black and white. Leaving upwards, the white rises over it again before the flight back.
 *
 * Only the live section owns the film layer. The flight's copies of this section are plain stills.
 */
export type AboutHandle = {
  /** Arriving from the white portal: white over the running film, the white lifts, then the print is cleaned. */
  reveal(): void;
  /** Leaving upwards: the white rises over the section, then done() (the flight back starts from white). */
  cover(done: () => void): void;
  /** Arriving back from below in white: only the white lifts. */
  uncover(): void;
  play(): void;
  wait(): void;
  clean(): void;
  idle(): void;
  waiting(): boolean;
  root: HTMLElement | null;
};
type Start = "wait" | "reveal" | "clean";

// Every section's portal: .35 s of white, then 1.65 s for the white to lift (2 s in all), on the same quintic ease.
const REVEAL = { wait: 0.35, lift: 1.65 },
  COVER = 1.1;
const smoother = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

// The card's own styles travel with it (React hoists this once into the head), so it never depends on the global sheet.
const CSS = `
.nw-about{position:absolute;inset:0;overflow:hidden;background:${WALL} var(--nw-about-wall,none) center/100% 100% no-repeat}
.nw-about[data-live]{background-image:none} /* the live section draws its lights itself */
.nw-about-stage{position:absolute;inset:-8px;display:grid;place-items:center;padding:24px}
.nw-about-film{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1}
.nw-about-white{position:absolute;inset:0;background:#fff;pointer-events:none;z-index:2;opacity:0}
.nw-about-frame{position:relative;display:grid;grid-template-rows:auto 1fr;gap:clamp(18px,3vh,32px);box-sizing:border-box;width:min(76vw,100%,(100dvh - 96px)*1.85);aspect-ratio:1.85/1;padding:clamp(60px,8.6vw,160px);color:#0e0e0e;
  background:radial-gradient(120% 95% at 50% 42%,#f6f6f4 0%,#ececea 46%,#d6d6d3 82%,#c9c9c6 100%)}
.nw-about-label{font:500 11px/1.4 var(--font-geist-mono),monospace;letter-spacing:.18em;text-transform:uppercase;color:#4a4a48}
.nw-about-copy{--intro-size:clamp(18px,2.15vw,32px);align-self:end;display:grid;gap:clamp(14px,2vh,24px)}
.nw-about-intro{max-width:28em;margin:0;font:400 var(--intro-size)/1.4 var(--font-read),sans-serif;text-wrap:balance}
.nw-about-line{align-self:end;max-width:20em;margin:0;font:400 calc(var(--intro-size) + 10px)/1.06 var(--font-brand),sans-serif;letter-spacing:-.015em;text-wrap:balance}
@media (max-aspect-ratio:1/1){.nw-about-frame{width:100%;aspect-ratio:auto;min-height:min(68vh,620px)}}
@media (max-width:600px),(max-height:560px){.nw-about-frame{padding:clamp(18px,5vmin,36px)}}
@media (orientation:landscape) and (max-height:560px){.nw-about-frame{width:min(90vw,100%,(100dvh - 64px)*1.85)}}
/* Afterwards the whole frame drifts a couple of pixels, slowly, so it is never frozen. */
.nw-about-stage[data-drift="on"]{animation:nw-about-drift 18s ease-in-out infinite}
@keyframes nw-about-drift{0%,100%{transform:none}25%{transform:translate(2px,-1.5px)}50%{transform:translate(.5px,-2.5px)}75%{transform:translate(-2px,-1px)}}
@media (prefers-reduced-motion:reduce){.nw-about-stage[data-drift]{animation:none}}
`;

// `line`: the section's title line on the white, written by reveal() (arriving forwards), never flying back up.
const AboutCard = forwardRef<AboutHandle, { live?: boolean; start?: Start; line?: string }>(
  function AboutCard({ live = false, start = "clean", line }, ref) {
    const root = useRef<HTMLDivElement>(null),
      stage = useRef<HTMLDivElement>(null),
      frame = useRef<HTMLDivElement>(null),
      canvas = useRef<HTMLCanvasElement>(null);
    const white = useRef<HTMLDivElement>(null),
      title = useRef<HTMLParagraphElement>(null),
      shown = useRef(0),
      fade = useRef(0);
    const film = useRef<AboutFilm | null>(null),
      first = useRef(start);
    const settle = (drift: boolean) => {
      if (stage.current) stage.current.dataset.drift = drift ? "on" : "off";
    };
    const setWhite = (value: number) => {
      if (white.current) white.current.style.opacity = value >= 1 ? "1" : value <= 0 ? "" : value.toFixed(4);
    };
    const setLine = (value: number) => {
      if (value !== shown.current) {
        shown.current = value;
        showTitle(title.current, value);
      }
    };
    const stopFade = () => {
      cancelAnimationFrame(fade.current);
      fade.current = 0;
      if (shown.current > 0) setLine(0);
    };
    // One timed fade of the white: from, to, over seconds after a wait, on the quintic ease; then done. The title line runs
    // on the same clock: with `card` it is written from the start, held, then faded; otherwise whatever is shown goes in .35 s.
    const fadeWhite = (
      from: number,
      to: number,
      wait: number,
      seconds: number,
      done: () => void,
      card = false,
    ) => {
      const lineFrom = shown.current;
      cancelAnimationFrame(fade.current);
      fade.current = 0;
      setWhite(from);
      const start = performance.now();
      const step = (now: number) => {
        const elapsed = (now - start) / 1000,
          t = (elapsed - wait) / seconds;
        setWhite(from + (to - from) * smoother(t));
        if (card) {
          writeTitle(title.current, elapsed);
          setLine(cardStrength(elapsed));
        } else if (shown.current > 0) setLine(lineFrom * (1 - smoother(elapsed / 0.35)));
        if (t < 1) {
          fade.current = requestAnimationFrame(step);
          return;
        }
        fade.current = 0;
        done();
      };
      fade.current = requestAnimationFrame(step);
    };
    const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const handle = useRef<AboutHandle | null>(null);
    useImperativeHandle(ref, () => {
      const made: AboutHandle = {
        reveal() {
          if (!film.current || reduced()) {
            stopFade();
            setWhite(0);
            made.play();
            return;
          }
          // The white portal: Section 1's old film already runs under the white, then the white lifts and the print is cleaned.
          // With a title line, the white first carries it: written, held and faded, then it lifts.
          settle(false);
          film.current.idle();
          if (title.current) fadeWhite(1, 0, CARD_WAIT, REVEAL.lift, () => made.play(), true);
          else fadeWhite(1, 0, REVEAL.wait, REVEAL.lift, () => made.play());
        },
        cover(done) {
          if (reduced()) {
            stopFade();
            setWhite(1);
            done();
            return;
          }
          fadeWhite(Number(white.current?.style.opacity || 0), 1, 0, COVER, done);
        },
        // Flying back up from Section 3: the flight lands in this white, which lifts the same way; the print stays clean.
        uncover() {
          if (reduced()) {
            stopFade();
            setWhite(0);
            return;
          }
          fadeWhite(1, 0, REVEAL.wait, REVEAL.lift, () => {});
        },
        play() {
          stopFade();
          setWhite(0);
          if (film.current) {
            settle(false);
            film.current.play();
          } else settle(true);
        },
        wait() {
          stopFade();
          settle(false);
          film.current?.wait();
        },
        clean() {
          stopFade();
          setWhite(0);
          film.current?.clean();
          settle(true);
        },
        idle() {
          settle(false);
          film.current?.idle();
        },
        waiting: () => film.current?.mode() === "wait" || film.current?.mode() === "idle",
        get root() {
          return root.current;
        },
      };
      handle.current = made;
      return made;
    });
    useEffect(() => {
      if (!live || !canvas.current || !frame.current) return;
      // The flight's copies of this section have no film: give them a still of the same corner lights.
      if (ropeFlightDevice() !== "mobile") {
        const still = wallStill(
          320,
          Math.max(90, Math.round((320 * window.innerHeight) / Math.max(1, window.innerWidth))),
        );
        if (still) document.documentElement.style.setProperty("--nw-about-wall", `url("${still}")`);
      }
      const made = createAboutFilm(canvas.current, frame.current, () => {
        if (stage.current) stage.current.dataset.drift = "on";
      });
      film.current = made;
      if (first.current === "reveal") handle.current?.reveal();
      else if (made && first.current === "wait") {
        settle(false);
        made.wait();
      } else {
        made?.clean();
        settle(true);
      }
      return () => {
        cancelAnimationFrame(fade.current);
        made?.dispose();
        film.current = null;
      };
    }, [live]);
    return (
      <div ref={root} className="nw-about" data-live={live || undefined}>
        <style href="nw-about-card" precedence="default">
          {CSS}
        </style>
        <div ref={stage} className="nw-about-stage">
          <div ref={frame} className="nw-about-frame">
            <span className="nw-about-label">About us</span>
            <div className="nw-about-copy">
              <p className="nw-about-intro">
                New Wings Solutions designs and fits out theatres for cinema owners. We plan the interior,
                fit the seats and bring the screen, projector, sound and 3D systems together.
              </p>
              <p className="nw-about-line">
                We make the kind of theatre people choose before they’ve even picked a film.
              </p>
            </div>
          </div>
          {live ? <canvas ref={canvas} className="nw-about-film" aria-hidden="true" /> : null}
        </div>
        {live ? (
          <div ref={white} className="nw-about-white" aria-hidden="true">
            {line ? <TitleLine ref={title} text={line} /> : null}
          </div>
        ) : null}
      </div>
    );
  },
);
export default AboutCard;
