# /rope-model speed and look tracker

Backup before the speed work: `D:/CodexOutputs/Rope_Speed_20261104/step0-before-speed/` (page, scripts, model, 6K sheets).
Measured at 1920×1080 on an RTX 4070 only, in Chrome. The Blender match is at 1920×804 against Blender's own pictures, at four camera positions. Every thread is always kept.

| Step | Download | Graphics memory (textures) | GPU time per frame | Detail match with Blender (start / 25 / 50 / end) |
|---|---|---|---|---|
| Before speed work | 324 MB | about 730 MB | 201 ms | .930 / .931 / .938 / .952 |
| 1. Baked values moved from 6K sheets onto thread points | 176 MB | about 200 MB | 17.5 ms | .930 / .931 / .938 / .952 |
| 2a. Grain texture: only the 2 used channels, 1024 x 3072 | 124 MB | about 8 MB | not measured alone | .931 / not checked / not checked / not checked |
| 2b. Model file packed with meshopt (lossless) | 59 MB (about 53 MB with gzip) | about 8 MB | 10 ms | .931 / .931 / .938 / .952 |
| 3a. Threads sorted into 331 stretches; those behind or beside the camera skipped | 60 MB | about 8 MB | 12.3 ms at start, 4.8 ms at end | not re-scored: 0.1% of pixels changed |
| 3b. Hidden threads no longer coloured; round shape in the geometry; small soft filter | 60 MB | about 8 MB | 7.3 ms at start, 4.8 ms at end | .937 / .941 / .948 / .960 |
| 4a. Blender's glow rebuilt as post processing (scored against the glow pictures from here on) | 60 MB | about 8 MB | 7.5 ms at start | .937 / .939 / .941 / .970 |
| 4b. Far threads fixed, tint refitted, Blender's backdrop added | 60 MB | about 8 MB | 7.7 ms at start, 7.0 ms in the middle | .949 / .948 / .951 / .968 |
| 4c. Softer strokes: soft filter .4, bright threads free of the tint sooner | 60 MB | about 8 MB | 7.6 ms at start, 6.2 ms in the middle | .950 / .948 / .951 / .968 |
| 5. Energy flow: light runs along the threads, in the thread shader | 60 MB | about 8 MB | 7.4 ms at start, 8.2 ms in the middle (light running) | still look unchanged, byte for byte |

## Laptop version, separate link (user's request, 2026-11-05)
`/rope-laptop` is a separate page for laptops. `/rope-model` (desktop) is not changed: its six test pictures are byte-identical and its 25 panel checks pass. Thread reduction is allowed for this version only.

| | Desktop `/rope-model` | Laptop `/rope-laptop` |
|---|---|---|
| Download | 60.3 MB (model 57.2, grain 3.1) | 2.89 MB, everything included |
| Triangles per frame | 6.2M to 15.6M | about 150K to 500K |
| Thread points | 3.86M | 411K |
| Picture storage | 16 bit, 8 edge samples | 8 bit, 4 edge samples or fewer |

- File: `public/rope-laptop/rope.bin`, made by `scripts/build-rope-laptop.mjs` (needs `MESHOPT_DIR` and `ROPE_CACHE`, see the top of the script). The file is new; the source is the desktop model.
- How it is small: each thread part is scored by the pixels it really owns from 25 camera positions along the one line the camera travels. Only those that show are kept, then thinned to within a fraction of a pixel.
- Quality: `laptop-quality.ts` steps by itself, 7 steps, from full size with 4 edge samples down to .42 size with none. It uses frame time, and the chip's own timer when there is one, so a 30 fps battery saver does not lower quality.
- Test switches: `?still`, `?flowAt=.3`, `?step=N`, `?bench=N` (draw N times a frame). There is no tuning panel on this page; it uses the desktop's base values.
- Look against desktop at 1536×776 (start / 25 / 50 / 75 / end): match at 8 px .913 / .891 / .911 / .924 / .954, at 32 px .942 / .919 / .942 / .956 / .978. Red within 5.5% of desktop's mean brightness, green .76 to 1.0. Threads are fewer and slightly coarser.
- Speed on the RTX 4070 here: full scroll 75.1 fps at this 75 Hz screen, worst frame 14.1 ms. Under forced load, 60 draws a frame still held 60 fps at step 3. Software graphics with no chip: steps to the lowest, 18 fps, no errors.
- Not known yet: the real result on a laptop. Only the RTX has been tested. A 60 Hz screen cannot show more than 60 fps.
- Backup and pictures: `D:/CodexOutputs/Rope_Speed_20261104/step21-laptop-version/`.

### First real laptop result and the steady picture fix (2026-11-05)
The user's laptop (AMD built-in, 60 Hz, 1920×970 canvas) on the first build: 59.1 fps, chip 8.7 ms threads + 2.5 ms glow at step 4. But the picture got blurry after about 10 s because quality kept stepping as it watched (marks at 7.2, 7.9 and 11.4 s), and the first frame waited 6.4 s on a 4.7 s block. These supersede the file size, step count and quality lines above.
- File now 2.95 MB. Bridges holes under 120 px and drops crumbs under 24 px, both measured at the nearest depth (`--bridge`, `--crumb`).
- Quality: 8 steps. While the canvas is still hidden it tests steps from the top and keeps the first that fits 12.5 ms of chip time, or frame time with no timer. It never climbs. Only two slow 60-frame windows in a row step it down once. `?diagnostics=1` tests all steps (about 2.3 s hidden) and writes `Chip test step N` marks, which give a laptop's full cost table.
- The block: three.js computed bounding spheres over all points for about 160 groups. Each group now has its own sphere; longest block here about .2 s.
- Below full size: softening is removed and a sharpen limited to neighbouring pixels is added. Edge width no longer falls under 1.3 px at 2 samples.
- Cheaper on the chip: vertex pows replaced by polynomials, through-colour baked on the CPU, first glow picture at quarter size.
- Each piece of thread fades over its last .0625 of length (`aF`, computed on load, no extra download), so short pieces no longer end hard.
- Look against desktop at 1536×776, step 0 (start / 25 / 50 / 75 / end): match at 8 px .912 / .888 / .910 / .924 / .955, at 32 px .941 / .914 / .941 / .956 / .978. Step 3: 8 px .896 / .873 / .887 / .902 / .942. Step 3 shows slight stair-steps when zoomed in.
- Here on the RTX, canvas 1920×970: chip about 3–5.5 ms through the full scroll at 1536×776, step 0 chosen, one mark only, no switching. With `?bench=40`, step 2 chosen, one mark only. Hover, running light and desktop checks pass (6 hashes equal, 25 panel checks).
- Not known yet: the result of this build on the real laptop. The `1 Issue` badge from the user's screenshots does not appear here; its report had no errors. ESLint's React rules still flag the uniform and ref updates in `rope-laptop.tsx`; the page works and `tsc` is clean.
- Backup and pictures: `D:/CodexOutputs/Rope_Speed_20261104/step22-laptop-steady/`.

