# Immediate border and overlapping two-second emissions

Later circle-only timing correction: the contour now begins two seconds before final settle during the existing pullback. The emission clock and overlapping waves in this note remain current. See `../pupil-early-trace/README.md`.

The user corrected the timing: the circle begins on the exact final camera-settling frame; the two-second interval starts at each ray emission. Old waves continue travelling as new ones begin. There is no waiting for wave completion.

## Timing

- Initial delay is zero. The visible right-edge head is present at trace zero; the existing contour reveal then runs for 1.65 seconds. The completed circle/peak settings are unchanged.
- First release follows the existing .25-second hold: 1.9 seconds after settling. Further releases occur at 3.9, 5.9, 7.9… seconds.
- Every front retains its own five-second travel and .8-second tail. Three slots cover the maximum overlapping lifetime; finished fronts naturally disappear before a fourth would be needed.
- The circle traces only once. Existing older logo-flash envelopes continue under each fresh attack, avoiding a hard reset or summed overexposure. The bright peak keeps the selected preset gain.

`FullJourney` still writes the same sampled final pose at priority -1. `StarBloom` sees `cinemaShot.stage==='done'` in that same render frame and activates the pulse immediately, before the queued public journey notification. No camera, journey duration or sampler change.

## Rendering and lifetime

`uHeroRadii` / `uHeroWaves` are three stable uniform components shared by visible/HDR/contact paths. Ray crests evaluate each active radius in the existing one-plane draw, then perform the existing cumulative absorption walk once. Receiving grains evaluate their unchanged single-front material model for each active front. Componentwise maximum plus the existing crest/wake bound preserves the strongest local response without stacking everything into a white wash. Sprite positions/physics/alpha/coverage/blending/LUT/counts remain unchanged. No new mesh, texture or render pass; the contact mask remains one shared pass.

The final view now needs visible demand frames continuously because at least one wave is always travelling after the first release. The previous quiet-rest timeout is removed. Visibility pause excludes hidden elapsed time and restores each front at the same radius on return. Camera exit, Replay and disposal clear all three strengths. Reduced motion produces no fronts, no repeating clock and no idle draw. Replay restarts the initial trace.

`samplePupilPulse` remains a finite single-envelope reference. `samplePupilFronts` and `samplePupilLoop` own emission ages and overlapping border envelopes. The approved View 1/View 2 focus presets and final glow values are untouched.

## Verification

Archive: `D:/CodexOutputs/Pupil_Emission_Overlap_20261028/`.

- 93 tests pass, including immediate trace, twenty two-second cycles, old-front retention, complete tails, continuous border launch, combined grain response bounds, hidden/stall/reduced-motion/reset behavior, shared-star linkage and earlier scene regressions.
- TypeScript, scoped ESLint and production build pass.
- `verify-overlap.cjs` performs the actual View 2 → 4.5-second pullback → final journey. The first border draw is in the settling frame, a few milliseconds before the public DOM phase commit. Four actual GPU releases and three simultaneous full-strength radii are recorded. Each new launch retains the preceding front in the next slot.
- Desktop, laptop and mobile quality profiles compile/draw with no page/shader errors. Workstation active-frame measurements are around 13.3 ms median; these are not physical laptop/mobile benchmarks. One initial lower-tier smoke capture had insufficient animated samples during warm-up; isolated tier checks subsequently pass.
- Actual source counts remain 238353 / 98304 / 49152; final receiving gain remains 1.5. Absorption, glow palette and source assets remain protected. Exit/hidden/reduced-motion behavior pass.
- Source GLB hash and `refs/checkpoints/eye-one` remain unchanged.

Latest-only revert: restore the four backed-up source files, the two tests and AGENTS.md from the archive; remove this new note and its addenda in the previous timing/panel documentation. Keep all promoted per-view defaults and the existing tuning panel.

No qualifying Next.js feedback candidate was retained.
