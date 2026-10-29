# Side surround speakers and grille slots

Status: Agent-verified — awaiting user review.

Objects (1608 runtime triangles): ET | Side surround speaker; ET | Side surround speaker.001; ET | Side surround speaker.003; ET | Side surround speaker.004; ET | Side surround speaker.005; ET | Side surround speaker.007; ET | Speaker grille slot; ET | Speaker grille slot.001; ET | Speaker grille slot.002; ET | Speaker grille slot.003; ET | Speaker grille slot.004; ET | Speaker grille slot.005; ET | Speaker grille slot.006; ET | Speaker grille slot.007; ET | Speaker grille slot.008; ET | Speaker grille slot.009; ET | Speaker grille slot.010; ET | Speaker grille slot.011; ET | Speaker grille slot.012; ET | Speaker grille slot.013; ET | Speaker grille slot.014; ET | Speaker grille slot.015; ET | Speaker grille slot.016; ET | Speaker grille slot.017; ET | Speaker grille slot.018; ET | Speaker grille slot.019; ET | Speaker grille slot.030; ET | Speaker grille slot.031; ET | Speaker grille slot.032; ET | Speaker grille slot.033; ET | Speaker grille slot.034; ET | Speaker grille slot.035; ET | Speaker grille slot.036; ET | Speaker grille slot.037; ET | Speaker grille slot.038; ET | Speaker grille slot.039; ET | Speaker grille slot.040; ET | Speaker grille slot.041; ET | Speaker grille slot.042; ET | Speaker grille slot.043; ET | Speaker grille slot.044; ET | Speaker grille slot.045; ET | Speaker grille slot.046; ET | Speaker grille slot.047; ET | Speaker grille slot.048; ET | Speaker grille slot.049; ET | Speaker grille slot.050; ET | Speaker grille slot.051; ET | Speaker grille slot.052; ET | Speaker grille slot.053; ET | Speaker grille slot.054; ET | Speaker grille slot.055; ET | Speaker grille slot.056; ET | Speaker grille slot.057; ET | Speaker grille slot.058; ET | Speaker grille slot.059; ET | Speaker grille slot.070; ET | Speaker grille slot.071; ET | Speaker grille slot.072; ET | Speaker grille slot.073; ET | Speaker grille slot.074; ET | Speaker grille slot.075; ET | Speaker grille slot.076; ET | Speaker grille slot.077; ET | Speaker grille slot.078; ET | Speaker grille slot.079
Materials: DETAIL V2 | Acoustic grille and powder-coated shell; ET CURVE PBR | Black anodized hardware

## Method
- Runtime GLB has no UVs. `scripts/surface-bake/prepare-uv.mjs speakers` reads only the runtime triangles and derives 276 planar charts
  (edge-connected faces with the same dominant normal axis, projected along it; 0 overlap splits; 68 charts never face a
  viewpoint and get 1/8 density). The runtime copy gets the same UVs from `/textures/theatre/speakers/speakers-uv.bin`; GLBs, positions, normals and topology are unchanged.
- `scripts/blender/surface-bake/bake-item.py speakers`: Cycles COMBINED direct surface bake of the source material in the disposable copy
  (LeftWall_work_copy.blend, never saved), 512 samples, 576s, all source lights, light linking and occluders.
  Glossy/sheen direction: single bake camera at 0, 22.2, 3.22. Display transform AgX / AgX - Medium High Contrast / exposure 0.45 applied once.
  Every bake triangle matched a runtime triangle (max distance 3.93e-6 m).
- `scripts/surface-bake/encode-item.mjs speakers`: 8-bit dither, UASTC level 3, RDO 0.25, sRGB, box mipmaps, zstd 19.
- Runtime: `components/corridor/baked-surfaces.tsx`, MeshBasicMaterial, toneMapped false, anisotropy up to 16, one draw call.

- Six surround speakers plus their 60 grille slot inserts share one 1024x1024 atlas (same baked-lighting needs, one draw call).

## Runtime assets
| File | Bytes |
|---|---:|
| /textures/theatre/speakers/speakers.ktx2 (1024x1024, 400 texels/unit, 46.8% used) | 452,179 |
| /textures/theatre/speakers/speakers-uv.bin | 8,756 |

Estimated GPU memory (4x4-block transcode, 1 B/texel, with mips): 1.3 MiB.

## Same-pose comparison (target mask from Blender, eroded 2 px; 8-bit display values)
| Pose | R3F mean RGB | Blender mean RGB | RMSE | RMSE excl. outliers | p95 max-channel err |
|---|---|---|---|---|---|
| opening (560x276, eye 0,22.2,3.22, target 0,0.802,3.22, 40 deg) | 42.8, 29.6, 12.4 | 44.3, 31.0, 12.4 | 5.11 | 5 (2 of 381 px over 20) | 13 |
| closeup (560x315, eye 0,22.2,3.22, target -8,9,4.6, 18 deg) | 42.6, 29.8, 11.7 | 43.2, 30.2, 12.4 | 3.82 | 3.82 (0 of 1107 px over 20) | 9.7 |

Outliers are pixels with any channel error above 20; they were checked visually and sit on silhouettes next to objects that
are still diagnostic or excluded (e.g. the runtime low-poly seating differs from Blender's seats).

## Limitations
- Powder-coat specular frozen at the opening view.

## Reproduce
```
node scripts/surface-bake/prepare-uv.mjs speakers
blender -b --python scripts/blender/surface-bake/bake-item.py -- speakers
node scripts/surface-bake/encode-item.mjs speakers --activate
node scripts/surface-bake/references.mjs speakers
```
Then capture R3F at each pose into `D:/CodexOutputs/Restoration_20261024/speakers/reference/<pose>-r3f.png` and run `blender -b --python scripts/blender/surface-bake/compare.py -- speakers <pose>`.