## Flight: green, blend to red, smooth stop (step 3, 2026-11-05)
New links `/rope-flight` and `/rope-flight-laptop`. `/rope-model` and `/rope-laptop` are unchanged: six desktop hashes equal, the panel test passes, laptop picture identical at five stops. `rope-flight.ts` owns the path, the blend and the scroll.
- No new download on either page. The four Blender colour files have byte-identical threads, so this is one tunnel recoloured in code. Blender only supplied the numbers and reference pictures.
- Green uses the green file's own numbers: tints and core are read directly, and baked red values convert back with the rule that made the colour files (main channel moves over, small one doubles, blue is 2.5 times). Green and red curves are exact red/green swaps, so one sheet holds both and each pixel takes its own, with no extra picture reads.
- Which curve a doubtful pixel takes also depends on the camera, so orange threads in the green go through the green curves. That threshold was set by eye against Blender's picture.
- Against Blender at the start view, match at 8 px / 32 px. Desktop green .939 / .961, desktop red .949 / .969. Laptop green .878 / .922, laptop red .874 / .920. Green's main channel runs 7–8% bright and red is low in the green picture (.72–.75).
- Only one camera view was compared for green, since that is the one Blender green picture available.
- Blend: threads turn one at a time between z -3 and -17, half way at -10. The stop is 17 along, where everything ahead is fully red. Travel stays 24, scroll is 16 screens.
- Scroll: follows the wheel. One gesture cannot pass the stop. When scrolling ends elsewhere the page glides on to the next rest (400 ms per screen, about 3.5 s to the stop and 2 s from there to the end), so the camera never rests in green. `?still`, `?flowAt` and reduced motion turn this off. `?colour=green` or `?colour=red` shows one colour. Eight real-wheel cases pass on both pages.
- Speed on the RTX here, full scroll at 1536×776: both about 75 fps at this 75 Hz screen. Laptop chip 4.1 ms threads, .3 ms glow, worst frame 14.8 ms. Desktop chip 5.5 ms (highest 6.9), worst frame 40.1 ms. Not yet tested on the real laptop.
- Backup and pictures: `D:/CodexOutputs/Rope_Speed_20261104/step23-flight/`.

### Backwards, smooth starts and ends (2026-11-05)
This replaces the blend, path and glide numbers above. The user asked for the camera to face backwards and for no sudden starts.
- The tunnel reaches only 2.6 units behind z 0, so turning the camera round at the old start would look out of the end. The laptop file also keeps only threads seen looking down the tunnel, and the look is matched from that side. So the camera still looks the same way and backs out instead, from z -24 to z 0. On screen threads arrive from the edges and shrink into the middle. No new data; the views are the ones already matched.
- Blend half way at z -17, red towards z 0. At the stop (z -7) and at the end, a ring of green is left in the far middle. That is a choice for the user to judge.
- Distance is now even along the scroll, and glides ease in and out. The camera follows with a weighted spring (`createFlightCamera`, .35 s), so its speed always changes gradually.
- Real camera speed read from the view matrix on both pages. Every gesture starts near 0 (.05 units/s in the first frame of one tick, .18 for a hard scroll) and ends at 0. Peak is about 6.4 units/s for a glide; a hard scroll reached 19 on desktop and 25 on laptop.
- A tick at the stop waits about .4 s before moving: it first has to cross the hold, then the 180 ms idle.
- The laptop's hidden quality test now puts the camera at z 0, the same view it tested before, because the flight's first view is the lightest. Step 0 was chosen here.
- Against Blender's green at z 0, match 8 px / 32 px: desktop .937 / .961, laptop .876 / .922. Wheel test 8 of 8 on both. Speed about 75 fps at 75 Hz: laptop chip 4.1 ms threads + .3 glow, worst frame 14.5 ms; desktop chip 4.7 + .5, worst frame 59.7 ms (one frame).
- Approved pages: six desktop hashes equal, panel test passes, `/rope-laptop` step 0 has zero difference at five stops. `rope.bin` is still 2,946,082 bytes.
- Backup of the files before this change: `D:/CodexOutputs/Rope_Speed_20261104/step24-backwards-before/`.

