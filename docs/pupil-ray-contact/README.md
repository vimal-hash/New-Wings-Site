# Thin rays and grain handoff — 2026-10-28

The user requested three changes to the accepted icy silver/blue pulse: a much brighter first pupil-border trace followed by another brightness lift; thin strong rays in empty space; and illuminated grains taking over the visible light at contact. Keep the palette, final pupil fill, camera path and particle physics/counts/coverage/blending/LUT intact.

## Timing and light shape

`pupil-pulse-state.ts` keeps the same pause, trace duration, release time and finite travel. The completed pre-flash border now reaches 1.25 instead of .30. Its additional launch flash remains a fast attack/slow decay, then returns to the original dim settled outline (.075). Reduced motion still skips the flash/travelling wave.

The ray has an independent narrow width of .016 pupil radii, with derivative antialiasing, a strong white core and a small icy blue shoulder. It no longer uses the broad grain-reaction tail as its visible width. Its private HDR multiplier is 8. The grain reaction width is .26 pupil radii, retaining a short fade and the same 3D world-distance arrival. Grain highlight strength and HDR extraction are raised (12× extraction), with darker atlas facets still retained. The shared palette and hero bloom gain/radius remain unchanged.

## Contact

`pupil-ray-contact.ts` renders a private density mask from the **actual** authored grain geometry, moving vertex path, atlas alpha, current pose and depth. Geometry, uniforms and texture are borrowed, not duplicated or modified. Its owned material accumulates coverage into one small RGBA8 target. A five-tap local sample feathers the handoff: the ray remains bright in empty space and fades into grain highlights in dense deposits. The main and HDR ray shaders share this live mask, so the bloom does not recreate a full ring across the particles. Clip-space UVs keep the same mask alignment when the HDR target is scaled on a lower quality tier.

The mask runs only during the travelling wave (and one hidden stationary preparation). Desktop/laptop/mobile scales are .25 / .1875 / .125 of the drawing buffer; no fullscreen native-size target is added. At 1920×945, desktop uses 480×236 RGBA8 (~453 KB). The active pass is included in existing frame draw-call/triangle metrics. Target, clear colour/alpha, auto-clear, shadow-update state and the temporary grain footprint uniforms are restored in `finally`. Main-frame particle alpha/blending remain untouched. Owned contact target/material dispose with the pulse; the borrowed geometry/atlas are never disposed here.

`star-bloom.tsx` prepares the coverage shader and target at an existing stationary stop, before warming emitter sampling. It submits the contact pass after the frame-stat reset and before base rendering. No new permanent animation loop, package, source asset or camera change is added. Existing Replay light / View 1 / View 2 controls re-arm/reset the effect.

## Evidence and restore

Exact pre-change source copies, native screenshots, GPU observations and the verified viewport recording are saved in `D:/CodexOutputs/Pupil_Ray_Contact_20261028/`. Build, TypeScript/lint and all 75 tests pass. Active desktop cadence measured 13.3 ms median / 13.4 ms p95 (~75 fps) on the workstation. Desktop/laptop/mobile program profiles retain 238353 / 98304 / 49152 main grains, with no shader/browser errors, correct reset, no reduced-motion flash and final bloom shutdown. These are workstation profile checks, not physical low-tier device measurements.

`handoff-on.png` / `handoff-off.png` compare the same held wave with the mask enabled or diagnostically bypassed. `contact-verification.json` records actual GPU mask alpha/readback and its resolution. `contact-3840.png` shows the final contact; timed `pulse-*.png` show the brighter first trace and launch. The ordinary full scroll journey and earlier close views are also rechecked.

The held-time comparison removes the overlaid line over 23,681 pixels in the audited grain-contact region while changing no empty-side pixels by more than two code values and leaving the pupil region identical. Actual GPU coverage is 480×236, with both fully empty (alpha 0) and dense (alpha 255) regions. The earlier two views differ from the saved version by at most one code value in the audited scene region. The full journey completes without browser errors and accounts for the additional contact draw during the travelling wave.

To revert only this task, restore the archived `pupil-pulse.ts`, `pupil-pulse-state.ts`, `star-bloom.tsx` and `eye-index.tsx` (to `logo-particle-eye/index.tsx`), remove `pupil-ray-contact.ts` / `scripts/pupil-ray-contact.test.mjs`, and remove this task's documentation note. Preserve the earlier glow refinement and initial pulse/fill. `refs/checkpoints/eye-one` stays at `fe1ad8ec53c888be42f08c814ff0192513aae31a`.
