# Story lines (18 November 2026)

After a talk-only story review from the Awwwards point of view, I proposed eight small changes so the site reads as one story from start to end: a dark theatre, the light (projector), the room (corridor drawings), the lamp and screen (liquid sphere and white), four reels (the sections), the brand, and the lights coming back up. The user said: "Except 5. Start all(1, 2, 3, 4, 6, 7,8). Start coding". Change 5 (a small cue dot before each wormhole) was **not** built.

All lines are plain words in the existing corner card, title cards, film frames and end page. Same look as before: no glow, blur or new effects.

| # | Where | Before | Now |
| --- | --- | --- | --- |
| 1 | Corner card at the projector stop | Put together, it sends one clean beam to the screen. | **Now it needs a room.** (hint: Scroll on) |
| 2 | Corner card during the corridor walk (new) | none | **Before a seat goes in, we draw the whole room.** (no hint, the camera is walking) |
| 3 | Corner card at the liquid sphere (new) | none | **The lamp is warm. The screen is waiting.** (no hint) |
| 4 | Title cards | the line alone | small **REEL ONE … REEL FOUR** above each line; line III **PEOPLE BRING THE COLOUR** (was COLOUR NEEDS HANDS) |
| 6 | Film frames (Section 1) | name only | one short line under each name (below) |
| 7 | Corner card at the final eye | Every light we place and every seat we fit serves one thing: the story. | **We fit the screen, the sound and the seats. The film does the rest.** (hint: Scroll on) |
| 8 | End page (the white after the eye) | logo and artwork only | **LIGHTS UP. YOUR THEATRE IS NEXT.** and a **Plan your theatre** button that opens the enquiry form with "A complete theatre" chosen |

Film frame lines (`FILM_PRODUCTS[].line`):

| Frame | Product | Line |
| --- | --- | --- |
| 1 | Theatre Screen | Where the light lands. |
| 2 | Projector & Lamp | The light starts here, behind your head. |
| 3 | Sound System | So a whisper reaches the back row. |
| 4 | Interior Design and Theatre Chairs | Two hours should feel short. |
| 5 | 3D Glasses | Light enough to forget you have them on. |
| 6 | 3D System | The picture steps off the screen. |

## How it works

