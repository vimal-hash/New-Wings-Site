# Blue wormhole — Section 2 to Section 3

Implemented 5 November 2026 in `new_site_three`, at the user's request. The green/red connection remains Section 1→2. Blue alone connects Section 2→3. Section 3→4 now uses yellow/green (see `docs/yellow-green/README.md`); phones retain four native sections without rope flights.

## Experience

Section 2 turns white before the camera leaves. That white becomes a real depth-tested opening at the far end of the blue tunnel. The camera backs from z≈-21.5698 to z=-12, settles and waits for another gesture. The existing white-rope interaction and five numbered placeholder cards work at that stop. A fresh gesture resumes backward travel to z=0 and brings Section 3 into view. Both connections reverse, with the same intermediate stops.

Blue uses 16 scroll screens, approximately 21.5698 world units of travel, stop distance 9.5698 and hold shares .48–.52. The source-space middle stop remains z=-12. The existing camera spring (.35 s), gesture end detection (180 ms) and glide pace (400 ms/screen) are shared. Green/red's original profile and shader logic are preserved. Its halo is blue; white stays outside the colour grade.

### Portal handoff and close-up correction

The original blue entry reused .022 of a shorter scroll range, so its white handoff lasted only .33 viewport heights instead of the first connection's .594. It also replaced the entering gesture with an artificial .1-screen nudge, and independently closed the portal from camera z=-19 to -13. This made the blue opening pinch away near the camera rather than recede like the first opening.

Both entries now use the original .594 viewport-height white handoff. The camera stays at its starting pose until white is complete, and the existing stop shares remain exact. Re-entering a connection carries the actual entering wheel/touch/key distance into its scroller; wheel line/page units are converted to pixels. The initial Section 1 entry remains native scrolling.

Matching only the portal's radius/depth ratio still left a visible discrepancy: blue looked through a different twist of the shared model, and uniform white haze flattened its darker rope tips. Blue now derives its entrance and portal directly from green's actual placement: remove green's -22.5 translation and divide by its 1.72 scale, while retaining its .62 radian rigid orientation. This matches the original strands and depth overlaps around the opening. It changes blue's starting camera pose and rigid model orientation; its z=-12 hover stop, z=0 endpoint, source vertices, palettes and material controls stay intact. Rotated culling bounds and hover samples follow the same placement in desktop and laptop paths. No new model or texture is generated.

| Value | Approved green | Blue in original model units |
| --- | --- | --- |
| Starting camera Z | -59.6 | (-59.6 + 22.5) / 1.72 ≈ -21.5698 |
| Portal Z | -60.2 | (-60.2 + 22.5) / 1.72 ≈ -21.9186 |
| Portal radius | 3.05 | 3.05 / 1.72 ≈ 1.77326 |
| Soft edge | .26 | .26 / 1.72 ≈ .15116 |
| Model rotation | .62 radians | .62 radians |
| Closing start / end | -23 / -12 | -.29070 / 6.10465 |
| Portal strength | .85 | .85 |
| Near / far halo reach | .3r+.02 / .8r+.06 | shared |
| Thread light gain | 2.1 | shared |
| Air near² / far² | .95 / .16 | shared |
| White fade distance | .594 viewport heights | shared |

A single blue tunnel never backs far enough away to close this opening at its middle stop: the white opening remains visible there and recedes naturally. Only blue's white air contribution is modulated by `.7 + .3*smoothstep(.05,.8,max(shown.rgb))`: dark rope valleys keep detail and bright fibres receive the strongest white. This is an artistic screen-space receiver response, not an additional physical light. The blue tint and original white reconstruction remain; the green portal GLSL is byte-identical to its earlier version. The green/red desktop and laptop shader logic also matches its pre-blue baseline.

Regression checks cover identical physical white distances at three viewport heights, no camera travel before white completion, exact hold preservation, equal portal projection/closing curves, equal projection of the original strands and containment of rotated bounds. The production build/TypeScript, scoped ESLint and all 39 focused tests passed. Matched browser views use four aperture sizes on desktop and two on laptop, with fixed source light time, matching aspect and camera projection. The white-core silhouette Dice score was approximately .9956–.9979 in the three measured desktop views; this measures contour overlap, not colour or animation equivalence.

Desktop completed the full 1→2→3→2→1 round trip with both intermediate stops, hover/close behavior, one reused canvas and one geometry request. The earlier 800 ms delayed-palette check confirmed the same 150 px gesture produces white opacity .192002 in both entries. Reversing before the canvas wakes returns to the native section and permits immediate backward entry into red. Protected model binaries and Blender sources retain their hashes. Laptop-path checks use the workstation GPU.

Initial handoff evidence: `D:/CodexOutputs/Portal_Match_20261105/`. Close-up comparison, supplied reference images, source backups, shader regressions and current HD views: `D:/CodexOutputs/Portal_Fine_20261105/`. `matched-comparison-hd.png` shows green above blue at the same three aperture sizes.

### Smooth section and camera handoff — 6 November

Completed and browser-verified before starting yellow/green. The white reveal now follows wheel input through a finite critically damped `.18 s` controller (`section-fade.ts`), rather than applying wheel jumps directly to opacity. The camera stays at its true covered start until white completes. `RopeLink.startZ` seeds the existing `.35 s` camera spring when a reused connection starts; the laptop's private quality test remains at its heaviest pose and restores that seed before visible flight. Each new link receives a fresh canvas wake callback.

Blue's shorter entrance previously compressed the same smoothstep glide into too little time. Only its entrance leg now scales duration by `sqrt(22.464/7.2)` (about 1.766), matching the first connection's initial scroll acceleration. Its exit pace remains unchanged. The first connection's glide durations stay exact. The yellow/green connection uses the same new white owner with the original joined-flight duration.

