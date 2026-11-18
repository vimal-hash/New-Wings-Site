# One scroll rule for the whole site (2026-11-18)

The user: "check front and reverse scroll are working on whole site. If not fix it" and "maintain same scroll speed on whole site".

## What was wrong

A walk of the whole site in headless Chrome, one mouse-wheel notch per gesture, scrolling back once at every stop:

- Scrolling back did nothing at three stops: Section 1's first film frame, View 2 and the final eye.
- One notch did very different amounts in different places. Each place counted the scroll its own way:
  - the white section after the final eye followed the wheel pixel for pixel: about ten notches to cover the eye;
  - the film strip followed the scroll too (440 px for a whole frame) and finished any gesture over 52.8 px on the next frame;
  - flights, Section 4's cards, the theatre and the logo stops each had their own thresholds, quiet times and locks.

## The rule

`components/corridor/scroll-step.ts` is now the only place that turns scrolling into movement:

- One gesture is one step, forward or back, everywhere on the site.
- A gesture counts once it has travelled 30 px. One mouse notch is 40–120 px, so every notch counts; a small trackpad nudge under 30 px moves nothing.
- The rest of the gesture (a long trackpad swipe and its momentum, or a long finger drag) moves nothing more.
- A new gesture starts after a 220 ms pause, a turn the other way, or a new touch.
- One key press (arrows, Page Up/Down, space, shift+space) is one step. Holding the key makes no more.
- Each event is decided once and every listener reads the same answer.
- The look-tuning panel, text fields and dialogs keep their own scrolling.

## What one step does

| Place | Forward | Back |
|---|---|---|
| Theatre, parts, projector | next stop (unchanged) | previous stop (unchanged) |
| Projector | the corridor walk, the liquid and the page (unchanged) | — |
| Section 1 film | one frame; after frame 6 the frame burns white, the next step flies on | one frame; on frame 1 the house lights come up (2.1 s), the title line fades (.35 s), the liquid turns back into the sphere and the camera walks back through the corridor to the projector |
| Flights | one whole leg to the next rest | one whole leg back; a step the other way mid-leg turns round |
| Sections 2 and 3 | the next flight | the flight back |
| Section 4 | one card; after the last card the section turns white and the camera climbs (unchanged) | one card |
| View 1 → View 2 → final eye | one step each (unchanged) | final eye → View 2: the pullback in reverse, the light fading out over its first second; View 2 → the turn back to the top of the slide, then down to the white panel and into Section 4 on its last card, under a white that lifts in .3 s |
| White section after the final eye | one step sweeps it all the way in (90% in .9 s) | one step sweeps it out; at the bare eye a back step goes on to the camera |
| Phones | one swipe, one section | one swipe back |

Kept as they were: title cards still hold forward scroll until their line is gone; on the return from Section 4 input is still ignored through the climb, the hold and the turn; each flight is still one unbroken leg per gesture.

Off a section edge on a computer (the page's scrollbar dragged, a search in the page), a step settles the page on the section edge it points to and that section starts as it does on phones; the next step goes on as usual. The old code let the wheel scroll the page natively there; the new rule takes every wheel event, so without this the page would have stayed stuck.

## Measured

Headless Chrome on the RTX PC (computer 1920×947 with one mouse-wheel notch per gesture unless said otherwise; phone 390×844 with finger swipes), scrolling back once at every stop:

- Every stop goes back and comes forward again with one notch, from the theatre to the white section. Before, back did nothing at Section 1's first frame, View 2 and the final eye.
- Section 1 frame 1 back: lights up, line gone, liquid back to the sphere, the corridor walked back: at the projector 14 s after the notch.
- View 2 back: the turn back up and the way down land in Section 4 on its last card 5.0 s after the notch; its white lifts in .3 s.
- Final eye back: View 2 4.6 s after the notch; the eye's light is gone 1 s in (screenshots at .25, .6 and 1 s).
- White section: one notch covers the eye (90% in .9 s, at rest 2.1 s); a forward notch there keeps it; one notch back sweeps it out; the next goes on to View 2.
- Page dragged 40% into Section 3: one notch settles it on Section 3, which plays into colour; the next notch flies on. Dragged back 60%: one notch back settles on Section 2; the next flies back.
- Phone (390×844, one 600 px finger swipe per gesture): every stop from the theatre to the white section goes back and forward with one swipe; Section 1 frame 1 back is at the projector 13 s after the swipe.
- Reduced motion (computer, one notch): every step at the end of the site works both ways. View 2 back lands on Section 4's last card at once (0.2 s, with no climb to see, like the forward return); the final eye back is at View 2 in 2.4 s.
- Same speed, whatever the size of the gesture: a 120 px finger swipe on a phone and a ~900 px touchpad flick with momentum on a computer each moved exactly one step everywhere tried (film frames forward and back, Section 2 to 3 and back, Section 4's cards forward and back): 8 of 8 each. Before, a phone swipe shorter than half the screen snapped back, and the film strip and the white section followed every pixel.
- No new console messages (only three.js deprecation warnings that were there before).

## Code

- `scroll-step.ts` (new): the rule and `listenSteps`.
- `full-journey.tsx`, `exit-stages.ts`, `page-exit.ts` (`createPageDescent`): the theatre and logo steps; back from the final eye and from View 2.
- `normal-page.tsx`: the one router on the page (reel → flight → title hold → Section 4 cards → sections → the return); back to the corridor; Section 4's white lift after the way down.
- `film-reel/reel-motion.ts`, `film-reel/film-reel.tsx`: steps; back from frame 1.
- `corridor-page.tsx`, `corridor-screen-state.ts`, `corridor-screen-runtime.tsx`, `journey-controls.ts` (`leavingPage`, `pageBack`): the way back through the corridor; the screens close as the camera passes back over them.
- `section-flight.tsx`, `rope-model/rope-flight.ts`, `rope-model/rope-link.ts`: a flight takes steps.
- `feedback-scene.tsx`: Section 4's cards take steps.
- `diagonal-section-state.ts`, `diagonal-section.tsx`: the white section sweeps on a critically damped spring.
- `pupil-pulse.ts`, `pupil-pulse-state.ts`: the final eye's light fades out on the way back instead of cutting off.

## Tests

- `scripts/scroll-step.test.mjs` (new): notches, trackpad swipe and momentum, nudges, pauses, turns, touches, keys.
- Updated: `film-reel-motion`, `exit-stages`, `diagonal-section`, `page-exit`, `corridor-screen-walls`, `pupil-pulse`.
- All 225 tests pass; `tsc --noEmit` and eslint on the changed files are clean.

## Backup and revert

`D:/CodexOutputs/Scroll_Steps_20261118/`: `before/` holds every changed file as it was before this work (rebuilt from the session record and checked by replaying the edits), `after/` the new files, `evidence/` the walks' logs, results and screenshots, and `harness/` the headless Chrome scripts that made them (`walk.mjs` walks the whole site, `logo-walk.mjs` the end of it, `short-check.mjs` the same-speed check, `drag-check.mjs` the scrollbar case). To revert, copy `before/` over the project, delete `components/corridor/scroll-step.ts`, `scripts/scroll-step.test.mjs` and `docs/scroll-steps/`, and remove the "One scroll rule (2026-11-18)" paragraph from `AGENTS.md`.
