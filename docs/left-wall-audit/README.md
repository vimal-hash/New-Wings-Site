# Left wall: direct surface bake (2026-10-24)

Target: `ET | Side structural wall 1` (Blender X 8.2-8.5, room face normal -X, 108 evaluated triangles,
material `DETAIL V2 | Wine velvet`). Moon, fixtures, speakers, slats, ceiling and all other surfaces untouched.

Method: one 4096x2048 Cycles COMBINED bake (1024 samples, 237 s) of the source material in the disposable copy
`D:/CodexOutputs/Theatre_LeftWall_Bake_20261023/LeftWall_work_copy.blend` (never saved; source SHA verified).
Lights, light linking and all occluders are the source scene's. Glossy/sheen direction: the opening camera
(0, 22.2, 3.22). Source AgX Medium High Contrast + exposure 0.45 applied once (`save_render`), triangular-dithered
to 8 bit, UASTC level 3 + RDO 0.25, sRGB, box mipmaps, zstd 19. No filtering or smoothing of the bake.

UVs: `theatre-marked.glb` has no UVs, so `components/corridor/left-wall-uv.ts` copies the wall's 108 triangles at load
(by colour ID) and derives a fixed planar UV from position (`left-wall-uv.json`, same rule as the bake script).
Room face: 5.1 mm x 3.4 mm texels, one island, no seams. No GLB, geometry, normal or transform is changed.

Runtime: 1 texture, `public/textures/theatre/left-wall/left-wall-surface.ktx2`, 3,882,754 bytes; MeshBasicMaterial,
toneMapped false, anisotropy up to 16, +1 draw call.

Same-pose comparison (wall pixels only, 8-bit):
| View | R3F mean RGB | Blender mean RGB | RMSE |
|---|---|---|---|
| Opening 1600x788 pose | 42.9, 18.0, 11.0 | 43.5, 18.1, 10.8 | 2.49 |
| Close-up (same eye, 48 deg) | 27.3, 14.2, 7.9 | 27.4, 14.5, 7.5 | 2.15 |
| Mid-room orbit (0, 10.4, 3.22) | 43.2, 18.0, 11.2 | 16.9, 14.4, 9.6 | 15.9 |

Known limitation: the velvet's red is mostly grazing-angle sheen. A single bake freezes it as seen from the opening
camera, so orbit views looking straight at the wall read redder than Blender. Multi-camera bakes were rejected.

Reproduce: `blender -b --python scripts/blender/left-wall/bake-left-wall-direct.py` (env LW_W/LW_H/LW_SAMPLES/LW_TAG),
convert display PNG to 8-bit, `node scripts/encode-left-wall.mjs`, `node scripts/verify-left-wall-protected.mjs`.

## 6K upgrade (2026-10-24) — Agent-verified, awaiting user review

Fresh 6144 x 6144 Cycles COMBINED bake (not an upscale): same disposable work copy, same 108 triangles, same opening
camera (0, 22.2, 3.22) for glossy/sheen direction, 2048 samples, 1,521 s. The accepted analytic UV layout is unchanged
(`left-wall-uv.json` boxes are normalised by the 4096 x 2048 layout, so the 6144 x 6144 image samples the same mapping
1.5x finer across and 3x finer vertically). Source AgX + look + exposure applied once by `save_render`, triangular dither to
8 bit, UASTC level 3 + RDO 0.25, sRGB, box mips down to 12 px, zstd 19 (`scripts/surface-bake/encode-6k.mjs`).

| | Accepted 4K | 6K |
|---|---|---|
| Runtime file | `left-wall-surface.ktx2` (backed up to `D:/CodexOutputs/Restoration_6K_20261024/backup/theatre-left-wall/`) | `left-wall-surface-6k.ktx2` |
| Image | 4096 x 2048 | 6144 x 6144 |
| Download | 3,882,754 bytes | 15,526,561 bytes |
| GPU estimate (4x4-block formats, mips) | 10.7 MiB | 48.0 MiB |
| Per-texel high-frequency residual (noise + fine detail, 8-bit) | 0.177 | 0.161 |
| Mean baked luma (8-bit) | 22.18 | 22.25 |

KTX2 vs clean 8-bit master: RGB PSNR 51.3 dB. RDO 1.0 / 2.0 were tested (14.07 / 14.03 MB, max error 42 / 58 levels) and
rejected: the velvet grain is genuine detail, so stronger RDO costs quality for almost no size saving.

Same-pose R3F vs Blender (wall mask, 8-bit RMSE; before = accepted 4K in the same build pipeline):
| View (560 px) | Before | After 6K |
|---|---|---|
| Opening | 2.59 | 2.63 |
| Close-up (48 deg) | 16.14 (2.10 excl. sofa-silhouette outliers) | 16.15 (2.11) |
| Mid-room | 15.71 | 15.64 |
| Near-wall detail (1.8 m) | – | 5.02 (R3F redder: frozen sheen) |

At journey distances both textures are already finer than a screen pixel, so the numbers are unchanged; the 6K gain is
sampling at close range. Known limitation unchanged: the velvet sheen is frozen from the opening camera, so face-on views
read redder than Blender. Reproduce: `LW_W=6144 LW_H=6144 LW_SAMPLES=2048 LW_TAG=6k blender -b --python
scripts/blender/left-wall/bake-left-wall-direct.py`, then `node scripts/surface-bake/encode-6k.mjs
<left-wall-6k-display.png> public/textures/theatre/left-wall/left-wall-surface-6k.ktx2`.
