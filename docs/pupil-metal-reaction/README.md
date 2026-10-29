# Received light on the silver grains — 2026-10-28

The user approved five refinements: keep the pupil strong but readable, make the particle wave clearer, scatter the handoff into glints, increase grain bloom with a more material-like response, and stop the reaction looking like a light simply passing over the deposit.

## Material response

`pupil-grain-reaction.ts` separates fast contact glints from the receiving material's slower silver response. Both are analytical functions of each existing grain centre's 3D distance from the pupil, the shared advancing radius, original grain size and stable seed. A short charging delay / glint variation prevents a uniform flash. The received energy lingers behind the crest and decays to zero. There is no new particle animation, positional jitter, random time flicker, CPU history or buffer.

The existing atlas still supplies grain shapes and dark facets. A small curved-facet approximation in each billboard's own rotated coordinates catches the inward grazing direction, shades the outward side and produces a roughness-dependent reflection glint. It is an artistic metallic model, not ray-traced inter-grain shadowing. Original atlas alpha, footprint, camera, geometry, count, physics, drift, blending and display transform remain unchanged.

Grain surface colour uses a soft knee to retain detail. The separately named `vHeroBloom` carries the received reflection / contact energy into the existing HalfFloat extraction, with gain 18 instead of the old gain 10. The source is the actual grain shader, never a bright ring overlaid on the field. Resting grains contribute zero hero light; the earlier star-only extraction and grade remain unchanged. Inactive grains skip the material calculations.

`GRAIN_REACTION` is the active grain tuning configuration; `PUPIL_GLOW` now contains only the shared core/halo palette. The shared depth-field fragment replaces all hero inputs with constants, so close loose grains and stars cannot inherit the final pupil response or unbound varyings. A vertex/fragment interface regression covers this contract.

## Pupil and absorption

Keep the first trace's brightness, timing and joined contours. Only reduce the launch flash multiplier 4.3 → 4.15 and the broad border shoulder .26 → .23. These small changes preserve the strong white core while opening the logo's dark cuts. No global exposure, bloom threshold or halo radius change.

Cumulative absorption, the narrow empty-side rays and the original camera path are preserved. Received grains continue reacting after the ray is hidden. Rays still cannot reappear inside gaps or beyond an intercepted deposit. The existing finite demand clock, hidden pause, reduced motion, replay/reset, stationary preflight and disposal remain in place. No new render pass or texture.

## Validation and restore

Archive: `D:/CodexOutputs/Pupil_Metal_Reaction_20261028/`. Immediate pre-task files are saved there, including `eye-index.tsx` and `depth-field.ts`. For a latest-only revert restore the source files listed there and remove the new reaction module/test/doc; preserve the earlier absorption work. `refs/checkpoints/eye-one` remains fixed.

Validation includes charging / persistence / dark reset / depth and size variation tests; shared-star shader interface test; unchanged ray absorption GPU regression; desktop/laptop/mobile program profiles, replay/reduced-motion/remount checks; matched close-view screenshots; production build, ESLint, typecheck and full tests. Profile measurements use the development workstation, not physical laptop/phone hardware. Native PNGs and an actual viewport recording are in the archive.
