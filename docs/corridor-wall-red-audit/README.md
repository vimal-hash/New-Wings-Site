# Corridor red-side wall (dark steel)

Status: Agent-verified — awaiting user review.

Objects (580 runtime triangles): Red corridor wall • separate from logo
Materials: PREP | Red corridor wall • separate from logo | Corridor • neutral soft fill / dark lower edge.001

## Method
- Runtime GLB has no UVs. `scripts/surface-bake/prepare-uv.mjs corridor-wall-red` reads only the runtime triangles and derives 2 planar charts
  (edge-connected faces with the same dominant normal axis, projected along it; 0 overlap splits; 0 charts never face a
  viewpoint and get 1/8 density). The runtime copy gets the same UVs from `/textures/corridor/wall-red/corridor-wall-red-uv.bin`; GLBs, positions, normals and topology are unchanged.
- `scripts/blender/surface-bake/bake-item.py corridor-wall-red`: Cycles COMBINED direct surface bake of the source material in the disposable copy
  (Corridor_prepared_work_copy.blend, never saved), 512 samples, 18.5s, all source lights, light linking and occluders.
  Glossy/sheen direction: single bake camera at -49.892, 105.678, 3.24. Display transform AgX / AgX - Medium High Contrast / exposure -0.65 applied once.
  Every bake triangle matched a runtime triangle (max distance 3.05e-5 m).
- `scripts/surface-bake/encode-item.mjs corridor-wall-red`: 8-bit dither, UASTC level 3, RDO 0.25, sRGB, box mipmaps, zstd 19.
- Runtime: `components/corridor/baked-surfaces.tsx`, MeshBasicMaterial, toneMapped false, anisotropy up to 16, one draw call.

- Baked in the prepared runtime-matching corridor scene (Corridor_Runtime_Material_Prepared.blend, disposable copy, never saved); runtime world to Blender is (x,-z,y). Glossy direction: the prepared bend camera. Validation: replaying the ACTIVE_CAMERA bake as pure emission at the bend camera reproduced the source render of the red wall (RMSE 0.32/255), confirming the Light Path > Is Camera Ray fill/tint branches are captured; an ABOVE_SURFACE bake did not (484 outliers) and was rejected.
- The bend/exit views are near-black (mean about 1/255), as in the prepared reference.

## Runtime assets
| File | Bytes |
|---|---:|
| /textures/corridor/wall-red/corridor-wall-red.ktx2 (1024x2048, 14.063 texels/unit, 68.7% used) | 541,989 |
| /textures/corridor/wall-red/corridor-wall-red-uv.bin | 1,220 |

Estimated GPU memory (4x4-block transcode, 1 B/texel, with mips): 2.7 MiB.

## Same-pose comparison (target mask from Blender, eroded 2 px; 8-bit display values)
| Pose | R3F mean RGB | Blender mean RGB | RMSE | RMSE excl. outliers | p95 max-channel err |
|---|---|---|---|---|---|
| entry (560x315, eye -4.048210144042969,56.60417938232422,3.240000009536743, target -8.917251586914062,66.93704223632812,3.240000009536743, 40 deg) | 1.6, 1.8, 2.5 | 1.5, 1.6, 2.2 | 4.52 | 3.1 (1641 of 88111 px over 20) | 9 |
| bend (560x315, eye -49.89191818237305,105.67767333984375,3.240000009536743, target -60.17906188964844,110.65523529052734,3.240000009536743, 40 deg) | 0.7, 0.4, 0.8 | 0.9, 0.7, 0.9 | 1.08 | 0.96 (33 of 78764 px over 20) | 2 |
| exit (560x315, eye -123.40933227539062,121.41460418701172,3.240000009536743, target -134.7411346435547,119.93868255615234,3.240000009536743, 40 deg) | 0.8, 0.4, 0.3 | 1.2, 0.8, 0.6 | 1.81 | 1.1 (220 of 48891 px over 20) | 2 |
| aerial (560x315, eye -20,30,140, target -80,95,0, 45 deg) | 3.1, 3.1, 4.2 | 1.2, 1.6, 2.3 | 6.03 | 4.16 (418 of 11491 px over 20) | 18 |

