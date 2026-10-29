# WebGL loading research — 25 October 2026

Research only. No application code, models, textures, camera behavior or timers were changed.

## Decision this research supports

Keep the accepted 2K appearance while measuring the full startup path. Do not reduce visual quality again merely because the user still sees an 18-second wait. File transfer, asset decoding, scene construction, GPU preparation and the moment the loading overlay disappears are separate stages. This investigation identifies useful engineering patterns; it does not establish which stage causes this project's delay.

The most useful next step is the diagnostic timer, followed by a fix for the measured bottleneck. It should report real elapsed stages, not impose a countdown or minimum wait.

## What was examined and what was not measured

- Both requested live sites: rendered scenes, a scroll transition on Active Theory, and opening a book/sample in Interaction Library.
- Public HTML, JavaScript, asset inventories and selected binary assets. Source was read as data, not run through a shell.
- Seven official pmndrs examples: application/model code, loading boundaries, render settings and model binaries. Source snapshots were saved; two larger demos were also opened in the browser.
- Two author-written Awwwards case studies: Igloo Inc and Summer Afternoon.
- A larger open-source world outside the Awwwards catalogue: Bruno Simon's 2025 portfolio repository, including its loader, main initialization, quality system, renderer and material system.
- Current R3F performance documentation and Three.js texture/shader documentation.

Exact byte counts below are fetched file/body lengths or GitHub repository blob sizes, not total browser transfer. HTTP gzip, runtime choices, decoder/WASM downloads, fonts, sounds, other scenes and caching can change actual traffic. A public inventory can contain unused files and alternate encodings: it is not a network waterfall.

No controlled cold-cache phone/laptop benchmark of the reference sites was available in this browser interface. Therefore this report makes no claim that a reference loads in a specific number of seconds, or that its entire experience is smaller than ours. Proprietary authoring tools, server code and complete private source are unavailable. Public source snapshots can differ from deployed revisions.

Evidence directory: `D:/CodexOutputs/WebGL_Research_20261025/`.

## 1. Active Theory

Live: https://activetheory.net/
Public entry source inspected: https://activetheory.net/assets/js/app.1780406240914.js
Public scene configuration: https://activetheory.net/assets/data/uil.1780406240914.json

### Actual implementation observed

The public bundle contains the Hydra framework, custom geometry loaders, shader/texture systems, worker image decoding and state-driven scene components. This is not an R3F application. Active Theory's team describes its state-based WebGL framework in its [Communication Arts interview](https://www.commarts.com/webpicks/active-theory-2). Its earlier v5 interview names Hydra explicitly; that historical interview is not evidence of every feature in the current revision: https://www.webbyawards.com/crafted-with-code/active-theory/.

The current bundle exposes custom `.bin`/`.json` geometry and texture inventories. It includes Cycles combined-bake maps, normal maps, packed MRO maps, KTX2 variants, particle data and bespoke shaders. It is not simply exporting a complete high-resolution Blender render onto every surface.

`Tests` selects quality by GPU tier: particle counts, DPR, bloom, volumetric light and some interactive features vary. Particle configurations range from 16,384 to 1,048,576 in the relevant function. This describes configured limits, not measured simultaneous visible particles.

`FXScroll` sorts scene initialization around the route. The first scene uses synchronous preparation and announces `FXScroll/firstScene`; other scene preparation can use the asynchronous upload path. `Initializer3D.uploadAllAsync` collects textures, geometry and shaders, then distributes upload work with a render worker. Loader readiness includes GPU/world/UI/scene milestones beyond file counts. The generic AssetLoader has a two-request split, but other loaders exist; do not interpret that as a global two-request limit for the entire site.

### Independently fetched samples