### Hover card at the stop (2026-11-05)
One glass card, flight pages only. `rope-card-state.ts` holds the rules, `rope-card.tsx` the card, and `scripts/rope-card.test.mjs` the rule tests (9 pass). It is a page element over the 3D. The picture inside is only a number until the real images arrive.
- Images 1 to 5 in turn, then 1 again, kept only in page memory. A refresh or new visit starts from 1.
- Ropes cover nearly the whole screen at the stop: with the hover's own rule, 99.6% of the screen outside the card has a rope under the mouse. Tighter catch areas leave only scattered holes that don't match what is seen (90% at 24 px; 87% at 12 px with four times the sample points).
- So hovering away means leaving the rope that opened the card, and this replaces the cross-fade first agreed. Off that rope for 120 ms, the card fades in 300 ms. After the mouse rests on a rope for 200 ms, and the old card has gone, the next opens.
- The card can't be dismissed by moving onto a gap, because there are almost none. It stays closed only when the mouse leaves the page or sits in the small rope-free hole in the middle.
- The mouse on the open card keeps it open and the ropes behind do not react. No card or count while flying; scrolling on closes it.
- The card waits for the camera to come fully to rest. Without that, the rope under a still mouse changed during the last moment of settling and card 1 flashed before card 2. With the mouse already resting on a rope, it opens about 1.7 s after the scroll reaches the stop.
- Real mouse test on both pages: every card in order `1,2,3,4,5,1,2`, shortest time open about 790 ms, no errors. A fast sweep of 60 moves used at most one number.
- Speed here with the card open, blur on: 75 fps at 75 Hz on both, worst frame under 14 ms, same as closed. This RTX says little about the blur on a weak laptop. The chip timer doesn't include the browser's blur, so the real check is frame time in the laptop report.
- Approved pages: no rope pixel changed. `/rope-laptop` at step 0 and `/rope-model` differ from their saved pictures only by about 200 pixels inside the Next dev badge, which also changes the six saved hashes. Panel test passes.
- Backup: `D:/CodexOutputs/Rope_Speed_20261104/step25-card/`.

## Laptop picture no longer falls while watching (2026-11-05)
- The user's report: clear for a few seconds, then blurred, broken and blocky. Frames sat at 33.3 ms at every quality, and the page lowered the picture every 4 s down to 806 wide with 2 edge samples.
- Cause: the check that should hold the picture needs the chip timer, and `?diagnostics=1` turns that timer off for the report's meter.
- Now in `laptop-quality.ts`: slow frames alone never lower the picture. Only the chip's own time, 15 ms or more on average for two windows in a row with slow frames, lowers it, and only once. With no chip timer at all, lasting slow frames count, also once, unless the test already found frames slow at every step.
- The hidden test waits for up to 60 frames per step for chip readings, because a choice made without them was too high and dropped about 3 s after showing. With no answer it stops waiting. If no step is fast and the chip gives no reading it uses step 3, not the lightest.
- Checks: `scripts/laptop-quality.test.mjs` replays the report's numbers and failed on the old code with drops at 4, 8, 12 and 16 s. In a real browser held near 24 fps the old code changed the picture size 10 times in 30 s and the new code 0 times, on `/rope-flight-laptop` with and without the report, and on `/rope-laptop`. At a fixed step, pictures match the previous ones 1.000 on both laptop pages. Desktop pages do not use this file.
- Still open: why the report's frames sat at 33.3 ms. No limit was found in the page's code, the hidden card adds no layer, and it was already so during the hidden test. Not reproduced here. The same laptop gave 16.7 ms on `/rope-laptop` earlier the same day.
- Backup: `D:/CodexOutputs/Rope_Speed_20261104/step28-laptop-quality/`.

## Desktop file reduced, installed and approved (2026-11-05)
- User said yes to removing never-seen threads. `public/rope-model/rope-red.glb` is now 41.98 MB (gzip 37.6, was 57.22 and 50.99), `MODEL ?v=2`. 2,863,555 of 3,858,275 points. Build: `desk-thin.mjs F.glb --seen seen-full.bin --also seen-lift.bin --nocore --dropwhole --hiddenpx 4 --margin 2 --amber --hoversamples`.
- Hover fix: `gltf.extras.hoverSamples` holds the original every-Nth points per rope (base64 Int16, about .44 MB). `rope-model.tsx` passes them as `stored`; `rope-hover.ts` uses them instead of reading the thinned geometry. The laptop page passes nothing and is unchanged.
- `scripts/build-rope-laptop.mjs` now reads the ORIGINAL at `D:/CodexOutputs/Rope_Speed_20261104/step30-desktop-size/rope-red.glb`. That file must be kept: it is also the source for any new desktop build (blue and yellow included).
- Results against the old file: 16 resting pictures at most .30% of pixels changed, .023% by more than 4 levels, brightness within .03%. 16 hover pictures at most .37% by more than 4 levels (was 12.5%). Full HD pairs at most .16% changed. Wheel, card and green-white scripts pass with no errors. Laptop page loads with no errors.
- Not measured: a real visitor's download time or frame rate on this file. GPU memory falls with the point count, not measured either.

## Desktop file size: trials, nothing installed (2026-11-05)
- User approved laptop point 2 and asked to start point 3, with "careful on threads". The project's desktop file is unchanged at 57.22 MB. Trials and scripts: `D:/CodexOutputs/Rope_Desktop_Test_20261105/`. Original file and page code: `D:/CodexOutputs/Rope_Speed_20261104/step30-desktop-size/`.
- Visibility map: threads drawn with the page's own width, depth, join and core rules, each with its own number, about 2,000 camera positions on `/rope-flight` and `/rope-model`, at 1920 and 3840 wide. Also with each of the 18 ropes lifted as the white hover lifts it. 61% of segments never own a pixel. 183,558 of 341,375 threads (512,527 points, under 3 points each) never show at all.
- Meshopt barely gains from rounding values, so rounding is not worth it in this format. Core normals and texture coordinates are read by no shader (2.58 MB).
- Results, each against the real desktop picture on `/rope-flight`: never-seen whole threads and core data only, 46.52 MB: 0.00% of pixels change. Plus hidden stretches thinned to 1.5 px, 44.02 MB: at most .08% change. To 4 px, 41.85 MB: at most .3%, .023% by more than 4 levels. With a margin of 1 segment instead of 2 it gets worse for little gain. 10 px with margin 1, 39.06 MB: 3.6%, rejected.
- Candidate `E.glb`, 41.54 MB (gzip 37.19, against 50.99): 4 px, margin 2, whole never-seen threads out, core data out, fixed values where amber is exactly 0. Every thread with any seen part stays whole, end to end. Brightness within .03% at all 16 resting pictures.
- Open: white hover. The same file photographed twice matches 100%, but with `E.glb` hover pictures differ, up to 12.5% of pixels by more than 4 levels. In the one pair looked at, it is the same rope with the white starting at a slightly different spot. `readSamples` reads every Nth point, and N and the points changed. Likely fix: store the original hover sample points with the file; not built.
- Limits: the map holds for this camera line, lens and tunnel layout only. Any change to these (blue and yellow included) means building the map and file again from the original. `scripts/build-rope-laptop.mjs` reads the desktop file and its cached scores count the original's points, so the original must be kept as the source.

