# 6K baked-texture upgrade — seven approved surfaces (2026-10-24)

Status of every target: **Agent-verified — awaiting user review.** Nothing committed or deployed.
Evidence images: [`6k/`](6k/) (before | after | Blender triptychs, close-up pairs, UV crops, real page-panel view).

## What changed
Seven surfaces received a fresh 6144 x 6144 Cycles bake (no upscaling), encoded as one UASTC KTX2 each, in their existing
texture folders under fresh `-6k` file names. Nothing else changed:

- GLBs: all 19 byte-identical to the pre-upgrade snapshot (`node scripts/surface-bake/check-6k.mjs` → `CHECK6K OK`; snapshot
  `docs/restoration/6k-baseline.json`, 68 files).
- The 10 corridor light assemblies (`corridor-pathway-lights`), floor joints, wall caps, roof datums, theatre terraces, stairs,
  aisle lights, moon designs and steel borders, speakers, sconces, sofas, projector, projector floor, logo, curtain and Slide A/B:
  textures, UV sidecars and manifest entries unchanged. Reverting only the seven targets' URL/bytes/imageSize fields in
  `baked-surfaces.json` reproduces the baseline file byte-for-byte.
- UV sidecars, chart layouts, triangle assignments, geometry, normals, transforms, camera, animation and UI code: unchanged.
  The only runtime code edit is `theatre-ceiling.tsx` reading its texture URL from `theatre-ceiling-assets.json` (as the left wall does).
- No exposure, lighting or grading change; no runtime switching, projection or multi-camera bundles; one bake per target.
- Old textures removed from `public/` after hash-verified backups to `D:/CodexOutputs/Restoration_6K_20261024/backup/<target>/`.

## Per-target sizes
GPU estimate = 4x4-block formats (BC7 on desktop, ASTC 4x4 on phones) at 1 byte/texel with mips.

| Target | Old image | New image | Textures | Old download | New download | Old GPU | New GPU |
|---|---|---|---:|---:|---:|---:|---:|
| Theatre left wall | 4096 x 2048 | 6144 x 6144 | 1 | 3,882,754 | 15,526,561 | 10.7 MiB | 48.0 MiB |
| Theatre right wall | 2048 x 4096 | 6144 x 6144 | 1 | 2,932,905 | 11,679,328 | 10.7 MiB | 48.0 MiB |
| Theatre floor slab | 2048 x 2048 | 6144 x 6144 | 1 | 1,078,351 | 8,108,148 | 5.3 MiB | 48.0 MiB |
| Theatre ceiling (incl. trim + cove) | 4096 x 4096 | 6144 x 6144 | 1 | 3,360,256 | 9,686,587 | 21.3 MiB | 48.0 MiB |
| Corridor left wall (`corridor-wall-red`) | 1024 x 2048 | 6144 x 6144 | 1 | 541,989 | 9,533,171 | 2.7 MiB | 48.0 MiB |
| Corridor right wall (`corridor-wall-connecting`) | 1024 x 2048 | 6144 x 6144 | 1 | 677,576 | 9,672,141 | 2.7 MiB | 48.0 MiB |
| Corridor slate floor | 2048 x 4096 | 6144 x 6144 | 1 | 2,117,651 | 8,842,184 | 10.7 MiB | 48.0 MiB |
| **Total (7 targets)** | | | 7 | **14,591,482** | **73,048,120** | **64 MiB** | **336 MiB** |

Whole site after the upgrade: 23 KTX2 files, 96.2 MB; 100.3 MB of all fetched assets (≈ 41.8 MB before).
Estimated texture GPU memory for all baked surfaces: ≈ 438 MiB (8 textures at 6144², including the earlier steel border).

## Bake, encode and colour
- Bakes: COMBINED direct surface bakes, `view_from = ACTIVE_CAMERA`, one eye per target (theatre opening camera; corridor bend
  camera), 2048 samples (ceiling chain 2048), disposable copies only, source hashes asserted unchanged.
