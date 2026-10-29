# Corridor plain slate floor

Status: Agent-verified — awaiting user review.

Objects (1148 runtime triangles): Plain floor • red to connecting plane
Materials: PREP | Plain floor • red to connecting plane | Floor | Slate 4K | Poly Haven.001

## Method
- Runtime GLB has no UVs. `scripts/surface-bake/prepare-uv.mjs corridor-floor` reads only the runtime triangles and derives 5 planar charts
  (edge-connected faces with the same dominant normal axis, projected along it; 4 overlap splits; 0 charts never face a
  viewpoint and get 1/8 density). The runtime copy gets the same UVs from `/textures/corridor/floor/corridor-floor-uv.bin`; GLBs, positions, normals and topology are unchanged.
- `scripts/blender/surface-bake/bake-item.py corridor-floor`: Cycles COMBINED direct surface bake of the source material in the disposable copy
  (Corridor_prepared_work_copy.blend, never saved), 1024 samples, 69.1s, all source lights, light linking and occluders.
  Glossy/sheen direction: single bake camera at -49.892, 105.678, 3.24. Display transform AgX / AgX - Medium High Contrast / exposure -0.65 applied once.
  Every bake triangle matched a runtime triangle (max distance 1.30e-4 m).
- `scripts/surface-bake/encode-item.mjs corridor-floor`: 8-bit dither, UASTC level 3, RDO 0.25, sRGB, box mipmaps, zstd 19.
- Runtime: `components/corridor/baked-surfaces.tsx`, MeshBasicMaterial, toneMapped false, anisotropy up to 16, one draw call.

- Baked in the prepared runtime-matching corridor scene (Corridor_Runtime_Material_Prepared.blend, disposable copy, never saved); runtime world to Blender is (x,-z,y). Glossy direction: the prepared bend camera. Validation: replaying the ACTIVE_CAMERA bake as pure emission at the bend camera reproduced the source render of the red wall (RMSE 0.32/255), confirming the Light Path > Is Camera Ray fill/tint branches are captured; an ABOVE_SURFACE bake did not (484 outliers) and was rejected.
- 2048x4096 at 25.9 texels/unit (about 3.9 cm), 1024 samples.

## Runtime assets
| File | Bytes |
|---|---:|
| /textures/corridor/floor/corridor-floor.ktx2 (2048x4096, 25.945 texels/unit, 67.0% used) | 2,117,651 |
| /textures/corridor/floor/corridor-floor-uv.bin | 2,416 |

Estimated GPU memory (4x4-block transcode, 1 B/texel, with mips): 10.7 MiB.

## Same-pose comparison (target mask from Blender, eroded 2 px; 8-bit display values)
| Pose | R3F mean RGB | Blender mean RGB | RMSE | RMSE excl. outliers | p95 max-channel err |
|---|---|---|---|---|---|
| entry (560x315, eye -4.048210144042969,56.60417938232422,3.240000009536743, target -8.917251586914062,66.93704223632812,3.240000009536743, 40 deg) | 14.8, 12.4, 9.4 | 12.7, 10.4, 8.2 | 5.83 | 5.16 (1047 of 56393 px over 20) | 14 |
| bend (560x315, eye -49.89191818237305,105.67767333984375,3.240000009536743, target -60.17906188964844,110.65523529052734,3.240000009536743, 40 deg) | 20.2, 17.4, 14.0 | 20.9, 17.3, 14.0 | 1.47 | 1.47 (0 of 56330 px over 20) | 3 |
| exit (560x315, eye -123.40933227539062,121.41460418701172,3.240000009536743, target -134.7411346435547,119.93868255615234,3.240000009536743, 40 deg) | 1.2, 0.6, 0.5 | 1.1, 0.5, 0.3 | 1.89 | 1.89 (0 of 53290 px over 20) | 8 |

Outliers are pixels with any channel error above 20; they were checked visually and sit on silhouettes next to objects that
are still diagnostic or excluded (e.g. the runtime low-poly seating differs from Blender's seats).

## Limitations
- Slate reflections are frozen at the bend camera: from the entry camera the floor reads slightly brighter (R3F 14.8 vs Blender 12.7 mean; RMSE 5.2 excluding outliers).

## Reproduce
```
node scripts/surface-bake/prepare-uv.mjs corridor-floor
blender -b --python scripts/blender/surface-bake/bake-item.py -- corridor-floor
node scripts/surface-bake/encode-item.mjs corridor-floor --activate
node scripts/surface-bake/references.mjs corridor-floor
```
Then capture R3F at each pose into `D:/CodexOutputs/Restoration_20261024/corridor-floor/reference/<pose>-r3f.png` and run `blender -b --python scripts/blender/surface-bake/compare.py -- corridor-floor <pose>`.

## 6K upgrade (2026-10-24) — Agent-verified, awaiting user review

Fresh 6144 x 6144 bake from the unchanged corridor source (`bake-item.py -- corridor-floor 2048 --size 6144x6144 --tag 6k`,
bend camera, 2048 samples, 395 s). Layout and `corridor-floor-uv.bin` unchanged (2048 x 4096 layout sampled 3x / 1.5x finer).

| | Previous | 6K |
|---|---|---|
| Runtime file | `corridor-floor.ktx2` (backup: `D:/CodexOutputs/Restoration_6K_20261024/backup/corridor-floor/`) | `corridor-floor-6k.ktx2` |
| Image | 2048 x 4096 | 6144 x 6144 |
| Download | 2,117,651 bytes | 8,842,184 bytes |
| GPU estimate | 10.7 MiB | 48.0 MiB |
| Mean baked luma | 9.43 | 9.49 |

KTX2 PSNR 55.7 dB. The 6K bake resolves the slate's pitting and speckle that the previous bake softened (UV crop at 4x gain:
`docs/restoration/6k/corridor-floor-uv-crop-gain4.png`); no Monte Carlo grain is visible. In a 12-degree close-up the
mean local gradient rises from 0.095 to 0.252 (8-bit) with the same mean colour. Camera-ray replay vs source: bend 0.95,
entry 5.69, exit 1.82. R3F vs Blender (before → after): entry 5.83 → 5.81, bend 1.47 → 1.47, exit 1.89 → 1.83.
