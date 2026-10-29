# Moon designs: polished steel border rings

Status: Agent-verified — awaiting user review.

Objects (848 runtime triangles): Cylinder.018; Cylinder.020; Cylinder.024; Cylinder.026
Materials: MOON | Polished stainless steel - fine polish

## Method
- Runtime GLB has no UVs. `scripts/surface-bake/prepare-uv.mjs moon-steel-border` reads only the runtime triangles and derives 112 planar charts
  (edge-connected faces with the same dominant normal axis, projected along it; 56 overlap splits; 36 charts never face a
  viewpoint and get 1/8 density). The runtime copy gets the same UVs from `/textures/theatre/moon-steel-border/moon-steel-border-uv.bin`; GLBs, positions, normals and topology are unchanged.
- `scripts/blender/surface-bake/bake-item.py moon-steel-border`: Cycles COMBINED direct surface bake of the source material in the disposable copy
  (LeftWall_work_copy.blend, never saved), 1024 samples, 656.5s, all source lights, light linking and occluders.
  Glossy/sheen direction: single bake camera at 0, 22.2, 3.22. Display transform AgX / AgX - Medium High Contrast / exposure 0.45 applied once.
  Every bake triangle matched a runtime triangle (max distance 2.95e-5 m).
- `scripts/surface-bake/encode-item.mjs moon-steel-border`: 8-bit dither, UASTC level 3, RDO 0.25, sRGB, box mipmaps, zstd 19.
- Runtime: `components/corridor/baked-surfaces.tsx`, MeshBasicMaterial, toneMapped false, anisotropy up to 16, one draw call.

- Included objects (exactly four, all "design moon"): Cylinder.018, Cylinder.020 (left wall), Cylinder.024, Cylinder.026 (right wall); 212 runtime triangles each, 848 total. Each is an annular steel ring 1.63-2.35 m from its moon centre; no modifiers.
- All four use the same material, MOON | Polished stainless steel - fine polish (4 users): metallic 1.0, roughness 0.09-0.15 from world-position micro-polish noise, bump, and planar/edge normal blending. Excluded: mirror discs (OPT | ... baked angle reflections), Material.005 parts, White plastic and material-less moon parts, walls, speakers and fixtures.
- Fixed 6144x6144 atlas (user requirement): 1,053 texels/m (about 0.95 mm), 83.2% used; every ring has its own charts (112 charts, ring backs facing the wall at 1/8 density), at least 16 texels across thin rims, 8 px padding. 4 objects joined into 2 bake passes (no per-object material inputs).
- Bake viewpoint chosen by evidence: Blender replays of three single-eye candidates scored at four journey views (RMSE opening/closeup/detail/projector): opening eye 17.2/13.6/4.9/25.4 (mean 15.3), mid-pullback 20.6/42.7/46.9/62.1, projector side 21.0/33.7/59.4/8.4. The opening eye was kept; one active bake.
- KTX2: UASTC level 3, RDO 0.25, sRGB DFD, box mips stopped at 12x12 (10 levels: 6144 to 12) so every level stays 4x4-block aligned for WebGL compressed formats; three.js allocates exactly the provided levels. The 6K authoring bake (EXR and 16-bit display PNG) is kept outside public.
- Change check: diffing the opening view before/after this item, all changed pixels lie on the ring perimeters (within a few px); nothing else changed.

## Runtime assets
| File | Bytes |
|---|---:|
| /textures/theatre/moon-steel-border/moon-steel-border.ktx2 (6144x6144, 1052.843 texels/unit, 83.2% used) | 12,376,809 |
| /textures/theatre/moon-steel-border/moon-steel-border-uv.bin | 3,956 |

Estimated GPU memory (4x4-block transcode, 1 B/texel, with mips): 48.0 MiB.

## Same-pose comparison (target mask from Blender, eroded 2 px; 8-bit display values)
| Pose | R3F mean RGB | Blender mean RGB | RMSE | RMSE excl. outliers | p95 max-channel err |
|---|---|---|---|---|---|
| opening (560x276, eye 0,22.2,3.22, target 0,0.802,3.22, 40 deg) | 54.8, 44.0, 36.9 | 68.7, 57.8, 44.9 | 39.68 | 8.26 (234 of 696 px over 20) | 116.5 |
| closeup (560x315, eye 0,22.2,3.22, target -6,10,3.45, 48 deg) | 51.6, 41.4, 33.9 | 66.0, 56.7, 45.3 | 39 | 7.82 (138 of 453 px over 20) | 110.4 |
| detail (560x315, eye 0,22.2,3.22, target -8.08,13.65,4.02, 8 deg) | 29.5, 25.2, 20.6 | 31.3, 26.5, 21.6 | 10.28 | 3.29 (369 of 10130 px over 20) | 13 |
| projector (560x315, eye 0,39.845,3.3525, target 0,33.845,3.2525, 40 deg) | 61.9, 49.6, 39.6 | 68.8, 59.7, 47.3 | 43.55 | 9.89 (28 of 63 px over 20) | 116.4 |
| offaxis (560x315, eye 0,12,3.22, target 8.1,13.6,4, 30 deg) | 99.9, 78.7, 70.8 | 84.9, 66.8, 41.2 | 46.04 | 10.66 (68 of 95 px over 20) | 108.2 |

Outliers are pixels with any channel error above 20; they were checked visually and sit on silhouettes next to objects that
are still diagnostic or excluded (e.g. the runtime low-poly seating differs from Blender's seats).

## Limitations
- Mirror-polished steel is the most view-dependent material in the room: reflections are frozen as seen from the opening camera. From other angles they do not move; e.g. the off-axis view of a right ring reads cooler than Blender (RMSE 10.7 excluding outliers, blue channel 71 vs 41).
- At normal framing the rings are 2-4 px wide; most masked error comes from the ring inner edge where Blender antialiasing blends the bright adjacent mirror glow while the site blends the still-diagnostic mirror. The ring itself matches at the 8 deg detail view (RMSE 3.3 excluding outliers).
- Download 12.4 MB and about 48 MiB of GPU memory for this one texture (estimate for BC7/ASTC); devices without BC7/ASTC/ETC2 support would fall back to uncompressed RGBA (about 4x). This is the cost of the requested 6K runtime atlas.

## Reproduce
```
node scripts/surface-bake/prepare-uv.mjs moon-steel-border
blender -b --python scripts/blender/surface-bake/bake-item.py -- moon-steel-border
node scripts/surface-bake/encode-item.mjs moon-steel-border --activate
node scripts/surface-bake/references.mjs moon-steel-border
```
Then capture R3F at each pose into `D:/CodexOutputs/Restoration_20261024/moon-steel-border/reference/<pose>-r3f.png` and run `blender -b --python scripts/blender/surface-bake/compare.py -- moon-steel-border <pose>`.