Four production-browser runs covered desktop/laptop rendering and single 150/900 px wheel gestures, hover and return. The largest white-opacity change per recorded frame was about .025–.074; first visible camera Z stayed within .006 of the actual -21.5698 start. Normal-motion early cancellation and an 800 ms delayed-palette entry also passed. Reduced motion keeps direct input and no automatic glide. Appearance, textures, geometry and portal proportions were unchanged by this motion fix. Backups and traces: `D:/CodexOutputs/Portal_Smooth_20261106/`; `stage-one-complete.json` records completion before the next connection started.

`normal-page.tsx` owns four native sections and selects one of two connection profiles. `section-flight.tsx` owns the covering planes and the transition contract. A single rope canvas is reused. Entry resets the reused covering planes before paint, so the next section cannot flash while a material loads. The green/red and blue card counters are independent. Real case-study images have not been supplied; cards retain the existing numbered placeholders.

## Blender appearance and unchanged geometry

Source: `D:/CodexOutputs/Loki_Rope_20261103/r3f/Rope_DarkBlue_r3f.blend`. The original optimized blue and red export reports share geometry hash `7af2c0d27b363682`.

No new GLB or laptop geometry binary was generated. These existing files are unchanged:

- `public/rope-model/rope-red.glb?v=2`: 41,976,548 bytes, 2,863,555 stored thread point records.
- `public/rope-flight-laptop/rope.bin?v=3`: 2,939,151 bytes, 425,600 points.
- `public/rope-laptop/rope.bin?v=4`: unchanged standalone asset.

The existing geometry contains red emission colour per point. Its monotonic source colour ramp can recover the shared hue coordinate. `scripts/blender/export-blue-rope-look.py` opens the actual blue Blender scene, checks its material ramp against the approved source record, and exports no-glow blue emission lookup textures by evaluating that source ramp at the recovered hue coordinate. This avoids a second geometry download or full-size appearance atlases.

- Desktop palette: 1024×1 RGB PNG, 626 bytes.
- Laptop palette: 256×1 RGB PNG, 438 bytes.
- `components/rope-model/blue-look.json`: source tints, core colour, exposure, original colour ramps, final channel curves and export record.

The lookup is decoded from sRGB once, then used in the thread shader. Existing grain, scalar emission strength and baked lighting remain shared. The small diffuse contribution uses the source colour-family matrix; transmission uses the existing depth/tint approximation with channels reassigned for blue. This is a source-informed material reconstruction, not a new Cycles lighting bake or a claim of pixel equivalence. Amber accents retain their source ramp.

Blue's source side tint is [.033,.213,.72], face tint [.15,.518,1]. The final blue channel curves come from the blue source's approved grade. The existing controls remain glow 1.2, shine .8, gloss 0; white glow 4, shine 1.8, gloss 0, speed 3; flow speed .3. Blue has no green/red join or duplicate tunnel copy. Desktop/laptop quality algorithms and texture precision remain unchanged.

## Reproduction

Run the installed Blender in background mode, with TEMP/TMP on D:, then:

```text
blender -b --python scripts/blender/export-blue-rope-look.py -- "D:/New folio/new site code/new_site_three" "D:/CodexOutputs/Blue_Section_2_3_20261105"
```

It exports the two lookup textures and source manifest, and renders a 1920×1080 reference at Blender Y=12 / web Z=-12, horizontal 24 mm / 36 mm sensor, 64 Cycles samples. It never saves a .blend or exports geometry. The reference applies the source's recorded channel curves after its compositor output. The runtime retains the user's .8 shine / 1.2 glow and animated energy flow, so comparison with a static Blender frame has different illumination timing.

## Verification

- Production build and TypeScript passed. All 11 touched runtime files pass ESLint, with scoped explanations for R3F's imperative frame/scroll ownership.
- 36 focused tests passed: blue camera/palette checks plus existing card, laptop-quality and page-exit cases.
- Broader run: 170 tests, 168 passed; the same two pre-existing failures remain (`scene-idle` VM mock missing house lighting and the historical `staged-camera` heading constraint). The archive-writing `logo-reveal.test.mjs` was excluded.
- Desktop natural-wheel round trip: 1→green/red stop→2→blue stop→3→blue stop→2→red stop→1, no captured page/console errors. One rope canvas remained, with one desktop geometry request. White hover, numbered card, delayed close-button hover and dismissal passed.
- Laptop quality program: blue stop, white hover/card, onward arrival at Section 3, no captured errors. Fixed step 3 also passed, including two-sample stationary edge accumulation.
- Mobile touch: all four native sections reached, no rope geometry requested. Reduced motion: no automatic glide, and GPU draw calls stop after the camera settles.
- Full production home journey passed from opening through projector, corridor, liquid/page entry, green/red, blue, all four sections and the covered page return to the original camera journey.
- Protected geometry binaries and the blue/red Blender sources retain their SHA-256 hashes. Named eye-one/two/three refs remain unchanged.

All browser checks used the workstation GPU; compatible quality paths are not physical laptop/phone performance measurements. A matched-camera, 8-pixel block structural correlation was about .868 desktop / .799 laptop against the static Blender reference. The desktop mean blue channel was 64.50 vs 66.76; laptop 59.75 vs 66.76. These are illustrative measurements with different light timing, not acceptance scores or 100% match claims.

Evidence, backups, build/test logs and HD captures: `D:/CodexOutputs/Blue_Section_2_3_20261105/`. The main screenshot is `blue-main-site-hd.png`; hover is `blue-main-hover-hd.png`. The production preview listens on 0.0.0.0:3001. Direct review: `/sections?section=2`; scroll once to enter blue.
