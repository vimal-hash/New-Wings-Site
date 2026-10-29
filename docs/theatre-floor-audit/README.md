# Theatre floor: read-only inspection

## Current quality-first revision — 22 October 2026

This section supersedes the 3 MB approximation described further below. Scope remains **theatre floor only**. The live Blender document, other room materials, original models, placement, camera journey and scrolling code were not edited.

- Replaced the single room probe with **49 Cycles directional measurements**, with 22.5-degree azimuth spacing at the two grazing rings, plus a perspective measurement at the approved opening stop. Interpolation changes with the camera; this is not a fixed floor photograph or a new floor surface.
- Retained original `Wood Floor Walnut` shading, including its 0.28 coat / 0.2 coat roughness, and the honed basalt source. The 4K walnut and 2K basalt illumination bakes use 512 samples and offline albedo-guided OIDN. Bake UV space is weighted toward exposed faces; hidden undersides remain in the geometry. Native `FloorUV_planks` coordinates, the original 2K seam/height image, its 1.5-unit tile and 0.8 mm bump distance preserve detail finer than the measured atlas. Fine joint and bump reconstruction remains an approximation between captured directions.
- Source image grading is the original AgX Medium High Contrast / exposure 0.45, applied only to the floor. A direct HDR-to-PNG lookup check agrees within about one display level at sampled source pixels. The original scene still supplies shadows/reflections during capture; camera-ray isolation does not replace surrounding source materials or lights.
- The new `/models/theatre-floor-detail.glb` contains only the same two floor surfaces, with the additional native UV set. **4,104 floor triangles; 63,788 total theatre triangles**, unchanged. All non-floor attributes and all 20 pre-existing model files pass the geometry/SHA checks. Maximum positional difference is still 0.00000604 m from export quantization.
- Floor assets total **136,825,360 bytes**. Full-resolution EXRs and losslessly gzipped native RGB9_E5 radiance replace the lossy texture approximation. Each radiance array is 1024 × 1024 × 51 layers (49 measured directions, diffuse reference, perspective reference), **213,909,504 GPU bytes per array**. Size and memory reduction are intentionally deferred for this appearance review; the arrays alone use about 408 MiB, before base textures. Do not treat this as the mobile-memory-optimised release.
- Source comparisons must account for the existing `.study-footer` scrim: it covers the bottom 57.5 px at 1920 × 1080 and fades to 40% dark opacity. It was not changed. Comparing a bare Blender image directly with those overlaid floor pixels incorrectly suggests that the floor needs brightening. `source-comparison.json` records the corrected, limited comparison, including a zero-difference non-floor ceiling patch.

Production preview: `http://192.168.1.5:3000/`. TypeScript, targeted ESLint, production build, native HDR/UV checks and the unchanged-geometry checks pass. Browser screenshots and current production checks are in this directory. A phone-sized browser check is not a real-phone memory or FPS measurement.

The matched-camera, footer-corrected wood region has an RGB RMS difference of **3.49 / 255**, versus **6.78 / 255** before this revision. The unobstructed basalt region is **1.21 / 255**, versus **5.77 / 255** before. Its rectangle excludes the still-diagnostic coloured rail fixtures. These are two limited image regions, not whole-scene or every-angle equivalence. The checked non-floor ceiling patch has zero changed channels across 600,000 channel samples. The production root, detail GLB and all eight floor texture endpoints return HTTP 200; a fresh production browser reports no errors. Desktop and 390 × 844 checks load all six models, and the phone-sized view completes the first camera leg. Final screenshots: `floor-quality-production.png`, `floor-quality-side.png`, `floor-quality-phone-sized.png`, `floor-quality-phone-travel.png`.

Working files are retained under `D:/CodexOutputs/Theatre_Floor_Quality_20261021/`, with the final density-weighted copy and assets in `dense-uv-v2/`. Original captures/measurements at the root are inputs to the UV-density step and should be retained. Runtime is `theatre-floor.tsx`, `theatre-floor-radiance.ts` and `floor-radiance-loader.ts`. Reproduction scripts: `repack-floor-visible-uv.py`, `bake-floor-quality-base.py`, `denoise-floor-quality-base.py`, `measure-floor-directions.py`, `export-floor-native-detail.py`, `measure-floor-opening.py`, `pack-floor-directions.py`, then `encode-floor-quality.mjs`. Verification: `verify-theatre-floor.mjs`, `verify-floor-radiance.mjs`, `compare-floor-reference.mjs`.

The measurements reproduce a static source room. Moving/removing sofas or changing room lighting requires updated captures/bakes. Arbitrary orbit views interpolate the measured field; this does **not** establish pixel-identical Cycles rendering at every camera angle. Keep appearance approval separate from the later asset/memory optimisation.

