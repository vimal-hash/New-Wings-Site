# Final tune (2026-11-19)

The user's last tuning list before launch (eight items, "start building all one by one. dont wait for me"). Content, images and copy are left to the user. All of this is uncommitted until the user says commit.

## 1. Highlight tour, on the opening's echo

After the house lights come up, five things light up one by one with their name on the cinema screen: seats → interior (ceiling and lights together) → screen → sound → floor lights (`TOUR_STOPS` in `hover-catalogue.tsx`). After the fifth, nothing is lit again until the visitor hovers. A hover or click ends the tour at once.

- The steps fall on the five repeats of the opening cue's 8D echo. The song's own numbers live in `story-beat.ts` (draft 1.4, 110 BPM: the long E at 2 bars, then the echo every three sixteenths, 0.409 s). Step *i* is at `OPENING_ECHO.first + i × OPENING_ECHO.every` (4.773 s, 5.182 s … 6.409 s) after the opening camera starts to move (`journeyControls.openingMovedAt`). The tour runs whether the sound is on or not.
- If the picture is late (a slow first frame), the clock moves its start so the tour begins 0.3 s later rather than skipping steps.
- The screen cover uses quicker timing during the tour (`SCREEN_COVER_TOUR`: in .2 s, out .4 s, text .1 s, swap .06 s; `theatreScreenCatalogue.quick`). Hovering uses the normal timing.
- The old one-off "seat cue" is gone: the tour replaces it.
- Measured in headless Chrome: steps at 4.79 / 5.20 / 5.62 / 6.02 / 6.43 s, against echo repeats at 4.77 / 5.18 / 5.59 / 6.00 / 6.41 s.

## 2. House lights fade

The lights go down as one slow, even fade over the whole pullback (`theatrePullbackDim = smooth(0, 1, progress)`; was from 6%). Lamps and the light they throw now dim together on one curve (`roomFill = mix(1, nightFill, dimAmount)`). Before, the lamps went out first and read as a switch.

## 3. Projector build

- The front glass shows a steady warm amber glow (`vec3(1, .74, .36)`) instead of the white softbox reflection and the flash. There is no lens glint.
- The build takes 2 s (`assemblySeconds: 2`; lead .06, spread 1.4, travel .32, jitter .05 in `projector-assembly.ts`).
- The camera goes on as the build ends: there is no hold or rest at the assembled projector going forward.

## 4. Drawings stop (new rest)

The corridor walk now has a rest where the blueprint drawings end, just before the liquid sphere comes into view (new phase `drawings`). The caption there is "Before a seat goes in, we draw the whole room." with Scroll on. The next scroll walks on to the sphere.

- Both legs are whole bars of the theme (`CORRIDOR_MOVE = { arrive: 3·BAR − 2.9, leave: BAR }` in `full-journey.tsx`). The 2 s build, its 0.9 s move and the first leg make 3 bars (6.55 s). The last leg is 1 bar (2.18 s), so the music parts below end as the camera stops.
- Going back from the sphere stops at the drawings. One more step back walks to the projector and on back to the theatre, as the old projector stop did.
- `drawings` takes over the projector stop's role as a quiet rest for late background preparation (`scene-idle.ts` priority ≥20 list, `logo-particle-eye` preparation, story caption, loading trace).

## 5. Blue tunnel

The blue tunnel (About Us → The team) flies straight through: no stop in the middle and no cards (`BLUE_FLIGHT.through`). The other two tunnels keep their stops. The walk measured blue from 0 to 1 in 3.4 s, rising steadily in both directions.

## 6. Eye particles part like water (computers and laptops)

At View 1, View 2 and the final eye, the eye's grains move aside from the mouse and flow back within about a second (`logo-particle-eye/wake.ts`, applied in the eye's vertex shader).

