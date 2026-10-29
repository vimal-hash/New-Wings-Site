# Cinema screen surface

Status: Agent-verified — awaiting user review.

Objects (772 runtime triangles): ET | Blank curved CinemaScope screen
Materials: REFINED | Material; SB | default surface for empty slot

## Method
- Runtime GLB has no UVs. `scripts/surface-bake/prepare-uv.mjs screen` reads only the runtime triangles and derives 6 planar charts
  (edge-connected faces with the same dominant normal axis, projected along it; 0 overlap splits; 2 charts never face a
  viewpoint and get 1/8 density). The runtime copy gets the same UVs from `/textures/theatre/screen/screen-uv.bin`; GLBs, positions, normals and topology are unchanged.
- `scripts/blender/surface-bake/bake-item.py screen`: Cycles COMBINED direct surface bake of the source material in the disposable copy
  (LeftWall_work_copy.blend, never saved), 1024 samples, 51s, all source lights, light linking and occluders.
  Glossy/sheen direction: single bake camera at 0, 22.2, 3.22. Display transform AgX / AgX - Medium High Contrast / exposure 0.45 applied once.
  Every bake triangle matched a runtime triangle (max distance 4.83e-6 m).
- `scripts/surface-bake/encode-item.mjs screen`: 8-bit dither, UASTC level 3, RDO 0.25, sRGB, box mipmaps, zstd 19.
- Runtime: `components/corridor/baked-surfaces.tsx`, MeshBasicMaterial, toneMapped false, anisotropy up to 16, one draw call.

- Only the physical surface is restored. The theatre screen has no runtime artwork or behaviour (checked in components/corridor); the corridor side screens (corridor-screens.tsx) are untouched.
- The first bake was black because the object has an empty data material slot; the disposable copy gives empty slots Blender's default surface so the bake covers the object. Source unchanged.

## Runtime assets
| File | Bytes |
|---|---:|
| /textures/theatre/screen/screen.ktx2 (1024x2048, 128 texels/unit, 45.8% used) | 654,628 |
| /textures/theatre/screen/screen-uv.bin | 1,684 |

Estimated GPU memory (4x4-block transcode, 1 B/texel, with mips): 2.7 MiB.

## Same-pose comparison (target mask from Blender, eroded 2 px; 8-bit display values)
| Pose | R3F mean RGB | Blender mean RGB | RMSE | RMSE excl. outliers | p95 max-channel err |
|---|---|---|---|---|---|
| opening (560x276, eye 0,22.2,3.22, target 0,0.802,3.22, 40 deg) | 190.1, 179.8, 174.9 | 189.7, 180.1, 174.2 | 1.55 | 1.55 (0 of 14927 px over 20) | 4 |
| closeup (560x315, eye 0,22.2,3.22, target 0,0.8,3.2, 22 deg) | 189.9, 179.4, 174.1 | 189.5, 179.6, 173.6 | 1.35 | 1.35 (0 of 70257 px over 20) | 3 |

Outliers are pixels with any channel error above 20; they were checked visually and sit on silhouettes next to objects that
are still diagnostic or excluded (e.g. the runtime low-poly seating differs from Blender's seats).

## Limitations
- Matte material (roughness 0.94): close to view-independent, so orbit views should hold up best of all items.

## Reproduce
```
node scripts/surface-bake/prepare-uv.mjs screen
blender -b --python scripts/blender/surface-bake/bake-item.py -- screen
node scripts/surface-bake/encode-item.mjs screen --activate
node scripts/surface-bake/references.mjs screen
```
Then capture R3F at each pose into `D:/CodexOutputs/Restoration_20261024/screen/reference/<pose>-r3f.png` and run `blender -b --python scripts/blender/surface-bake/compare.py -- screen <pose>`.
