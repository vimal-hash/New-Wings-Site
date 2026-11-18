# Section title lines (15 November 2026)

The user asked for one line of black, widely spaced capitals before each of the four sections, in the style of a film title card (their reference: the black-screen "AVENGERS | INFINITY WAR" card, inverted to black on white). Each line joins the section's cinema era to what the section is about. The user chose the words; they are **draft copy** and can be changed in one place.

| Section | Era | Line | Shown on |
| --- | --- | --- | --- |
| 1 Products | grainy black and white | THE TOOLS AND THEIR LIGHT | the white after the liquid sphere (the reel's opening white) |
| 2 About Us | clean black and white | WE MAKE IT CLEARER | About Us's white, after the green-red wormhole |
| 3 Team | vintage colour | PEOPLE BRING THE COLOUR (was COLOUR NEEDS HANDS until 18 November) | Section 3's white, after the blue wormhole |
| 4 Testimonials | HD | TODAY, THEATRES TRUST US | Section 4's white, after the yellow wormhole |

## Reel words (18 November)

From the story review (`docs/story-lines/README.md`): each line now has a small "REEL ONE" … "REEL FOUR" above it, so the four sections read as the reels of one film, and line III became PEOPLE BRING THE COLOUR. The reel word is the same Cinzel, `clamp(10px, .8vw, 18px)`, `.6em` tracking, ink `#121212b8`, centred over the line (it does not change the line's own centring). It comes up with the first letter over `TITLE.ink` (.75 s) and fades out with the line. Edit the words in `SECTION_REELS` (`title-card.tsx`), one per line in `SECTION_LINES`; `scripts/story-lines.test.mjs` keeps the two lists in step.

## History (all 15 November)

1. First version: the line shown with each section's arrival white, no animation of its own.
2. Second version: a timed card on the white each flight **leaves** from (before the wormhole), with the camera backing out of it. The user said this was a misunderstanding.
3. **Current**: the card is on each section's own white portal, the white you **arrive** in after the wormhole, just before the section shows. Leaving whites are back to their original plain state and timing (`section-flight.tsx` is the committed version again). The user also asked for a smoother, slower reveal, more space between letters and a slightly smaller size.

## The sequence on each section's white

From the moment the white is whole (the flight lands in it; for Section 1, when the reel's opening white starts):

1. **Letters write in** one after another, left to right, at an even pace; the last is whole at 2.8 s (`TITLE.write`). Each letter comes up over .75 s (`TITLE.ink`) on a soft ease (gentle start and end), so a few are always rising together and the line fills in smoothly. Opacity only: no movement, blur or glow.
2. **Hold**: the whole line stays still for 1 s (`TITLE.hold`).
3. **Fade**: the line fades into the white over .9 s (`TITLE.out`).
4. **The white opens onto the section** .45 s after the fade starts (`TITLE.lift`; `CARD_WAIT` = 4.25 s), using the existing 1.65 s lift. Section 1: the house lights start going down at the same point.

Measured on the running dev server (my own headless Chrome, 1920×940, real wheel input), ms from landing (Section 1: from the first letter):

| | all letters | line starts fading | white starts lifting / lights start | line gone | white half | white clear |
| --- | --- | --- | --- | --- | --- | --- |
| Line I (reel) | 2775 | 3895 | 4482 | 4602 | 5282 | – |
| Line II (About Us) | 2801 | 3921 | 4455 | 4628 | 5082 | 5775 |
| Line III (Team) | 2801 | 3921 | 4455 | 4628 | 5081 | 5776 |
| Line IV (Testimonials) | 2800 | 3921 | 4441 | 4628 | 5081 | 5775 |

So the line is gone while the white is still about 99% (the lift's quintic start), before the section shows through.

## Rules

- **Forwards only**, including opening a section directly or from the menu. Flying back up, the whites stay plain.
- **Input**: until the line has gone, a scroll down waits (it never skips the card; `cardUntil` in `normal-page.tsx`). Scrolling back up still turns back; the line fades with the white (.35 s) and the flight returns.
- The leaving whites (before each wormhole) have no line and their original timing.
- Line alone (no numeral, no divider), centred, one line on computers; balanced two lines on narrow screens.
- Non-AI look: no glow, blur, shadow, gradient or sliding letters. Plain ink colour `#121212`.
- Liquid sphere to the white page: `MORPH_SECONDS` 2 → 2.4 in `corridor-page.tsx` (same curve, a little slower, so it settles into the white more softly).
- Reduced motion: whites jump as before, so the line is not seen.

## Where

- `components/corridor/title-card.tsx`: `SECTION_LINES` (edit the words here), `TITLE` timings, `CARD_WAIT`, `cardStrength(seconds)`, the `TitleLine` element (one span per letter), `writeTitle(line, seconds)` and `showTitle(line, strength)`.
- `components/corridor/section-white.tsx` (Sections 3, 4): `line` prop; `reveal(done, titled)` runs the card and the white on one clock.
- `components/corridor/about-card.tsx` (Section 2): `line` prop (computers only); `reveal()` runs the card before the white lifts off the old film.
- `components/film-reel/film-reel.tsx` and `reel-motion.ts` (Section 1): `hold: CARD_WAIT`; `shot.held` is now seconds since the opening white began (until the lights are down), and the line uses `cardStrength(shot.held)`.
- `components/corridor/normal-page.tsx`: passes the lines, says which reveals are titled, and holds a scroll down during the card.

## Type

- Cinzel 600 via `next/font/google` (self-hosted at build time, no request to Google from the browser; free licence). `preload:false` so it never competes with the opening; `display:"block"` so a stand-in serif never shows.
- `font-size: clamp(15px, 2.1vw, 48px)` (was 2.45vw / 56px max), `letter-spacing: .46em` (was .3em) with the same `.46em` padded on the left so the line is truly centred, `word-spacing: .1em`. At 1920 px: 40 px type, 18.5 px between letters. At 390 px: 15 px, two balanced lines.

## Phones

Phones use native scrolling (no flights), so only Section 1's line appears there (on the reel's opening white).

## Checked (15 November 2026)

- Real runs on the user's dev server in my own headless Chrome, 1920×940, wheel input: all four lines (table above); a scroll down during line III did not skip it; a scroll up during line III took the line away with the white and flew back up plain.
- 390×844 phone emulation: line I in two balanced lines.
- `npx tsc --noEmit`, ESLint on the changed files, `scripts/film-reel-motion`, `blue-rope`, `yellow-rope`, `liquid-page` tests (21/21). Console: only the existing graphics-driver (ANGLE) warnings and the library's THREE.Clock notice.
- Not checked: the slower liquid-sphere morph in a browser (only its test), real phones/laptops, Safari/WebKit, the reduced-motion setting, screen readers (the line is decorative and hidden from them).

Backups, captures and revert: first version `D:/CodexOutputs/Section_Title_Cards_20261115/`; second (leaving-white) version `D:/CodexOutputs/Title_Card_Sequence_20261115/`; current `D:/CodexOutputs/Title_Card_Arrival_20261115/`.