## Laptop threads solid at rest (2026-11-05)
- The user's laptop runs step 3: 2 edge samples, picture stretched from 72%. There threads read as dashes. Step 0 with the same file looks nearly continuous, so the main cause was too few edge samples. Holes in the file were the smaller part.
- `laptop-finish.ts`, flight page with 2 edge samples only: each frame looks a little aside, in a cycle of 4 positions, and the last 4 frames are averaged equally. That gives 8 samples at the price of 2. The same 4 frames are always in the average, so nothing shimmers. An earlier running blend changed about 1.5% of pixels every frame at rest; the equal average changes .006%, the same as step 0.
- Averaging: the picture stores square roots. Averaging roots came out too dark (blue ratio .78) and averaging light came out too bright (up to 1.24), so it uses halfway between the two.
- Cost: the frame copy is a direct chip copy, not a shader pass. The finish time here stayed about .3 ms; a shader copy took it to 1.7 ms. While the camera moves none of this runs, and threads go back to the old 1.3 pixel minimum width. At rest they keep their true width (minimum 1).
- File: `--points 428000 --join .2 --joinpx 800` closes 2,303 holes under 800 px at 20% light with a fade. 2,939,151 bytes, `FLIGHT_ROPE_FILE ?v=3`. It scores the same as the old file; the visible gain is small.
- Match to desktop at step 3, 8 px, cache off at the three stops: old .912 / .898 / .886, new .921 / .910 / .899. Colour ratios at the stop: old 1.003 / 1.066 / .935, new .996 / 1.062 / .920.
- Fair comparison rule: cache on or off shifts both desktop and laptop pictures by the same amount, cause unknown. Compare only in the same state, and use `CACHE=off` with the desktop `doff` pictures. Earlier readings of .92 and "22% too bright" for whole threads compared different states. The fair score for whole threads is about .89 against .93 for the old file at step 0.
- Checks: wheel, card, card closed and green/white scripts pass, 27 unit tests pass, picture size changes 0 times at about 24 fps. `/rope-laptop` at step 0, `/rope-model` and `/rope-flight` match their saved pictures 1.000.
- Not checked: chip time and look on the user's real laptop (this RTX says little), the look while scrolling (same method as before, so dashes may still show in motion), and how the white looks moving on the slow laptop.
- Backup: `D:/CodexOutputs/Rope_Speed_20261104/step29-whole-threads/`. Trial files: `D:/CodexOutputs/Rope_Whole_Test_20261105/`.

## Laptop report and what is really drawn (2026-11-05)
Research only, no site code changed. Reports and the measuring script: D:/CodexOutputs/Rope_Speed_20261104/laptop-reports-20261105/.
- Laptop (AMD Radeon built-in graphics, 1920×970 drawn): 6 fps at the start, 12.8 fps at the end. Chip time 162 ms threads and 3.7 ms glow at the start, 72 and 3.3 at the end.
- Load 19 s: download 17.3 s, unpack .21 s, first frame .26 s.
- Sent to the chip at the start, 3.78M segments at 4 triangles each, which with the core gives exactly the 15.6M the page reports: 21% seen, 58% hidden, 13% off screen, 9% thread ends that draw nothing. At the end of the path: 7% seen, 81% off screen.
- 89% of seen segments at the start are under 1 pixel wide.
- Never seen from any point on the path: 26% of segments if hover's .15 depth lift must stay exact, 47% if not. Checked at 49 positions; 10 other positions showed under 1% of those appear, so a real cut needs closer positions and a margin.
- Draco cannot pack threads: its glTF extension takes only triangle primitives, and threads are line strips (51 of the 57 MB). The file uses meshopt. Neither changes triangles drawn.
- Codex's reductions: theatre without sofas 1.77M to 496K triangles, corridor 345K to 75K, both solid surfaces. The rope file is already Codex's cut: 14.5M to 3.86M points, fuzz 1 in 4, all thread fibres kept.

## Report on the rope page (user's request, 2026-11-05)
- Why: on the laptop the page takes 25 s to load and then lags badly. The cause is not measured yet.
- Codex's loading report now also runs on `/rope-model`, only with `?diagnostics=1` (`rope-report.tsx`). It adds the graphics chip's name, drawing size, model load marks, and frame times overall and for each 10% of the tunnel. Where the browser offers the timer it also gives the chip's time for threads and for glow. That timer was not in the approved list; it only adds to the report.
- Normal link: no panel and no meter. Pictures are byte-identical to before the change at 6 test views, with and without the report. Panel test 25 of 25, type check clean, no errors.
- Laptop link: `http://192.168.1.5:3000/rope-model?diagnostics=1`. Port 3000 is a temporary relay to the dev server on 3100, because 3100 fails from the laptop (reason unknown). It replaces the 3100 link below. Tested on this computer through that address, not on the laptop itself.
- Correction: the page draws far more than the file's count suggests, because each thread segment is one quad of 4 triangles. RTX 4070 at 1920×1080: start 15.6M triangles / 312 calls, chip 7.6 ms; middle 11.3M / 216, 7.0 ms; end 6.2M / 108, 5.9 ms. Glow costs .3 to .5 ms of chip time. The earlier "1.8M triangles" counted the file, not what is drawn.
- Backup: D:/CodexOutputs/Rope_Speed_20261104/step20-report-connected/. Before this: step19-before-report/.

