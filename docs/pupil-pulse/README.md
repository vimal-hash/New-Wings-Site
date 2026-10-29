# First pupil light pulse — 2026-10-28

User-authorised first version for visual tuning: once the final eye/camera settles, trace steel-white light around the pupil from right toward left, complete the outline, flash quickly and settle slowly, releasing one outward wave. Only grains reached by that wave brighten. The earlier stand/contact sequence remains removed.

## Timing and controls

`pupil-pulse-state.ts` contains the tunable controls and one finite demand-frame clock. After `logoDone`: pause .55 s; trace 1.3 s; hold .18 s; flash with .075 s attack / .9 s decay. The wave starts at 2.03 s, travels for 5 s, then finishes its .8 s tail. It is a single pulse. The border remains a restrained dim outline after settling. The temporary **Replay light** button repeats only this effect, without changing the camera.

Returning to either close review view resets and hides all pulse lighting. Restart/remount also resets it. Time before activation or while the document is hidden does not advance the effect. Reduced motion skips the flash and travelling wave, leaving the dim completed border. This effect requests demand frames only while its finite sequence is active.

## Geometry, depth and shading

`pupil-pulse.ts` constructs thin front-only strokes from the actual GLB front contours and the accepted clean blue face. Two small owned drawables provide the border and an additive, world-space ray ring with restrained filaments. No source GLB or asset download is added. Borrowed GLB geometry, iris instance buffers, atlas, LUT, particle current, coverage and blending remain intact.

The grain shader's new illumination term measures **3D world distance** from the pupil. A narrow front and short exponential trail use the same radius/width as the visible ray. Height/depth affect arrival; the wave is not screen-space and never uniformly lights the whole field. The original steel atlas's darker facets remain dark relative to its reflective faces. This is an artistic lighting response using the existing baked grain shading, not new inter-grain shadow maps or physical ray tracing. The resting shader contribution is exactly zero.

## Post processing

Reuse the existing private HalfFloat HDR bloom, with the current quality-dependent sizes/blur levels and renderer NoToneMapping. Resting iris colour stays excluded. During the hero pulse, only its added grain illumination plus border/ray emission enter the HDR extraction. Their original alpha/depth masks are retained. Hero halo gain .42; close-view star gain stays .24. Once the pulse ends, final-eye HDR extraction/compositing stops again. No second display transform or LUT change.

Emitter main-frame and HDR variants are prepared at existing stationary stops. Owned geometry/materials and temporary emitter masks are disposed with their owners. The current grade still runs in its established order.

## Evidence

Build, TypeScript/lint and all 72 tests pass. Evidence and exact pre-change source copies: `D:/CodexOutputs/Pupil_Pulse_20261028/`.

- `pupil-pulse.webm`: actual viewport frames recorded at 1920×945 and encoded to WebM, not a mocked animation. The decoded video was checked at 3.8 s (mean pixel value 18.66, non-black). Direct WebGL captureStream produced an unusable black preview; the replacement uses the visible compositor frames.
- `hero-3840.png`, timed `pulse-*.png`: native screenshots.
- `pulse-verification.json`: live GPU wave values, activation and return to zero.
- `profiles-verification.json`: desktop/laptop/mobile quality programs; original 238353 / 98304 / 49152 main instances; no browser/shader errors; replay/reset, reduced-motion, inactive-final-bloom and route-remount checks.
- `on-verification.json`: the ordinary full scroll journey reaches the final eye and activates hero extraction after settling, with no browser errors.
- Active desktop pulse: 13.3 ms median / 13.4 ms p95 (~75 fps) on the RTX workstation. Laptop/mobile profiles were exercised on that workstation, not physical low-tier devices.
- Close-view comparison against the pre-pulse build: mean changes <.000024 of one 8-bit code value over the audited region, maxima 1–2 on a few pixels. Earlier framing, sky and particles remain visually unchanged.

The protected `refs/checkpoints/eye-one` remains `fe1ad8ec53c888be42f08c814ff0192513aae31a`. To revert just this pulse, restore the archived `star-bloom.tsx`, `eye-index.tsx` (to `logo-particle-eye/index.tsx`), `depth-field.ts` and `experience.tsx`; remove the two new pulse modules/test and this task's documentation note. Keep the accepted pupil fill and earlier cinematic work.
