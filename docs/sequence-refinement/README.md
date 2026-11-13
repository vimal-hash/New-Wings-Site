# Theatre, projector and page-sequence refinement

Implemented 1 November 2026 in `new_site_three`. The existing Claude corridor films and glasses design are preserved.

## Behaviour

- The opening uses the theatre's real edges, drawn left to right in luminous silver-white. There is no blue colour stage. The completed outline holds before materials appear.
- House lights rise over 3.2 seconds with a quintic ease after the auto pullback. Deferred GPU preparation waits until that cue finishes. Lighting uses mutable uniforms, without React updates each frame.
- Theatre hover inspection remains active with glasses worn; actual interface controls are excluded from raycasting.
- Theatre-to-projector camera legs last 1.9 and 1.5 seconds. The authored lens-side geometry and animation are retained.
- `projector-edit.ts` supplies one shared removal policy for solid rendering, shadows, hover and formation grains. Wiring and duplicate cooling parts are excluded. Original textured black side panels retain their UVs; other housing and orange accents use the existing black-anodized material.
- After the corridor display stop, the sphere is already present ahead of the moving camera. Arrival flows automatically through the morph into four native viewport sections.
- A fresh forward gesture at the fourth section's bottom starts a 1.25-second sheet zoom-out. Further scroll drives its fade and camera retreat. The next fresh gesture enters View 1 directly. Momentum cannot skip the stop.
- View 1 pitches upward by 0.36 radians while retaining its approved FOV and lens squeeze; the join to View 2 remains continuous. View 2 and the final eye marks are preserved.
- Temporary touch controls have 44-pixel minimum height; portrait overlays wrap and the collapsed performance badge clears the camera controls.

## Verification

- TypeScript and ESLint passed for the changed runtime files.
- 32 focused tests passed: opening/light cue, hover policy, projector removal policy, page exit, liquid handoff, exit stages, camera continuity and restored corridor films.
- Chrome: verified glasses-on hover, white outline, cleaned exploded projector, automatic corridor-to-page handoff, four native sections, scroll fade and direct View 1 handoff.
- Checked a 390 × 844 portrait viewport using the mobile quality path, including white outline and higher View 1 framing. Temporary viewport override was reset.
- Foreground desktop Chrome reported approximately 75 FPS / 13.3 ms during the reviewed motion. This is a local workstation observation, not a physical-phone performance guarantee. Physical mobile hardware still needs testing.
- The existing development hydration warning comes from ColorZilla's injected `cz-shortcut-listen` attribute.

## Recovery and captures

Pre-task corridor source backup: `D:/CodexOutputs/Sequence_Refinement_20261031/corridor/`.

Captures in the parent output directory: `glasses-highlight.jpg`, `projector-clean-black.jpg`, `fourth-section.jpg`, `mobile-white-outline.jpg`, and `view1-desktop.jpg`.

No GLBs were rewritten. No named eye checkpoint was moved, and no existing Claude work was reset.
