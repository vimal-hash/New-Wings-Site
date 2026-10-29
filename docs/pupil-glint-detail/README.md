# Silver glint detail and particle-only +30% — 2026-10-28

The user approved more separation between individual bright grains and a 30% brightness increase, clarifying that the increase applies to the particle reaction only, never the logo or empty-side rays.

Changes are confined to `pupil-grain-reaction.ts` and the authored eye material in `logo-particle-eye/index.tsx`:

- Narrow contact glint lobes (roughness exponent 44–100 instead of 22–52), stronger selected peaks and stable per-grain glint weights. Neighbours can retain different strengths without animated random flicker.
- Slightly concentrate inward-facing reflections (power 1.35). Retain the previous floor .24 / reflection 1.85 so the steel response remains full.
- Redistribute HDR light toward small glints: body coefficient .75 and contact glint coefficient 1.7. A smooth luminance knee at HDR 48 limits the hottest merged bloom pools, preserving brighter individual cores.
- Apply the independent `uHeroReactionGain=1.3` after the surface soft knee and after the refined HDR knee. This multiplies the receiving grains' surface contribution and bloom by 30%, without changing their rest colour or any other emitter. `GRAIN_REACTION.brightness` is the tuning control.

No change to pupil material/flash, ray material/brightness, bloom global gain/threshold/radius, star material, original alpha/blending/atlas/LUT, geometry, counts, particle motion, charging/afterglow timing, camera, cumulative absorption or finite demand clock. No extra pass, texture, buffer or draw.

Native GPU verification holds the same pulse time and switches only the grain gain between 1.0 and 1.3. `gain-verification.json` in the archive reads the actual HalfFloat grain extraction over a grain-only region: the measured linear energy ratio is approximately 1.300001, with successful reads. Native `refined-100.png`, `refined-130.png` and `refined-130-3840.png` show that comparison. Display pixels can clip and bloom is nonlinear; this is a verified light gain, not a claim that every displayed RGB value rises exactly 30%.

Archive and immediate pre-task backups: `D:/CodexOutputs/Pupil_Glint_Detail_20261028/`. A latest-only revert restores `pupil-grain-reaction.ts` and `eye-index.tsx` (to the eye's index file), and removes this note. Earlier pupil/absorption work and `refs/checkpoints/eye-one` remain protected. Production build, typecheck/ESLint, full tests, native GPU brightness verification, quality profiles, absorption checks and viewport replay provide validation; profile tests run on the development workstation.
