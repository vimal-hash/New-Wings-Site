# Stair nosings and aisle edge reveals

Status: Agent-verified with a known limitation (dark edge-reveal rims) — awaiting user review.

Objects (4132 runtime triangles): ET | 919 flush metal step nosing; ET | 919 flush metal step nosing.001; ET | 919 flush metal step nosing.002; ET | 919 flush metal step nosing.003; ET | 919 flush metal step nosing.004; ET | 919 flush metal step nosing.005; ET | 919 flush metal step nosing.006; ET | 919 flush metal step nosing.007; ET | 919 flush metal step nosing.008; ET | 919 flush metal step nosing.009; ET | 919 flush metal step nosing.010; ET | 919 flush metal step nosing.011; ET | 919 flush metal step nosing.012; ET | 919 flush metal step nosing.013; ET | 919 flush metal step nosing.014; ET | 919 flush metal step nosing.015; ET | 919 flush metal step nosing.016; ET | 919 flush metal step nosing.017; ET | 919 flush metal step nosing.018; ET | 919 flush metal step nosing.019; ET | 919 flush metal step nosing.020; ET | 919 flush metal step nosing.021; ET | 919 flush metal step nosing.022; ET | 919 flush metal step nosing.023; ET | 919 flush metal step nosing.024; ET | 919 flush metal step nosing.025; ET | 919 flush metal step nosing.026; ET | Inlaid aisle edge reveal; ET | Inlaid aisle edge reveal.001; ET | Inlaid aisle edge reveal.002; ET | Inlaid aisle edge reveal.003
Materials: DETAIL V2 | Satin brushed nickel; ET CURVE PBR | Satin graphite titanium

## Method
- Runtime GLB has no UVs. `scripts/surface-bake/prepare-uv.mjs step-nosings` reads only the runtime triangles and derives 306 planar charts
  (edge-connected faces with the same dominant normal axis, projected along it; 0 overlap splits; 76 charts never face a
  viewpoint and get 1/8 density). The runtime copy gets the same UVs from `/textures/theatre/step-nosings/step-nosings-uv.bin`; GLBs, positions, normals and topology are unchanged.
- `scripts/blender/surface-bake/bake-item.py step-nosings`: Cycles COMBINED direct surface bake of the source material in the disposable copy
  (LeftWall_work_copy.blend, never saved), 512 samples, 577.8s, all source lights, light linking and occluders.
  Glossy/sheen direction: single bake camera at 0, 22.2, 3.22. Display transform AgX / AgX - Medium High Contrast / exposure 0.45 applied once.
  Every bake triangle matched a runtime triangle (max distance 5.93e-4 m).
- `scripts/surface-bake/encode-item.mjs step-nosings`: 8-bit dither, UASTC level 3, RDO 0.25, sRGB, box mipmaps, zstd 19.
- Runtime: `components/corridor/baked-surfaces.tsx`, MeshBasicMaterial, toneMapped false, anisotropy up to 16, one draw call.

- 27 satin nickel step nosings plus four satin graphite inlaid aisle edge reveals. Both materials are fully metallic and use Object coordinates, so objects are baked unjoined.
- Thin strips keep at least 16 texels across (anisotropic charts).

## Runtime assets
| File | Bytes |
|---|---:|
| /textures/theatre/step-nosings/step-nosings.ktx2 (2048x2048, 109.823 texels/unit, 62.1% used) | 1,078,097 |
| /textures/theatre/step-nosings/step-nosings-uv.bin | 14,404 |

Estimated GPU memory (4x4-block transcode, 1 B/texel, with mips): 5.3 MiB.

## Same-pose comparison (target mask from Blender, eroded 2 px; 8-bit display values)
| Pose | R3F mean RGB | Blender mean RGB | RMSE | RMSE excl. outliers | p95 max-channel err |
|---|---|---|---|---|---|
| opening (560x276, eye 0,22.2,3.22, target 0,0.802,3.22, 40 deg) | target not visible at this pose | | | | |
| closeup (560x315, eye 0,22.2,3.22, target 0,13,0.8, 30 deg) | 7.3, 7.0, 6.0 | 24.6, 22.2, 21.1 | 17.28 | 13.23 (39 of 99 px over 20) | 29 |
| detail (560x315, eye 0,22.2,3.22, target 0.5,15.5,0.95, 7 deg) | 49.3, 44.2, 38.7 | 72.3, 64.1, 57.3 | 27.49 | 7.89 (2650 of 5358 px over 20) | 54 |
| front (560x315, eye 0,5,1.8, target 0,16,1, 40 deg) | 52.3, 47.3, 44.0 | 32.4, 26.0, 19.4 | 22.99 | 12.75 (5 of 7 px over 20) | 31.8 |

Outliers are pixels with any channel error above 20; they were checked visually and sit on silhouettes next to objects that
are still diagnostic or excluded (e.g. the runtime low-poly seating differs from Blender's seats).

## Limitations
- Fully metallic thin rims: Blender shows a narrow specular highlight along the aisle edge reveals that the frozen bake loses after texture filtering at grazing angles, so the reveals read darker (detail pose R3F 49 vs Blender 72 mean over the mask; the horizontal nosings match closely). Not fixable by more texels; it is view-dependent, and a second view-direction bake is not allowed.
- Front-of-room views show the riser faces from the side the opening camera never sees.

## Reproduce
```
node scripts/surface-bake/prepare-uv.mjs step-nosings
blender -b --python scripts/blender/surface-bake/bake-item.py -- step-nosings
node scripts/surface-bake/encode-item.mjs step-nosings --activate
node scripts/surface-bake/references.mjs step-nosings
```
Then capture R3F at each pose into `D:/CodexOutputs/Restoration_20261024/step-nosings/reference/<pose>-r3f.png` and run `blender -b --python scripts/blender/surface-bake/compare.py -- step-nosings <pose>`.