- The mouse leaves a short trail of up to 8 points. Each point pushes grains outward (14 px) and drags them along the stroke (7 px), within 85 px, capped at 16 px. Faster strokes push more.
- Strength rises in .06 s and falls with a .4 s time constant; a point is gone after 1.4 s. Each grain answers a little differently (0.75–1.25, by its seed), so the edge is not a hard circle.
- Position only: no glow, colour, size or brightness change. The stars and the space around the eye don't move. Mouse only (`pointerType === "mouse"`): touch and pen do nothing. It is off under reduced motion and while the last page covers the eye.
- The star-bloom copy shares the same uniforms, so the stars' bloom moves with the grains. It draws only while a trail is alive, then the scene rests again.
- Measured: strength 0.63 just after a stroke, 0 by 1.7 s, with no shader errors.

## 7. Production check

- Reports the user sent from the phone and laptop (`journey-frames-*.json`): no JS errors in either.
  - Phone: one 1.7 s shader compile while resting on the Products reel. This is the existing preparation-at-rest design.
  - Laptop: frames capped at a flat 30 fps (Chrome Energy Saver / battery), with a GPU about 40× slower than the reference. Loader at 19.4 s on a 0.4 Mbps estimate. One 300 ms hitch at the start of the corridor walk from first-use compiles. The late preparation now waits for the drawings rest instead.
- `pnpm audit --prod`: two moderate Next.js advisories (GHSA-mfr8-8qww-v76h, GHSA-vc7v-qv4w-wrv8). They affect 16.2–16.4.4 and are fixed in 16.4.5. Both concern `'use cache'` and root params, which this site does not use. Update Next when convenient.
- Load and smoothness numbers for the production build are in `measurements.md` next to this file.

## 8. Sound

`theme-sound.ts` was rewritten; the Sound tab stays (`sound-toggle.tsx`).

- **On by itself on the first click, tap or key press anywhere.** Browsers allow sound only after one of these (`navigator.userActivation`); a scroll or swipe doesn't count. If the visitor turns it off with the tab, it stays off.
- **Opening:** `theme-opening.mp3` now starts with the opening camera move, from the moment the camera moved, so its echo lands on the tour. Turned on later in the opening, it joins at the right offset. Turned on after the echo, it waits for the first scroll.
- **Journey in parts, one per camera move:** cut from `theme-drop.mp3` on its bar lines (`DROP_BARS`). Each part ends with a one-beat fade.
  - First scroll: part 1, 0 → 10.92 s (the whoomp and round one), holding softly at the exploded projector.
  - Build scroll: part 2, 10.92 → 17.47 s (round two), ending as the walk stops at the drawings.
  - Next scroll: part 3, the last bar and chord, landing as the camera stops at the sphere.
  - The hum comes in under the end of part 1.
  - Walking back stops the part.
  - On phones, a part only starts if the previous one began at least 9 s earlier.
- **Sections:** as the Reel One title writes in, the opening's long E and its echo play (2.25 s). Then the drop plays from bar 2 and loops bars 2–10 with no stop. Without the echo (sound turned on later, or coming back from the end page), it loops in with a 2 s fade.
- **End page:** unchanged. The end cue plays each time the last page covers the eye; everything else fades.
- `title-card.tsx` sends `nw:title` once per write-in.
- Measured (desktop, times from the opening move):
  - click → sound on;
  - opening cue at +0.03 s;
  - first scroll → part 1 (0–10.92 s);
  - the exploded projector reached 9.5 s after that scroll;
  - build scroll → part 2 (6.565 s); the build took 2.05 s, and the walk reached the drawings 0.04 s after part 2 ended;
  - next scroll → part 3; the sphere arrived 2.19 s later, about 0.03 s from the last chord;
  - Reel One title → echo, then the looping drop.

## Tests

`scripts/story-beat.test.mjs` is new: the echo and the tour steps, and the bar lines with the legs and parts. `blue-rope` now checks the through flight; `theme-sound` checks that sound starts only from a click, tap or key press. 241 tests pass; tsc and eslint are clean.