## White smooth stop, draw back, laptop link (user's request, 2026-11-04)
- Stop: over the last 45% of its length the white slows at a steady rate instead of stopping dead (`SPREAD.settle`). On the picture's rope it reaches full length in about 1.5 seconds (was 1.06). Top speed .75 units a second, .11 just before the stop, largest drop between frames .023.
- Leaving: the white draws back to the spot it started from, the spread in reverse, starting slowly. About 1.6 seconds on the picture's rope. It ends at radius -.25, half the thread jitter, where no white is left, so the picture returns exactly to what it was. Coming back part way grows it again from where it is. At speed 0 it still leaves (`backLeast`). Reduced motion keeps the gentle fade.
- Replaces "Leaving fades it out in .6 seconds" in the hover section below for normal motion.
- Test: the 25 panel checks pass, 10 of 11 stop and draw-back checks pass, and the 11th, thrown off by the first frame after idle, passes when rechecked on the live page. Type check clean, no errors. No shader change. Laptop untested.
- Laptop link: `http://192.168.1.5:3100/rope-model`. `allowedDevOrigins` in `next.config.ts` had to list this computer's address: without it Next.js refused the dev connection and the page stayed at "Loading model 0%". The address can change if the router gives this computer a new one. Loaded from this address on this computer only; another device could not be tested from here. The firewall already allows `C:\Program Files\nodejs\node.exe` in.
- Backup: D:/CodexOutputs/Rope_Speed_20261104/step18-smooth-and-link/. Before this: step17-before-smooth/.

