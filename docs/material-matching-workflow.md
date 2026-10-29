# Blender → R3F material restoration: accepted workflow

## Current implementation � direct surface bake (2026-10-23)

The previous camera-image-derived UV atlases were rejected: cropped renders produced boundaries; a 165-degree source render removed boundaries but lacked grazing-angle detail and stretched pixels. Do not reinstall them or call those passes accepted.

Runtime now uses ceiling-uv-fixed.glb (55,860 bytes) and ceiling-surface-edges.ktx2 (3,360,256 bytes): total 3,416,116 bytes. One 4K fixed surface appearance, MeshBasicMaterial, sRGB, toneMapped=false, UV channel1, anisotropy up to16. No runtime projection, fallback PBR, angle fade or appearance switch. Reflections are frozen, not physically view-dependent. This is not a promise of exact Cycles parity.

Reproduction: scripts/blender/bake-ceiling-direct-surface.py opens the prepared authoring copy, restores repaired cove UVs and bakes original source material COMBINED lighting at256 samples/4096px, ACTIVE_CAMERA glossy direction,24px margins and original light linking. Source display transform is applied offline. scripts/blender/clean-ceiling-direct-surface.py filters each of26 islands independently, fills isolated gutters and removes thin bake seams with a local median filter. It does not change geometry. Encode ceiling-direct-surface-clean.png using basisu UASTC level3, sRGB, mipmaps, box filter, zstd19. Run scripts/finalize-ceiling-approved-assets.cjs.

Required checks: actual exported UV/geometry audit, protected source hashes, desktop opening plus strong upward orbit (15px drag at1920x945), mobile viewport and production build. Save ceiling-direct-opening.png, ceiling-direct-tilted.png and ceiling-direct-mobile.png. A browser viewport check is not physical-phone FPS evidence. Left wall remains untouched.

## Source and scope

- Active website: `D:/New folio/new site code/new_site_three`, not the older `new_si_two` checkout that may be the shell's default directory.
- Original live scene: `D:/CodexOutputs/CollectionTransfer_20261016/Theatre_Moon_Projector_restored_one.blend`.
- Source used for matched captures: `D:/CodexOutputs/Theatre_Optimization_20261017/Theatre_Moon_Projector_optimized.blend`.
- Preserved authoring work: `D:/CodexOutputs/Theatre_Ceiling_PBR_20261023/`. Original sources were never overwritten. Prepared/baked working .blend files are authoring masters, not runtime downloads.
- Website baseline hashes: `docs/theatre-floor-audit/unchanged-model-baseline.json`; despite the folder name, this protects20 original scene/model/motion files. Do not delete it with old floor experiments.
- Work on only the surface the user names. Ceiling geometry, camera journey and all other materials are accepted baselines. Do not restore adjacent mirrors, sconces, floor, sofas or corridor as an incidental part of a wall pass.

## Plan for one implementation, maximum three focused passes

This is a target, not a guarantee. Establish evidence early rather than making many speculative revisions.

**Pass1 — reference and implementation.** Inventory target evaluated meshes, materials, bounds, UVs, modifiers and light linking. Match Blender/web cameras exactly. Record source render and runtime measurements. Prepare a suitable UV layout before baking. Export the target separately, using source PBR constants, normal detail, one diffuse-lighting atlas and one small local environment. Add only the reflection calibration actually needed.

**Pass2 — diagnose visual differences.** Compare the same regions and camera. Distinguish illumination noise, compression blocks, UV seams, normal detail, mesh silhouette aliasing, display-transform differences and camera-projection boundaries. Use diffuse-only/no-normal/no-opening-correction views to isolate causes. Change one diagnosed cause at a time; measure whether the source match improves.

**Pass3 — local refinement and acceptance.** Repair only residual confirmed problems, verify compressed output and the complete camera movement at target viewports, record bytes/limits and keep one accepted screenshot. Stop once accepted; do not equate smaller files with better appearance.

## Geometry and UV preparation

