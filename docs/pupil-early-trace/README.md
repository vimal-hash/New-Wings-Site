# Circle starts two seconds before final settle

Superseded by the next user correction: lead is now one second and trace completion immediately triggers the first flash/rays. The trace continues across the camera settle, with no separate hold. See `../pupil-seamless-launch/README.md`.

The user confirmed the annotated sentence specifying the circle's early start while the eye and logo are still moving. Only the circle is advanced; first-ray timing and the two-second overlapping emission cadence remain unchanged.

The existing pullback lasts 4.5 seconds. `samplePupilPreTrace` derives the contour reveal directly from raw camera progress, beginning at 2.5/4.5. No new animation clock or camera change. It uses the existing 1.65-second trace and border gain; thus the contour completes .35 seconds before final settle and holds through the normal first-ray delay. It contains no wave fronts, flash or grain excitation.

`createPupilPulse.update` reads that preview during `logoReveal`/`pullback`. The camera already requests the needed frames. Completion is latched across the final-frame handoff, so the contour does not reset or retrace at `logoDone`. The existing emission clock still starts at settle and releases at +1.9, +3.9, +5.9… seconds; all previous wave radii, tails, brightness controls, absorption and grain response stay unchanged. Replay clears the latch and runs the initial trace on request. A direct final-view shortcut, with no preceding pullback, retains that review behaviour.

Leaving the reveal clears the early trace; hidden/reduced-motion handling is retained. Reduced-motion travel skips the preview. No fill timing, camera sampler, geometry/count/motion/blending/LUT, grade, shader source, source asset or promoted preset changes.

## Verification / rollback

Archive: `D:/CodexOutputs/Pupil_Early_Trace_20261028/`.

- 94 tests pass. The new temporal check covers the exact onset, monotonic trace, completion before settle, no early rays, no extra invalidation and unchanged first-release timing.
- TypeScript, scoped ESLint and production build pass.
- `verify-early.cjs desktop` follows the real View 2 → pullback → final journey and inspects actual GPU values. It checks a two-second lead against final phase commit, no pre-settle fronts, no contour restart, the unchanged first release and later two-second intervals, continued older fronts, hidden pause, camera exit and reduced motion.
- The existing camera and approved per-view presets remain unchanged; the protected eye-one reference and GLB remain unchanged.

Latest-only revert: restore the three source files, pulse test and AGENTS.md from the archive; remove this note and the new early-trace addendum in the prior timing note. Keep the overlapping wave implementation and all approved presets.

No qualifying Next.js feedback issue was retained.
