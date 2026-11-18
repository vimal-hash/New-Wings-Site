# Measured picture choice (2026-11-17)

The user: "we can't code based on each graphics card. It's not right common practice right? Look for common pov and do
right practice."

Before, `effect-quality.ts` gave the rich picture ("desktop") only to graphics cards whose names matched a hand-written
list (desktop GeForce RTX 3060–5090, Radeon RX 6000/7000). Everything else got the light picture ("laptop"): every new
card, every Mac, every fast laptop. The list had to be kept up to date by hand.

Now the site does the common thing: it measures how fast this device really draws, then picks. Nothing is chosen from
a card's name any more. Phones are unchanged: they always get the phone picture and skip the test.

## How it works

- While the page loads, a short drawing test runs in a worker (`gpu-speed.worker.ts`, WebGL 2 on an OffscreenCanvas),
  so the main thread and the loader keep moving. It times the two kinds of work the site's drawing is made of:
  - threads: thin ribbons, 400,000 triangles a draw, into a 512 × 512 picture with depth (like the rope's threads and
    the models);
  - pixels: a nine-read blur, back and forth between two 1024 × 1024 pictures (like glow, blur and big screens).
- Each batch ends by reading one pixel back, which waits for the chip to finish. The wait with nothing drawn is
  subtracted. Batches double (threads 2 → 128 draws, pixels 4 → 256 passes) until one takes about 4 ms.
- The timed test runs 0.8 s. Readings in the first 0.45 s are ignored: a desktop card starts at idle clocks, about 10×
  slower, and steps up in that time (`SETTLED_MS`). The lower quarter of the rest is used, because the page's own loading
  can only slow the test down, never speed it up.
- Speed = this device's time ÷ the same test on the reference PC (the user's RTX 4070 desktop, Chrome 157):
  `REFERENCE = { drawMs: 0.0453, passMs: 0.0227 }`. 1 means as fast; 2 means it takes twice as long.
- `effect-quality.ts` picks the rich picture when its costliest moment fits 13 ms of chip work at this window's size
  (`BUDGET_MS`). 65 fps is 15.4 ms a frame; the rest is for the browser's own drawing and for a test that reads a little
  slow on a busy machine.
  - cost = `fixedMs` × threads speed + `perMpxMs` × million drawn pixels × pixels speed (`RICH_COST` in `gpu-speed.ts`)
  - corridor: the reveal, 0.34 ms + 0.73 ms per million pixels, at the size the rich picture draws
    (`targetDpr("desktop", …)`). From GPU-timed replays on the reference PC: 1.66 ms at 1920 × 940, 3.04 ms at
    2560 × 1440.
  - rope flight between the sections: 8.29 ms + 1.57 ms per million pixels, at pixel ratio 1 to 1.5. From the same
    replays: its costliest frame took 11.13 ms at 1920 × 940 and 14.09 ms at 2560 × 1440.
  - an unknown speed (no WebGL 2 in workers, the test failed, or no answer within 3 s) gets the light picture.
- The code still says `desktop` / `laptop` / `mobile`, but these now name pictures, not devices: a fast laptop gets
  `desktop`, a slow desktop `laptop`. Renaming them across the many files that read them was left alone on purpose.
- Pages wait for the test before their first 3D canvas: `experience.tsx` (the Scene import) and `app/sections/page.tsx`
  both wait for `prepareQuality()`.
- While the test runs, computers already download the opening's files (`startOpeningDownloads` in
  `opening-files.ts`, started by the Scene loader in `experience.tsx`). It asks the browser for the same 36 files, in the
  same order and with the same kind of request, that `preloadOpeningAssets` asks for once the canvas exists; the
  loaders then take those downloads instead of fetching again. It only downloads: unpacking and every GPU step still
  wait for the canvas, so the test has the graphics chip to itself. Phones skip both. `THEATRE_MODELS` and
  `THEATRE_SCREEN_ARTWORK` now live in `opening-files.ts` (re-exported from their old homes) so that list has one
  source. The rope flight asks `ropeFlightDevice()`; asked before the test has finished (only a
  very early menu jump can), it answers light for that moment without keeping the answer.

## Saved result

- Kept in the browser (`localStorage` key `nw-graphics-speed`, version 1) for 7 days, for the same chip and the same
  plugged-in / battery state (Chrome and Edge tell; other browsers count as unknown). A laptop on battery can run its chip
  much slower, so the two are kept apart.
- The chip's name is only used to know that a saved speed belongs to this chip, never to choose a picture.
- The worker names the chip first; when the saved speed fits, it draws nothing. The speed is then known about 0.1 s in.
- A test that ran while the tab was hidden (a background tab) is used for that visit but not kept.
- An answer that cannot be read counts as unknown. The page never waits on the test for more than 3 s.
- To test again: clear the site's data in the browser. When the test itself changes, bump `SAVED.version`.

