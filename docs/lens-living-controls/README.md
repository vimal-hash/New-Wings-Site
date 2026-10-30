# View 1 and white-section camera controls

User requested independent FOV, lens squeeze and living-camera controls for the existing white brand section and View 1. This does not restore the rejected brand redesign.

## Controls

Look tuning → Camera & lens. “Camera editing” can follow the section, or explicitly edit View 1 / White brand section. Each has its own reset and navigation button. The panel remains reachable when the white section covers the eye.

- FOV 22–65°: approved View 1 default 65°; white default 40°. No automatic dolly/reframing.
- Horizontal squeeze .75–1.6: approved View 1 default 1.05; white default 1. Values above 1 compress width; this is geometric image squeeze, not an expensive optical aberration effect.
- Living camera: mouse parallax .45, idle sway .08, smoothing .28 seconds, transient roll .12 degrees by default. Each has a separate control and a master living-motion toggle.
- White artwork also has a layer-depth control, default 1. The central mark/lettering remains the focus plane; decorative foreground, rings, background motifs and stars receive different parallax distances.
- Camera effects toggle returns that target to its unmodified pose. Global approved-baseline comparison also bypasses these camera effects without deleting drafts.

`lens-controls.ts` validates and persists the two independent presets under `eye-lens-controls-v1`. Existing cinema presets, promoted values and storage are unchanged. Save/copy/download includes `lensCameras`; Reset camera affects only its selected target.

View 1 promotion (2026-10-30): schema version 2 retains the existing storage key and migrates only View 1 FOV/squeeze from v1 to 65° / 1.05× once. White and all living-motion drafts are preserved; later v2 edits remain editable and persistent. `viewOneLensWeight` now rises with a quintic curve from zero at the corridor/slide entry to one at .985 (the existing View 1 shortcut mark). Absolute FOV blends from the actual incoming projection, then fades out with the original turn before View 2. Reversing slide progress reverses the same curve. There is no timer, camera-path change or snap at entry. Eight focused lens tests, TypeScript and ESLint pass, including actual Three projection endpoints, join smoothness, non-accumulation and one-time migration. Pre-promotion backups: `D:/CodexOutputs/View1_Lens_Defaults_20261030/`.

## Implementation boundaries

`view-one-lens.ts` modifies the actual Three perspective camera after FullJourney samples the authored pose. It adjusts FOV and the horizontal projection term/inverse, then applies damped local translation while looking at the same authored forward focus. There is no accumulating camera transform. Influence eases in during slide, is 1 at the View 1 mark/top, eases to 0 during turn, and is exactly 0 at turned/pullback/done. Final pulse, particle properties, counts, blending, LUT, post effects and GLBs are untouched.

The white section is still original HTML/SVG artwork. `brand-camera.ts` projects those flat artwork planes with focal scaling, horizontal squeeze and depth-dependent parallax; it does not convert them into new 3D meshes or add another Canvas. Neutral FOV/squeeze preserves the original layout. Camera transforms are independent of entrance/idle transforms and per-letter/object repulsion. Influence starts after the complete colour logo clears the opaque feather and reaches full strength at the white section's completion, preserving the existing reveal alignment.

Transient animation uses mutable state, not React updates per frame. Rendering/DOM work pauses while hidden or outside the relevant view. Reduced motion and touch input suppress living motion while retaining static FOV/squeeze adjustments. Actual mouse events enable motion on hybrid devices even when their primary hover media query reports touch. Idle sway deliberately keeps View 1 rendering; set Idle sway to 0 for demand rendering once mouse easing settles. No extra WebGL pass or dependency was added.

## Verification / restore

Production build, scoped ESLint and TypeScript pass. Fifteen targeted tests cover independent storage, validation/reset, neutral projection, layer separation, 60/120 Hz easing, View 2/finale isolation, repeated real-Three projection without accumulation, and the prior reveal/repulsion/diagonal invariants. Chrome review includes View 1 at 32° / 1.2× and the white section at 50° / 1.15×; the colour logo remains centred. Test values were reset after checking. Actual physical-laptop FPS has not been measured.

Immediate pre-task sources and screenshots: `D:/CodexOutputs/Lens_Living_Controls_20261030/`. To undo only this request restore its saved brand-artwork, brand-motion, diagonal-section, full-journey, cinema-panel and AGENTS files, and remove the new lens-controls/lens-motion/view-one-lens/brand-camera/lens-panel modules and their test/docs. Do not reset the whole working tree or move eye-one/two/three checkpoint refs.