## New base values and white length (user's request, 2026-11-04)
- The user set these on the panel and asked for them to be applied. They are now `TUNING_BASE` in `rope-tuning.tsx`: red glow 1.2, shine .8, gloss 0; white glow 4, shine 1.8, gloss 0, speed 3; flow speed .3. Sliders, Reset, Reset all and Hold now use them. On the sliders 1 still means the look matched to Blender, so `?still` no longer gives the Blender-matched picture unless the sliders are set back to 1.
- White length: it no longer spreads along the whole rope. It stops at `reachScreen` .19 of the screen width from the mouse on ropes up to `reachDepth` 3 away, measured against the user's picture (depth 3.01 rope). Further ropes keep the same real length (.855 units), so they look smaller. At the same on-screen length they curled around the hole, which the user had rejected.
- Measured at 1919x945: the picture's rope 651 pixels end to end, against about 670 by eye in the user's picture. Mid rope 550, depth 12 rope 124, depth 22 rope about 66. Near ropes vary with their angle and position (506 and 733). Full length after about 1.1 seconds at speed 3 (radius read directly, 1.06 s).
- Reduced motion: the same length fades in, instead of the whole rope.
- The patch does not follow the mouse; the user asked for the length change alone. No new slider.
- Test: 23 panel checks pass except two whose test was wrong (the panel's held rope is already at full length, so speed cannot show there). Those were retested on a real hover: 5 of 5, including that the white stops and stays. Type check clean, no console errors. No shader change. Laptop untested.
- My first pictures this round used old saved values in the test browser; all numbers above were retaken with the browser's saved values cleared.
- Backup: D:/CodexOutputs/Rope_Speed_20261104/step16-values-and-length/. Before this: step15-before-length/. Pictures: length-pictures/.

## Look controls (temporary tool, asked for by the user)
- Panel top right on `/rope-model`, code in `components/rope-model/rope-tuning.tsx`. Red: glow, shine, gloss. White: glow, shine, gloss, speed. Energy flow: speed. 1 was the approved look when this was built (see the new base values above); gloss starts at 0. White speed was added because the request could be read either way.
- Glow scales the post processing halo (white's stored level is divided by red's glow so the two stay separate). Shine multiplies the thread's glow term, or the white level. Speed multiplies the pace.
- Gloss is new, not in the Blender file: a tight highlight along the thread (tightness 300), light from ahead and to one side (.35, .45, -.82), colour (1, .43, .03) on red. All of these set by eye. At 0 the shader skips it.
- Mouse inside the White box keeps the last rope white, so it can be seen while adjusting. If no rope has been hovered yet, one is chosen.
- Values are saved in the browser only (`rope-tuning-v1`) and are never in the code until the user sends them and says to keep them. Copy values gives them as text. Hold to see approved look compares. `?still` also uses the saved values, so reset before comparing with Blender.
- Test: 23 of 23 checks with real input events. Each control changes the picture; each back at its base value gives the identical picture; speed 0 stops the white and the light; values survive a reload; reset all restores; wheel over the panel does not fly the camera. Base still look at the middle stop is byte for byte the approved one.
- GPU median at 1920x1080, middle of the tunnel: base 8.4 ms, red gloss 1 8.3 ms, gloss with glow and shine at 3 8.4 ms. Laptop still untested.
- Backup: D:/CodexOutputs/Rope_Speed_20261104/step14-look-controls/. Before this: step13-before-panel/.

## Red and green as two joined tunnels (user's request, 2026-11-05)
Replaces the one recoloured tunnel. Only on `/rope-flight` and `/rope-flight-laptop`. `/rope-model` and `/rope-laptop` score 1.000 against their baselines at all five stops (the only differing pixels are the Next dev badge).

- Red stays whole. Green is a second whole copy of the same threads, placed by a matrix past red's far tip, so green costs no extra download on desktop.
- The tunnel is a cone, measured from the file: rope circle radius about 1.25 at the near mouth, about 2.1 at the far tip. An unscaled green mouth is about 40% narrower than red's tip, which is what looked like "shrink and fit". Green is therefore scaled 1.72× (`GREEN.scale`), so its mouth meets the tip.
- Each rope sits about .91 rad further round at the tip than at the mouth, so green is turned .91 (`GREEN.turn`) and each green rope carries on from the same red rope.
- No fade: the user removed it. Green's threads widen to 1.5× from the stop to the end and dim by the same factor, so it softens without losing brightness. It stays visible at the end, so the end frame no longer equals `/rope-model`.
- A full-screen quad on the far plane (`farHoleMaterial`) paints dark green inside the opening and dark red outside, so green does not leak through gaps in the red walls.
- Flight: 28 screens, stop at 44.6 of 59.6 units, held at .74 to .76 of the scroll. About 8 s to the stop, 2.6 s on to the end.
- Known and left alone: red's thread ends are torn where green begins. Softening them was offered; the user has not chosen.
- Laptop flight has its own file, `public/rope-flight-laptop/rope.bin`, 2,948,180 bytes, built with `--views 31 --behind 8 --points 430000`, because the near-mouth threads of `/rope-laptop`'s file are never seen on its path but are the green tunnel's far end here.
- Speed at 1536×776 on the RTX 4070 (the 75 Hz screen caps it at 75): desktop flight 75 fps, thread drawing 5.8 to 10.5 ms, about 10M triangles at the end of the run; `/rope-model` 5.4 ms on average. Laptop flight 75 fps, thread drawing 1.7 to 4 ms. Not yet tested on the user's AMD laptop.

### Card changes
- Smaller (32% of the width, at most 52% of the height), border removed, image fills the card.
- X or Esc closes it. Cards are then off at this stop and only the white rope is left. A small "Show cards" button shows bottom-right only while off. Clicking it opens nothing; the next rope hover opens the next number. Leaving the stop or refreshing also turns cards back on. The count continues after closing; only a refresh returns to 1.
- Bug found by test and fixed: the scroll rests on whole pixels, and a pixel is about .003 of camera travel. A wheel at the stop moved the target by that much, which counted as leaving the stop: cards turned back on, a card flashed and used up a number. `flightAtStop` now measures from the stop itself.
- Tests: `scripts/rope-card.test.mjs` 13 of 13, real mouse tests 12 of 12 for close and button on both flight pages, wheel test on both.

Backup: `D:/CodexOutputs/Rope_Speed_20261104/step26-joined/`.

### Soft join, stop further back, close button, no white on green (user's request, 2026-11-05)
Replaces these numbers above: green's shift is now -22.5, turn .62, the stop is at z -9 (50.6 of 59.6 flown, held at .832 to .852 of the scroll), about 9.3 s to the stop, 1.8 s on to the end.

- Thinning threads alone did not soften the join. The red tunnel is about 99.6% covered by thousands of overlapping dark threads, so it stays solid until nearly the last thread is gone, and green then appears at a hard edge. Tried first and dropped: thinning only, with 6 units of overlap (dark band in the flight, hard round edge at the stop).
- What is in now, all in `rope-flight.ts` under `JOIN`: green's mouth reaches over red's last stretch, just outside it (red ends z -30, green starts z -18). Each thread thins and dims at its own length. Thread colour goes from red to green over z -18 to -36, the same function in both tunnels, so no thread in front of another shows a colour edge. The change is even in 1/distance from the stop, because perspective squeezes the far end into few pixels. Red's dark core slides outward over z -16 to -24 so it does not hide the green.
- This is a short colour change in the join only. Red stays pure red before z -18 and green pure green after z -36. The user rejected red recoloured over its whole length earlier.
- White hover now only reads the red ropes, so green never turns white, in the tunnel or through the opening. `rope-hover.ts` is back to one material.
- Close button bug: the X sits above the scroll layer, so moving onto it fired `pointerleave`, the mouse counted as gone, the card closed 120 ms later and reopened. `away` now keeps the card when the mouse is still on it. The earlier test clicked within 100 ms, before the card closed, so it missed this. `flight-card-off.mjs` now rests on the X for 2 s and moves back and forth, watching every change.
- Speed at 1536×776 on the RTX 4070: desktop 75 fps, thread drawing 4.4 to 11.5 ms; laptop 75 fps, 2.6 to 4.2 ms, 2.95 MB. Not tested on the user's AMD laptop.

## Hover white spread (build step 2)
- Approved by the user on 2026-11-04. Code: `components/rope-model/rope-hover.ts`, plus small parts of `rope-materials.ts`, `rope-finish.ts`, `rope-model.tsx`.
- Finding the rope: 3000 points per rope are kept on the processor. Each frame the mouse or camera moves, the nearest rope within reach of the mouse is chosen (.12 world units or 12 pixels, whichever is wider). The chosen rope stays unless another is clearly in front. Real mouse only; touch is ignored.
- The spread: starts at the point found and grows by straight distance from it, on that rope only. Pace .05 + .06 x depth units a second, about 100 pixels a second at 1920 wide, speeding up 12% a second, top 2.2. Each thread's front is a little ahead or behind. A brighter band runs just behind the front. Leaving fades it out in .6 seconds. These numbers were set by eye, nothing to match them against.
- White does not go through the red colour grade: it tops out at about 58% red, 60% green, 49% blue, so white came out tan. Threads store white in alpha and the final step goes around the grade.
- Halo: white is stored dim and warm (green .3, blue .1), so the glow stays in the tunnel's red. With neutral white the grade turned the halo purple.
- Fuzz hairs have no rope of their own and stayed dark red, like scratches on the white. White threads are stored .15 units nearer in depth so they draw over the hairs. They can also draw over a neighbouring rope by that amount.
- Reduced motion: the whole rope turns white gently, no creeping. The user raised no objection.
- No hover: still look byte for byte the same as approved (checked at the middle stop). After leaving a rope, frozen moment: 0 pixels different.
- Test results, 1920x1080, middle of the tunnel, light running, GPU median: no hover 8.3 ms, hover held 8.3, mouse sweeping 8.3, wheel while hovering 8.0. Script per frame .73 ms, .74, .89, .92. At 1920x1080 scale 1.5: 10.9, 10.9, 11.0, 10.6. All 75 frames per second.
- Camera: does not move under the mouse. Touch: picture unchanged. Empty hole: picture unchanged. Leaving the window: picture restored. Frozen view at rest: 0 frames. Reduced motion: white settles, 0 frames at rest, leaving restores it.
- Wheel test with the light frozen, no mouse: 73.6 frames per second, 13.4 ms, GPU median 6, worst 106.8 ms (the old hitch), camera path correct, same picture on the way back.
- Laptop still untested. Info and pictures on hover come with the sections in build step 5.
- Backup: D:/CodexOutputs/Rope_Speed_20261104/step12-hover-white/. Before this step: step11-before-hover/. Pictures: D:/CodexOutputs/Rope_Speed_20261104/hover-pictures/.

## Energy flow (step 5)
- Approved by the user on 2026-11-04. Laptop test still to come.
- How it works: each thread's glow is multiplied by rest .25 plus a moving pulse. Speed .35 per second, spacing 1.6, tail 3, 80% of threads carry light. These are the old recipe's defaults, not fitted to anything. The picture's glow post processing reads the result, so bloom travels with the light. Baked light and shadow do not pulse.
- Direction: away from the camera, into the tunnel. Sharp head at the far side, long tail behind. One light passes a given spot about every 4.6 seconds.
- `?still` gives the look matched to Blender, `?flowAt=.3` holds the light at one moment. People who ask for reduced motion get the still look and no new frames.
- Still look against the accepted 4c pictures: all four stops byte for byte identical.
- Average of 8 moments against the still look, website output: red .93, green 1.01, blue .97 at the start, red .93, green 1.01, blue .97 at the middle. Red falls short because the brightest pulses reach the top of the colour curve and clip. Single moments vary about 6% in overall brightness.
- Fuzz hairs have no length to travel along, so they could have blinked. They carry almost no glow: holding them steady changed 1 pixel by 1 level. Left as they are.
- The light multiplies the matched glow, so it fades where the still picture is dark. A thread seen end-on stays dim as the light passes. The old version had a small floor for this; not added, to keep the matched look.
- New cost: frames now draw all the time while the page is open, not only on scroll. Idle frames are no longer 0. Battery use on a laptop is not tested.
- GPU median with the light running, 1920x1080: start 7.4, 10% 7.2, 25% 6.9, 40% 8.4, 50% 8.2, 60% 7.8, 75% 7.4, end 6.7. Same spots with the light frozen: 7.4, 7.2, 6.9, 6.2, 6.1, 5.7, 5.3, 4.8.
- So the running light costs about 2 ms from 40% onward and nothing before it. Cause not found. It does not depend on the moment of the light, on continuous drawing or on camera movement; only on the clock changing.
- Screens, middle of the scroll, light running: 1920x1080 8.2 ms; 1440x900 scale 1.5 9.0 ms; 2560x1440 9.7 ms; 1920x1080 scale 1.5 10.8 ms. All held 75 frames per second here. Laptop still untested.
- Mouse moving with the light running: camera did not move. Reduced motion: 0 new frames in 2 seconds; turning it off starts the light again.
- Wheel with the light running: 75 frames per second, 13.7 ms at the slow end, worst 14.1 ms in a short run. Wheel test with the light frozen: 73 frames per second, 13.4 ms, GPU median 5.9, worst 119.9 ms (the old unexplained hitch, still there), camera path correct, same picture on the way back.
- Backup: D:/CodexOutputs/Rope_Speed_20261104/step10-energy-flow/. Before this step: step9-before-flow/. Pictures: D:/CodexOutputs/Rope_Speed_20261104/flow-pictures/.

## After 4c, softer strokes (replaces the same numbers in the section below)
- Stroke width, nearness of neighbouring pixels, near threads, website / Blender: start .734 / .740 and .753 / .756; middle .684 / .690 and .699 / .708. Far threads are now a little too soft: .624 / .581 and .628 / .574.
- Fine detail, no blur: .903 / .898 / .900 / .934. Pixel roughness .0281 / .0306 / .0328 / .0234 against Blender .0288 / .0312 / .0335 / .0242.
- Overall red 1.02 / 1.03 / 1.04 / 1.04, green 1.11 / 1.15 / 1.25 / 1.14, blue 1.03 / 1.05 / 1.09 / 1.05. Green is only about 4 to 7 of 255 on the screen, so these are about one colour level.
- Brightest threads: red .97 / .98 / 1.01 / .98, green .97 / 1.01 / 1.20 / .98. The top 1% of red runs high at the end stop: .776 against .715.
- Hole, inner 40 pixels, display red: 35.9 / 34.3, 33.8 / 32.1, 28.8 / 27.1, same floor at the end.
- Wheel test at 1920x1080: 73 frames per second, 13.4 ms at the slow end, GPU median 6.1, worst single frame 160.1 ms (this hitch moves between 80 and 187 ms between runs, cause still unknown), mouse 0 new frames, idle 0, same picture on the way back.
- Screens, start and middle: 1920x1080 7.6 / 6.2 ms; 1440x900 scale 1.5 8.4 / 7.5 ms; 2560x1440 9.6 / 8.2 ms; 1920x1080 scale 1.5 11.3 / 9.9 ms. Laptop still untested.
- Tried and dropped: real partial coverage at full width (alpha to coverage). It adds about 1.7 ms and matches no better than the filter. Dimming full-width threads by opacity (scores fell). Removing the tint by camera distance (mid tones far too bright).
- Still different: a few single threads are bright orange on the website and dim red in Blender, because Blender sees them through other threads. A few thin threads show a dotted look at zoom.
- Backup: D:/CodexOutputs/Rope_Speed_20261104/step8-soft-strokes/. Before this step: step7-before-soft/.

## Look against Blender's pictures with glow (1920x804, website / Blender)
- Reference: `D:/CodexOutputs/Rope_Bake_20261104/truth-glow/`. Blender only supplies these pictures; colour, shadow, shine and glow all happen in code.
- Order of stops: start / 25 / 50 / end. Broad shape .949 / .948 / .951 / .968. Fine detail, no blur, .901 / .897 / .898 / .933.
- Overall red 1.01 / 1.01 / 1.02 / 1.02, green .95 / .96 / 1.07 / .96, blue .96 / .97 / 1.00 / .98.
- Glow alone at the start stop: total red 100.7% of Blender, green 96.9%, blue 98.2%. Inside the hole .0056 against .0057.
- Centre hole, display red, inner 40 pixels: 34.8 against 34.3 at the start, 32.8 against 32.1 at 25, 27.9 against 27.1 at 50, same floor as Blender at the end.
- Pixel roughness .0299 / .0324 / .0343 / .0246 against Blender .0288 / .0312 / .0335 / .0242.
- Still short: brightest threads, red .95 to .99 and green .87 to 1.12 depending on stop. Darkest pixels at stop 50 run a little high. Far threads look slightly more dotted than Blender's, and thin bright threads look a little wirier, with Blender's strokes softer and wider. Top highlights at stop 50 run yellower.
- Wheel test after 4b at 1920x1080: 74.2 frames per second, 13.4 ms at the slow end, worst single frame 80.1 ms, GPU median 6, mouse 0 new frames, idle 0, same picture on the way back.

## Notes
- Far-thread bug: on threads thinner than a pixel, the 4 samples across the thread fell off its edges and counted as zero shine. Threads near the hole read half of Blender's brightness and the glow they feed was weak. Samples now stay on the thread. Same cost. Ruled out by test first: grain distance levels, minimum thread width.
- Fitted numbers, not derived: tint strength (green and blue squared) and the bright-thread rule (.3 to .8). The backdrop (.0035, .00005, .00034 before the curves) is read from Blender's end stop.
- The glow itself was not strengthened. It still uses the file's own settings.
- Backup of this state: D:/CodexOutputs/Rope_Speed_20261104/step6-after-far-threads/.
- Screens after 4b, start and middle of the scroll: 1920x1080 7.7 / 7.0 ms; 1440x900 scale 1.5 8.6 / 7.2 ms; 2560x1440 9.4 / 8.2 ms; 1920x1080 scale 1.5 11.0 / 9.9 ms. Laptop still untested. One run read 23.9 ms at the last spot; three repeats read 9.9 ms.
- Step 3 timings are the GPU median on an RTX 4070 at a fixed scroll spot (start of scroll is the worst frame). Earlier rows measured at 25% of the scroll, where the same frame was about 1.5 ms cheaper than at the start.
- Screens after step 3, start and middle of the scroll: 1920x1080 7.3 / 6.0 ms; 1440x900 scale 1.5 8.2 / 7.0 ms; 2560x1440 9.2 / 8.0 ms; 1920x1080 scale 1.5 10.8 / 9.7 ms. Laptop still untested.
- Step 3 colour: red within 1 to 3% of Blender, green 6 to 15% low, blue 8 to 15% low. For the colour step.
- Step 3 fine detail at the start of the scroll, no blur: .864 (it was .856). Pixel roughness .037, Blender .038. The soft filter strength was fitted to that roughness.
- Tried and dropped in step 3: removing thread points (a full pixel of movement only removes 9%, about 0.3 ms); colour fade on thin threads (scores fell to .90 to .95); cheaper grain settings (no saving left).
- Ready if laptops need it: 4 edge samples instead of 8. About 1 ms faster, half the memory, fine detail .860. Stills only; not checked for flicker in motion.
- Worst single frame in the wheel test is 133.5 ms, cause unknown. The first-return difference at the top of the scroll no longer shows in the wheel test.
- Backup of step 3: D:/CodexOutputs/Rope_Speed_20261104/step4-frames/.
- Step 2b is lossless: the picture at the start is pixel-identical before and after. The grain texture is no longer 6K; at 3x zoom it shows no visible loss.
- Scroll test after 2b: 73 frames per second, 13.4 ms at the slow end, worst 187 ms. Drawing the same spot repeatedly gives an identical picture and camera; only the first return to the very top differs, in about 560 of 2 million pixels. The wheel test also flags the 10% stop, not found when placed directly. Cause not found; not visible.
- Raw model before packing: D:/CodexOutputs/Rope_Speed_20261104/rope-red-raw.glb. Backup of step 1: D:/CodexOutputs/Rope_Speed_20261104/step1-points/.
- After step 1, real wheel scrolling: 60.9 frames per second on average, 26.7 ms at the slow end (95th percentile), one 253 ms hitch. GPU time by position: start 18.1 ms, 50% 16.5 ms, end 7.9 ms. No laptop tested yet.
- Step 1 check: glow colour and opacity fit exactly; glow strength error is under one 8-bit step, total light .06533 on both.
- Before step 1, almost all frame time was the shader on hidden threads reading 6K sheets. Drawing the threads with a plain colour took 5.5 ms.

## Step 5 started: flight attached to the real page, white portal (2026-11-05)

- First transition is live inside `.normal-page`: section 1 -> green -> red stop -> section 2. Sections 2 -> 3 -> 4 stay plain scroll (blue and yellow were skipped). Sections hold placeholder colours; no real content yet.
- `components/corridor/section-flight.tsx` owns the page side, `components/rope-model/rope-link.ts` is the small contract, `components/rope-model/rope-portal.ts` owns the portal. Rope pages without a link behave as before.
- Scroll order: the camera waits for the first 2.2% of the scroll while the information fades and blurs out and the section turns pure white. The white then stays behind as a real disc at the far end of the green tunnel (z -60.2, radius 3.05), so threads overlap its rim by depth.
- Colour: the portal writes alpha only. Neutral light through the green grade comes out cyan, so white is forced in the last pass and its light added afterwards in display colour.
- Grey rule: partly covered white over dark reads as grey. So the soft edge and the haze are green until nearly solid (`portalTint`, `air`), and the portal goes out by closing while staying white (camera z -23 to -12, after the -24 join), not by dimming.
- The rope canvas wakes once the section is 90% through its white-out. Its first draws are slow (two frames near 80 ms), and they now fall on solid white.
- Device choice: `ropeFlightDevice()` in `effect-quality.ts`. Mobile and no-WebGL2 get plain scroll of all four sections.
- Review route: `/sections` (`?end` enters at section 4). Review only.
- Tested on the RTX 4070 at 1920x1080: home-page journey with real wheel to the zoom-out and on to logoReveal; `/sections` and `/sections?end` on desktop and laptop versions, including the way back and a second trip. Median flight frame 13.3 ms at 75 Hz. `/rope-flight` matched baseline except the Next.js dev badge; its card, wheel and hover tests passed.
- Not tested: a real laptop with both canvases, real phones, real section content, clickable content in section 1 (`over` sits under the scroller and will need pointer handling).
- Backup from before step 5: `D:/CodexOutputs/Rope_Sections_20261105/before/`. `rope-finish.ts` and `laptop-finish.ts` were not in that backup; the portal parts are small and do nothing at strength 0.
