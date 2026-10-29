# Projector floor / platform (PROJECTOR FLOOR | Original = source Second_floor)

Status: Agent-verified — awaiting user review.

Objects (12 runtime triangles): Second_floor
Materials: FLOOR V3 | Satin walnut PBR

## Method
- Runtime GLB has no UVs. `scripts/surface-bake/prepare-uv.mjs projector-floor` reads only the runtime triangles and derives 6 planar charts
  (edge-connected faces with the same dominant normal axis, projected along it; 0 overlap splits; 3 charts never face a
  viewpoint and get 1/8 density). The runtime copy gets the same UVs from `/textures/projector-floor/projector-floor-uv.bin`; GLBs, positions, normals and topology are unchanged.
- `scripts/blender/surface-bake/bake-item.py projector-floor`: Cycles COMBINED direct surface bake of the source material in the disposable copy
  (LeftWall_work_copy.blend, never saved), 1024 samples, 40.6s, all source lights, light linking and occluders.
  Glossy/sheen direction: single bake camera at 0, 39.845, 3.353. Display transform AgX / AgX - Medium High Contrast / exposure 0.45 applied once.
  Every bake triangle matched a runtime triangle (max distance 1.97e-6 m).
- `scripts/surface-bake/encode-item.mjs projector-floor`: 8-bit dither, UASTC level 3, RDO 0.25, sRGB, box mipmaps, zstd 19.
- Runtime: `components/corridor/baked-surfaces.tsx`, MeshBasicMaterial, toneMapped false, anisotropy up to 16, one draw call.

- Target confirmed: runtime public/models/projector-floor-marked.glb node "projector-floor" (12 triangles, one box, no UVs) = layout object PROJECTOR FLOOR | Original = source object Second_floor in Theatre_Moon_Projector_optimized.blend (extract_native_floor.py + build_layout.py apply only the theatre translation (0.010995,-26,0.02)). Runtime bounds minus that translation equal Second_floor to 0.1 mm; every bake triangle matched within 0.002 mm.
- Intended material: FLOOR V3 | Satin walnut PBR (object-linked slot; identical in the older live scene). Wood.117/Wood.003 in the native-world file and the corridor preparation are the unused data-level material underneath and were not used.
- In the source, Second_floor and the whole projector are hidden from render and the floor's dedicated light (CINE | Projector hero key, LL | second floor only) has 0 energy. Only the floor is un-hidden, only in the disposable copy, for the bake and the matching Blender reference; no light was changed or added, and the projector (animated at runtime) casts no frozen shadow.
- Runtime: the diagnostic node is hidden in the theatre route's own clone and a world-space copy is drawn with the baked atlas (components/corridor/baked-surfaces.tsx, extractNodeSurfaces). Projector code, materials, particles and controls untouched.
- Single bake direction chosen by evidence: Blender replays of four candidate single bakes (wide, returned and close eyes; above-surface) were scored at all three journey views; the returned-view eye gave the lowest mean and worst-case error. Final result is ONE bake.

## Runtime assets
| File | Bytes |
|---|---:|
| /textures/projector-floor/projector-floor.ktx2 (2048x2048, 110 texels/unit, 86.7% used) | 1,302,292 |
| /textures/projector-floor/projector-floor-uv.bin | 164 |

Estimated GPU memory (4x4-block transcode, 1 B/texel, with mips): 5.3 MiB.

## Same-pose comparison (target mask from Blender, eroded 2 px; 8-bit display values)
| Pose | R3F mean RGB | Blender mean RGB | RMSE | RMSE excl. outliers | p95 max-channel err |
|---|---|---|---|---|---|
| wide (560x315, eye 0,43.345,3.5025, target 0,33.845,3.2525, 40 deg) | 8.7, 4.9, 1.8 | 15.2, 8.4, 3.0 | 6.07 | 5.29 (2712 of 63909 px over 20) | 19 |
| close (560x315, eye -2.7,36.545,5.0525, target 0,33.845,3.2525, 40 deg) | 18.9, 11.4, 5.1 | 8.8, 4.3, 2.0 | 9.31 | 7.88 (12283 of 118454 px over 20) | 24 |
| returned (560x315, eye 0,39.845,3.3525, target 0,33.845,3.2525, 40 deg) | 18.2, 10.4, 4.0 | 18.9, 10.7, 4.1 | 1.61 | 1.61 (0 of 57669 px over 20) | 4 |

Outliers are pixels with any channel error above 20; they were checked visually and sit on silhouettes next to objects that
are still diagnostic or excluded (e.g. the runtime low-poly seating differs from Blender's seats).

## Limitations
- Satin walnut sheen is view-dependent and frozen from the returned view: from the wide approach the deck reads darker than Blender (RMSE 6.1) and from the close high view brighter (RMSE 9.3); the returned view matches (RMSE 1.6).
- For these comparisons the runtime projector was hidden temporarily (capture-only) because the source render hides it; the deck under the projector is therefore compared without it.

## Reproduce
```
node scripts/surface-bake/prepare-uv.mjs projector-floor
blender -b --python scripts/blender/surface-bake/bake-item.py -- projector-floor
node scripts/surface-bake/encode-item.mjs projector-floor --activate
node scripts/surface-bake/references.mjs projector-floor
```
Then capture R3F at each pose into `D:/CodexOutputs/Restoration_20261024/projector-floor/reference/<pose>-r3f.png` and run `blender -b --python scripts/blender/surface-bake/compare.py -- projector-floor <pose>`.