## Measured on the reference PC (RTX 4070, headless Chrome 157)

- The test alone, 6 runs in a blank page: settled at 0.04531 ms a draw and 0.0227–0.0231 ms a pass, about 0.85 s in all.
- Real page loads at 1920 × 947: 0.98–1.02× for both kinds of work, "rich corridor, rich rope flight" every time. These
  are the same pictures the name list gave this PC.
- Loader released: first visit 4.2–4.7 s (the test ends about 1.0 s in); with the test skipped 3.5–3.7 s; later visits
  using the saved speed 3.53–3.66 s. So only a first visit (and one a week after) is slower.
- First visits with an empty cache, 3 loads each (loader released):
  | | localhost | 100 Mbps, 20 ms |
  | --- | --- | --- |
  | old fixed choice (no test) | 3.5–3.7 s | 4.50–4.55 s |
  | test, files after the canvas | 4.26–4.34 s | 5.33–5.43 s |
  | test, files during the test (now) | 4.33–4.48 s | 4.72–4.91 s |
  - With the early start the 36 opening files arrive by about 0.3 s on localhost, nothing downloads twice, and the speed
    readings are unchanged (1.00–1.02×).
  - What remains is graphics preparation: on this PC the loader waits for the projector's GPU work (its long shader
    build), which can only start once the canvas exists, after the test. So on a real connection the test now costs
    about 0.3 s instead of 0.85 s; on localhost, where files arrive at once, it still costs about 0.7 s.
- Larger windows on the same PC: 2560 × 1305 and 3840 × 2000 get "rich corridor, light rope flight". The rich rope
  would need about 13.5 ms and 20 ms of chip work there (about 49 fps at 4K). The name list gave the rich rope at any
  size; this protects 65+ fps.
- Whole-site walk, 25 stops, before and after: the same pictures (difference 0.0002 in the theatre, 0.038 or less on
  the pages, 0.07 at the eye from its own animation) and the same frame rates (75 fps on most legs).
- Save check: a hidden tab ran the test and kept nothing; a normal visit kept it; the next visit reused it at 0.1 s.
- Safari's engine (Playwright WebKit on Windows) has no OffscreenCanvas: "Graphics speed unknown" at 0.4 s, light
  pictures, no errors. WebKit bug reports say Safari 17 on macOS Sonoma and later has WebGL in worker OffscreenCanvas, so
  those Macs are measured; older Safari stays light, as it always did (the name list never matched Apple chips).
- Firefox was not checked here (Playwright's Firefox is not installed on this PC).

## Where to look

- Performance panel row "Picture · speed⁴", for example "rich corridor, rich rope flight · 0.98× / 1.00× (saved
  test)".
- `?diagnostics=1` trace mark "Graphics speed 1.00x threads, 1.00x pixels (saved)".
- Local check of a picture without the test: `?diagnostics&fx-test=desktop|laptop|mobile` on localhost, as before.

## Keeping it right

- A new heavy effect in the rich picture: time its costliest frame on the reference PC at two window sizes and fold it
  into `RICH_COST`.
- A change to the test itself: run it 6 times in a blank page on the reference PC, put the settled ms in `REFERENCE` and
  bump `SAVED.version`.
- Never bring back a list of graphics card names.
- Tests: `scripts/gpu-speed.test.mjs`.

## Files

- NEW `components/corridor/gpu-speed.worker.ts`: the test.
- NEW `components/corridor/gpu-speed.ts`: readings to speed, the cost model, the saved result.
- `components/corridor/effect-quality.ts`: rewritten; same exports (`effectQuality`, `ropeFlightDevice`,
  `EffectQuality`) plus `prepareQuality` and `describeQuality`.
- `components/corridor/experience.tsx`, `components/corridor/scene.tsx`, `components/corridor/metrics.ts`,
  `app/sections/page.tsx`: wait for the test; panel row.
- NEW `components/corridor/opening-files.ts`: the early downloads; `opening-assets.ts` and `theatre-screen-artwork.ts`
  re-export its two file constants.
- NEW `scripts/gpu-speed.test.mjs`.
- Backup, evidence and revert steps: `D:/CodexOutputs/Measured_Picture_Choice_20261117/`.

## Not done

- A first visit still waits about 0.3 s longer for the loader on a 100 Mbps connection (0.7 s on localhost). A shorter
  test would cut that, but could read a laptop whose chip wakes slowly as slower than it is.
- If the rich rope flight turns out slow while it plays, it does not yet switch to the light one by itself.
