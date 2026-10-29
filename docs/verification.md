# Current verification

Source: `D:/CodexOutputs/Approved_Theatre_Corridor_20261020/Theatre_Corridor_Logo_marked_layout.blend`.

- Theatre and projector floor: original scale and spacing, shared translation only.
- Shared translation: `[.010995, -26, .02]`, another 12 metres toward the slide. Circled rear roof edge: Y=-4.5. Projector floor starts at Y=.669. Slide A straight section: Y=-15 to -27; curved rise begins at -27. Slide B: opposite terminal opening.
- No runtime fitting transform; identity model placement in R3F.
- Blender BVH: no theatre/platform intersections with corridor/logo surfaces above Z=.051.
- Corridor wall vertices identical to the previous approved layout (zero maximum error). The corridor terminal remains at Y=-15; its geometry is no longer tied to the movable slide base.
- Additional ray/BVH checks: zero blue-shell intersections with either wall, floor or either slide. Floor present below all 641 camera route samples. Minimum horizontal camera/wall clearance: 8.46 metres.
- Active geometry and motion data: 534,599 triangles, 5,128,525 bytes, no image textures. The batched GPU projector has one mesh/material, with one extra points draw during formation.
- Projector: optimized Blender source at frame 576. Native scale/orientation/height retained; assembled centre aligned with the platform XY centre within 0.001 millimetres. No projector intersections with architecture or platform. 507 visible parts batched into one export mesh/draw call. Original animations remain in the Blender source for the next step.
- `review_projector.py` confirms the 627 existing layout meshes/helpers have unchanged coordinate sets (visible meshes at 1e-7m tolerance; boundary-loop helpers at 1e-4m to allow traversal/rounding differences).
- Manual animation: 20,000 GPU points, four-second formation and exploded hold; Assemble runs the Blender sequence in two seconds. Browser button cycle measured 2.085 seconds including input/UI overhead. Replay and mobile button layout checked. No shader errors.
- GPU motion: 514 parts, 65 poses in one 1.6 MB float texture; 2,570 sampled matrices match Blender within 2.99e-7 matrix units. Decoded assembled bounds differ from the static placement by 5.71e-7 metres. Eight camera/control regression tests, lint and production build pass.
- Production build, ESLint and seven camera/placement regression checks passed.
- Chrome production preview checked at 1366×768 and 390×844: initial framing, forward/reverse travel, bend and endpoint. See output folder for R3F screenshots and four Blender authoring views covering the theatre placement, left curve and both slide ends.

This does not claim that every mathematical contact below the floor is absent, or that device performance with final materials has been verified.

## Full journey restored — 2026-10-20

Ported from `new_si_two/src/components/scene/FreeCamera.tsx`, `CorridorPage.tsx`, `PageReveal.tsx` and `CorridorScreens.tsx`:
- Opening hold 2 s and pullback 2.5 s; two deliberate reveal gestures; .5 s retreat legs, .2 s hold, 1.4 s approach.
- Particles hold exploded; the following gesture starts assembly, 1 s return hold and .9 s camera return.
- .9 s side-screen retreat, followed by 1.8 s corridor travel with quartic ease-out. Camera uses the audited upgraded centreline rather than the old corridor's world coordinates; height stays fixed during the corridor stages.
- Same 6 m maximum page width, .7→1 scale, 14→6→.6 m depth stages; 1.1 s expansion stages. Arrival uses 1.8 s to finish together with corridor travel. Original three blank section colours retained.
- No asset transforms or Blender geometry modified. Two original runtime side-screen surfaces restored without the obsolete floor patch or lighting emitters.
- Desktop browser: particle hold, assembly gesture, wide stop, corridor arrival, two page stages and native section scrolling verified. No browser errors. WebGL canvas unmounted after handoff.
- Input: shared wheel/touch/keyboard stage handling, momentum lock during panel expansion, browser pinch/zoom preserved, reduced-motion preference supported. Orbit remains optional inspection mode.
- Browser at 390×844: corridor arrival, both panel expansion stages, white/sage/sand native scrolling and zero remaining canvas elements verified. Desktop viewport restored. These are browser viewport checks, not physical phone FPS measurements.

## Separate low-poly sofas — 2026-10-20

- Uses the approved 1,479-triangle replacement, exported as a separate 12,320-byte Draco GLB with one mesh/material and zero textures.
- Source layout is the latest optimized theatre Blender collection, not the older 16-sofa web layout: rows B/C/D, 12 sofas.
- `verify-sofas.mjs` decodes the compressed asset, checks triangle/mesh/texture counts, finite vertex data, retained rows and centre-aisle clearance. All 12 placement envelopes match the saved Blender bounds plus the theatre translation, with zero metadata error.
- One InstancedMesh, 17,748 seating triangles, one draw call. No useFrame work or additional lights/shadow passes.
- One feature flag disables both rendering and asset loading. Metrics include the extra model, asset bytes and seating triangles.
- Lint, production build and eight existing journey/projector regressions pass.
- Browser: 5/5 models loaded; seating adds exactly 17,748 rendered triangles and one draw call in the opening view. Desktop and 390×844 visual checks passed with an open centre aisle and no browser errors. Mobile hardware FPS should be rechecked on the user device.

