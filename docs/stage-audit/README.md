# Stage / floating screen dais

Status: Agent-verified — awaiting user review.

Objects (1644 runtime triangles): ET | Floating curved screen dais
Materials: ET CURVE PBR | Blackened open-pore ash

## Method
- Runtime GLB has no UVs. `scripts/surface-bake/prepare-uv.mjs stage` reads only the runtime triangles and derives 6 planar charts
  (edge-connected faces with the same dominant normal axis, projected along it; 0 overlap splits; 4 charts never face a
  viewpoint and get 1/8 density). The runtime copy gets the same UVs from `/textures/theatre/stage/stage-uv.bin`; GLBs, positions, normals and topology are unchanged.
- `scripts/blender/surface-bake/bake-item.py stage`: Cycles COMBINED direct surface bake of the source material in the disposable copy
  (LeftWall_work_copy.blend, never saved), 1024 samples, 28.4s, all source lights, light linking and occluders.
  Glossy/sheen direction: single bake camera at 0, 22.2, 3.22. Display transform AgX / AgX - Medium High Contrast / exposure 0.45 applied once.
  Every bake triangle matched a runtime triangle (max distance 4.76e-4 m).
- `scripts/surface-bake/encode-item.mjs stage`: 8-bit dither, UASTC level 3, RDO 0.25, sRGB, box mipmaps, zstd 19.
- Runtime: `components/corridor/baked-surfaces.tsx`, MeshBasicMaterial, toneMapped false, anisotropy up to 16, one draw call.

- Source is a Curve object; the disposable copy bakes a mesh twin in the same collections and light-link receiver sets, with the same ray visibility.
- 1 sliver triangle on a non-planar end cap is triangulated differently from the GLB; it is matched to the nearest runtime triangle (within 2 mm).

## Runtime assets
| File | Bytes |
|---|---:|
| /textures/theatre/stage/stage.ktx2 (1024x2048, 152.734 texels/unit, 41.7% used) | 533,786 |
| /textures/theatre/stage/stage-uv.bin | 3,428 |

Estimated GPU memory (4x4-block transcode, 1 B/texel, with mips): 2.7 MiB.

## Same-pose comparison (target mask from Blender, eroded 2 px; 8-bit display values)
| Pose | R3F mean RGB | Blender mean RGB | RMSE | RMSE excl. outliers | p95 max-channel err |
|---|---|---|---|---|---|
| opening (560x276, eye 0,22.2,3.22, target 0,0.802,3.22, 40 deg) | 20.0, 15.7, 11.8 | 21.5, 16.0, 11.5 | 3.79 | 3.76 (2 of 1969 px over 20) | 10 |
| closeup (560x315, eye 0,22.2,3.22, target 0,1.5,0.3, 20 deg) | 21.5, 16.7, 12.2 | 20.2, 14.4, 9.7 | 19.57 | 2.46 (317 of 12432 px over 20) | 8 |

Outliers are pixels with any channel error above 20; they were checked visually and sit on silhouettes next to objects that
are still diagnostic or excluded (e.g. the runtime low-poly seating differs from Blender's seats).

## Limitations
- Blackened ash sheen/specular frozen at the opening view.

## Reproduce
```
node scripts/surface-bake/prepare-uv.mjs stage
blender -b --python scripts/blender/surface-bake/bake-item.py -- stage
node scripts/surface-bake/encode-item.mjs stage --activate
node scripts/surface-bake/references.mjs stage
```
Then capture R3F at each pose into `D:/CodexOutputs/Restoration_20261024/stage/reference/<pose>-r3f.png` and run `blender -b --python scripts/blender/surface-bake/compare.py -- stage <pose>`.