| Public asset | Bytes | Dimensions / interpretation |
|---|---:|---|
| Main app JS | 1,817,616 | Identity body; not gzip browser transfer and not whole site |
| UIL configuration JSON | 223,372 | Configuration only |
| Tree-room walls/ceiling combined bake KTX2 | 57,497 | 1024 × 1024, 11 mip levels |
| Matching normal KTX2 | 32,846 | 1024 × 1024, 11 mip levels |
| Room floor geometry `.bin` | 353 | One primitive-like custom geometry asset; not whole room |

The sampled KTX2 headers use BasisLZ supercompression (ETC1S path). Our current bakes use UASTC with Zstd. Both can be KTX2 while having different download/quality/transcoding tradeoffs. This is a reason to test encoding by content later, not proof that ETC1S preserves our dark gradients equally well.

The wall bake and normal URLs are in `measured-reference-assets.json`. They demonstrate that visually rich environments can use modest individual map resolutions; they do not prove all Active Theory textures are 1K. The inventories list both source/alternate representations and many scenes. Their sums must not be presented as initial download size.

Response headers showed a CDN cache hit and one-hour caching for the sampled app/data. Browser-visible evidence showed a particle-rich logo scene and a continuous visual change after scrolling. It does not reveal an end-to-end cold-load time.

**Apply to us:** track actual scene readiness, prioritize the opening scene, prepare later scene resources in controlled background work, and measure texture transcoding/upload separately. Keep the Blender appearance; adopting Hydra would be a costly rewrite with no measured justification.

## 2. Interaction Library — Jungik Lee

Live: https://library.jjangik.kr/
Public entry: https://library.jjangik.kr/shelf.js?v=311
Registry: https://library.jjangik.kr/interactions/registry.js?v=91

### Actual implementation observed

The import map uses standalone Three.js 0.160.0, alongside GSAP 3.12.5. The inspected shelf code has no GLTF loader, `.glb` reference or iframe. The room/shelf is constructed using primitives, rounded boxes, shapes and generated canvas textures. Canvas functions draw wood grain, paper, labels and details. Some artwork remains external images. This explains why its rich room appearance does not require our kind of full-surface Blender bake bundle.

The renderer caps DPR at 1.5, uses antialiasing, PCF soft shadow maps and ACES tone mapping. Generated canvas texture sizes found include 256 × 256, 512 × 512, 1024 × 256, 512 × 1024 and 2048 × 1024. Those are code call sites, not an exhaustive count of allocated runtime textures.

The registry exposes 11 independent sample modules via dynamic import. Important correction: dynamic import does not mean everything is deferred until a click. In the desktop startup path, code prefetches all sample modules and then mounts/prepares samples before declaring readiness. The lite path (coarse pointer, narrow viewport or explicit lite flag) avoids that full preparation path and prefetches modules later. Fonts have a bounded initial wait. Samples can be unmounted and reconstructed.

The curtain sequence tracks preparation milestones. The code has font/time guards; this is useful scheduling evidence, not a guaranteed 2.5-second total load limit. Much work is procedural and still costs CPU/GPU time even when it has no downloaded texture file.

### Measured files

| File | Bytes | Note |
|---|---:|---|
| Shelf JS | 143,126 | Identity body; excludes vendor libraries |
| All 11 sample entry modules combined | 84,344 | Excludes their imports, images and other assets |
| Three.js module HTTP response | 166,366 | Gzip body |
| GSAP HTTP response | 28,109 | Gzip body |
| Observer HTTP response | 4,265 | Gzip body |
| Window-seat artwork WebP | 149,522 | External image |
| Clock words PNG | 66,025 | 1024 × 1024 |
| Rug words PNG | 58,885 | 2048 × 1024 |

The main site rendered as a lit wooden bookcase; selecting Drag opened an interactive book spread. The creator's visible descriptions identify a mix of DOM/GSAP, Three.js/GLSL and Canvas 2D samples.

**Apply to us:** separate interaction modules, use a lighter startup strategy for constrained devices, and consider reusable/procedural material detail for future assets where it preserves the design. Rebuilding the approved theatre procedurally would not automatically match Blender or solve the current delay. Do not copy this site's desktop prepare-everything path indiscriminately.

