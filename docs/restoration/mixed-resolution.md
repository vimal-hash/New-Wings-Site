# Mixed-resolution baseline and background corridor loading

2026-10-24. No commits or deployment. Active preview: http://192.168.1.5:3000/.

## Active resolutions

| Surface | Resolution | Texture bytes |
|---|---:|---:|
| left-wall | 4096 x 4096 | 6,654,528 |
| right-wall | 4096 x 4096 | 4,811,180 |
| floor-slab | 2048 x 2048 | 679,508 |
| corridor-wall-red | 4096 x 4096 | 3,350,186 |
| corridor-wall-connecting | 4096 x 4096 | 3,412,048 |
| Theatre ceiling | 6144 x 6144 | 4,138,235 |
| Moon steel border | 6144 x 6144 | 12,376,809 |
| Corridor floor | 6144 x 6144 | 5,964,611 |

Five changed textures: 43,769,147 -> 18,907,450 bytes; saved 24,861,697 bytes. All scene model/motion/baked texture/UV assets: 82,293,553 -> 57,431,856 bytes (30.2% reduction). Opening requests 42,832,682 bytes, with 14,599,174 bytes loaded in the background after the first opening frame. These totals exclude JS, decoder WASM, fonts and HTTP overhead; gzip motion size used for supported browsers. Loading card now uses this inventory, instead of the incomplete previous number.

## Method and visual review
Smaller images were derived from the latest user-compressed 6K PNGs to preserve the accepted palette and the new corridor left-wall fill. No rebaking or source alteration. Four walls use 4096 square textures; theatre slab uses 2048 square. A 4096 slab candidate is kept outside public as an alternative. Existing UV layouts preserved. Sharp Lanczos3 downsampling into RGB PNG without another palette reduction; UASTC effort1, lambda0.25, dictionary4096, zstd19, sRGB box mipmaps to4px. Opening screenshot compared with previous all-6K scene: very close at the normal camera, with less available fine detail on close inspection as expected. Theatre floor is dark and smooth; 2K was retained for the normal journey.

## Loading change
The opening theatre/projector/sofas retain one complete Suspense boundary. Corridor geometry has a separate boundary that starts after the opening first frame. Its atlases and UV sidecars are preloaded in parallel with its GLB. A queued camera transition holds before the screens/corridor approach until corridorReady is published after the full subtree commits. A status message explains any wait; it resumes automatically when ready. Existing camera paths, shot timings and animation data were not changed.

## Verification
Production build, TypeScript and targeted ESLint for all five touched TSX/TS modules pass. Opening, orbit, projector assembly and full corridor journey render without console errors. Deliberate slow-asset proxy test: theatre appeared with5/6 models, pending approach displayed Loading corridor, then resumed automatically and reached endpoint when assets completed. Final parallel-preload build also completed the journey with a20s delayed corridor model. Proxy timing logs and screenshots retained here; test server is stopped after testing.

Single desktop normal-load sample: first opening frame4.90s, active75FPS, frame/p95 13.3/13.6ms at1280x720. Local/cache-dependent, not a controlled improvement versus the user-reported25s or a real-phone benchmark. The browser viewport override did not take effect (it remained1280x720), so no phone-viewport or real-phone validation is claimed.

All19 GLBs, all pre-existing texture files, UV sidecars and excluded manifest entries unchanged, including ceiling/moon steel/corridor floor6K and10 corridor lights. Only the five approved URLs/byte/imageSize entries change. Source texture backups and source code snapshots stored outside public in this directory. Estimated GPU texture memory saved by replacing five6K textures with four4K plus one2K: about149MiB on BC7/ASTC4x4; three requested6K surfaces still carry their original memory cost.

## Multi-angle plan — not implemented
Keep this single-bake baseline first. Later test moon steel, corridor floor and corridor left wall individually using a small set of additional views. Offer optional higher quality on capable machines, load extra atlases only on demand, blend smoothly without abrupt appearance switching, and retain this lighter default. No multi-camera bakes or new appearance-switching branches were added.

## Artifacts
D:/CodexOutputs/Mixed_Resolution_20261024/ contains report.json, baseline.json, verification.json, asset-inventory.json, code.diff, source/texture backups, resize/encode logs, screenshots and a4K slab candidate. Reproduce preparation via D:/CodexOutputs/prepare-mixed-resolution.cjs and activation via D:/CodexOutputs/apply-mixed-resolution.cjs; do not rerun them over later changes without a fresh baseline.
