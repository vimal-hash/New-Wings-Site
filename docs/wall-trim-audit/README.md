# Side wall caps and graphite end reveals

Status: Agent-verified — awaiting user review.

Objects (648 runtime triangles): ET | ATELIER graphite end reveal; ET | ATELIER graphite end reveal.001; ET | ATELIER graphite end reveal.002; ET | ATELIER graphite end reveal.003; ET | Side wall top graphite cap -1; ET | Side wall top graphite cap 1
Materials: DETAIL V2 | NOIR / Satin graphite titanium; REFINED | NOIR / Black anodized hardware

## Method
- Runtime GLB has no UVs. `scripts/surface-bake/prepare-uv.mjs wall-trim` reads only the runtime triangles and derives 36 planar charts
  (edge-connected faces with the same dominant normal axis, projected along it; 0 overlap splits; 20 charts never face a
  viewpoint and get 1/8 density). The runtime copy gets the same UVs from `/textures/theatre/wall-trim/wall-trim-uv.bin`; GLBs, positions, normals and topology are unchanged.
- `scripts/blender/surface-bake/bake-item.py wall-trim`: Cycles COMBINED direct surface bake of the source material in the disposable copy
  (LeftWall_work_copy.blend, never saved), 512 samples, 74.1s, all source lights, light linking and occluders.
  Glossy/sheen direction: single bake camera at 0, 22.2, 3.22. Display transform AgX / AgX - Medium High Contrast / exposure 0.45 applied once.
  Every bake triangle matched a runtime triangle (max distance 3.06e-6 m).
- `scripts/surface-bake/encode-item.mjs wall-trim`: 8-bit dither, UASTC level 3, RDO 0.25, sRGB, box mipmaps, zstd 19.
- Runtime: `components/corridor/baked-surfaces.tsx`, MeshBasicMaterial, toneMapped false, anisotropy up to 16, one draw call.

- Top graphite caps of both side walls plus four graphite end reveals; caps are 20.8 m long, so they use 96 texels/m along their length with at least 12 texels across (anisotropic texels).

## Runtime assets
| File | Bytes |
|---|---:|
| /textures/theatre/wall-trim/wall-trim.ktx2 (1024x2048, 96 texels/unit, 14.1% used) | 392,674 |
| /textures/theatre/wall-trim/wall-trim-uv.bin | 2,036 |

Estimated GPU memory (4x4-block transcode, 1 B/texel, with mips): 2.7 MiB.

## Same-pose comparison (target mask from Blender, eroded 2 px; 8-bit display values)
| Pose | R3F mean RGB | Blender mean RGB | RMSE | RMSE excl. outliers | p95 max-channel err |
|---|---|---|---|---|---|
| opening (560x276, eye 0,22.2,3.22, target 0,0.802,3.22, 40 deg) | 17.2, 6.0, 1.6 | 12.3, 7.3, 4.1 | 5.61 | 5.52 (1 of 228 px over 20) | 14.6 |
| closeup (560x315, eye 0,22.2,3.22, target -6,10,3.45, 48 deg) | 5.4, 1.7, 1.8 | 5.2, 3.2, 2.0 | 4.06 | 4.06 (0 of 626 px over 20) | 10.8 |
| detail (560x315, eye 0,22.2,3.22, target 8.2,14,6.35, 6 deg) | 8.2, 5.8, 3.6 | 9.0, 6.4, 3.9 | 2.32 | 2.31 (3 of 19814 px over 20) | 6 |

Outliers are pixels with any channel error above 20; they were checked visually and sit on silhouettes next to objects that
are still diagnostic or excluded (e.g. the runtime low-poly seating differs from Blender's seats).

## Limitations
- At normal framing the caps are 1-2 px lines; the detail pose (6 deg) is the meaningful comparison.

## Reproduce
```
node scripts/surface-bake/prepare-uv.mjs wall-trim
blender -b --python scripts/blender/surface-bake/bake-item.py -- wall-trim
node scripts/surface-bake/encode-item.mjs wall-trim --activate
node scripts/surface-bake/references.mjs wall-trim
```
Then capture R3F at each pose into `D:/CodexOutputs/Restoration_20261024/wall-trim/reference/<pose>-r3f.png` and run `blender -b --python scripts/blender/surface-bake/compare.py -- wall-trim <pose>`.
