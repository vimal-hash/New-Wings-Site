# Corridor fine slab joints

Status: Agent-verified — awaiting user review.

Objects (96 runtime triangles): Floor • fine slab joint 015; Floor • fine slab joint 033; Floor • fine slab joint 051; Floor • fine slab joint 069; Floor • fine slab joint 087; Floor • fine slab joint 105; Floor • fine slab joint 123; Floor • fine slab joint 141; Floor • fine slab joint 159; Floor • fine slab joint 177; Floor • fine slab joint 195; Floor • fine slab joint 213
Materials: PREP | Floor • fine slab joint 015 | Pathway • recessed dark joints.001; PREP | Floor • fine slab joint 033 | Pathway • recessed dark joints.001; PREP | Floor • fine slab joint 051 | Pathway • recessed dark joints.001; PREP | Floor • fine slab joint 069 | Pathway • recessed dark joints.001; PREP | Floor • fine slab joint 087 | Pathway • recessed dark joints.001; PREP | Floor • fine slab joint 105 | Pathway • recessed dark joints.001; PREP | Floor • fine slab joint 123 | Pathway • recessed dark joints.001; PREP | Floor • fine slab joint 141 | Pathway • recessed dark joints.001; PREP | Floor • fine slab joint 159 | Pathway • recessed dark joints.001; PREP | Floor • fine slab joint 177 | Pathway • recessed dark joints.001; PREP | Floor • fine slab joint 195 | Pathway • recessed dark joints.001; PREP | Floor • fine slab joint 213 | Pathway • recessed dark joints.001

## Method
- Runtime GLB has no UVs. `scripts/surface-bake/prepare-uv.mjs corridor-floor-joints` reads only the runtime triangles and derives 24 planar charts
  (edge-connected faces with the same dominant normal axis, projected along it; 0 overlap splits; 12 charts never face a
  viewpoint and get 1/8 density). The runtime copy gets the same UVs from `/textures/corridor/floor-joints/corridor-floor-joints-uv.bin`; GLBs, positions, normals and topology are unchanged.
- `scripts/blender/surface-bake/bake-item.py corridor-floor-joints`: Cycles COMBINED direct surface bake of the source material in the disposable copy
  (Corridor_prepared_work_copy.blend, never saved), 512 samples, 10.3s, all source lights, light linking and occluders.
  Glossy/sheen direction: single bake camera at -49.892, 105.678, 3.24. Display transform AgX / AgX - Medium High Contrast / exposure -0.65 applied once.
  Every bake triangle matched a runtime triangle (max distance 5.78e-4 m).
- `scripts/surface-bake/encode-item.mjs corridor-floor-joints`: 8-bit dither, UASTC level 3, RDO 0.25, sRGB, box mipmaps, zstd 19.
- Runtime: `components/corridor/baked-surfaces.tsx`, MeshBasicMaterial, toneMapped false, anisotropy up to 16, one draw call.

- Baked in the prepared runtime-matching corridor scene (Corridor_Runtime_Material_Prepared.blend, disposable copy, never saved); runtime world to Blender is (x,-z,y). Glossy direction: the prepared bend camera. Validation: replaying the ACTIVE_CAMERA bake as pure emission at the bend camera reproduced the source render of the red wall (RMSE 0.32/255), confirming the Light Path > Is Camera Ray fill/tint branches are captured; an ABOVE_SURFACE bake did not (484 outliers) and was rejected.
- Twelve recessed joints; mask erosion 0 because they are 1-2 px wide.

## Runtime assets
| File | Bytes |
|---|---:|
| /textures/corridor/floor-joints/corridor-floor-joints.ktx2 (1024x2048, 37.863 texels/unit, 76.2% used) | 248,596 |
| /textures/corridor/floor-joints/corridor-floor-joints-uv.bin | 692 |

Estimated GPU memory (4x4-block transcode, 1 B/texel, with mips): 2.7 MiB.

## Same-pose comparison (target mask from Blender, eroded 2 px; 8-bit display values)
| Pose | R3F mean RGB | Blender mean RGB | RMSE | RMSE excl. outliers | p95 max-channel err |
|---|---|---|---|---|---|
| bend (560x315, eye -49.89191818237305,105.67767333984375,3.240000009536743, target -60.17906188964844,110.65523529052734,3.240000009536743, 40 deg) | target not visible at this pose | | | | |
| down (560x315, eye -49.89191818237305,105.67767333984375,3.240000009536743, target -74.65,116,0, 25 deg) | 16.5, 13.3, 9.6 | 14.8, 12.1, 9.6 | 3.57 | 3.57 (0 of 1018 px over 20) | 8 |
| aerial (560x315, eye -20,30,140, target -80,95,0, 45 deg) | 2.0, 2.0, 2.0 | 3.0, 2.0, 2.0 | 0.58 | 0.58 (0 of 1 px over 20) | 1 |

Outliers are pixels with any channel error above 20; they were checked visually and sit on silhouettes next to objects that
are still diagnostic or excluded (e.g. the runtime low-poly seating differs from Blender's seats).

## Limitations
- Only meaningful from the downward detail view (RMSE 3.6, no outliers).

## Reproduce
```
node scripts/surface-bake/prepare-uv.mjs corridor-floor-joints
blender -b --python scripts/blender/surface-bake/bake-item.py -- corridor-floor-joints
node scripts/surface-bake/encode-item.mjs corridor-floor-joints --activate
node scripts/surface-bake/references.mjs corridor-floor-joints
```
Then capture R3F at each pose into `D:/CodexOutputs/Restoration_20261024/corridor-floor-joints/reference/<pose>-r3f.png` and run `blender -b --python scripts/blender/surface-bake/compare.py -- corridor-floor-joints <pose>`.
