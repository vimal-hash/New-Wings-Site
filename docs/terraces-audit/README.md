# Terraces, aisles and treads (smoked walnut)

Status: Agent-verified — awaiting user review.

Objects (3996 runtime triangles): ET | Aisle -7.4 row 2 tread 1
Materials: REFINED | Smoked walnut

## Method
- Runtime GLB has no UVs. `scripts/surface-bake/prepare-uv.mjs terraces` reads only the runtime triangles and derives 222 planar charts
  (edge-connected faces with the same dominant normal axis, projected along it; 128 overlap splits; 102 charts never face a
  viewpoint and get 1/8 density). The runtime copy gets the same UVs from `/textures/theatre/terraces/terraces-uv.bin`; GLBs, positions, normals and topology are unchanged.
- `scripts/blender/surface-bake/bake-item.py terraces`: Cycles COMBINED direct surface bake of the source material in the disposable copy
  (LeftWall_work_copy.blend, never saved), 1024 samples, 101s, all source lights, light linking and occluders.
  Glossy/sheen direction: single bake camera at 0, 22.2, 3.22. Display transform AgX / AgX - Medium High Contrast / exposure 0.45 applied once.
  Every bake triangle matched a runtime triangle (max distance 1.34e-4 m).
- `scripts/surface-bake/encode-item.mjs terraces`: 8-bit dither, UASTC level 3, RDO 0.25, sRGB, box mipmaps, zstd 19.
- Runtime: `components/corridor/baked-surfaces.tsx`, MeshBasicMaterial, toneMapped false, anisotropy up to 16, one draw call.

- One object holding all five terraces, aisles and treads; 128 overlapping projections were split into separate charts.
- 12 differently triangulated slivers matched to the nearest runtime triangle (within 32 mm, max 1% allowed).

## Runtime assets
| File | Bytes |
|---|---:|
| /textures/theatre/terraces/terraces.ktx2 (2048x4096, 63.527 texels/unit, 76.4% used) | 1,939,686 |
| /textures/theatre/terraces/terraces-uv.bin | 12,452 |

Estimated GPU memory (4x4-block transcode, 1 B/texel, with mips): 10.7 MiB.

## Same-pose comparison (target mask from Blender, eroded 2 px; 8-bit display values)
| Pose | R3F mean RGB | Blender mean RGB | RMSE | RMSE excl. outliers | p95 max-channel err |
|---|---|---|---|---|---|
| opening (560x276, eye 0,22.2,3.22, target 0,0.802,3.22, 40 deg) | 74.8, 57.8, 46.4 | 74.8, 57.2, 46.8 | 4.54 | 3.79 (11 of 2019 px over 20) | 11 |
| closeup (560x315, eye 0,22.2,3.22, target 0,12,0.6, 30 deg) | 57.0, 44.9, 36.9 | 53.3, 40.0, 31.6 | 24.93 | 2.24 (928 of 21113 px over 20) | 9 |
| detail (560x315, eye 0,22.2,3.22, target 0.5,15.5,0.95, 7 deg) | 71.3, 56.0, 46.8 | 68.6, 51.7, 42.0 | 21.41 | 2.85 (3781 of 101919 px over 20) | 10 |

Outliers are pixels with any channel error above 20; they were checked visually and sit on silhouettes next to objects that
are still diagnostic or excluded (e.g. the runtime low-poly seating differs from Blender's seats).

## Limitations
- Texel size is 15.7 mm (63.5 texels/m) to keep the atlas at 2048x4096; walnut grain is softer than Blender in very close orbit views. Much of the tread area is hidden under seating.
- Outliers sit on seat silhouettes and the aisle edge reveals.

## Reproduce
```
node scripts/surface-bake/prepare-uv.mjs terraces
blender -b --python scripts/blender/surface-bake/bake-item.py -- terraces
node scripts/surface-bake/encode-item.mjs terraces --activate
node scripts/surface-bake/references.mjs terraces
```
Then capture R3F at each pose into `D:/CodexOutputs/Restoration_20261024/terraces/reference/<pose>-r3f.png` and run `blender -b --python scripts/blender/surface-bake/compare.py -- terraces <pose>`.