- Preserve evaluated source positions, triangles and corner normals. Our first diagnostic-mesh normal comparison was misleading: the original Blender corner normals differed by at most0.0532degrees, with zero needing repair over1degree. Do not apply a guessed normal fix.
- Preserve material-coordinate bindings before making a new bake UV active. Normal nodes with empty UV names must be pinned to their intended source channel.
- New bake copies must remain members of the original receiver collections. Root-only copies lost source ceiling light linking and produced the wrong illumination.
- Use UV0 for tangent normals and UV1 for light/glossy maps. Current ceiling uses identical coordinates in both. Verify the actual runtime channel assignment.
- Check invalid/out-of-range UVs, collapsed triangles, overlap, local distortion and useful texel density. Padding must survive mip filtering, not merely look separated in the UV editor.
- A distortion ratio of1 is locally isotropic. A distorted UV chart is not by itself proof of visible stretched procedural detail: a bake can compensate. Connect numerical evidence to observed artifacts before changing a good surface.
- Cove repair: angle-based unwrap using existing seams; align each chart by an orthogonal transform, then fit using uniform scale into its previous reserved bounds. Four tiny corner cap polygons needed separate planar charts in verified free atlas space. Minimum-stretch and conformal alternatives were worse on this topology and were rejected.
- After UV changes, remap old HDR diffuse/glossy texels through triangle barycentric correspondence. Rebake tangent normals because their directions depend on the UV basis. Check that other occupied chart pixels remain unchanged. Export and measure again after compression.

## Material and illumination transfer

Keep source base colour, roughness, metallic, IOR and relevant emission constants. Do not paint over an exposure/display error with arbitrary material colours.

The ceiling's numerical settings are not a universal wall material. If the next surface has procedural or image-driven base colour/roughness/metalness, transfer or bake those actual channels instead of replacing them with constants. Keep colour maps and data maps correctly annotated; pack compatible scalar channels only when their UVs/resolution agree. Grain direction, repeat scale, normal intensity and reflection sharpness require that surface's own reference. Mirrors/transmission and strongly view-dependent reflections need separate treatment within the approved scope; a plaster lightmap is not their replacement.

The accepted ceiling uses source PBR constants plus a tangent normal, shared diffuse illumination, a local equirectangular environment and one active-camera glossy calibration map. It removes duplicate generic diagnostic lighting from this restored surface. The live environment's view response is calibrated against the source camera, while retaining live changes during travel.

Scene-linear radiance maps use the appropriate linear colour annotation; normals and display lookup data are non-colour. The saved display LUT matches the source scene's display transform. Avoid applying display conversion twice. Inspect shader output and actual display before changing brightness.

Filter noisy radiance per UV island with normalised mask weights. Whole-image smoothing can contaminate neighbouring charts and erase intentional dark reveals. Extend gutters from each island without sampling unrelated colours. For normals, average decoded vectors and renormalise; do not blur encoded RGB against black empty space.

## Camera-specific opening correction

The current ceiling includes a camera-projected Blender reference crop. This is an intentional appearance correction, not a claim of general all-angle PBR/Cycles equivalence. After an orbit-angle defect was reported, its fade was narrowed to0.08–0.8world units and gated by camera heading (dot confidence0.9994–0.99998). The source crop's upper edge is feathered over projected Y0.985–1. Distance alone was insufficient: it exposed a horizontal cutoff and duplicate features during turns. Always check small orbit deviations and camera movement before accepting a projection correction.

- Web eye: `(0.010995,3.24,3.8)`, look target `(0.010995,3.24,25.198)`, vertical FOV40degrees.
- Matching Blender eye: `(0,22.2,3.22)`, target `(0,0.802,3.22)`, vertical sensor24mm, lens `12/tan(20degrees)`.
- Blender→web placement: translate by `(0.010995,-26,0.02)` in Blender before conversion `(x,y,z)→(x,z,-y)`.
- Current source capture3072×1080,256Cycles samples with denoising; top crop3072×360. Projector aspect must remain3072/1080. Shader maps projected vertical range2/3…1 to crop range0…1.
- Lossless WebP, native-resolution crop, restrained sigma0.5 sharpening. No median filter in the accepted opening image. Texture uses linear filtering, no mip softening and device-capped16x anisotropy.
- A16:9 reference ended inside1920×945 screens, producing vertical seams. Capture wider at the same vertical FOV, rather than stretching the old image. Feather only extreme4% horizontal margins; test the actual viewport, including resize settling.
- Added world-X shadow multipliers and coverage bands produced heavy side strips and were removed. Do not reintroduce them.
- Current highlight calibration lightly neutralises only high-luminance cove pixels. Do not use it as a replacement for correct source radiance/display conversion.

## Compression and asset organisation

Keep model and texture folders separate: `public/models/theatre/<surface>...glb` and `public/textures/theatre/<surface>/...`. Public folders should contain the accepted runtime set only. Authoring EXRs, intermediate renders and rejected variants stay outside public or are removed.

