# Theatre right wall (ET | Side structural wall -1)

Status: Agent-verified — awaiting user review.

Objects (108 runtime triangles): ET | Side structural wall -1
Materials: DETAIL V2 | Wine velvet

## Method
- Runtime GLB has no UVs. `scripts/surface-bake/prepare-uv.mjs right-wall` reads only the runtime triangles and derives 6 planar charts
  (edge-connected faces with the same dominant normal axis, projected along it; 0 overlap splits; 4 charts never face a
  viewpoint and get 1/8 density). The runtime copy gets the same UVs from `/textures/theatre/right-wall/right-wall-uv.bin`; GLBs, positions, normals and topology are unchanged.
- `scripts/blender/surface-bake/bake-item.py right-wall`: Cycles COMBINED direct surface bake of the source material in the disposable copy
  (LeftWall_work_copy.blend, never saved), 1024 samples, 166.1s, all source lights, light linking and occluders.
  Glossy/sheen direction: single bake camera at 0, 22.2, 3.22. Display transform AgX / AgX - Medium High Contrast / exposure 0.45 applied once.
  Every bake triangle matched a runtime triangle (max distance 3.29e-6 m).
- `scripts/surface-bake/encode-item.mjs right-wall`: 8-bit dither, UASTC level 3, RDO 0.25, sRGB, box mipmaps, zstd 19.
- Runtime: `components/corridor/baked-surfaces.tsx`, MeshBasicMaterial, toneMapped false, anisotropy up to 16, one draw call.

- Same Wine velvet material as the accepted left wall; baked from its own lighting, not mirrored.
- Room face (+X) is one chart at 196 texels/m (5.1 mm), stored rotated in the atlas.

## Runtime assets
| File | Bytes |
|---|---:|
| /textures/theatre/right-wall/right-wall.ktx2 (2048x4096, 196 texels/unit, 62.3% used) | 2,932,905 |
| /textures/theatre/right-wall/right-wall-uv.bin | 356 |

Estimated GPU memory (4x4-block transcode, 1 B/texel, with mips): 10.7 MiB.

## Same-pose comparison (target mask from Blender, eroded 2 px; 8-bit display values)
| Pose | R3F mean RGB | Blender mean RGB | RMSE | RMSE excl. outliers | p95 max-channel err |
|---|---|---|---|---|---|
| opening (800x394, eye 0,22.2,3.22, target 0,0.802,3.22, 40 deg) | 42.5, 17.5, 10.6 | 42.6, 17.3, 10.1 | 7.81 | 2.66 (83 of 23784 px over 20) | 8 |
| closeup (800x450, eye 0,22.2,3.22, target -6,10,3.45, 48 deg) | 26.1, 15.5, 9.5 | 24.8, 14.0, 7.2 | 17.37 | 2.35 (733 of 62611 px over 20) | 8 |
| midroom (800x450, eye 0,10.4,3.22, target -8.2,4,3, 48 deg) | 41.9, 16.8, 10.2 | 16.6, 13.4, 8.7 | 15.53 | 9.54 (85505 of 109657 px over 20) | 37 |

Outliers are pixels with any channel error above 20; they were checked visually and sit on silhouettes next to objects that
are still diagnostic or excluded (e.g. the runtime low-poly seating differs from Blender's seats).

## Limitations
- Velvet sheen is frozen as seen from the opening camera (same accepted limitation as the left wall): looking straight at the wall in orbit (midroom pose) R3F reads redder than Blender.

## Reproduce
```
node scripts/surface-bake/prepare-uv.mjs right-wall
blender -b --python scripts/blender/surface-bake/bake-item.py -- right-wall
node scripts/surface-bake/encode-item.mjs right-wall --activate
node scripts/surface-bake/references.mjs right-wall
```
Then capture R3F at each pose into `D:/CodexOutputs/Restoration_20261024/right-wall/reference/<pose>-r3f.png` and run `blender -b --python scripts/blender/surface-bake/compare.py -- right-wall <pose>`.

## 6K upgrade (2026-10-24) — Agent-verified, awaiting user review

Fresh 6144 x 6144 bake (`bake-item.py -- right-wall 2048 --size 6144x6144 --tag 6k`, 2048 samples, 1,052 s, same opening
camera, same 108 triangles, margin 12 px). The chart layout and `right-wall-uv.bin` are unchanged; UVs are normalised by
the 2048 x 4096 layout, so the 6K image samples the same mapping 3x finer across and 1.5x finer vertically.

| | Accepted | 6K |
|---|---|---|
| Runtime file | `right-wall.ktx2` (backup: `D:/CodexOutputs/Restoration_6K_20261024/backup/theatre-right-wall/`) | `right-wall-6k.ktx2` |
| Image | 2048 x 4096 | 6144 x 6144 |
| Download | 2,932,905 bytes | 11,679,328 bytes |
| GPU estimate | 10.7 MiB | 48.0 MiB |
| Residual (8-bit) / mean luma | 0.160 / 19.85 | 0.147 / 19.88 |

KTX2 vs clean master: RGB PSNR 52.8 dB. Same-pose RMSE vs Blender (before → after): opening 2.82 → 2.83; close-up 15.84 →
15.84 (2.17 → 2.16 excluding sofa-silhouette outliers); mid-room 15.70 → 15.61; near-wall detail 5.18 (after only).
Limitation unchanged: frozen sheen reads redder face-on.
