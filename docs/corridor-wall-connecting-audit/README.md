# Corridor connecting-plane wall (dark steel)

Status: Agent-verified — awaiting user review.

Objects (580 runtime triangles): Connecting plane • joins yellow tip
Materials: PREP | Connecting plane • joins yellow tip | Corridor • right neutral soft fill / dark lower edge.001

## Method
- Runtime GLB has no UVs. `scripts/surface-bake/prepare-uv.mjs corridor-wall-connecting` reads only the runtime triangles and derives 2 planar charts
  (edge-connected faces with the same dominant normal axis, projected along it; 0 overlap splits; 0 charts never face a
  viewpoint and get 1/8 density). The runtime copy gets the same UVs from `/textures/corridor/wall-connecting/corridor-wall-connecting-uv.bin`; GLBs, positions, normals and topology are unchanged.
- `scripts/blender/surface-bake/bake-item.py corridor-wall-connecting`: Cycles COMBINED direct surface bake of the source material in the disposable copy
  (Corridor_prepared_work_copy.blend, never saved), 512 samples, 17.3s, all source lights, light linking and occluders.
  Glossy/sheen direction: single bake camera at -49.892, 105.678, 3.24. Display transform AgX / AgX - Medium High Contrast / exposure -0.65 applied once.
  Every bake triangle matched a runtime triangle (max distance 2.96e-5 m).
- `scripts/surface-bake/encode-item.mjs corridor-wall-connecting`: 8-bit dither, UASTC level 3, RDO 0.25, sRGB, box mipmaps, zstd 19.
- Runtime: `components/corridor/baked-surfaces.tsx`, MeshBasicMaterial, toneMapped false, anisotropy up to 16, one draw call.

- Baked in the prepared runtime-matching corridor scene (Corridor_Runtime_Material_Prepared.blend, disposable copy, never saved); runtime world to Blender is (x,-z,y). Glossy direction: the prepared bend camera. Validation: replaying the ACTIVE_CAMERA bake as pure emission at the bend camera reproduced the source render of the red wall (RMSE 0.32/255), confirming the Light Path > Is Camera Ray fill/tint branches are captured; an ABOVE_SURFACE bake did not (484 outliers) and was rejected.

## Runtime assets
| File | Bytes |
|---|---:|
| /textures/corridor/wall-connecting/corridor-wall-connecting.ktx2 (1024x2048, 15.797 texels/unit, 77.0% used) | 677,576 |
| /textures/corridor/wall-connecting/corridor-wall-connecting-uv.bin | 1,220 |

Estimated GPU memory (4x4-block transcode, 1 B/texel, with mips): 2.7 MiB.

## Same-pose comparison (target mask from Blender, eroded 2 px; 8-bit display values)
| Pose | R3F mean RGB | Blender mean RGB | RMSE | RMSE excl. outliers | p95 max-channel err |
|---|---|---|---|---|---|
| entry (560x315, eye -4.048210144042969,56.60417938232422,3.240000009536743, target -8.917251586914062,66.93704223632812,3.240000009536743, 40 deg) | 5.1, 5.1, 5.2 | 5.2, 5.2, 5.5 | 0.82 | 0.82 (0 of 23051 px over 20) | 2 |
| bend (560x315, eye -49.89191818237305,105.67767333984375,3.240000009536743, target -60.17906188964844,110.65523529052734,3.240000009536743, 40 deg) | 9.6, 7.6, 6.3 | 9.8, 7.8, 6.5 | 1.44 | 1.3 (25 of 29106 px over 20) | 4 |
| exit (560x315, eye -123.40933227539062,121.41460418701172,3.240000009536743, target -134.7411346435547,119.93868255615234,3.240000009536743, 40 deg) | 5.6, 5.4, 5.3 | 7.3, 6.4, 5.9 | 7.52 | 1.31 (618 of 27663 px over 20) | 4 |
| aerial (560x315, eye -20,30,140, target -80,95,0, 45 deg) | target not visible at this pose | | | | |

Outliers are pixels with any channel error above 20; they were checked visually and sit on silhouettes next to objects that
are still diagnostic or excluded (e.g. the runtime low-poly seating differs from Blender's seats).

## Limitations
- Frozen at the bend camera; exit view outliers sit on edges next to the pending Slide surfaces.
- A sliver gap where wall pieces meet can show the still-diagnostic Slide geometry behind it (Slide scope pending).

## Reproduce
```
node scripts/surface-bake/prepare-uv.mjs corridor-wall-connecting
blender -b --python scripts/blender/surface-bake/bake-item.py -- corridor-wall-connecting
node scripts/surface-bake/encode-item.mjs corridor-wall-connecting --activate
node scripts/surface-bake/references.mjs corridor-wall-connecting
```
Then capture R3F at each pose into `D:/CodexOutputs/Restoration_20261024/corridor-wall-connecting/reference/<pose>-r3f.png` and run `blender -b --python scripts/blender/surface-bake/compare.py -- corridor-wall-connecting <pose>`.

## 6K upgrade (2026-10-24) — Agent-verified, awaiting user review

Fresh 6144 x 6144 bake from the unchanged corridor source (`bake-item.py -- corridor-wall-connecting 2048 --size 6144x6144
--tag 6k`, bend camera, 2048 samples, 434 s). Layout and `corridor-wall-connecting-uv.bin` unchanged.

| | Previous | 6K |
|---|---|---|
| Runtime file | `corridor-wall-connecting.ktx2` (backup: `D:/CodexOutputs/Restoration_6K_20261024/backup/corridor-wall-connecting/`) | `corridor-wall-connecting-6k.ktx2` |
| Image | 1024 x 2048 | 6144 x 6144 |
| Download | 677,576 bytes | 9,672,141 bytes |
| GPU estimate | 2.7 MiB | 48.0 MiB |
| Mean baked luma | 20.64 | 20.68 |

KTX2 PSNR 52.5 dB. Box-downsampled to the previous size the 6K bake agrees with the accepted one within 1.26 levels RMSE.
Camera-ray replay vs source: bend 0.65, entry 0.49, exit 7.35 (1.05 excluding silhouette outliers).
R3F vs Blender (before → after): entry 0.82 → 0.84, bend 1.45 → 1.48, exit 7.53 → 7.46.