KTX2 handles GPU compression; PNG/WebP/ZIP download size alone does not describe decoded GPU memory. Current maps use mipmaps and device-capped16x anisotropy. Original2K normal bake is vector-filtered to1K; diffuse2K, glossy1K, environment1024×512. Do not upscale by default.

Draco/glTF Transform details that mattered:

- Encoder `quantizationBits` key is `TEX_COORD`, not `TEXCOORD`. The wrong key silently retained12-bit UV defaults and collapsed thin UV triangles. Current precision: POSITION24, NORMAL12, TEX_COORD20; method enum1.
- `prune({keepAttributes:true})` preserves UV attributes that appear unused because textures are applied externally by the web component.
- Welding identical vertices reduced the UV-repaired model to55,860bytes; UV cuts add24vertices while retaining4,992triangles.
- Audit the actual compressed GLB, not just authoring UVs.
- Give changed UV geometry and its maps matching new filenames to avoid cached old/new combinations.

## Active ceiling: accepted values

Manifest: `components/corridor/theatre-ceiling-assets.json`. Runtime code: `components/corridor/theatre-ceiling.tsx`.

| Asset | Bytes |
|---|---:|
| `/models/theatre/ceiling-uv-fixed.glb` | 55,860 |
| `irradiance-uv-fixed.ktx2` | 2,034,549 |
| `normal-uv-fixed.ktx2` | 203,237 |
| `environment.ktx2` | 549,815 |
| `specular-uv-fixed.ktx2` | 836,915 |
| `display-lut.png` | 22,577 |
| `opening-wide.webp` | 650,696 |
| Total ceiling | 4,353,649 |

Total active scene model/texture manifest sum:9,386,578bytes, excluding JavaScript and decoders. This is not every file on disk and not GPU memory.

Actual exported cove:2,688triangles; max local anisotropy1.04712; zero triangles over5% distortion. Overall ceiling surface over5% distortion:2.08064%→0.08346%, with the remainder outside this cove repair. No invalid/collapsed UV triangles. Prepared atlas pixel-centre overlap check found zero overlaps; not an analytic subpixel guarantee.

Geometry audit:20 original scene files unchanged;4,992ceiling triangles; max position discrepancy below0.000009m. Non-cove occupied texture pixels unchanged before encoding. Build, scoped lint and browser checks passed. Active FPS75 in the test browser is not a physical-mobile performance guarantee.

## Reproduction and checks

Preserved authoring inputs include prepared/baked .blend files, base ceiling.glb, source normal/lighting/glossy maps, final repaired EXRs/PNG, environment, LUT, cove correspondence JSON and accepted wide capture. Do not delete these with rejected intermediate bakes.

Current cove repair chain, run from this repository:

1. Blender background: `scripts/blender/refine-cove-uv.py` → `cove-uv-refinement.json`. Opens a working copy, never saves source.
2. Blender background: `scripts/blender/transfer-cove-uv-textures.py` → final diffuse/glossy EXRs and normal PNG; verifies atlas overlap/gutters and non-cove pixels.
3. `node scripts/export-cove-uv-fixed.mjs` → runtime GLB, preserving geometry/normals.
4. Encode repaired EXRs with basisu HDR/UASTC; normal PNG with `-uastc -linear`; level3,mipmaps,boxfilter,zstd19. Basis binary: `D:/New folio/new site code/_tools/basisu/bin/basisu.exe`.
5. `node scripts/finalize-ceiling-uv-assets.cjs` updates accepted sizes/paths. Re-render/re-crop opening only if its source camera or appearance actually changes.
6. `node scripts/audit-ceiling-texture-mapping.mjs` and `node scripts/verify-theatre-ceiling.mjs` validate the manifest-selected runtime model.
7. `npx eslint components/corridor/theatre-ceiling.tsx`; `npm run build`. Inspect normal opening and `/?ceiling-test=mapping` (PBR without image correction), optionally `no-normal` or `diffuse`.
8. Restart the production server after building, then verify opening and pullback at1920×945 and normal16:9. Save screenshot and console results. Do not claim tested phone FPS from desktop viewport emulation.

## What not to repeat

- Multi-direction floor radiance files reached148MB and were explicitly rejected. They are removed during cleanup; the original plain diagnostic floor remains active.
- A large combined bake did not handle travel well and was not deployed. Do not promise one static bake will reproduce view-dependent reflections everywhere.
- Whole-field polynomial smoothing reduced irregularity but worsened source-match measurements. Native-cove special baking did not automatically fix seams.
- Lowering3.88MB to3.68MB without fixing the image was not improvement. User approval depends on appearance, performance and honest size reporting together.
- Original-source normal evidence takes priority over comparisons against simplified diagnostic exports.
- No model-wide material restoration, camera retiming or neighbouring-surface edits inside a local surface request.

