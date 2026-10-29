# Aisle, step and stage-cove lights

Status: Agent-verified with a known limitation (off-axis diffusers ~20% dimmer) — awaiting user review.

Objects (8912 runtime triangles): ET | Aisle tread optic; ET | Aisle tread optic.001; ET | Aisle tread optic.002; ET | Aisle tread optic.003; ET | Aisle tread optic.004; ET | Aisle tread optic.005; ET | Aisle tread optic.006; ET | Aisle tread optic.007; ET | Aisle tread optic.008; ET | Aisle tread optic.009; ET | Aisle tread optic.010; ET | Aisle tread optic.011; ET | Aisle tread optic.012; ET | Aisle tread optic.013; ET | Aisle tread optic.014; ET | Aisle tread optic.015; ET | Aisle tread optic.016; ET | Aisle tread optic.017; ET | Aisle tread optic.018; ET | Aisle tread optic.019; ET | Aisle tread optic.020; ET | Aisle tread optic.021; ET | Aisle tread optic.022; ET | Aisle tread optic.023; ET | First step recessed optic; ET | First step recessed optic.001; ET | First step recessed optic.002; ET | Recessed terrace nosing 0 -1; ET | Recessed terrace nosing 0 1; ET | Recessed terrace nosing 1 -1; ET | Recessed terrace nosing 1 1; ET | Recessed terrace nosing 2 -1; ET | Recessed terrace nosing 2 1; ET | Recessed terrace nosing 3 -1; ET | Recessed terrace nosing 3 1; ET | Recessed terrace nosing 4 -1; ET | Recessed terrace nosing 4 1; ET | Stage lower cove; ET | Step light recessed graphite channel; ET | Step light recessed graphite channel.001; ET | Step light recessed graphite channel.002; ET | Step light recessed graphite channel.003; ET | Step light recessed graphite channel.004; ET | Step light recessed graphite channel.005; ET | Step light recessed graphite channel.006; ET | Step light recessed graphite channel.007; ET | Step light recessed graphite channel.008; ET | Step light recessed graphite channel.009; ET | Step light recessed graphite channel.010; ET | Step light recessed graphite channel.011; ET | Step light recessed graphite channel.012; ET | Step light recessed graphite channel.013; ET | Step light recessed graphite channel.014; ET | Step light recessed graphite channel.015; ET | Step light recessed graphite channel.016; ET | Step light recessed graphite channel.017; ET | Step light recessed graphite channel.018; ET | Step light recessed graphite channel.019; ET | Step light recessed graphite channel.020; ET | Step light recessed graphite channel.021; ET | Step light recessed graphite channel.022; ET | Step light recessed graphite channel.023; ET | Step light recessed graphite channel.024; ET | Step light recessed graphite channel.025; ET | Step light recessed graphite channel.026; HALO II | Aisle channel hood; HALO II | Aisle channel hood.001; HALO II | Aisle channel hood.002; HALO II | Aisle channel hood.003; HALO II | Aisle channel hood.004; HALO II | Aisle channel hood.005; HALO II | Aisle channel hood.006; HALO II | Aisle channel hood.007; HALO II | Aisle channel hood.008; HALO II | Aisle channel hood.009; HALO II | Aisle channel hood.010; HALO II | Aisle channel hood.011; HALO II | Aisle channel hood.012; HALO II | Aisle channel hood.013; HALO II | Aisle channel hood.014; HALO II | Aisle channel hood.015; HALO II | Aisle channel hood.016; HALO II | Aisle channel hood.017; HALO II | Aisle channel hood.018; HALO II | Aisle channel hood.019; HALO II | Recessed aisle light ribbon; HALO II | Recessed aisle light ribbon.001; HALO II | Recessed aisle light ribbon.002; HALO II | Recessed aisle light ribbon.003; HALO II | Recessed aisle light ribbon.004; HALO II | Recessed aisle light ribbon.005; HALO II | Recessed aisle light ribbon.006; HALO II | Recessed aisle light ribbon.007; HALO II | Recessed aisle light ribbon.008; HALO II | Recessed aisle light ribbon.009; HALO II | Recessed aisle light ribbon.010; HALO II | Recessed aisle light ribbon.011; HALO II | Recessed aisle light ribbon.012; HALO II | Recessed aisle light ribbon.013; HALO II | Recessed aisle light ribbon.014; HALO II | Recessed aisle light ribbon.015; HALO II | Recessed aisle light ribbon.016; HALO II | Recessed aisle light ribbon.017; HALO II | Recessed aisle light ribbon.018; HALO II | Recessed aisle light ribbon.019
Materials: ET CURVE PBR | Neutral white architectural diffuser; HALO II | Soft aisle guide; HALO | Recessed 2700K aisle diffuser; REFINED | Brushed champagne reveal; REFINED | NOIR / Black anodized hardware

