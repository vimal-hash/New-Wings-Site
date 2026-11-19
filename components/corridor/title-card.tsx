"use client";
import { forwardRef } from "react";
import { Cinzel } from "next/font/google";

/**
 * One line of black, widely spaced capitals, set like a film's title card, on the white the visitor arrives in just
 * before each section: the white after the liquid sphere (Section 1), then the white each wormhole ends in (Sections 2-4).
 * With the white whole, the line writes itself in, letter by letter, left to right, slowly and evenly (TITLE.write seconds),
 * holds whole (TITLE.hold), then fades into the white (TITLE.out) before the white opens onto the section.
 *
 * Draft copy for the client to confirm: each line joins the section's cinema era to what the section is about.
 */
export const SECTION_LINES = [
  "THE TOOLS AND THEIR LIGHT", // Section 1, Products: grainy black and white, the first light through film
  "WE MAKE IT CLEARER", // Section 2, About Us: clean black and white
  "PEOPLE BRING THE COLOUR", // Section 3, Team: vintage colour (was "COLOUR NEEDS HANDS")
  "TODAY, THEATRES TRUST US", // Section 4, Testimonials: HD
] as const;

/** The small reel number over each line: the four sections are the four reels of one film. */
export const SECTION_REELS = ["REEL ONE", "REEL TWO", "REEL THREE", "REEL FOUR"] as const;

/** Seconds. write: first letter starts to last letter whole. ink: one letter coming up. hold: the whole line, still.
 * out: the line fading into the white. lift: on a section's white, how long after the line starts fading the white
 * starts lifting off the section (so the line is all but gone before the section shows through). */
export const TITLE = { write: 2.8, ink: 0.75, hold: 1, out: 0.9, lift: 0.45 };

/** Seconds a section's white holds, from arriving, before it lifts: the line written, held, and half faded. */
export const CARD_WAIT = TITLE.write + TITLE.hold + TITLE.lift;

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const smoother = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** The line's strength `seconds` after its white arrived: whole while it is written and held, then fading into the white. */
export const cardStrength = (seconds: number) =>
  1 - smoother((seconds - TITLE.write - TITLE.hold) / TITLE.out);

// Self-hosted at build time (no request to Google). Not preloaded: the line is first needed long after the opening, and
// the hidden line is laid out when the page mounts, which loads the font by itself. "block": never a stand-in serif.
// Weight 600: matched side by side against the film's title card (black on white reads thinner than white on black).
// Loaded once here; the end page's closing line uses the same font object (diagonal-section.tsx).
export const cinzel = Cinzel({ subsets: ["latin"], weight: "600", display: "block", preload: false });

// Letter-spacing also follows the last letter; the same space on the left keeps the line truly centred.
// Letters start unseen; writeTitle() brings each one up. No movement, blur or glow: only ink coming up on the page.
// The reel number sits above the line without moving it (the line stays exactly where it was), small and a little lighter.
const CSS = `
.nw-title-line{position:absolute;inset:0;margin:0;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:0 6vw 1.2vh;pointer-events:none;user-select:none;visibility:hidden}
.nw-title-line>span{position:relative;display:block;max-width:100%;padding-left:.46em;font-size:clamp(15px,2.1vw,48px);font-weight:600;line-height:1.7;letter-spacing:.46em;word-spacing:.1em;color:#121212;text-align:center;text-wrap:balance;font-kerning:normal;font-variant-ligatures:none}
.nw-title-line [data-letter],.nw-title-line [data-reel]{opacity:0}
.nw-title-reel{position:absolute;left:50%;bottom:100%;transform:translateX(-50%);margin-bottom:.5em;padding-left:.6em;font-size:clamp(10px,.8vw,18px);line-height:1;letter-spacing:.6em;word-spacing:0;color:#121212b8;white-space:nowrap}
`;

const TitleLine = forwardRef<HTMLParagraphElement, { text: string }>(function TitleLine({ text }, ref) {
  const reel = SECTION_REELS[(SECTION_LINES as readonly string[]).indexOf(text)];
  return (
    <p ref={ref} className="nw-title-line" aria-hidden="true">
      <style href="nw-title-line" precedence="default">
        {CSS}
      </style>
      <span className={cinzel.className}>
        {reel ? (
          <span className="nw-title-reel" data-reel="">
            {reel}
          </span>
        ) : null}
        {[...text].map((letter, index) =>
          letter === " " ? (
            <span key={index}> </span>
          ) : (
            <span key={index} data-letter="">
              {letter}
            </span>
          ),
        )}
      </span>
    </p>
  );
});
export default TitleLine;

/**
 * The line as it is `seconds` after it started writing: letters come up one after another, evenly spaced, each over
 * TITLE.ink seconds on a gentle ease (soft to start, soft to settle), so a few are always coming up together and the line
 * fills in smoothly from left to right; the last is whole at TITLE.write. Driven by its owner's own clock, so it stays in
 * step with that scene. Infinity: all written.
 */
export function writeTitle(line: HTMLElement | null, seconds: number) {
  if (!line) return;
  // Each time a line starts to write, the theme hears of it (theme-sound.ts: the sections' music starts here).
  if (seconds > 0 && line.dataset.cued !== "1") {
    line.dataset.cued = "1";
    window.dispatchEvent(new Event("nw:title"));
  } else if (seconds <= 0 && line.dataset.cued) delete line.dataset.cued;
  const letters = line.querySelectorAll<HTMLElement>("[data-letter]"),
    gap = (TITLE.write - TITLE.ink) / Math.max(letters.length - 1, 1);
  letters.forEach((letter, index) => {
    const value = Math.round(smooth((seconds - index * gap) / TITLE.ink) * 1000) / 1000;
    if (Number(letter.style.opacity || 0) !== value) letter.style.opacity = String(value); // only letters that changed
  });
  // The reel number comes up whole, with the first letter.
  const reel = line.querySelector<HTMLElement>("[data-reel]");
  if (reel) {
    const value = Math.round(smooth(seconds / TITLE.ink) * 1000) / 1000;
    if (Number(reel.style.opacity || 0) !== value) reel.style.opacity = String(value);
  }
}

/** Shows the line at this strength (0 hidden), without a render: its owners run on requestAnimationFrame. */
export function showTitle(line: HTMLElement | null, strength: number) {
  if (!line) return;
  const value = Math.min(1, Math.max(0, strength));
  line.style.visibility = value > 0 ? "visible" : "hidden";
  line.style.opacity = value >= 1 ? "" : value.toFixed(4);
}
