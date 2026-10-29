# Theatre, corridor and logo

New logo-eye prototype: moving silver particle bands, isolated in a removable component, with the existing logo/camera sequence preserved. [Scope, removal and verification](docs/logo-particle-eye/README.md). The physical laptop's reported 50-second projector wait and its lighting remain deferred; the earlier loading work below must not be treated as verified on that laptop.

Latest laptop fixes: smaller first-paint downloads, earlier projector preparation, identical particle motion with less repeated GPU work, restrained cool-white floor lighting, a smaller centred sphere and automatic slide-to-turn continuation. [Report, comparisons and checks](docs/laptop-five/README.md).

Latest pass: illumination-aware room dimming, live projector floor shadows, smaller centred liquid entrance, corrected exit clocks and a black logo background. [Evidence and checks](docs/five-fixes/README.md).

Latest liquid finish: softer ivory/charcoal shading, warm corridor light and a curved flowing current, with the existing transition intact. [Screenshots and validation](docs/liquid-refinement/README.md).

Latest fixes: whiter continuously moving liquid pearl, immediate return at the third page section, and projector grains fitted to the current parts. [Evidence and validation](docs/three-fixes/README.md).

The corridor page now arrives as a procedural liquid pearl, morphs into a rectangle and hands off to HTML. [Implementation and verification](docs/liquid-page/README.md).

Latest fix — 26 October: opening GPU preparation finishes before the first camera move; later-room preparation waits until it ends. Soft night fill preserves visible theatre and floor detail after formation. Evidence and verification: [opening and ambient correction](docs/opening-ambient/README.md).

## Current scene — 25 October 2026

The projector stays invisible until formation. Laptop particles now use 32,768 genuine source samples and the source grain program; phones retain clean material reveal and assembly without flying particles. Shared landing masks connect particles, surfaces and shadows. The theatre and both floors fade dark once and stay dark until Restart. Opening camera travel no longer has the old stationary ease-out tail. Invisible GPU preparation uses stationary stops, and optional computer-only 6K loads run one at a time. Current evidence, screenshots, device limits and loading measurements: [sequence correction report](docs/sequence-corrections/README.md). The earlier [performance/material report](docs/scene-performance/README.md) remains historical evidence for glass, upholstery and wall cleanup. Preview: `http://192.168.1.5:3000/`; loading diagnostics: `http://192.168.1.5:3000/?diagnostics=1`.

The geometry-rebuild notes below describe the earlier diagnostic stage; the current manifests and scene-finish report supersede their old projector/model/texture totals.

## Earlier geometry rebuild

Current Blender layout: `D:/CodexOutputs/Approved_Theatre_Corridor_20261020/Theatre_Corridor_Logo_marked_layout.blend`.

The theatre and projector platform moved together another 12 metres toward the slide, aligning the circled rear theatre edge with the requested line. Both retain their original dimensions and spacing; the shared Blender translation is `[.010995, -26, .02]`. The rear roof edge is Y=-4.5 and the platform starts at Y=.669. Corridor walls are identical to the previous approved layout, including the terminal at Y=-15. Slide A now continues straight for 12 metres before its curved rise starts at Y=-27. Slide B at the opposite end is unchanged. The whole logo is not scaled to force a fit.

The architecture GLBs use coordinates baked directly from this file. R3F applies no fitting transform. The optimized projector uses a single batched mesh with GPU part transforms sampled from Blender, centred over the platform at its native size, orientation and height. Diagnostic colours remain intentional; finished textures/lighting, sofas and scroll-triggered projector choreography are outside this step.

| Active asset | Triangles | Bytes |
| --- | ---: | ---: |
| `public/models/corridor-marked.glb` — logo, corridor and both slides | 45,402 | 436,148 |
| `public/models/theatre-marked.glb` — theatre and moon fixtures | 63,788 | 700,892 |
| `public/models/projector-floor-marked.glb` | 12 | 1,784 |
| `public/models/projector-animated.glb` — GPU-driven projector parts | 425,397 | 3,600,200 |
| `public/models/projector-motion.bin.gz` — poses and particle targets | 0 | 389,501 |
| Total | 534,599 | 5,128,525 |

