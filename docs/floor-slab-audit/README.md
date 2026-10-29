# Foundation floor slab

Status: Agent-verified — awaiting user review.

Objects (108 runtime triangles): ET | Foundation slab
Materials: ET PBR | NOIR / Honed black basalt

## Method
- Runtime GLB has no UVs. `scripts/surface-bake/prepare-uv.mjs floor-slab` reads only the runtime triangles and derives 6 planar charts
  (edge-connected faces with the same dominant normal axis, projected along it; 0 overlap splits; 4 charts never face a
  viewpoint and get 1/8 density). The runtime copy gets the same UVs from `/textures/theatre/floor/floor-slab-uv.bin`; GLBs, positions, normals and topology are unchanged.
- `scripts/blender/surface-bake/bake-item.py floor-slab`: Cycles COMBINED direct surface bake of the source material in the disposable copy
  (LeftWall_work_copy.blend, never saved), 1024 samples, 80.7s, all source lights, light linking and occluders.
  Glossy/sheen direction: single bake camera at 0, 22.2, 3.22. Display transform AgX / AgX - Medium High Contrast / exposure 0.45 applied once.
  Every bake triangle matched a runtime triangle (max distance 3.51e-6 m).
- `scripts/surface-bake/encode-item.mjs floor-slab`: 8-bit dither, UASTC level 3, RDO 0.25, sRGB, box mipmaps, zstd 19.
- Runtime: `components/corridor/baked-surfaces.tsx`, MeshBasicMaterial, toneMapped false, anisotropy up to 16, one draw call.

- Visible mostly in the front aisle between the stage and the first terrace.

## Runtime assets
| File | Bytes |
|---|---:|
| /textures/theatre/floor/floor-slab.ktx2 (2048x2048, 96 texels/unit, 80.6% used) | 1,078,351 |
| /textures/theatre/floor/floor-slab-uv.bin | 356 |

Estimated GPU memory (4x4-block transcode, 1 B/texel, with mips): 5.3 MiB.

## Same-pose comparison (target mask from Blender, eroded 2 px; 8-bit display values)
| Pose | R3F mean RGB | Blender mean RGB | RMSE | RMSE excl. outliers | p95 max-channel err |
|---|---|---|---|---|---|
| opening (560x276, eye 0,22.2,3.22, target 0,0.802,3.22, 40 deg) | 50.5, 45.3, 42.7 | 50.5, 44.2, 41.0 | 7.89 | 2.92 (75 of 3199 px over 20) | 11 |
| closeup (560x315, eye 0,22.2,3.22, target 0,4,0, 28 deg) | 52.8, 48.0, 45.5 | 49.3, 43.1, 39.8 | 24.47 | 2.42 (457 of 9221 px over 20) | 19 |

Outliers are pixels with any channel error above 20; they were checked visually and sit on silhouettes next to objects that
are still diagnostic or excluded (e.g. the runtime low-poly seating differs from Blender's seats).

## Limitations
- Honed basalt has soft reflections; they are frozen as seen from the opening camera and will not slide with camera movement.
- Close-up outliers sit on the stage/seat silhouettes (excluded runtime seats differ from Blender seats).

## Reproduce
```
node scripts/surface-bake/prepare-uv.mjs floor-slab
blender -b --python scripts/blender/surface-bake/bake-item.py -- floor-slab
node scripts/surface-bake/encode-item.mjs floor-slab --activate
node scripts/surface-bake/references.mjs floor-slab
```
Then capture R3F at each pose into `D:/CodexOutputs/Restoration_20261024/floor-slab/reference/<pose>-r3f.png` and run `blender -b --python scripts/blender/surface-bake/compare.py -- floor-slab <pose>`.

## 6K upgrade (2026-10-24) — Agent-verified, awaiting user review

Fresh 6144 x 6144 bake (`bake-item.py -- floor-slab 2048 --size 6144x6144 --tag 6k`, 2048 samples, 996 s, same opening
camera, margin 24 px). Chart layout and `floor-slab-uv.bin` unchanged (2048 x 2048 layout, sampled 3x finer).

| | Accepted | 6K |
|---|---|---|
| Runtime file | `floor-slab.ktx2` (backup: `D:/CodexOutputs/Restoration_6K_20261024/backup/theatre-floor-slab/`) | `floor-slab-6k.ktx2` |
| Image | 2048 x 2048 | 6144 x 6144 |
| Download | 1,078,351 bytes | 8,108,148 bytes |
| GPU estimate | 5.3 MiB | 48.0 MiB |
| Residual (8-bit) / mean luma | 0.064 / 35.00 | 0.052 / 34.88 |

KTX2 vs clean master: RGB PSNR 55.3 dB. Same-pose RMSE vs Blender (before → after): opening 7.89 → 7.94 (2.93 → 2.88
excluding outliers); close-up 24.47 → 24.47 (2.42 → 2.39; outliers are seat silhouettes over the aisle); stage-front
detail 3.33 (after only).
