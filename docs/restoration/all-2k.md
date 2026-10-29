# All baked textures capped at 2K

Completed 2026-10-25; preparation started2026-10-24.

All23 active baked textures are2048px or smaller on their longest side. Eight larger textures were replaced: theatre left/right walls, ceiling, moon steel borders, corridor left/right walls, corridor floor, and terraces. Terraces preserve their2:1 layout at1024x2048. Existing2K and smaller textures unchanged.

| Surface | New dimensions | New KTX2 bytes |
|---|---|---:|
| left-wall | 2048 x 2048 | 1,680,069 |
| right-wall | 2048 x 2048 | 1,164,679 |
| corridor-wall-red | 2048 x 2048 | 820,372 |
| corridor-wall-connecting | 2048 x 2048 | 872,645 |
| corridor-floor | 2048 x 2048 | 708,554 |
| ceiling | 2048 x 2048 | 723,939 |
| moon-steel-border | 2048 x 2048 | 1,249,187 |
| terraces | 1024 x 2048 | 281,130 |

Opening scene assets42,832,682 ->18,011,248 bytes. Deferred corridor11,468,009 ->4,273,900 bytes. Total scene assets54,300,691 ->22,285,148 bytes, about59% smaller. Totals include inventoried models/motion/UV/bake files, excludingJS/decoderWASM/fonts/HTTP overhead. GPU storage also falls with resolution.

Derived from the latest accepted PNGs using Lanczos3; RGBPNG intermediates and UASTC effort1, RDO0.25/dictionary4096, sRGB box mipmaps to4px, zstd19. No rebake, extra display transform or palette reduction. Smaller textures retain the general appearance at the opening camera but have less fine detail at close range.

Verification: production build including TypeScript passes; all23 active texture headers are at most2048px; all mip payloads validated; eight new LAN responses match file hashes; all19 GLBs and every pre-existing public texture/UV file remain byte-identical. Only three texture manifests and asset-budget.json changed, plus eight added textures. No loading or camera code changed in this pass. Full projector assembly/return and corridor journey reached the endpoint with no browser console errors.

Single localhost desktop sample: first frame3.69s,75FPS,13.3/13.5ms frame/p95 at1280x720. This is not a prediction for the user laptop or phone. Real-device loading still requires user testing.

Source and active texture backups are in D:/CodexOutputs/All_2K_20261024/backup/. Original manifests, baseline hashes, source paths, encoding logs, screenshots and verification.json are stored in the parent folder. before-opening.jpg and after-opening.jpg use the same opening camera. after-corridor.jpg records endpoint verification. Original6K/4K authoring sources are preserved outside public. No commits/deployment or multi-angle baking.

Preview: http://192.168.1.5:3000/.