Outliers are pixels with any channel error above 20; they were checked visually and sit on silhouettes next to objects that
are still diagnostic or excluded (e.g. the runtime low-poly seating differs from Blender's seats).

## Limitations
- View-dependent steel response is frozen as seen from the bend camera; the entry view shows small differences (RMSE 3.1 excluding outliers).
- Aerial outliers sit on edges next to the excluded logo ribbons.

## Reproduce
```
node scripts/surface-bake/prepare-uv.mjs corridor-wall-red
blender -b --python scripts/blender/surface-bake/bake-item.py -- corridor-wall-red
node scripts/surface-bake/encode-item.mjs corridor-wall-red --activate
node scripts/surface-bake/references.mjs corridor-wall-red
```
Then capture R3F at each pose into `D:/CodexOutputs/Restoration_20261024/corridor-wall-red/reference/<pose>-r3f.png` and run `blender -b --python scripts/blender/surface-bake/compare.py -- corridor-wall-red <pose>`.

## 6K rebake with the readable charcoal fill (2026-10-24) — Agent-verified, awaiting user review

Source: item-only override (`sourceOverride` in `scripts/surface-bake/items.json`) — disposable copy
`D:/CodexOutputs/Restoration_6K_20261024/corridor-wall-red/Left_Wall_Lighting_work_copy.blend`, hash-checked against the
prepared master `D:/CodexOutputs/Corridor_Left_Wall_Lighting_20261024/Left_Wall_Lighting_Prepared.blend` before and after.
The global corridor source and every other corridor item are unchanged. Material taken from `ob.material_slots[0].material`:
`LEFT WALL | Soft readable charcoal fill` (in this copy the slot reports link DATA; the bake JSON confirms the prepared
material was the one baked). Generated-coordinate height fade kept; no modifiers, so the frozen mesh keeps the same texture
space; the wall was not joined with anything (580 triangles, one pass).

One 6144 x 6144 COMBINED bake from the existing bend camera (-49.892, 105.678, 3.24), 2048 samples, 426 s. Existing chart
layout and `corridor-wall-red-uv.bin` unchanged (1024 x 2048 layout sampled 6x / 3x finer).

| | Previous | 6K |
|---|---|---|
| Runtime file | `corridor-wall-red.ktx2` (backup: `D:/CodexOutputs/Restoration_6K_20261024/backup/corridor-wall-red/`) | `corridor-wall-red-6k.ktx2` |
| Image | 1024 x 2048 | 6144 x 6144 |
| Download | 541,989 bytes | 9,533,171 bytes |
| GPU estimate | 2.7 MiB | 48.0 MiB |
| Mean baked luma (8-bit) | 6.8 (old near-black source) | 21.8 (readable fill) |

KTX2 vs clean master: RGB PSNR 53.0 dB.

Camera-ray validation (bake replayed as camera-only emission vs the prepared source render, wall mask, 8-bit RMSE):
bend 0.39, exit 1.21, entry 3.78 — the Is Camera Ray fill and steel branches are captured at the bake viewpoint.

R3F (actual compressed texture) vs prepared Blender, same pose: entry 3.86, bend 1.34, exit 1.79, page 18.09
(the previous near-black wall scored 16.03 / 15.52 / 14.44 / 31.12 against the same target).

### Page-panel pose: diagnosed limitation (not compensated)
At the page pose Blender shows the wall about twice as bright (mean 22.7/25.2/28.3) as any bend-camera bake can carry
(12.3/13.7/16.6). Diagnosis: the fill emission terms are view-independent and are captured (bend replay 0.39); the extra
brightness is the steel Principled BSDF's reflection (metalness map, low roughness) seen from the page direction.
A Blender-only test bake from the page eye (never shipped) proves the trade-off — replay RMSE page 0.63 / bend 14.90 /
entry 2.06 / exit 12.71, versus the bend bake's 18.33 / 0.39 / 3.78 / 1.21. One single-viewpoint bake cannot match both, so
the instructed bend camera is kept and nothing was brightened artificially. The real page-panel view with its white panel
was captured through the actual scroll journey (`docs/restoration/6k/corridor-page-panel-real.png`): the wall now reads
as dim charcoal instead of black. Options if the page view must be brighter (need your decision): bake from the page
eye (bend and exit then read too bright), or reduce steel reflectivity in the prepared material (a design change).