21 October 2026. Scope: theatre floor only. No Blender originals, website assets, rendering settings or camera journey were changed. The audit script opens files in a separate background Blender process and never saves a blend.

## Findings

- The connected live Blender session is the preserved `D:/CodexOutputs/CollectionTransfer_20261016/Theatre_Moon_Projector_restored_one.blend`. It is not the approved optimized source. Its floor currently uses `REFINED | Smoked walnut`; this distinction matters when choosing material inputs.
- Independently opened the optimized source, `D:/CodexOutputs/Theatre_Optimization_20261017/Theatre_Moon_Projector_optimized.blend`, and the approved placed layout, `D:/CodexOutputs/Approved_Theatre_Corridor_20261020/Theatre_Corridor_Logo_marked_layout.blend`.
- In both files, the authored timber floor is `ET | Aisle -7.4 row 2 tread 1` (prefixed `THEATRE | ` in the layout). Its assigned material is `Wood Floor Walnut` / `Wood Floor Walnut.002`. The optimized mesh retains `PBR_Metric`, `PaintUV`, `automap` and `FloorUV_planks` UV layers.
- The optimized timber object has 444 base-mesh triangles. The approved layout contains the evaluated geometry at 3,996 triangles. These are different stages of evaluation, not evidence of a new regression. Do not substitute the base mesh and lose its repeated floor geometry.
- The separate foundation slab retains its honed black basalt material and mapping. Projector platform `Second_floor` is outside this step; its 4K material is not the theatre's timber floor.
- The timber material contains 43 Blender nodes. Its existing packed source images include 1K wood colour/specularity images, 2K plank normal and displacement images, and a 256-pixel fine bump image. Several external paths are missing, but the images are packed inside the blend and available for reuse. No new texture download is necessary for the initial restoration.
- The actual current `public/models/theatre-marked.glb` is 700,892 bytes, one mesh and one diagnostic material, with `POSITION`, `NORMAL` and `COLOR_0` only. It contains no UV attributes, images or textures. Its geometry-study export cannot accept the original mapped material simply by assigning a colour texture.
- The previous project's floor bake is 11,632,379 bytes and its full directional views are 17,681,666 bytes: 29,314,045 bytes combined (~29.3 MB decimal), excluding masks and previews. The previews total another 5,998,324 bytes. Do not reintroduce that entire package automatically.
- The old website floor code refers to `REFINED | Smoked walnut`, whereas the approved optimized/layout floor is assigned `Wood Floor Walnut`. Old bakes must be checked for look and mapping compatibility; do not assume they match the later approved Blender material.

## Recommended next implementation

1. Use the approved placed layout as the spatial source; preserve its evaluated floor surface and existing transforms.
2. In a separate web-export copy, retain the floor's UV mapping and distinguish its material from the rest of the diagnostic theatre. Avoid adding a second overlapping floor surface. Retain all other geometry and materials as they are.
3. Reuse the packed walnut sources and simplify the Blender node network offline into a small texture set. Start by assessing 2K colour and lower-resolution normal/roughness controls; increase resolution only when the actual camera framing demonstrates a visible need.
4. First restore floor grain, plank spacing, colour and satin roughness. Do not restore the 81-direction reflection package or add dynamic reflection passes as part of this first step. Any reflection approximation must be reviewed visually before it is accepted.
5. Show a floor-only result, then measure incremental loading/GPU resources and frame pacing. No FPS gain or identical appearance has been measured by this inspection. The other theatre surfaces and current simple lighting will still be unfinished at this stage.

Walls, ceiling, moon glass, sofas, projector, projector platform, corridor and logo remain outside this change. Detailed file inspection is in `blend-inspection.json`.

## Floor-only implementation — 21 October 2026

Restored **only** the timber terraces/aisles and the foundation floor slab. The stage plinth, projector platform, fixtures, seating, walls, ceiling, corridor, logo, camera stops and scroll code retain their existing state.