- **Corner card** (`components/corridor/story-caption.tsx`): new `corridor` and `lamp` chapters with no hint. Phases `screens` and `corridor` show the corridor line until `liquidInView`, then the lamp line, which stays through `panel` (the liquid morph) and goes when the white page comes (`page`). Walking back (`leavingPage`) shows nothing. The card is re-keyed per chapter, so each line slides in with the existing animation.
- **When the lamp line starts** (`components/corridor/full-journey.tsx`, `LIQUID_IN_VIEW = 0.87` of the walk's eased second leg; flag `liquidInView` in `journey-controls.ts`, published only when it changes): at the moment a wall fills the view and the drawings are behind (desktop 4.26 s after the step), just before the sphere shows (about 4.5 s). A first try at .45 switched while the drawings were still on screen.
- **Title cards** (`components/corridor/title-card.tsx`): `SECTION_REELS` beside `SECTION_LINES`; the reel word fades in with the first letter and out with the line. See `docs/section-title-lines/README.md`. `cinzel` is exported so the end page shares the one font load.
- **Film frames** (`components/film-reel/film-data.ts`, `film-content.ts`, `film-reel.tsx`): the line is drawn at 40 px, `#aeaca6`, under the rule on the 1400×320 text strip (about 13–14 px on screen at 1920 wide); screen readers hear it in the frame's live text and the product list.
- **End page** (`components/corridor/diagonal-section.tsx`, `.end-call` in `app/globals.css`): comes up 1.2 s after the artwork's entrance starts, over 1 s (`.brand-artwork[data-revealed="true"] ~ .end-call`), and fades in .5 s when the white sweeps back out. It never moves with the mouse (no lens depth, no repel). The button has `data-cinema-controls`, so the site's scroll-step rule leaves it alone. Placement:
  - Computers: under the logo, `clamp(18px, 3.8vh, 44px)` below it, one line.
  - Short laptop screens (min width 700, max height 820): 18 px under the logo, 10 px gap, 42 px button, so it stays clear of the drawings under the words.
  - Phones (max width 699): above the logo, 26 px clear of it, line on two rows (LIGHTS UP. / YOUR THEATRE IS NEXT.), because below the logo the stacked words and drawings reach the contact bar.
  - Landscape phones (max height 500): line and button side by side, centred between the logo and the contact bar.

## Checked (18 November 2026, my headless Chrome on my own dev preview, port 3100)

- Desktop 1920×947 walk, one notch from the projector: corridor line 0.03 s, lamp line 4.26 s, liquid morph 5.16 s, white page (no card) 7.57 s. Phone 390×844 swipe: 0.00 / 3.70 / 4.72 / 7.06 s.
- Title cards: REEL ONE to REEL FOUR on computers; phones show only line I, with REEL ONE.
- Frames 1 and 4 (longest name) read cleanly on desktop and phone.
- End page, nothing within 16 px except tiny background star specks: 1920×947, 1536×864, 1366×768, 1280×720 (button was 6 px from the screen drawing before the short-screen rule), 2560×1440, 768×1024, 1024×768, phones 390×844, 360×780, 375×667, 412×915. Landscape 844×390 and 932×430: the row is 9 px from the logo and the contact bar; the button touches the top of the spotlight drawing by about 5 px.
- The button opens the enquiry form with "A complete theatre" chosen; Escape closes it; a step back sweeps the white out and the line and button go with it.
- 227 tests pass (new `scripts/story-lines.test.mjs`), `npx tsc --noEmit` clean. Console: only the existing THREE notices.
- Not checked: real phones/laptops, Safari/WebKit, reduced motion, a screen reader.

## Known, not part of this change

- 667×375 landscape (narrower than 700): the artwork uses its phone layout, so the stacked words are huge, run under the contact bar and "Solutions" is off screen; the line/button row sits over the top of "New Wings". The artwork needs its own short-landscape layout.
- 1024×768: the "New Wings" word touches the left edge of the screen (existing artwork layout).

## Dev server note: stale globals.css

`@tailwindcss/turbopack` (4.3.3) keeps a compiled copy of each CSS file and rebuilds it only when the file's modified time differs from its last run. Two quick writes to `globals.css` can race it: it compiles the first write's text but records the second write's time, so the dev server keeps serving the older CSS. Touching the file does not help (same content, Turbopack does not re-run the loader). Fix: make one more single edit to `globals.css`. If old CSS survives a restart, the persistent cache holds it: stop the preview and move `.next/dev/cache/turbopack` aside (done once here: `.next/dev/cache/turbopack.stale-20261118`, 537 MB, safe to delete).

Backups, captures and revert: `D:/CodexOutputs/Story_Lines_20261118/` (`before/` holds the files as they were at f73dfd2; copy them back and delete `docs/story-lines/` and `scripts/story-lines.test.mjs` to revert).

## Theatre line (19 November 2026)

The theatre stop's corner card said "Lights down. The room goes quiet. This is the moment we build for." But the house lights rise as that stop begins (`houseLightLevel`, 3.2 s after the opening settles) and are up when the visitor scrolls back to it, so the line contradicted the lit room (found in the 16 November review). The user asked to fix this caption alone (title cards keep holding the scroll). New line, same hint: "Take your seat. Everything in this room is our work." It matches the seated, lit, before-the-film moment and points at the hoverable room; "Lights up" stays with the end page. `scripts/story-lines.test.mjs` guards it. Checked in my headless Chrome: the new line at the first stop while the lights rise and once they are up, and after scrolling back from the exploded projector; no console errors. Revert: put the old line back in `components/corridor/story-caption.tsx` (and the comment in `diagonal-section.tsx`) and drop the last test.
