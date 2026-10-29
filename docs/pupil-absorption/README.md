# Pupil absorption refinement — 2026-10-28

User scope: all four reported issues plus the three agreed refinements, confined to the final pupil pulse.

1. The first trace follows joined miter ribbons on the existing front contours, lifted only .04 world units. Adjacent endpoints share their offsets. The angular reveal closes fully at its wrap seam, with a 1.65 s eased trace, .25 s hold and .10 s flash attack.
2. Grain response still uses each actual centre's 3D distance and the existing metallic atlas. The hero contribution preserves dark facets and decays behind the front; no particle transforms, alpha, counts, physics or LUT change.
3. Rays cannot appear in internal deposit gaps: `pupil-absorption.ts` integrates the real live coverage from the projected pupil centre to the wavefront.
4. That cumulative absorption also suppresses rays after the outer edge. Directions with no intercepted deposit continue through the empty sides.
5. Grain lighting uses a stronger soft knee (.8), facet exponent .8, floor .34 / highlight 2.1 and private HDR gain 10. This retains small silver glints rather than broad clipped patches.
6. Five nearby density samples soften the ray-to-grain handoff. The ray loses energy across the projected envelope; the actual 3D grains carry the moving highlights. This is artistic absorption, not physical inter-grain ray tracing.
7. Empty rays retain their thin core / icy halo with restrained angular brightness variation at 7, 19 and 43 cycles. No time-driven flicker or swimming.

The absorption shader has 96 / 72 / 48 maximum steps on desktop / laptop / mobile and exits at full absorption. It runs only in the narrow crest after early discard, using the existing quarter / 3/16 / eighth-resolution contact target. There is no new render target or pass, CPU particle walk or animation loop. The finite demand clock, hidden pause, reduced motion, replay/reset, ownership and stationary warm-up are retained. Pupil border private HDR gain is 6 to retain its contour at the stronger flash. Stars and previous close views keep their original pipeline.

Immediate pre-task source backups and native evidence: `D:/CodexOutputs/Pupil_Absorption_20261028/`. Restore only this task's modified files from there for a latest-only revert; remove new `pupil-border.ts`, `pupil-absorption.ts` and their tests. Do not reset other untracked source. The named `refs/checkpoints/eye-one` is untouched.

Validation: joined-contour / source preservation test; cumulative absorption regressions through gaps and after the deposit; empty-side continuity; pulse clock/3D arrival tests; production build and typecheck; browser shader/replay/quality checks. Native screenshots and the viewport recording in the archive show the sequence; quality-profile measurements on the development GPU are not physical laptop or phone benchmarks.