- Original `theatre-marked.glb` remains byte-for-byte unchanged. A route-owned geometry copy excludes only the two audited floor colour IDs; the separately exported UV-mapped floor replaces those exact triangles. There is no stacked diagnostic floor beneath it.
- The floor keeps **3,996 walnut + 108 basalt = 4,104 triangles**. The complete theatre stays at **63,788 triangles**. All non-floor position, normal and colour buffers are identical. All 20 pre-existing model files pass SHA-256 checks. Export position differences are at most **0.00000604 m**, from Draco quantization.
- Blender's packed material sources and original plank coordinates supply the finish. Diffuse illumination is baked offline in Cycles; clean material albedo guides offline OIDN denoising to remove indirect-light fireflies while retaining grain. Normal/roughness maps retain the relief and satin response.
- A single static room capture, corrected for the room bounds, supplies approximate view-dependent reflections. It is assigned to the floor material only. No scene environment, real-time reflection pass, extra scene light or global tone-mapping change was added. The original AgX contrast/exposure is captured in a small floor-only display lookup.
- Final GPU-compressed textures: **2K walnut illumination, 1K walnut normal, 512 roughness; smaller basalt maps; 1K × 512 reflection capture**. The floor GLB is **85,696 bytes**; the complete floor asset package is **3,028,898 bytes**, plus approximately 585 KB of shared Basis transcoder files on a first uncached load. It adds two draw calls, no triangles, and no per-frame React/JavaScript work.
- The 2K package was compared with the 4K bake at the same camera/reflection settings. In the recorded wood-detail region the RMS pixel difference was 2.38/255; the front-floor region was 0.65/255. The sampled ceiling region was identical. These measurements compare texture resolutions, **not equivalence with Cycles**.

### Validation and practical limits

`pnpm build`, TypeScript, targeted ESLint and `node scripts/verify-theatre-floor.mjs` pass. The production preview serves at `http://192.168.1.5:3000/`. Desktop and 390 × 844 viewport checks load all six models, show the floor, and complete the first scroll camera leg without browser errors. The preview sampled about 75 FPS at a 75 Hz desktop refresh rate; the phone-sized check uses the same desktop GPU and is **not a real-phone performance measurement**.

The baked finish preserves the source grain, palette and material settings. A single captured reflection is an approximation, especially for nearby step LEDs and arbitrary orbit angles; this is **not a 100% pixel-identical Cycles render**. Remaining diagnostic colours/lighting around the floor are intentionally unchanged. Review the floor before restoring another surface.

### Files and reproduction

- Runtime: `components/corridor/theatre-floor.tsx`, `theatre-floor-geometry.ts`, `theatre-floor-ids.json`, `theatre-floor-assets.json`.
- Rollback: set `THEATRE_FLOOR_ENABLED` to `false` in `scene-features.ts`; the untouched diagnostic GLB and original index are retained.
- Blender export copy: `D:/CodexOutputs/Theatre_Floor_Restore_20261021/Theatre_floor_only_web_copy.blend`. Only source-floor backups are hidden in this copy; 1,754 non-floor object transforms, visibility and material-slot assignments were checked unchanged. The live Blender file and its unsaved edits were never modified.
- Build assets: run background Blender with `scripts/blender/bake-theatre-floor.py`; run `polish-theatre-floor-bakes.py` for denoising; run `node scripts/encode-theatre-floor.mjs`; verify with `node scripts/verify-theatre-floor.mjs`. Do not reuse these colour IDs/room bounds after another geometry export without regenerating and verifying them.
- Evidence: `geometry-verification.json`, `texture-size-comparison.json`, `floor-desktop.png`, `floor-front-angle.png`, `floor-mobile.png`, `floor-mobile-pullback.png`, and logs in this directory. Source references are kept in the Blender export folder.
## Native perspective detail refinement — 22 October 2026

The opening floor capture previously passed through the 1024-square UV atlas, softening board-end joints and small reflected highlights. `export-floor-opening-detail.py` extracts the original 1920 × 1080 HDR Cycles floor-only capture, without opening or saving a source blend. The floor shader projects this capture onto the existing two floor meshes near the measured camera. It retains the captured bump, joint roughness and coat instead of applying another joint-darkening correction over that capture.

The projection fades continuously by both camera distance (0.08–1.2 metres) and angular departure (0.5–5 degrees), using the original per-surface visibility mask and capture alpha. Away from this viewpoint the existing 49-direction measured field remains in use. This improves the opening view; it does not establish exact dynamic reflections at every orbit angle. No model positions, geometry, scene lights, cameras, journey code or other materials were edited.

The footer-corrected matched wood-region RMS is now 1.88 / 255, compared with 3.49 / 255 before this refinement. Basalt is 1.19 versus 1.21. These are limited region comparisons, not a percentage fidelity score. `refine-crop-0.png` and `refine-crop-1.png` show the before/after plank detail; `refined-opening-1920.png` records the full comparison view. The original floor capture adds 6,541,331 bytes; floor assets total 143,366,691 bytes. Size optimisation is deferred as requested.

Build, TypeScript, targeted ESLint, unchanged-model/geometry checks and HDR checks pass. The browser loads all six models without rendering errors at desktop and 390 × 844 dimensions. A mobile-sized desktop viewport does not test real-phone FPS or memory.