## 3. Seven R3F examples — source and binary inspection

Sources are the official [pmndrs examples repository](https://github.com/pmndrs/examples/tree/main/examples). Inspected gallery snapshots use Fiber 9.8.2, drei 10.7.9, React 19.2.9 and Three 0.186.1; original demo publication dates are older. Binary sizes were checked against repository metadata and downloaded files. Model size excludes JS, environment maps, fonts and decoder runtimes.

| Example | Geometry asset bytes | Actual implementation | Useful lesson / limit |
|---|---:|---|---|
| Progressive loading with Suspense | High 10,794,984; low Draco 5,524 | Nested Suspense displays low model while high resolves | A small fallback can show early; total high download still occurs |
| Reusing geometry and LOD | Four loaded levels total 566,156 | 800 objects share cached resources; distance switches between four meshes and far empty group; demand rendering | LOD controls render cost; all four levels are requested up front |
| GLTFJSX 400KB drone | 405,820 | Draco geometry, WebP embedded textures, three mesh definitions, shared materials | Good preprocessing; its small file is not a whole architectural scene |
| Merged Instance | 3,176,584 | Draco assembly; generated Merged/instances graph reuses recurring components; static shadow setup | Complex assemblies can use instancing without flattening authored hierarchy |
| Camera Scroll | 673,296 | GLB camera animation sampled from scroll; cached model/environment; seven mesh definitions | Keep camera motion numeric and avoid per-frame React state updates |
| Room with Soft Shadows | 428,436 | Draco + WebP room; 17 mesh definitions; performance monitor reduces soft-shadow samples | Adapt expensive effects instead of degrading all texture detail |
| Baking Soft Shadows | 38,031 glTF | AccumulativeShadows over 100 frames, eight randomized lights; generated repeating flakes normal texture | Some baking occurs at runtime and has startup/warm-up cost; different from our offline radiance bakes |

Source links:

1. https://github.com/pmndrs/examples/tree/main/examples/progressive-loading-states-with-suspense
2. https://github.com/pmndrs/examples/tree/main/examples/re-using-geometry-and-level-of-detail
3. https://github.com/pmndrs/examples/tree/main/examples/gltfjsx-400kb-drone
4. https://github.com/pmndrs/examples/tree/main/examples/merged-instance
5. https://github.com/pmndrs/examples/tree/main/examples/camera-scroll
6. https://github.com/pmndrs/examples/tree/main/examples/room-with-soft-shadows
7. https://github.com/pmndrs/examples/tree/main/examples/baking-soft-shadows

### What binary inspection adds

The drone embeds seven 1024-square WebP images. The room embeds 15 WebP images: eleven 1024-square and four 2048-square. Camera Scroll embeds seven 1024-square JPEG images. Small network files do not mean equally small GPU textures; JPEG/WebP typically decode to ordinary pixel textures, unlike GPU-compressed KTX2.

Merged Instance has 236 mesh definitions, seven materials and no embedded images. Accessor counts total about 1.72 million triangles across mesh definitions, before scene-graph instancing. That is useful evidence of a genuinely complex assembly, but not a measured on-screen triangle count or browser performance comparison.

The high bust and largest Draco LOD both describe 151,924 triangles; their sizes differ greatly. File encoding matters independently of triangle count. This is not permission to change our protected GLBs.

The drone CSS fades the canvas in over five seconds after a half-second delay. That is a concrete example of visual readiness differing from asset completion. Do not infer download speed by looking only at when a canvas becomes fully opaque.

Geometry sharing in the LOD example is not the same as GPU instancing: its separate meshes can still produce separate draw calls. Likewise, useGLTF.preload starts work earlier; it does not make bytes or decoder work disappear.

## 4. Larger experiences and work outside the R3F demo catalogue

### Igloo Inc — author case study, Awwwards

https://www.awwwards.com/igloo-inc-case-study.html

Abeto describes Three.js/Svelte with custom shaders, procedural ice assets and interactive particle volumes. Its team iterated in-browser while measuring low-end performance. For particles it built a compressed volume exporter instead of shipping heavy image slices. It also used custom geometry export and texture/shader loading strategies in initial and background preparation. The lesson is content-specific representations and scheduled preparation, not simply increasing or decreasing every map resolution. The article publishes no complete asset-size budget or reproducible cold-load result, so none is claimed here.

### Summer Afternoon — author case study, Awwwards

https://www.awwwards.com/summer-afternoon.html

This explorable landscape includes a character, collisions, sound, hidden objects and multiplayer. Vicente Lucendo describes Three.js/Svelte, BVH acceleration, procedural environment production and mobile/tablet optimization. He also describes custom geometry export and texture/shader preparation both initially and in the background. It is broader in world/interaction scope than our guided theatre, but its article does not provide comparable triangle or download totals. BVH addresses geometry query/collision work; adding it would not by itself accelerate our texture downloads.

### Bruno Simon's 2025 portfolio — full source inspection outside Awwwards

Live: https://bruno-simon.com/
Repository: https://github.com/brunosimon/folio-2025

The open repository makes this the strongest large-world code comparison. It uses Three.js WebGPU/TSL with a WebGL option and Rapier physics, rather than R3F. Its stylized palette/shader material design differs from our baked architectural look.

Specific code findings:

- `sources/Game/Game.js`: an explicitly small first resource batch initializes the intro. Rendering starts before the second major resource batch and dynamic Rapier import complete. The full world is subsequently assembled. This is a meaningful distinction between first visible content and full interactivity.
- `sources/Game/ResourcesLoader.js`: caches loaders and loaded URLs, reuses Draco/KTX2 loaders, starts resources in a batch concurrently, and resolves batch completion after callbacks. Loader completion is not a GPU-finished timestamp.
- `sources/Game/Quality.js`: mobile user agent defaults to lower quality; quality changes publish events. The inspected version does not prove automatic measured device benchmarking.
- `sources/Game/Rendering.js`: bloom mip count and postprocessing configuration vary by quality.
- `sources/Game/PreRenderer.js`: on high-quality WebGPU, a small cube-camera render temporarily exposes eligible hidden objects to prepare rendering. Blindly forcing every asset into our startup would increase work, so this needs selective application.
- `sources/Game/Materials.js`: shared palette and generated gradient materials rather than one high-resolution photographic map for every world object.

Measured repository examples: terrain compressed GLB 26,208 bytes versus its 730,120-byte uncompressed counterpart; terrain texture 350,064 bytes at 512 × 512; palette texture 1,504 bytes at 128 × 4. Both sampled `.ktx` files actually have KTX2 container headers: extension alone does not identify the encoding. The larger areas compressed GLB is 639,312 bytes per repository inventory. These are selected files, not the whole world. Build environment variables select compressed/uncompressed paths, so repository alternatives must not be summed as deployment traffic.

The source supports staged loading and device quality as transferable patterns. It does not support replacing our stack with WebGPU as a proven cure for the existing wait.

## 5. What applies to our current project

Verified current asset budget: opening 18,011,248 bytes; deferred corridor 4,273,900 bytes; total 22,285,148 bytes. This is approximately 18.01 / 4.27 / 22.29 decimal MB, excluding application JS, decoder WASM, fonts and transport overhead. The current profile has 23 baked textures capped at 2K. The accepted higher-resolution source masters remain available outside the runtime.

Current code already has demand rendering, a DPR cap of 1.25, GPU-compressed bakes and deferred corridor loading. These are legitimate techniques also found in the references. Therefore the correct conclusion is not that everything built so far is wrong.

Read-only code findings worth investigating next:

1. Theatre, animated projector and sofas share an opening Suspense boundary. Work for a later projector section may participate in opening readiness. Measure this dependency before splitting anything; preserve animation timing and avoid holes/placeholders.
2. `baked-surfaces.tsx` requests atlas textures through one suspending hook, then UV sidecars through another. This can create a request waterfall when UVs are not preloaded. Confirm its real timeline; corridor preloading already starts both categories.
3. KTX2 is configured for two workers. More workers are not automatically faster on a phone. Measure queue/start/completion and chosen GPU format before tuning.
4. Baked-surface extraction and per-item geometry construction occur after resources resolve. Measure CPU construction separately from model transfer/decode.
5. The existing first-frame statistic and the user's visual waiting time may have different start/end points. Align both to navigation and record overlay removal explicitly. A draw-call count or smooth FPS after loading cannot explain startup latency.

These are hypotheses from source inspection, not established causes of the user's delay.

## 6. Diagnostic timer specification — proposed, not implemented

Record one continuous startup trace with navigation-relative timestamps. Overlapping stages must remain overlapping; do not add parallel durations together as if they were sequential.

| Stage | What it should establish |
|---|---|
| Document/application startup | Request start, server response, script arrival and application/canvas initialization |
| Asset download | Each model, texture, UV sidecar, motion data, font and decoder; request start/end, transfer bytes, cache/revalidation where available |
| Decoder initialization | Draco/Basis JS and WASM fetch/init, worker startup |
| Asset processing | GLB parse/Draco decode, KTX transcode and queued worker time, motion decompression |
| Scene construction | Surface extraction, UV attachment, material creation, projector initialization |
| GPU preparation | Shader preparation and texture/geometry upload work; distinguish CPU submission from true GPU completion |
| First visible frame | Browser-presentable opening frame with required surfaces ready |
| Overlay removal / interaction ready | What the visitor actually experiences as finished loading |
| Deferred corridor | Separate background trace and any camera wait at the transition |

Run cold and warm cache separately on the actual laptop and phone via the same LAN URL. Record connection, browser, viewport, texture profile and failures. Localhost desktop timings and mobile viewport emulation are not real-device measurements. Use repeat runs rather than one best result.

Only after that: change the largest measured blocker, retest visual integrity and loading time, and keep the change if it improves the actual target device. Potential outcomes include parallelizing existing requests, moving later assets off the opening boundary, warming decoder dependencies earlier, or scheduling GPU work. The trace decides which is justified.

Multi-angle bakes stay a later optional feature for capable computers. Adding those now would increase assets/processing and make this diagnosis harder.

## 7. Primary technical references

- R3F scaling performance: https://r3f.docs.pmnd.rs/advanced/scaling-performance
- Three.js KTX2Loader: https://threejs.org/docs/pages/KTX2Loader.html
- Three.js WebGLRenderer and compileAsync: https://threejs.org/docs/pages/WebGLRenderer.html
- Active Theory current public app and UIL URLs above; interviews provide context, not timings.
- Jungik Lee current shelf/registry source URLs above.
- Official pmndrs source folders and Bruno Simon repository above.

KTX2 still needs decoding/transcoding and GPU preparation; the container alone is not a zero-work runtime format. Three.js documents compileAsync for asynchronous shader preparation, but it should be tested against our actual readiness path rather than added as an unconditional extra delay.

## Reproduction and evidence

`fetches.json`: raw response headers and fetched entry lengths. `measured-reference-assets.json`: exact selected URLs, sizes, KTX dimensions. `r3f-file-inventory.json`: repository file metadata. `parsed-glb-inventory.json`: fetched GLB mesh/material/texture/triangle inspection. `examples-tree.json` and `bruno-tree.json`: captured repository trees. `r3f-source/` and `bruno-source/`: relevant source snapshots. `library-samples/`: the 11 registry entry modules. Reference screenshots are saved beside these files. Source scripts and assets are research evidence only; none were placed in public or reused in the website.

No complete external network waterfall, private source recovery, exact aesthetic equivalence or 100% performance prediction is claimed.
