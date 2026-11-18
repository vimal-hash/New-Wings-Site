"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import TitleLine, { CARD_WAIT, cardStrength, showTitle, writeTitle } from "./title-card";

/**
 * The white portal on a section: arriving, the flight ends in white and it lifts off the section the way Section 1 is
 * revealed: .35 s of white, then 1.65 s on the same quintic ease, 2 s in all, as every section's portal; leaving upwards, it rises first so the flight back
 * starts from the same white. Section 2 has its own, tied to its film.
 * Arriving forwards (reveal with `titled`), the white first carries the section's title line: written, held, faded into
 * the white, and only then does it lift (CARD_WAIT instead of WAIT).
 */
// doneAt: how far the white has lifted (0 to 1, as seen) when `done` is called; 1, the default, is once it has gone.
export type WhiteHandle = {
  reveal(done: () => void, titled?: boolean, doneAt?: number): void;
  cover(done: () => void): void;
};
const WAIT = 0.35,
  LIFT = 1.65,
  COVER = 1.1;
// Held white is a hair short of solid (invisible): a solid layer hides the section so completely that the browser skips
// drawing it, and would then draw all of it for the first time on the first frame of the lift, which stutters. Just
// short of solid, the section is drawn while the white still holds still.
const HOLD = 0.998;
const smoother = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

// `line`: the section's title line, on this white only when reveal() asks for it (arriving forwards).
const SectionWhite = forwardRef<WhiteHandle, { covered?: boolean; line?: string }>(function SectionWhite(
  { covered = false, line },
  ref,
) {
  const node = useRef<HTMLDivElement>(null),
    title = useRef<HTMLParagraphElement>(null),
    frame = useRef(0),
    shown = useRef(0);
  const set = (value: number) => {
    if (node.current) node.current.style.opacity = value.toFixed(4);
  };
  const setLine = (value: number) => {
    if (value !== shown.current) {
      shown.current = value;
      showTitle(title.current, value);
    }
  };
  // One timed fade of the white (from, to, over seconds after a wait, on the quintic ease), then done. The title line runs
  // on the same clock: with `card` it is written from the start, held, then faded; otherwise whatever is shown goes in .35 s.
  const fade = (
    from: number,
    to: number,
    wait: number,
    seconds: number,
    done: () => void,
    card = false,
    doneAt = 1,
  ) => {
    cancelAnimationFrame(frame.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      set(to);
      setLine(0);
      done();
      return;
    }
    set(from);
    const start = performance.now(),
      lineFrom = shown.current;
    let called = false;
    const step = (now: number) => {
      const elapsed = (now - start) / 1000,
        t = (elapsed - wait) / seconds,
        eased = smoother(t);
      set(from + (to - from) * eased);
      if (card) {
        writeTitle(title.current, elapsed);
        setLine(cardStrength(elapsed));
      } else if (shown.current > 0) setLine(lineFrom * (1 - smoother(elapsed / 0.35)));
      if (!called && t > 0 && eased >= doneAt) {
        called = true;
        done();
      }
      if (t < 1) {
        frame.current = requestAnimationFrame(step);
        return;
      }
      frame.current = 0;
      if (!called) done();
    };
    frame.current = requestAnimationFrame(step);
  };
  useImperativeHandle(ref, () => ({
    reveal(done, titled = false, doneAt = 1) {
      fade(
        HOLD,
        0,
        titled && title.current ? CARD_WAIT : WAIT,
        LIFT,
        done,
        titled && !!title.current,
        doneAt,
      );
    },
    cover(done) {
      fade(Number(node.current?.style.opacity || 0), 1, 0, COVER, done);
    },
  }));
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  return (
    <div
      ref={node}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 5,
        background: "#fff",
        pointerEvents: "none",
        opacity: covered ? HOLD : 0,
      }}
    >
      {line ? <TitleLine ref={title} text={line} /> : null}
    </div>
  );
});
export default SectionWhite;