## Method
- Runtime GLB has no UVs. `scripts/surface-bake/prepare-uv.mjs aisle-lights` reads only the runtime triangles and derives 432 planar charts
  (edge-connected faces with the same dominant normal axis, projected along it; 0 overlap splits; 124 charts never face a
  viewpoint and get 1/8 density). The runtime copy gets the same UVs from `/textures/theatre/aisle-lights/aisle-lights-uv.bin`; GLBs, positions, normals and topology are unchanged.
- `scripts/blender/surface-bake/bake-item.py aisle-lights`: Cycles COMBINED direct surface bake of the source material in the disposable copy
  (LeftWall_work_copy.blend, never saved), 512 samples, 566.9s, all source lights, light linking and occluders.
  Glossy/sheen direction: single bake camera at 0, 22.2, 3.22. Display transform AgX / AgX - Medium High Contrast / exposure 0.45 applied once.
  Every bake triangle matched a runtime triangle (max distance 1.25e-3 m).
- `scripts/surface-bake/encode-item.mjs aisle-lights`: 8-bit dither, UASTC level 3, RDO 0.25, sRGB, box mipmaps, zstd 19.
- Runtime: `components/corridor/baked-surfaces.tsx`, MeshBasicMaterial, toneMapped false, anisotropy up to 16, one draw call.

- Aisle tread optics, first-step optics, recessed terrace nosings, stage lower cove (emissive diffusers), step-light graphite channels, aisle light ribbons and champagne channel hoods: 105 objects joined into 30 bake passes, one 2048x2048 atlas.
- No light intensity, colour or scene lighting is changed.

## Runtime assets
| File | Bytes |
|---|---:|
| /textures/theatre/aisle-lights/aisle-lights.ktx2 (2048x2048, 154.453 texels/unit, 29.7% used) | 1,131,219 |
| /textures/theatre/aisle-lights/aisle-lights-uv.bin | 26,484 |

Estimated GPU memory (4x4-block transcode, 1 B/texel, with mips): 5.3 MiB.

## Same-pose comparison (target mask from Blender, eroded 2 px; 8-bit display values)
| Pose | R3F mean RGB | Blender mean RGB | RMSE | RMSE excl. outliers | p95 max-channel err |
|---|---|---|---|---|---|
| opening (560x276, eye 0,22.2,3.22, target 0,0.802,3.22, 40 deg) | target not visible at this pose | | | | |
| front (560x315, eye 0,5,1.8, target 0,16,1, 40 deg) | 189.2, 182.5, 176.6 | 232.9, 215.0, 196.4 | 33.84 | null (100 of 100 px over 20) | 46 |

Outliers are pixels with any channel error above 20; they were checked visually and sit on silhouettes next to objects that
are still diagnostic or excluded (e.g. the runtime low-poly seating differs from Blender's seats).

## Limitations
- These lights face the screen, away from the opening camera, so the opening pose cannot see them; the comparison uses a front-of-room pose (eye 0,5,1.8), which is off the bake eye.
- From that front pose the diffusers read about 20% dimmer than Blender (R3F 189 vs Blender 233 mean): their view-dependent glossy/transmission terms are evaluated with the opening camera direction, which is behind these faces. The emissive core and placement match.

## Reproduce
```
node scripts/surface-bake/prepare-uv.mjs aisle-lights
blender -b --python scripts/blender/surface-bake/bake-item.py -- aisle-lights
node scripts/surface-bake/encode-item.mjs aisle-lights --activate
node scripts/surface-bake/references.mjs aisle-lights
```
Then capture R3F at each pose into `D:/CodexOutputs/Restoration_20261024/aisle-lights/reference/<pose>-r3f.png` and run `blender -b --python scripts/blender/surface-bake/compare.py -- aisle-lights <pose>`.
