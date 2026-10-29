# User-compressed 6K PNGs converted to KTX2 — 2026-10-24

All seven user-supplied `_compress.png` files were converted directly to UASTC KTX2. No rebake, resize, added dither, display transform or geometry change. All remain 6144 x 6144. The ceiling now uses KTX2 again instead of the temporary direct-PNG loader.

| Surface | Original 6K KTX2 bytes | User PNG bytes | New KTX2 bytes |
|---|---:|---:|---:|
| left-wall | 15,526,561 | 11,246,874 | 13,694,560 |
| right-wall | 11,679,328 | 8,251,042 | 9,515,658 |
| floor-slab | 8,108,148 | 8,343,996 | 5,591,046 |
| corridor-wall-red | 9,533,171 | 12,994,105 | 7,384,866 |
| corridor-wall-connecting | 9,672,141 | 12,958,800 | 7,583,017 |
| corridor-floor | 8,842,184 | 8,154,159 | 5,964,611 |
| ceiling | 9,686,587 | 1,964,085 | 4,138,235 |

Original seven 6K KTX2 textures: 73,048,120 bytes. New seven: 53,871,993 bytes. Saved 19,176,127 bytes (26.25%). Immediately before this work, the ceiling used a 1,964,085-byte direct PNG, so the actual prior active seven total was 65,325,618; savings against that intermediate state are 11,453,625 bytes (17.53%). This is a seven-surface total, not total website download.

## Encoding and limitations
UASTC effort 1, RDO lambda 0.25, dictionary 4096, sRGB box mipmaps down to 12px, zstd 19. The original effort-3/dictionary-32768 encode was stopped because it took too long; no output from that cancelled attempt was applied. Encoder stats are preserved per item. The user PNGs already use a reduced palette; this is a lossy visual trade-off explicitly approved for ceiling and requested for testing on all seven surfaces. KTX2 cannot recover colours discarded by those PNGs. Fine banding or palette noise may be visible close up. No claim of pixel-identical appearance to the original high-bit-depth bake.

Estimated GPU texture storage for these seven remains roughly 336 MiB on BC7/ASTC4x4 (48 MiB each with mipmaps). Ceiling returns from about 192 MiB PNG storage to about 48 MiB compressed storage. No real-phone test performed.

## Verification
Production build including TypeScript passes; targeted ceiling ESLint passes. Strict baseline verification confirms all 19 GLBs and all original public model/texture files unchanged, excluded manifest items unchanged (including corridor lights), user PNGs unchanged, all seven HTTP responses hash-identical to their candidates, correct 6144 dimensions, UASTC/sRGB metadata and valid zstd mip payload lengths. Geometry/UVs/cameras/animation untouched. Only three ceiling/surface manifests, the ceiling loader and seven new textures changed or were added.

Matched opening screenshots and review artifacts: D:/CodexOutputs/User_Compressed_6K_20261024/. Previous active manifests and loader are saved there; per-target texture backups are in backup/. Original accepted KTX2 textures remain present but are not requested by the active manifests. Reproduction scripts: D:/CodexOutputs/encode-user-compressed-6k.cjs and D:/CodexOutputs/apply-user-compressed-6k.cjs. Source hashes and candidate hashes: report.json; integrity evidence: verification.json. No commits or deployment. Preview: http://192.168.1.5:3000/.

## Browser review
All 6 models loaded; theatre opening and full scroll sequence through projector assembly to corridor endpoint rendered with no browser console errors. Single desktop opening sample after encoding: 75 FPS, frame/p95 13.3/13.5 ms, first 3D frame 5.43 s on localhost. These are not real-phone measurements or controlled before/after performance benchmarks. Matched opening captures: before-opening.jpg and after-opening.jpg. Corridor after-corridor.jpg is an endpoint review, not a pixel-matched pair: the earlier before-corridor.jpg has the white panel at a different reveal stage.
