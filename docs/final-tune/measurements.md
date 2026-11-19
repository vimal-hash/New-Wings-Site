# Production measurements (2026-11-19)

Production build (`npm run build`, `next start` on port 3200) in my own headless Chrome on the RTX 4070 PC. Each run was a first visit, with cache and site storage cleared. Script: `prod-measure.mjs` in the session scratchpad. Times are seconds from navigation.

| | Desktop (1600×900, 100 Mbps / 20 ms) | Android phone (390×844 ×2, touch, 12 Mbps / 70 ms, CPU 4× slower) |
| --- | --- | --- |
| First paint (FCP = LCP) | 0.16 | 0.43 |
| Loader releases | 5.6 | 13.1 |
| Opening done (first scroll works) | 11.1 | 17.6 |
| Downloaded by then | 19.6 MB, 144 files | 14.4 MB, 137 files |
| Camera moves (pullback, build, walk, drawings → sphere) | 75 fps, no frame over 50 ms | 71–75 fps, worst 40 ms |
| Rests | 1 frame of 53 ms at the drawings rest (late preparation, by design) | 2 frames up to 53 ms at the projector stop |
| Behind the loader / opening | 4 frames over 50 ms (worst 494 ms) | 13 frames over 50 ms (worst 694 ms) |
| Console | No errors. Warnings only: three's `Clock` deprecation, `PCFSoftShadowMap` → `PCFShadowMap`, several KTX2 loaders | Same |

The phone run uses this PC's GPU, so it tests loading and the slower main thread, not a phone GPU. The user's real phone report shows one 1.7 s compile while resting on the Products reel.

On phones the projector stop is `done` (no exploded stage); then drawings → sphere, one swipe each.

## Full-site walk (dev server, desktop, one wheel notch per step)

Every stop goes back and forward with one step:

- theatre → exploded projector → drawings → reel frames 1–6;
- green/red tunnel stop → Section 2 → (blue, straight through) → Section 3;
- yellow/green tunnel stop → Section 4 cards 0–2;
- the climb, View 2, the final eye, the white page.

Back from the drawings walks to the projector and on to the theatre, as the old projector stop did (one step, 22 s). The blue flight had no stop: 0 → 1 in 3.4 s.