Edge repair: the +X wall-crown closure was outward-facing in the source, so its room-visible face baked black. Reverse that bake copy only (never source/runtime geometry); fix-ceiling-direct-edges.py rebakes its chart over the retained direct EXR. stitch-ceiling-direct-edges.py repairs233 paired smooth UV cuts using matching geometric endpoints/normals, then clean-ceiling-direct-edges.py restores isolated gutters. Encode ceiling-edge-stitched-clean.png to the active filename. Screenshots ceiling-edges-before.png and ceiling-edges-fixed.png show the same camera drag (+10,+5 pixels at1920x945). Runtime total3,416,116B. The full direct bake now includes the closure correction to avoid regression.

## Left wall (2026-10-24)

Direct single-camera surface bake, runtime planar UVs because theatre-marked.glb has no UVs. See docs/left-wall-audit/README.md.

## Remaining theatre surfaces (2026-10-24)

Generic pipeline for every surface after the left wall (items in `scripts/surface-bake/items.json`):
1. `node scripts/surface-bake/prepare-uv.mjs <item>` reads only runtime triangles (no GLB is written), builds planar charts
   (edge-connected faces sharing a dominant normal axis, overlap-split, hidden-from-every-viewpoint charts at 1/8 density,
   thin strips kept at `minTexelsAcross`), skyline-packs them into the smallest power-of-two atlas keeping >= `minDensity`
   of the target texel density, and writes the runtime chart sidecar `public/textures/.../<item>-uv.bin` (v2: chart id per
   triangle + [label, scaleU, scaleV, offsetU, offsetV]).
2. `blender -b --python scripts/blender/surface-bake/bake-item.py -- <item>`: disposable copy, evaluated meshes frozen and
   triangulated, bake UVs matched triangle-by-triangle to the runtime, render UV left active, empty material slots given
   Blender's default surface, curves baked through mesh twins in the same light-link sets, objects joined only when that
   cannot change shading. COMBINED, ACTIVE_CAMERA = opening camera, source AgX look applied once.
3. `node scripts/surface-bake/encode-item.mjs <item> --activate` (UASTC L3, RDO 0.25, sRGB, box mips, zstd 19).
4. Runtime: `components/corridor/baked-surfaces.tsx` (only manifest items with `active: true`).
5. Verify: `references.mjs` (Blender beauty + Workbench target mask per pose), R3F capture at the same pose, `compare.py`.
Do not bake from more than one camera (user decision). Surfaces facing away from the opening camera and fully metallic thin
rims are the known weak spots; see each docs/<item>-audit/README.md. The corridor is unresolved: its runtime geometry is not a
rigid/affine copy of the corridor source (docs/restoration/inventory.md).

## 6K upgrade workflow (2026-10-24)
For an accepted surface: back up its KTX2 outside `public/`; rebake fresh at 6144 x 6144 with the same source, camera and UV
layout (`bake-item.py -- <item> 2048 --size 6144x6144 --tag 6k`; the left wall and ceiling use their own scripts with
`LW_*` / `CEIL_*` env vars); check convergence with `convergence-check.py` and gain-boosted `uv-crop-compare.py` crops;
encode with `encode-6k.mjs` (UASTC 3, RDO 0.25, sRGB, mips stop at 12 px for 4x4-block alignment, zstd 19) under a fresh
`-6k` URL; for camera-ray materials replay at the bake pose; capture the same poses before/after in R3F and compare with
`compare.py`; guard with `check-6k.mjs`. Measured results and device/memory caveats: `docs/restoration/6k-upgrade.md`.

## Current runtime overrides (2026-10-25)
Read docs/scene-finish/README.md and the current manifests first. Live moon reflections, source projector PBR/material maps, original particle-field choreography and reused sofa radiance arrays are active. Only the four authorized ceiling/floor/left-corridor/floor targets select compressed 6K on capable laptops/desktops. Phones/tablets retain 2K. The curtain is a one-shot transition during the 0.3s wide pause, not an always-visible background. No new multi-camera bake bundle. Existing single surface bakes retain their frozen-sheen limitations. Earlier projection and multi-texture ceiling descriptions in this document are historical and must not override active manifests.