The projector comes from `Theatre_Moon_Projector_optimized.blend`. Its 514 parts use 65 sampled poses from frames 96–576, retaining original hierarchy-derived motion and animated visibility. GPU interpolation plays assembly in two wall-clock seconds, avoiding 514 JavaScript object updates per frame. A 20,000-point GPU particle recreation lands on the optimized exploded geometry over four seconds, then holds until Assemble is pressed. The lighter particle field is an approximation of the previous dense effect. Geometry uses one draw call; particles add one only while forming. Original source hierarchy/actions remain unchanged. The previous static GLB is retained as an inactive reference. No texture files, shadow passes or postprocessing were added.

The two manual buttons are Particles and Assemble. They disable during playback, support replay and keyboard input, and do not change the camera or scroll sequence. Programs compile before buttons enable. Rendering returns to demand mode after each animation. A raw motion-data fallback is available for browsers without native gzip decompression; supported browsers download the 389 KB gzip file. `projector-animation-verification.json` verifies the decoded GPU assembled pose against the existing placement. `projector-motion-source-verification.json` checks 2,570 matrices against Blender across five timeline positions.

The eagle/globe was reduced from 25,000 to 20,000 triangles; stronger reductions failed the conservative sampled surface-error limit. Slide A has 98 triangles per surface/side including its straight section. Slide B has 96 per surface/side.

## Run and verify

```sh
pnpm build
pnpm start --hostname 0.0.0.0 --port 3000
pnpm lint
node --test scripts/camera-regression.test.mjs
node --test scripts/projector-controls.test.mjs
node scripts/verify-projector-animation.mjs
```

Orbit is available for inspection; the default is **Orbit: Off** for the complete journey. The intro keeps the original framing and timing, translated with the theatre. Two deliberate scrolls reveal the projector, approach it and start particles. Parts hold until the next scroll assembles them and returns the camera. Further scrolls show both side screens, travel along the upgraded corridor centreline, then expand the blank page twice. The full-screen page has white, sage and sand sections with native scrolling; the WebGL canvas unmounts after handoff. Wheel, touch and keyboard inputs share the same stages. Restart reloads the journey.

The export folder contains `build_layout.py`, `verify_export.py`, `final_layout_audit.py`, `layout-report.json`, `verification.json`, `final-layout-audit.json`, and `export-manifest.json`. The original .blend files were not overwritten. Above-floor theatre/platform intersections were checked. The wall curves match the original vertices exactly outside the straight terminal extension. Blue shell intersections with walls, floor and both slides are zero. All 641 route samples have floor below them. Buried foundation/ground contacts are not treated as visible collisions. Responsive browser checks do not replace performance measurements on physical target devices.

To reinstall a verified export: `node scripts/use-blender-layout.mjs`. Earlier fit experiments and `align-upgraded-entrance.mjs` are superseded and must not be used for this layout.

## Optional sofas

`components/corridor/sofas.tsx` owns the seating independently. Set `SOFAS_ENABLED = false` in `components/corridor/scene-features.ts` to remove the entire group and skip its GLB request; the theatre files stay unchanged.

The separate `public/models/sofa-lowpoly-draco.glb` is 12,320 bytes: one 1,479-triangle mesh, no textures. Twelve GPU instances restore the latest Blender rows B/C/D (three rows of four) using their saved bounds and the current theatre translation. Total seating is 17,748 triangles in one draw call, with no per-frame updates. Materials remain diagnostic pending the texture pass. The geometry and instance buffer are released when the 3D scene unmounts.

Source/export report: `D:/CodexOutputs/Approved_Theatre_Corridor_20261020/sofa-export-report.json`. Export script: `export_sofas.py` in the same directory; rerun after moving the theatre in Blender. Verify with `node scripts/verify-sofas.mjs`.

At the bottom of the third page section, a fresh downward wheel gesture, upward swipe or PageDown/ArrowDown/Space press returns the page to a small panel at the same corridor stop. The gesture that reaches the bottom and its trailing momentum are ignored. The last section's colour stays visible through the zoom-out. The scene prepares behind the page, then resumes demand rendering; scrolling moves the camera up the opposite slide with a steady heading. At the lip a fresh scroll triggers the 1.4-second turn with a gentle backward move. After the turn, another fresh scroll starts the automatic 4.5-second pullback to the full logo. The 3D canvas still unmounts while normal page scrolling is active.
The final reveal has separate slide, turn and pullback stages. Slide travel uses refresh-rate-independent scroll smoothing and can reverse before the top. Turn and pullback are automatic once triggered, with momentum blocked from skipping either stop. Camera poses match exactly at both joins. Approved final framing and geometry are preserved.




