# Controlled logo flash and silver release

The user requested the proposed uneven ending, plus a reduction of the pupil-logo's excessive launch peak. They explicitly clarified that ray brightness and receiving-particle brightness must stay unchanged.

## Logo peak only

`pupil-pulse-state.ts` exposes `PUPIL_PULSE.flashGain=1.8` instead of the previous hardcoded 4.15. It scales only the border's launch-flash contribution. The completed first trace remains 1.25; timing, attack, decay, ray width/colour/strength and particle gain remain intact. At the mathematical peak the total border multiplier changes from 5.1251 to 2.9308 (42.8% lower), retaining a strong launch without the former broad blue-white bloom. No shared bloom, tone mapping, material, palette or global exposure changes.

## Uneven silver release

`pupil-grain-reaction.ts` selects retained facets from stable original grain seed/group values. A minority holds a longer soft silver wake; neighbouring grains cool more quickly. The release is monotonic, with no oscillation, random per-frame sparkle or new flash. Existing crest/wake energy bounds remain. Only the wake changes: catch, connected-group transfer and their surface/HDR gains are identical, including `GRAIN_REACTION.brightness=1.3`.

All original buffers/positions/current/counts/blending/atlas/LUT/camera remain intact. No new pass, draw, texture, CPU history or animation loop. The existing finite clock fades the wave to zero and returns to demand-idle rendering.

## Verification and rollback

Archive: `D:/CodexOutputs/Pupil_Pulse_Settle_20261028/`.

- `before-*.png` / `after-*.png`: matching 1920×945 viewport and controlled pulse times, including first trace, launch, transfer, release and finish.
- `peak-comparison.png`: identically enlarged screenshot crops, without retouching.
- `scope-audit.json`: comparison against pre-task code; zero difference in catch, crest, ray wave, travel or flash timing. Receiving gain stays 1.3. Emitter shaders, bloom pipeline and absorption hashes match the accepted prior source.
- `before-verification.json` / `after-verification.json`: actual GPU uniform values; identical radius, wave, count and gain, no shader/page errors. Trace 1.25 in both; border at 2.75 seconds changes 5.0362 → 2.8922; wave finishes at zero.
- `peak-pixels.json`: near-white logo crop pixels reduce from 21,182 to 11,489 at the matched peak capture.
- `pupil-pulse.webm`: actual viewport replay, independently decoded and verified nonblack.
- 84 tests, typecheck, changed-file ESLint and production build pass. Physical laptop review is deferred; no new actual-device performance claim.

Latest-only revert: restore `pupil-pulse-state.ts`, `pupil-grain-reaction.ts`, the three backed-up pupil tests and AGENTS.md from this archive; remove this new note. Preserve every earlier change and `refs/checkpoints/eye-one`.
