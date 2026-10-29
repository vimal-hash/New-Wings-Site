# One-second lead with no launch gap

The user explicitly approved a continuous sequence: circle starts one second before final settle; completion immediately begins the flash and ray emission; further emissions remain two seconds apart.

`PUPIL_PULSE.traceLead` is now 1 and `hold` is zero. The trace duration remains 1.65 seconds. During the existing 4.5-second pullback, the circle begins at 3.5 seconds. At final settle it has run for one second; the clock is seeded with that same elapsed time and continues the remaining .65 seconds. The previous forced-complete contour latch and separate post-settle delay are removed. One timeline now owns trace completion and first emission, so a completed-circle state cannot sit idle waiting for another trigger.

Natural releases: +.65, +2.65, +4.65… seconds after final settle. The original fast brightness attack starts at the release, without an extra hold. Brightness, trace duration, wave speed/lifetime/overlap, palette, absorption and grain response are unchanged. Replay and a direct final shortcut start their full trace at the request and emit immediately at its completion, also without a hold.

No camera, fill, shader source, geometry/count/physics/blending/LUT, promoted per-view focus/glow preset or source asset changes. Hidden time, reduced motion, reset/exit and the three independent travelling fronts retain their previous behaviour.

## Verification / restore

Archive: `D:/CodexOutputs/Pupil_Seamless_Launch_20261028/`.

- 94 tests pass. The handoff regression verifies an incomplete trace at settle, exact continuation from the early segment, no completed-trace sample without an emitted front, first release after .65 seconds, and full manual replay.
- TypeScript, scoped ESLint and production build pass.
- `verify-seamless.cjs desktop` follows the actual View 2 → pullback → final scene. Circle onset was measured at 1.0025 seconds before the final public phase commit. The first completed-circle GPU sample contains an active emitted front; the flash starts within one render frame, with no extra hold. Later emission intervals measured 1.9994, 2.0010 and 2.0014 seconds.
- Three full-strength fronts coexist; no old front resets at a new emission. Hidden pause/resume, camera exit and reduced-motion idle pass with no browser/shader errors. The existing desktop grain count and receiving gain remain 238353 and 1.5. Physical laptop review remains deferred.
- Camera and approved presets, GLB hash and `refs/checkpoints/eye-one` remain unchanged.

Latest-only revert: restore the two source files, pulse test and AGENTS.md from this archive, remove this new note and the addendum to the preceding timing document. Keep all earlier camera/panel/preset/overlap work.

No qualifying Next.js feedback candidate was retained.
