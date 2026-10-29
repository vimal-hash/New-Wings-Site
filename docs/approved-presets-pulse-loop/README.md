# Approved view defaults and repeating pupil light

Timing superseded by the user's next clarification: the circle now begins on the camera-settling frame and emissions repeat every two seconds from release, with earlier fronts continuing independently. The presets in this note remain current. See `../pupil-emission-overlap/README.md`; the quiet-rest schedule below records the previous implementation.

## Promoted screenshot values

| Preset | Approved fields |
| --- | --- |
| View 1 | DOF on; autofocus off; focus distance 3000; range 3000; bokeh 4 |
| View 2 | DOF on; autofocus off; focus distance 2070; range 2800; bokeh 12 |
| Final eye | Bloom on; pulse bloom .58; softness .65; logo border 1; logo peak 1; side rays 1; particle reaction 1.5 |

`cinema-controls.ts` now exports immutable `CINEMA_PRESETS` built from the existing base plus the specifically approved overrides. Other focus/colour/star/glow fields are not copied from screenshots or inferred. Final focus remains off. Factory load, per-view Reset and the baseline comparison use these per-view source defaults; transition blending is unchanged.

Browser exports are schema version 2. The existing storage key is retained so v1 drafts can be migrated: the specifically promoted fields are replaced once, while unrelated colour/star drafts remain. Future version-2 user changes continue to persist normally. Invalid or blocked storage falls back to source defaults. This is not a blanket browser-storage wipe.

## Repeating finale

The initial pause, full contour trace and hold occur once. Every light wave retains the existing five-second travel, .8-second settling tail, attack/decay, absorption, thin empty-side rays and grain response. After the wave has fully settled, the scene holds quietly for **two seconds**, then launches again. The repeat interval is 7.8 seconds; its first release is 10.25 seconds after activation. The initial release remains at 2.45 seconds. The repeat rises smoothly from the resting outline rather than snapping back to the completed-circle brightness or retracing the border. At the bright peak it matches the configured first pulse.

`samplePupilPulse` remains the finite-envelope reference. `samplePupilLoop` adds the repeated-wave/rest mapping. The demand clock consumes animation time in capped steps; a late quiet-rest timer is clamped at the next launch so it cannot skip a wave. No accumulated hidden time is charged to the animation.

`createPupilPulse` owns one timeout only during a quiet rest. Active trace/waves use existing invalidation; quiet rests stop bloom/contact draws and do not request a continuous RAF. Visibility pause preserves the unspent rest and cancels the timer; visibility return schedules the remaining rest. Leaving `logoDone`, Replay and disposal clear pending wakes. Reduced motion has no flash, repeating timer or wave. `Replay light` restarts the entire sequence, including the initial trace.

No new pass, shader change, glow palette, ray width, particle motion/count/geometry/blending/LUT, absorption or camera path. The only receiving-gain change is the user's promoted final preset, 1.3 → 1.5. Existing quality tiers remain in force.

## Verification / restore

Archive: `D:/CodexOutputs/Approved_Presets_Pulse_Loop_20261028/`.

- 92 regressions pass, including approved defaults, one-time migration, draft preservation, Reset/baseline, three-phase envelope, repeated timing, hidden/rest/reduced-motion handling and logo peak-only semantics.
- TypeScript, scoped ESLint and production build pass.
- `verify-loop.cjs` drives the production app with a deliberately stale v1 fixture. The actual GPU focus uniforms match 3000/3000/4 and 2070/2800/12; the panel's six final glow values match the screenshot.
- Three automatic wave launches were captured. Measured quiet gaps were 1.9676 and 2.0003 seconds; the trace never reset after completing. Every sampled receiving gain is 1.5 and desktop grain count remains 238353. Browser/shader errors: none.
- Visibility pause/resume, camera exit, reduced motion and route unmount pass. Screenshots include both promoted close views, final controls and the second automatic pulse. Workstation evidence does not establish physical laptop performance.
- Named `refs/checkpoints/eye-one` and source GLB hash remain unchanged.

Latest-only rollback: restore `cinema-controls.ts`, `pupil-pulse-state.ts`, `pupil-pulse.ts`, `star-bloom.tsx`, the two tests and AGENTS.md from the archive. Remove this note and the current-default addendum in the panel documentation. Keep the existing panel and all earlier approved work. A stored v2 browser draft will then be treated as unsupported by the older code; exported presets remain recoverable in the archive/user downloads.

No qualifying Next.js feedback candidate was retained; the implementation and timer verification were routine application work.
