# Temporary cinema tuning desk

Latest timing clarification: circle starts on the final settling frame; ray emissions recur every two seconds while earlier waves continue travelling. See `../pupil-emission-overlap/README.md`. All promoted presets remain unchanged.

Current approved defaults (2026-10-28): View 1 manual DOF 3000/3000/4 and View 2 manual DOF 2070/2800/12 are now enabled source presets; final glow peak 1 and receiving gain 1.5 are promoted with the other shown glow values. Final focus remains off. Browser schema v2 migrates these fields once from older drafts. The finale now repeats after each fully settled wave plus a two-second rest, with its first circle traced only once. See `../approved-presets-pulse-loop/README.md`; earlier descriptions of focus being off by default and a finite one-shot clock below describe the panel's original baseline.

The user requested the reference demo's live adjustment workflow: tune each eye angle, send the values for permanent adoption, then remove the panel. They specifically requested a **Logo peak flash** control for the recently reduced logo-only launch, independent of side rays and receiving particles, and a cinematic depth-based blur preview.

## Using the panel

Refresh the scene and open **Look tuning** in the upper right. **Follow camera** selects View 1 (silver dune), View 2 (diagonal stream), or final eye. The editing dropdown can select another preset; **Go to…** seeks its existing authored pose. Moving a slider does not move the camera.

- Glow: stars have halo/softness controls. Final-eye controls include overall pulse bloom/softness, logo border glow, logo peak flash, empty-side ray brightness and receiving-particle gain.
- Colour & space: existing nebula strength/variation, contrast, black toe, platinum, cool shadows, vignette and fine grain.
- Focus: optional depth of field, visible-silver autofocus, manual focus distance/range (scene units), and aperture/bokeh size. Off by default. The manual distance is inactive while autofocus is checked.
- Post-processing toggles bloom, grade and focus together; source-emission controls remain independent. Bloom and grade also have their own switches.
- **Before / approved baseline** temporarily restores the exact pre-panel defaults across all effects. It does not delete the drafts.
- **Reset this view** affects only the selected preset. **Save** commits immediately; edits also auto-save after 250 ms. **Copy values** or **Download** exports all three presets as versioned JSON. On insecure LAN HTTP, blocked clipboard access falls back to a selectable textarea. Storage failure leaves the scene usable and explains how to export.

Persistence is local to the browser/origin (`eye-cinema-tuning-v1`), not a cross-device sync service. The JSON is the handoff to the developer. Values are allow-listed, finite and range-clamped; malformed/blocked storage falls back to approved defaults.

## Scope and pipeline

`cinema-controls.ts` is a small external store with stable SSR snapshots. React updates occur only on controls and journey-stage changes, never per frame. Render-time values reuse one object. Existing authored turn/pullback progress interpolates numeric presets and effect weights directly; no new animation clock, camera damping or path mutation. Optional blur, grade and bloom fade in/out along transitions rather than suddenly switching at their midpoint.

`space-grade.ts` updates existing uniforms, retaining native display-space sampling, the current LUT and NoToneMapping. Nebula strength multiplies only the dark background classification, preserving silver neutrality. Star/hero halo gain and radius update the existing selective HDR bloom. No whole-image re-tone-mapping.

`pupil-pulse-state.ts` accepts a flash-gain argument, defaulting to the unchanged 1.8. The completed circle remains 1.25. `pupil-pulse.ts` applies a separate border multiplier and a ray-colour gain; neither changes the shared wave strength or travel clock. The receiving shader's existing `uHeroReactionGain` remains 1.3 by default. Changing the logo peak alone leaves both other gains intact. Use **Replay light** at the final stop to preview this short-lived event.

`cinema-focus.ts` is an optional lens preview applied after the selective halo and before the fine-grained creative grade. It copies the actual native display image (without another display transform), renders a private packed-depth scene, then gathers colour through a soft-edged aperture. Actual eye/near-grain vertex paths and atlas alpha coverage supply depth rather than solid billboard rectangles; opaque geometry/filling logo retain their own depth and clipping. Stars/atmosphere remain distant. An in-focus pixel takes an exact colour sample; depth-aware weights limit distant colour bleeding across nearer silhouettes. This is an artistic screen-space depth-of-field preview, not physical inter-grain ray tracing.

Autofocus selects a real visible authored grain near the image centre; it does not focus the potentially offscreen overall eye bounds. At most ~1024 candidates are inspected when pose/projection/geometry changes; stationary frames reuse the result. No synchronous GPU depth readback. Scene/camera/geometry/source materials remain untouched.

| Tier | Depth resolution | Aperture samples |
| --- | --- | --- |
| Desktop | native | 40 |
| Laptop | half | 24 |
| Mobile | 0.375× | 12 |

Focus resources are created only on first enable. Disabled focus issues no copy, depth render or lens draw. All owned targets/materials/proxies are released on unmount; shared source geometries/textures/uniforms are retained/restored. Depth capture restores target, clear state, auto-clear, shadow state, sprite viewport height and DPR even on failure. Ordinary meshes keep source frustum culling, while authored instanced grains retain their audited bounds handling.

## Verification and removal

External archive: `D:/CodexOutputs/Cinema_Tuning_Panel_20261028/`. `check-panel.cjs` drives real controls and inspects compiled GPU uniforms: live grade, independent presets, refresh persistence, per-view reset, reversible baseline, keyboard/wheel camera protection, actual focus draw/no-draw, final shortcut, replay and independent peak gains. Desktop/laptop/mobile browser contexts exercise the shader paths, responsive UI, master bypass, autofocus changes, demand-idle and route remount. These are workstation profile checks; actual laptop hardware review remains deferred.

The test suite covers persistence validation, isolated presets, interpolation, effect fades and logo peak-only semantics. Production build/typecheck and scoped ESLint pass. No source asset, particle buffer/count/physics/LUT/blending or protected eye-one checkpoint change.

To adopt the user's result: validate their exported JSON, promote it to fixed source presets, verify the three stops/transitions, then remove the panel and browser draft hydration. Keep the small render-value interface until fixed presets replace it. To revert this task alone, restore the eight source/CSS files and AGENTS.md from the archive; remove `cinema-controls.ts`, `cinema-panel.tsx`, `cinema-focus.ts`, this note and the new cinema-controls test. Preserve every earlier approved effect and `refs/checkpoints/eye-one`.

References consulted: official pmndrs R3F hooks documentation and the `plane-crash` example's control grouping/manual-focus workflow. No example assets, models, lights, camera configuration or display transforms were copied.
