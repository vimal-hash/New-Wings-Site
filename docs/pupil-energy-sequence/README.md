# Catch, transfer and release — 2026-10-28

User approved a complete, visibly different receiving-material sequence, keeping the current point of view, particle-only 1.3 gain, logo/side-ray brightness and laptop preview.

## Three distinct moments

1. **Catch:** inward-facing contact glints rise immediately at the real 3D wave arrival. They decay quickly, while dark atlas facets remain visible.
2. **Transfer:** the fuller silver response rises later in connected groups. A smooth value field over the original authored centres (including depth) gives nearby grains correlated delays; stable per-grain size/seed adds smaller differences. The transfer phase is .32–1.10 crest widths behind contact, roughly 50–160 ms at the current wave speed. It adds one restrained transfer glint, not an endless sparkle loop.
3. **Release:** a third channel carries a softer silver wake. Grain retention and decay differ with seed, size and group. Its energy is limited by the receding crest so both cannot stack into a doubled white peak. The wake outlives the strong crest and then fades monotonically. Global pulse completion clears it and returns to demand-idle rendering.

`pupil-grain-reaction.ts` owns the shared GPU functions and CPU references. `index.tsx` carries the new `vHeroWake` into the existing directional surface and HDR-light terms. The depth field replaces it with a constant zero alongside the other hero inputs, so stars/near loose grains stay outside this reaction.

The group field is continuous across cell boundaries and uses arithmetic hashes (no four extra sine evaluations per vertex). It runs only during the hero response. No CPU particle history, texture, buffer, pass, draw or simulated particle displacement is added. Grouping uses original centres, so it cannot swim with the current. Actual world-space depth still determines arrival.

This is artistic received-light behaviour, using the existing shaded grain atlas and curved-facet approximation; it is not a fluid simulation or inter-grain ray tracing. Preserve original count/geometry/alpha/blending/atlas/LUT/physics/current/camera. The existing pupil sequence, brightness controls, cumulative absorption, ray widths, bloom settings, palette, close views and protected `refs/checkpoints/eye-one` are unchanged.

## Evidence and laptop review

Archive: `D:/CodexOutputs/Pupil_Energy_Sequence_20261028/`.

- `before.webm`: preceding approved glint-detail replay.
- `pupil-pulse.webm`: updated replay, same 1920×945 viewport, camera and pulse timing.
- Native screenshots show matching timed checkpoints and a 4K frame; the decoded recording is checked for a valid nonblack image.
- Tests cover distinct catch/transfer/release, monotonic final decay, size/depth variation, smooth connected groups, reset to zero and the shared-star shader interface.
- Build, typecheck/ESLint and full tests; all three quality paths, replay/reset/reduced motion/remount and unchanged absorption are verified. Workstation profile measurements are not physical laptop/phone benchmarks.

Laptop URL on the same network: `http://192.168.1.5:3000/?diagnostics=1`. After load: View 2 → fresh scroll to final eye → Replay light. Keep Performance open for actual-device feedback. The server binds to 0.0.0.0:3000; no firewall or security settings were changed.

Latest-only revert: restore `pupil-grain-reaction.ts`, `eye-index.tsx` (to the eye index), `depth-field.ts`, the prior reaction test and AGENTS.md from this archive; remove this new note. Preserve all earlier glint-detail/absorption changes and the named checkpoint.
