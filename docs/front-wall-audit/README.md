# Theatre front (screen) wall

Status: Agent-verified — awaiting user review.

Objects (108 runtime triangles): ET | Front structural wall
Materials: ET PBR | NOIR / Graphite wall backing

## Method
- Runtime GLB has no UVs. `scripts/surface-bake/prepare-uv.mjs front-wall` reads only the runtime triangles and derives 6 planar charts
  (edge-connected faces with the same dominant normal axis, projected along it; 0 overlap splits; 5 charts never face a
  viewpoint and get 1/8 density). The runtime copy gets the same UVs from `/textures/theatre/front-wall/front-wall-uv.bin`; GLBs, positions, normals and topology are unchanged.
- `scripts/blender/surface-bake/bake-item.py front-wall`: Cycles COMBINED direct surface bake of the source material in the disposable copy
  (LeftWall_work_copy.blend, never saved), 1024 samples, 34.3s, all source lights, light linking and occluders.
  Glossy/sheen direction: single bake camera at 0, 22.2, 3.22. Display transform AgX / AgX - Medium High Contrast / exposure 0.45 applied once.
  Every bake triangle matched a runtime triangle (max distance 3.22e-6 m).
- `scripts/surface-bake/encode-item.mjs front-wall`: 8-bit dither, UASTC level 3, RDO 0.25, sRGB, box mipmaps, zstd 19.
- Runtime: `components/corridor/baked-surfaces.tsx`, MeshBasicMaterial, toneMapped false, anisotropy up to 16, one draw call.

- Graphite wall backing around the screen; the room face is one chart, 5 non-visible faces at 1/8 density.

## Runtime assets
| File | Bytes |
|---|---:|
| /textures/theatre/front-wall/front-wall.ktx2 (1024x2048, 121.802 texels/unit, 76.6% used) | 491,610 |
| /textures/theatre/front-wall/front-wall-uv.bin | 356 |

Estimated GPU memory (4x4-block transcode, 1 B/texel, with mips): 2.7 MiB.

## Same-pose comparison (target mask from Blender, eroded 2 px; 8-bit display values)
| Pose | R3F mean RGB | Blender mean RGB | RMSE | RMSE excl. outliers | p95 max-channel err |
|---|---|---|---|---|---|
| opening (560x276, eye 0,22.2,3.22, target 0,0.802,3.22, 40 deg) | 17.8, 9.2, 2.8 | 17.7, 9.4, 2.1 | 2.2 | 2.2 (0 of 11253 px over 20) | 6 |
| closeup (560x315, eye 0,22.2,3.22, target 5,0,3.5, 48 deg) | 17.7, 9.2, 2.2 | 17.7, 9.4, 2.0 | 2.12 | 2.12 (0 of 10742 px over 20) | 6 |

Outliers are pixels with any channel error above 20; they were checked visually and sit on silhouettes next to objects that
are still diagnostic or excluded (e.g. the runtime low-poly seating differs from Blender's seats).

## Limitations
- Lighting and any sheen are frozen as seen from the opening camera; the material is matte, so off-axis change is small.

## Reproduce
```
node scripts/surface-bake/prepare-uv.mjs front-wall
blender -b --python scripts/blender/surface-bake/bake-item.py -- front-wall
node scripts/surface-bake/encode-item.mjs front-wall --activate
node scripts/surface-bake/references.mjs front-wall
```
Then capture R3F at each pose into `D:/CodexOutputs/Restoration_20261024/front-wall/reference/<pose>-r3f.png` and run `blender -b --python scripts/blender/surface-bake/compare.py -- front-wall <pose>`.