- Display transform applied once (`image.save_render` with the source scene's AgX look/exposure) to a 16-bit master kept
  outside `public/`; triangular dither to 8 bit; UASTC level 3, RDO 0.25, sRGB transfer, box mips down to 12 px (all levels
  4x4-block aligned for WebGL), zstd 19 (`scripts/surface-bake/encode-6k.mjs`). Headers checked with
  `node scripts/surface-bake/ktx2-info.mjs`: UASTC / sRGB / zstd / 10 levels, matching the accepted encoding.
- RDO tuned against the clean master on the left wall: 1.0 and 2.0 saved under 10% size but raised max error from 35 to
  42/58 levels, so 0.25 was kept. Encoded PSNR vs master: 51.3–55.7 dB.

## Convergence
`scripts/blender/surface-bake/convergence-check.py` box-filters each 6K master down to the accepted size and compares.

| Target | Residual accepted | Residual 6K (downsampled) | RMSE accepted vs 6K | Note |
|---|---:|---:|---:|---|
| Left wall | 0.178 | 0.177 | 0.51 | |
| Right wall | 0.162 | 0.174 | 0.52 | |
| Floor slab | 0.064 | 0.110 | 0.49 | sub-level; no visible grain |
| Ceiling | 0.054 (8-bit master) | 0.032 | 2.29 | cleanup kernels now narrower in UV terms |
| Corridor right wall | 0.090 | 0.106 | 1.26 | |
| Corridor floor | 0.134 | 0.257 | 0.62 | resolved slate detail, see UV crop |
| Corridor left wall | 0.023 | 0.149 | 17.5 | intentional: new readable-fill source |

All residuals are below a third of one 8-bit level, smaller than the encode dither itself. Gain-boosted UV crops show no
Monte Carlo grain.

## Same-angle verification (8-bit RMSE vs Blender, target mask; before = accepted texture, same pipeline)
| Target | View | Before | After |
|---|---|---:|---:|
| Left wall | opening / close-up / mid-room / near detail | 2.59 / 16.14 / 15.71 / 5.08 | 2.63 / 16.15 / 15.64 / 5.02 |
| Right wall | opening / close-up / mid-room / near detail | 2.82 / 15.84 / 15.70 / 5.21 | 2.83 / 15.84 / 15.61 / 5.18 |
| Floor slab | opening / close-up / near detail | 7.89 / 24.47 / 3.31 | 7.94 / 24.47 / 3.33 |
| Ceiling | opening / looking up / cove / crown junction | 12.80 / 11.84 / 10.22 / 11.63 | 12.43 / 11.81 / 10.03 / 11.04 |
| Corridor left wall | entry / bend / exit / page | 16.03 / 15.52 / 14.44 / 31.12 | 3.86 / 1.34 / 1.79 / 18.09 |
| Corridor right wall | entry / bend / exit | 0.82 / 1.45 / 7.53 | 0.84 / 1.48 / 7.46 |
| Corridor floor | entry / bend / exit | 5.83 / 1.47 / 1.89 | 5.81 / 1.47 / 1.83 |

High close-up / mid-room values come from sofa silhouettes over the wall mask and the known frozen sheen, both unchanged.
At journey distances the old textures were already finer than a screen pixel, so the numbers barely move; the 6K gain
appears up close. 12-degree close-ups (≈ 1 mm per screen pixel, i.e. a high-DPI display or close inspection), mean local
gradient before → after: corridor floor 0.095 → 0.252 (clearly sharper slate), ceiling crown 0.535 → 0.545 (slightly crisper
trim edge), left-wall velvet 0.057 → 0.053 and floor slab 0.080 → 0.080 (no visible change: these baked appearances are
dark, smooth lighting with little fine texture). See `6k/zoom-*-before-vs-after.png`.

Camera-ray validation (bake replayed as camera-only emission vs source render): corridor left wall bend 0.39 (its new
Is Camera Ray fill is captured), corridor right wall bend 0.65, corridor floor bend 0.95.

## Performance (measured 2026-10-24, production build, served from this PC)
| Setting | First 3D frame | Frame / p95 | Draw calls | Notes |
|---|---:|---:|---:|---|
| Desktop pane 593 x 862, DPR 1, RTX 4070 (ANGLE D3D11) | 6.16 s | 13.3 / 13.5 ms (75 fps, display cap) | 30 | JS heap 519 MB after load |
| Mobile emulation 375 x 812, DPR 2 (Pixel 8 UA) | 6.23 s | 13.3 / 13.4 ms | 30 | same PC GPU/CPU — not representative of a phone |
| Real phone | not tested | – | – | no device was available to me |

The served-locally numbers exclude real network time. At 50 Mbit/s the 100 MB of assets alone take ~16 s (~6.7 s before);
at 20 Mbit/s ~40 s (~17 s before). Most of the 6 s first-frame time here is UASTC transcoding of the eight 6K textures in two
worker threads.

## Device support (honest assessment)
- This PC: MAX_TEXTURE_SIZE 16384, BC7/BPTC + S3TC; all seven textures load and render (HTTP 200, no console errors).
- A 6144 texture needs MAX_TEXTURE_SIZE ≥ 6144 (in practice 8192). WebGL 2 only guarantees 2048. GPUs limited to 4096
  (older Mali-T6xx/Adreno 3xx Android phones, some very old integrated GPUs) cannot use these textures; they would fail to
  upload and the surfaces would render black. Not tested on such a device.
- iPhone/iPad (A8 and later) and current Android flagships support ASTC 4x4 and 8192–16384 textures, so they can decode
  these files, but memory is the real risk: three.js keeps each transcoded mip chain in JS memory after GPU upload
  (8 x ~50 MB ≈ 400 MB for the eight 6K textures; measured heap 519 MB) on top of ~438 MiB of GPU texture memory. iOS Safari can reload
  or crash a tab near ~1–1.5 GB, so older iPhones (≤ 4 GB RAM) are at real risk. This needs testing on real phones.
- Devices without any 4x4-block format would fall back to uncompressed RGBA: ~192 MiB per 6K texture (unlikely on WebGL 2
  hardware, but possible on some Linux desktop drivers).

## Remaining visual limitations
- Left/right theatre walls: velvet sheen frozen from the opening camera; face-on views read redder than Blender (unchanged).
- Corridor left wall at the page-panel pose: Blender's steel reflection from that angle makes the wall ~2x brighter than any
  bend-camera bake can carry; diagnosed with a Blender-only page-eye test bake (see the corridor-wall-red report). Kept the
  bend camera as instructed; no artificial brightening.
- Ceiling keeps its accepted warmer look vs the theatre master (blue −13 to −16 levels); not corrected.
- Floor slab and left-wall velvet show no visible 6K gain (smooth, dark lighting); their extra bytes buy little.
- The loader caption "… KB · compressed assets" is computed from the asset manifests and now includes the larger ceiling file.

These results are a close visual match at the measured views, not exact Cycles equivalence; nothing here is claimed as
"100% matched".

## Reproduce
```
blender -b --python scripts/blender/left-wall/bake-left-wall-direct.py        # env LW_W=6144 LW_H=6144 LW_SAMPLES=2048 LW_TAG=6k
blender -b --python scripts/blender/surface-bake/bake-item.py -- <item> 2048 --size 6144x6144 --tag 6k   # right-wall, floor-slab, corridor-*
CEIL_N=6144 CEIL_SAMPLES=2048 blender -b --python scripts/blender/ceiling-6k/1-bake.py   # then 2-fix-closure, 3-stitch, 4-clean
node scripts/surface-bake/encode-6k.mjs <display.png> <public/.../name-6k.ktx2>
blender -b --python scripts/blender/surface-bake/bake-item.py -- <item> --replay <pose> --tag 6k        # camera-ray validation
node scripts/surface-bake/references.mjs <item> [pose]; blender -b --python scripts/blender/surface-bake/compare.py -- <item> <pose> [before|r3f]
blender -b --python scripts/blender/surface-bake/convergence-check.py -- <accepted.png> <6k.png>
node scripts/surface-bake/check-6k.mjs; node scripts/restoration-baseline.mjs --check
```
Masters (16-bit display PNG + EXR) stay outside `public/`: `D:/CodexOutputs/Theatre_LeftWall_Bake_20261023/left-wall-6k*`,
`D:/CodexOutputs/Restoration_20261024/<item>/bake*-6k.*`, `D:/CodexOutputs/Restoration_6K_20261024/theatre-ceiling/`.
Captures: `D:/CodexOutputs/Restoration_6K_20261024/captures/{before,after}/`. `restoration-baseline.mjs` now tracks the 6K
files; its pre-upgrade record is `baseline-hashes.pre-6k.json`.
