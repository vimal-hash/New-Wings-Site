# Corridor capped wall tops

Status: Agent-verified — awaiting user review.

Objects (1160 runtime triangles): FIX | Capped Red corridor wall • separate from logo; FIX | Capped Connecting plane • joins yellow tip
Materials: PREP | FIX | Capped Connecting plane • joins yellow tip | Corridor • right neutral soft fill / dark lower edge.001; PREP | FIX | Capped Red corridor wall • separate from logo | Corridor • neutral soft fill / dark lower edge.001

## Method
- Runtime GLB has no UVs. `scripts/surface-bake/prepare-uv.mjs corridor-wall-caps` reads only the runtime triangles and derives 160 planar charts
  (edge-connected faces with the same dominant normal axis, projected along it; 158 overlap splits; 83 charts never face a
  viewpoint and get 1/8 density). The runtime copy gets the same UVs from `/textures/corridor/wall-caps/corridor-wall-caps-uv.bin`; GLBs, positions, normals and topology are unchanged.
- `scripts/blender/surface-bake/bake-item.py corridor-wall-caps`: Cycles COMBINED direct surface bake of the source material in the disposable copy
  (Corridor_prepared_work_copy.blend, never saved), 512 samples, 12.9s, all source lights, light linking and occluders.
  Glossy/sheen direction: single bake camera at -49.892, 105.678, 3.24. Display transform AgX / AgX - Medium High Contrast / exposure -0.65 applied once.
  Every bake triangle matched a runtime triangle (max distance 3.83e-4 m).
- `scripts/surface-bake/encode-item.mjs corridor-wall-caps`: 8-bit dither, UASTC level 3, RDO 0.25, sRGB, box mipmaps, zstd 19.
- Runtime: `components/corridor/baked-surfaces.tsx`, MeshBasicMaterial, toneMapped false, anisotropy up to 16, one draw call.

- Baked in the prepared runtime-matching corridor scene (Corridor_Runtime_Material_Prepared.blend, disposable copy, never saved); runtime world to Blender is (x,-z,y). Glossy direction: the prepared bend camera. Validation: replaying the ACTIVE_CAMERA bake as pure emission at the bend camera reproduced the source render of the red wall (RMSE 0.32/255), confirming the Light Path > Is Camera Ray fill/tint branches are captured; an ABOVE_SURFACE bake did not (484 outliers) and was rejected.
- Generated caps use the shading UVs interpolated from their parent walls (preparation step); runtime bake UVs are separate.

## Runtime assets
| File | Bytes |
|---|---:|
| /textures/corridor/wall-caps/corridor-wall-caps.ktx2 (512x1024, 19.441 texels/unit, 23.0% used) | 161,313 |
| /textures/corridor/wall-caps/corridor-wall-caps-uv.bin | 5,540 |

Estimated GPU memory (4x4-block transcode, 1 B/texel, with mips): 0.7 MiB.

## Same-pose comparison (target mask from Blender, eroded 2 px; 8-bit display values)
| Pose | R3F mean RGB | Blender mean RGB | RMSE | RMSE excl. outliers | p95 max-channel err |
|---|---|---|---|---|---|
| aerial (560x315, eye -20,30,140, target -80,95,0, 45 deg) | 3.8, 29.8, 42.8 | 17.0, 18.2, 19.9 | 21.38 | 11.33 (149 of 293 px over 20) | 56 |

Outliers are pixels with any channel error above 20; they were checked visually and sit on silhouettes next to objects that
are still diagnostic or excluded (e.g. the runtime low-poly seating differs from Blender's seats).

## Limitations
- Caps face upward and are invisible from inside the corridor; from the aerial pose they are 1-2 px edges beside the excluded logo ribbons, so the measured error is dominated by ribbon edges.

## Reproduce
```
node scripts/surface-bake/prepare-uv.mjs corridor-wall-caps
blender -b --python scripts/blender/surface-bake/bake-item.py -- corridor-wall-caps
node scripts/surface-bake/encode-item.mjs corridor-wall-caps --activate
node scripts/surface-bake/references.mjs corridor-wall-caps
```
Then capture R3F at each pose into `D:/CodexOutputs/Restoration_20261024/corridor-wall-caps/reference/<pose>-r3f.png` and run `blender -b --python scripts/blender/surface-bake/compare.py -- corridor-wall-caps <pose>`.
