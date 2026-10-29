# Ceiling surface bake

Current files and reproduction: [material workflow](../material-matching-workflow.md).

Runtime: ceiling-uv-fixed.glb (55,860B) + ceiling-surface-edges.ktx2 (3,360,256B) = 3,416,116B. One fixed UV appearance from a direct Blender surface bake. Previous camera-image atlases were rejected for stretched detail and removed from public assets. Original Blender sources, geometry and unrelated surfaces are preserved.

Evidence: ceiling-direct-opening.png, ceiling-direct-tilted.png, ceiling-direct-mobile.png; geometry-verification.json; texture-mapping-fixed.json; cleanup-verification.json. Historical screenshots are not the current runtime.

Edge repair: the +X wall-crown closure was outward-facing in the source, so its room-visible face baked black. Reverse that bake copy only (never source/runtime geometry); fix-ceiling-direct-edges.py rebakes its chart over the retained direct EXR. stitch-ceiling-direct-edges.py repairs233 paired smooth UV cuts using matching geometric endpoints/normals, then clean-ceiling-direct-edges.py restores isolated gutters. Encode ceiling-edge-stitched-clean.png to the active filename. Screenshots ceiling-edges-before.png and ceiling-edges-fixed.png show the same camera drag (+10,+5 pixels at1920x945). Runtime total3,416,116B. The full direct bake now includes the closure correction to avoid regression.

## 6K upgrade (2026-10-24) — Agent-verified, awaiting user review

The accepted ceiling chain re-run at 6144 x 6144 from the same `Ceiling_PBR_prepared.blend` (opened, never saved) with the
same repaired `CeilingLightmap` UVs (`cove-uv-refinement.json`) and opening-camera glossy direction — a fresh bake, not an
upscale. Scripts: `scripts/blender/ceiling-6k/1-bake.py` (direct COMBINED bake of the 10 HALO II objects, 2048 samples,
~39 min), `2-fix-closure.py` (room-facing crown closure rebake), `3-stitch.py` (233 UV seams stitched),
`4-clean.py` (per-island cleanup in 26 isolated sections, never across atlas neighbours; display transform applied once
by `save_render`), then `node scripts/surface-bake/encode-6k.mjs`. Pixel-scaled settings (margin, stitch band, crop,
gutter kernel) scale by 1.5; the smoothing kernels keep their pixel size, so the cleanup is ~1.5x narrower in UV terms.
`ceiling-uv-fixed.glb` is unchanged; `theatre-ceiling.tsx` now reads the texture URL from `theatre-ceiling-assets.json`.

| | Accepted | 6K |
|---|---|---|
| Runtime file | `ceiling-surface-edges.ktx2` (backup: `D:/CodexOutputs/Restoration_6K_20261024/backup/theatre-ceiling/`) | `ceiling-surface-edges-6k.ktx2` |
| Image | 4096 x 4096 | 6144 x 6144 |
| Download (texture) | 3,360,256 bytes | 9,686,587 bytes |
| GPU estimate | 21.3 MiB | 48.0 MiB |
| Mean baked luma (8-bit) | 79.79 | 79.21 |

KTX2 vs clean master: RGB PSNR 55.2 dB. UV-matched crops (`D:/CodexOutputs/Restoration_6K_20261024/theatre-ceiling/crop-*.png`)
show the same plaster gradients and cove/fascia shading with crisper LED-shelf edges and trim lines.
Same-pose RMSE vs the theatre master render (before → after): opening 12.80 → 12.43; looking up 11.84 → 11.81; cove 10.22 → 10.03;
crown-junction detail 11.04 (after only). The accepted ceiling is warmer than the theatre master (blue −13 to −16 levels);
that accepted look is preserved, not corrected. The loader caption's "compressed assets" figure includes the ceiling bytes
and therefore rises accordingly.

## 6K compressed-PNG test (2026-10-24) — rejected, current texture kept

Candidate: `ceiling-edge-stitched-clean-display_compress.png` (1,964,085 bytes, 6144 x 6144, 8-bit **palette of 256 colours**,
no alpha, sRGB/gamma 2.2 tags like the master) vs the approved 16-bit master (36,331,809 bytes, 38,509 colours after the
approved 8-bit dither). No display transform was re-applied; both source PNGs are unchanged.

Decoded pixels vs the 16-bit master: palette PNG RMSE 1.76 (43.2 dB), max 35.7 levels, 33% of texels off by > 2 levels,
9.9% by > 4, 1.2% by > 8 (current 8-bit input: 0.49, max 1.5, none > 2). Errors form contour bands over the plaster, cove
and LED strips; dark gradients posterise; warm edges shift colour (e.g. blue −35). Evidence: `docs/restoration/6k/ceiling-png-test/`.

KTX2 (identical basisu settings, palette PNG fed directly without the 8-bit re-dither): 4,500,207 bytes vs current
9,686,587 (−53.5%, all from the PNG). Encoder-only alternatives on the approved master: RDO 1.0 / 2.0 / 4.0 =
9,385,390 / 9,262,040 / 9,191,547 (−3 to −5%). Decoded GPU texture vs master: current BC7 0.64 RMSE (52.0 dB, 0.12% > 4 levels),
candidate BC7 1.77 (43.2 dB, 10.1% > 4 levels); ASTC alike.

Website (headless Chrome, same build, fresh URL, 1120 x 630, deterministic — restored build is pixel-identical to the
before captures): candidate changes 2.6% of pixels by > 2 levels at the opening, 11.7–16% in orbit views and 40% in a close
crown view (max 21–23 levels), with visible stipple on flat plaster and contour rings across the ceiling. Rejected; the
current `ceiling-surface-edges-6k.ktx2` stays active (backup: `D:/CodexOutputs/Restoration_6K_20261024/backup/theatre-ceiling-6k-current/`).

Side finding (not applied): rounding the approved master to 8 bit *without* dither gives a 4,834,694-byte KTX2 (−50%)
with ≤ 0.5-level error and almost no on-screen change (≤ 1.4% of pixels > 2 levels, max 7), but 4x-gain crops show
one-level contour steps in dark gradients that the approved dither prevents. Needs your visual approval before any use.
GPU memory is unchanged by any of these files (6144² UASTC → BC7/ASTC ≈ 48 MiB with mips); only download size differs.

Decision (2026-10-24, user): after comparing the undithered 8-bit candidate side by side in a separate preview (port 3001),
the user chose to keep the current dithered `ceiling-surface-edges-6k.ktx2`. The isolated preview copy was removed;
test encodes and evidence remain in `D:/CodexOutputs/Restoration_6K_20261024/theatre-ceiling/png-test/`.
