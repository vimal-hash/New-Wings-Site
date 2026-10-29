# Corridor restrained roof datums (charcoal titanium)

Status: Agent-verified — awaiting user review.

Objects (1976 runtime triangles): Red corridor wall • separate from logo • restrained roof datum; Connecting plane • joins yellow tip • restrained roof datum
Materials: PREP | Connecting plane • joins yellow tip • restrained roof datum | Exterior • charcoal titanium roof datum.001; PREP | Red corridor wall • separate from logo • restrained roof datum | Exterior • charcoal titanium roof datum.001

## Method
- Runtime GLB has no UVs. `scripts/surface-bake/prepare-uv.mjs corridor-roof-datums` reads only the runtime triangles and derives 152 planar charts
  (edge-connected faces with the same dominant normal axis, projected along it; 140 overlap splits; 72 charts never face a
  viewpoint and get 1/8 density). The runtime copy gets the same UVs from `/textures/corridor/roof-datums/corridor-roof-datums-uv.bin`; GLBs, positions, normals and topology are unchanged.
- `scripts/blender/surface-bake/bake-item.py corridor-roof-datums`: Cycles COMBINED direct surface bake of the source material in the disposable copy
  (Corridor_prepared_work_copy.blend, never saved), 512 samples, 5.5s, all source lights, light linking and occluders.
  Glossy/sheen direction: single bake camera at -49.892, 105.678, 3.24. Display transform AgX / AgX - Medium High Contrast / exposure -0.65 applied once.
  Every bake triangle matched a runtime triangle (max distance 1.06e-2 m).
- `scripts/surface-bake/encode-item.mjs corridor-roof-datums`: 8-bit dither, UASTC level 3, RDO 0.25, sRGB, box mipmaps, zstd 19.
- Runtime: `components/corridor/baked-surfaces.tsx`, MeshBasicMaterial, toneMapped false, anisotropy up to 16, one draw call.

- Baked in the prepared runtime-matching corridor scene (Corridor_Runtime_Material_Prepared.blend, disposable copy, never saved); runtime world to Blender is (x,-z,y). Glossy direction: the prepared bend camera. Validation: replaying the ACTIVE_CAMERA bake as pure emission at the bend camera reproduced the source render of the red wall (RMSE 0.32/255), confirming the Light Path > Is Camera Ray fill/tint branches are captured; an ABOVE_SURFACE bake did not (484 outliers) and was rejected.
- Thin horizontal bands; 7 texels/unit with at least 4 across.

## Runtime assets
| File | Bytes |
|---|---:|
| /textures/corridor/roof-datums/corridor-roof-datums.ktx2 (512x1024, 7.059 texels/unit, 13.8% used) | 76,174 |
| /textures/corridor/roof-datums/corridor-roof-datums-uv.bin | 7,012 |

Estimated GPU memory (4x4-block transcode, 1 B/texel, with mips): 0.7 MiB.

## Same-pose comparison (target mask from Blender, eroded 2 px; 8-bit display values)
| Pose | R3F mean RGB | Blender mean RGB | RMSE | RMSE excl. outliers | p95 max-channel err |
|---|---|---|---|---|---|
| aerial (560x315, eye -20,30,140, target -80,95,0, 45 deg) | 1.0, 1.5, 1.3 | 0.8, 1.0, 1.8 | 1.89 | 1.89 (0 of 4 px over 20) | 3.7 |

Outliers are pixels with any channel error above 20; they were checked visually and sit on silhouettes next to objects that
are still diagnostic or excluded (e.g. the runtime low-poly seating differs from Blender's seats).

## Limitations
- Not visible from any journey pose tested (4 px from the aerial pose); baked for completeness at low resolution.

## Reproduce
```
node scripts/surface-bake/prepare-uv.mjs corridor-roof-datums
blender -b --python scripts/blender/surface-bake/bake-item.py -- corridor-roof-datums
node scripts/surface-bake/encode-item.mjs corridor-roof-datums --activate
node scripts/surface-bake/references.mjs corridor-roof-datums
```
Then capture R3F at each pose into `D:/CodexOutputs/Restoration_20261024/corridor-roof-datums/reference/<pose>-r3f.png` and run `blender -b --python scripts/blender/surface-bake/compare.py -- corridor-roof-datums <pose>`.
