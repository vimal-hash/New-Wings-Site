# Wall sconces (carved backing and opal optics)

Status: Agent-verified — awaiting user review.

Objects (1296 runtime triangles): ET | Sconce carved backing; ET | Sconce carved backing.001; ET | Sconce carved backing.003; ET | Sconce carved backing.004; ET | Sconce carved backing.005; ET | Sconce carved backing.007; ET | Sconce vertical optic; ET | Sconce vertical optic.001; ET | Sconce vertical optic.003; ET | Sconce vertical optic.004; ET | Sconce vertical optic.005; ET | Sconce vertical optic.007
Materials: DETAIL V2 | NOIR / Satin graphite titanium; DETAIL V2 | Opal diffuser 001; DETAIL V2 | Opal diffuser 003; DETAIL V2 | Opal diffuser 004; DETAIL V2 | Opal diffuser 005; DETAIL V2 | Opal diffuser 007; DETAIL V2 | Opal diffuser HALO | Dim wall practical

## Method
- Runtime GLB has no UVs. `scripts/surface-bake/prepare-uv.mjs light-fixtures` reads only the runtime triangles and derives 78 planar charts
  (edge-connected faces with the same dominant normal axis, projected along it; 0 overlap splits; 19 charts never face a
  viewpoint and get 1/8 density). The runtime copy gets the same UVs from `/textures/theatre/light-fixtures/light-fixtures-uv.bin`; GLBs, positions, normals and topology are unchanged.
- `scripts/blender/surface-bake/bake-item.py light-fixtures`: Cycles COMBINED direct surface bake of the source material in the disposable copy
  (LeftWall_work_copy.blend, never saved), 512 samples, 65.6s, all source lights, light linking and occluders.
  Glossy/sheen direction: single bake camera at 0, 22.2, 3.22. Display transform AgX / AgX - Medium High Contrast / exposure 0.45 applied once.
  Every bake triangle matched a runtime triangle (max distance 4.77e-6 m).
- `scripts/surface-bake/encode-item.mjs light-fixtures`: 8-bit dither, UASTC level 3, RDO 0.25, sRGB, box mipmaps, zstd 19.
- Runtime: `components/corridor/baked-surfaces.tsx`, MeshBasicMaterial, toneMapped false, anisotropy up to 16, one draw call.

- Six carved graphite sconce backings and six opal optics (each optic has its own emissive material, so they bake as separate passes into one 512x1024 atlas).
- No light intensity, colour or scene lighting is changed: the emissive appearance is the baked result only.

## Runtime assets
| File | Bytes |
|---|---:|
| /textures/theatre/light-fixtures/light-fixtures.ktx2 (512x1024, 303.906 texels/unit, 55.7% used) | 271,214 |
| /textures/theatre/light-fixtures/light-fixtures-uv.bin | 4,172 |

Estimated GPU memory (4x4-block transcode, 1 B/texel, with mips): 0.7 MiB.

## Same-pose comparison (target mask from Blender, eroded 2 px; 8-bit display values)
| Pose | R3F mean RGB | Blender mean RGB | RMSE | RMSE excl. outliers | p95 max-channel err |
|---|---|---|---|---|---|
| opening (560x276, eye 0,22.2,3.22, target 0,0.802,3.22, 40 deg) | 54.6, 39.5, 25.7 | 73.6, 52.2, 27.3 | 24.65 | 5.79 (58 of 172 px over 20) | 79 |
| closeup (560x315, eye 0,22.2,3.22, target -8,9,3.1, 18 deg) | 70.6, 51.3, 33.4 | 79.5, 57.0, 33.4 | 13.89 | 5.88 (95 of 669 px over 20) | 58 |
| detail (560x315, eye 0,22.2,3.22, target 8.1,17.8,3.1, 5 deg) | 75.0, 51.9, 36.0 | 76.8, 52.8, 35.9 | 6.27 | 3.39 (564 of 16725 px over 20) | 13 |

Outliers are pixels with any channel error above 20; they were checked visually and sit on silhouettes next to objects that
are still diagnostic or excluded (e.g. the runtime low-poly seating differs from Blender's seats).

## Limitations
- At small sizes the bright optic core reads about 10/255 dimmer than Blender (2-px-wide strips, texture filtering); at the 5 deg detail pose the match is RMSE 3.4.

## Reproduce
```
node scripts/surface-bake/prepare-uv.mjs light-fixtures
blender -b --python scripts/blender/surface-bake/bake-item.py -- light-fixtures
node scripts/surface-bake/encode-item.mjs light-fixtures --activate
node scripts/surface-bake/references.mjs light-fixtures
```
Then capture R3F at each pose into `D:/CodexOutputs/Restoration_20261024/light-fixtures/reference/<pose>-r3f.png` and run `blender -b --python scripts/blender/surface-bake/compare.py -- light-fixtures <pose>`.