## End-of-page zoom-out — 2026-10-20

- A fresh downward gesture after the third section reaches its bottom requests the return. The bottom-reaching gesture and wheel momentum do not exit the page; wheel, touch and keyboard share a tested gate.
- The cached scene is mounted behind the still-visible page, at the saved corridor stop, and waits for shader readiness before uncovering it.
- A 1.5 s smooth zoom-out matches the viewport at its first frame and shrinks to the original small-panel size/depth. The final section colour is preserved.
- Normal page scrolling still unmounts the canvas. Reopening the returned panel restores the third section at its end.
- Lint, production build and 11 regression tests pass (including arrival momentum, small trackpad deltas, fresh swipe/key and upward-reset tests).
- Browser verification: desktop and 390×844 return/reopen cycles passed; the bottom-reaching scroll leaves the page open, the next scroll zooms out, the restored page opens at its saved bottom, and native scrolling remains available. No browser errors. Final checks: 12 regression tests, lint and production build pass.
- Re-entry glitch fix: ignore input throughout return loading/animation; clear accumulated scroll at completion and require a settled, separate gesture before expansion. A regression simulates three seconds of continuous momentum and confirms the panel cannot reopen. All 14 tests, lint and production build pass.

## Slide exit and full-logo reveal — 2026-10-20

- After the page returns to a small corridor panel, the next deliberate downward gesture now starts the final logo shot rather than reopening the page.
- Uses the existing opposite slide's authored quarter-circle (28.32789 m radius), with the same camera clearance above its surface; then a cubic exterior path lifts away from the logo.
- Slide/exterior velocities match at the join. The 9 s shot starts and ends at rest, smoothly settles upright, and frames the measured logo bounds at 40° FOV with responsive distance and clipping.
- Background Blender verification: 2,000 path segments at each of desktop and portrait aspects, zero intersections with logo/walls/slides. Source geometry is unchanged.
- Tests verify slide clearance, exact initial pose, position/velocity continuity, upright centre framing and complete bounds coverage at portrait/square/wide aspects. All 17 tests, lint and production build pass.
- Browser: full page → small panel → next gesture → slide exit → settled logo verified end to end. Desktop and 390×844 final framing is centred and unclipped; no browser errors. Screenshots saved as full-logo-reveal-desktop.png and full-logo-reveal-mobile.png in the output directory.

Camera correction: matched slide and exterior acceleration as well as velocity; continuous pitch speed at the lip; restrained 11 degree final viewing tilt with responsive bounding-corner framing. Lint, production build and all 18 regressions pass. Blender clearance check: 4,000 segments, no intersections.



## Scroll-driven camera polish — 2026-10-20
Page return hands directly to the reveal with buffered scroll input. Signed wheel/touch/keyboard deltas drive a clamped target; exponential smoothing is independent of refresh rate and supports reversal. Slide aim raised, lip rotation speed matched, exterior distance eased more gradually. Approved final framing and model geometry preserved. Automatic end orbit disabled; manual inspection toggle retained. Dense 4,000-sample orientation regression passes; 4,000 Blender clearance segments report no intersections.

Final aim correction: ramp rotation now blends toward a measured logo-centre view at the lip, with a small mid-ramp lift. Exterior tracking keeps the logo centre inside the camera view (1,001 samples) rather than turning through empty sky. All 21 active regression tests, lint and production build pass.

Browser verification (final revision): complete journey through third-section exit passed; page return immediately entered logoReveal. Exterior subject visibility checked visually. Up-scroll from logoDone returned to logoReveal and moved the camera closer; down-scroll completed it again. Desktop and 390x844 portrait final framing checked; no browser console errors. Temporary viewport override reset. Screenshots: scroll-polish-desktop.png and scroll-polish-mobile.png. Portrait testing is browser viewport testing, not physical-device performance measurement.

## Staged exit — 2026-10-20
New approved sequence replaces the continuously scrubbed reveal: user scrolls to slide lip without early yaw, a fresh gesture triggers the turn in place (1.4 s), and a later gesture starts the automatic pullback (3.2 s). A 220 ms input quiet period prevents momentum skipping stops. Matching position and quaternion at both joins verified. 24 regressions pass; lint and production build pass. Geometry and final framing unchanged.

Live staged-exit verification: complete journey passed. At top, SCROLL TO TURN appeared before any yaw; fresh scroll ran turn only; SCROLL TO REVEAL THE LOGO held until another gesture; pullback then completed without further input. Final desktop and 390x844 portrait framing preserved; no browser console errors. Screenshot staged-exit-final.png saved; viewport reset.

Moving-turn refinement: turn now follows the first 12% of the already-audited exterior curve while rotating; subsequent pullback continues from that exact pose and takes 4.5 seconds. No geometry or final-frame changes. Both staged joins and moving-turn regression pass; lint and production build pass.
