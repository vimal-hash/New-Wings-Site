# Critical model request priority — 25 October 2026

The user story is to reduce the phone's initial theatre wait while keeping its accepted appearance, models and journey. The preceding parallel-preload pass left first navigation essentially unchanged at 5.768 s, and its phone report identified critical requests queued behind atlas transfers on the local HTTP/1.1 server.

## Evidence and implementation

Before this change, the phone initiated Draco wrapper/WASM loads at 702.3/702.6 ms but sent the requests at 2,823.3/2,859.4 ms: over 2.1 s queued. The projector model started at 642.2 ms, was sent at 2,561.8 ms and finished at 4,172.9 ms. These intervals overlap; they are not independent CPU costs.

`CorridorExperience` now uses React DOM's documented render-time `preload` API, emitting initial-HTML hints for the existing Draco Wasm wrapper, Draco Wasm binary and projector GLB. Each uses `as="fetch"`, anonymous/same-origin credentials and high fetch priority. The JS wrapper is fetched as data, not executed as an extra script. Three's original loaders consume those responses; no custom decoder, new pool, copied response buffer, alternative asset URL or private loader API is introduced. The existing non-Wasm decoder fallback remains unchanged.

The canvas preloader also queues the existing exact GLB batches, singleton motion promise and eligible sofa model before the larger atlas requests. UVs and atlases still start together without waiting for model parsing. The corridor stays deferred until the opening's render estimate. Loader cache keys, model batches, feature gating, texture worker count and preparation cache remain intact. There is no artificial timer or model-completion gate.

## Verification

- Production build (including TypeScript), targeted ESLint and existing preload/motion/cache tests pass.
- Actual production HTML on `/`, `/theatre` and `/theatre/floor` contains exactly one correctly configured hint for each of the three critical resources. React serializes anonymous CORS as `crossorigin=""`, which is equivalent to anonymous.
- A fresh browser origin (`127.0.0.1:3000`) downloaded approximately 16.92 MB of opening resources. Its three critical requests started at 36.3 ms and were sent at 46.2/46.2/46.5 ms; first atlas requests began at 399.5 ms. Each critical resource has one successful resource entry and a full body transfer, with no credential mismatch or unused-preload warnings.
- Full trace: six unique model load/parse jobs, 23 unique atlas load/processing jobs across opening plus deferred corridor, one expensive theatre preparation, one Basis initialization and zero captured errors. Opening counts remain 30 draw calls, 97,902 visible triangles and 23 textures / 37 geometries.
- Fresh-origin desktop opening commit 1.138 s, render estimate 1.213 s, loading-card removal 1.649 s. These are local desktop measurements, not a measured phone improvement or a controlled before/after mobile benchmark.
- Ceiling, screen and seats/aisle crops match the preceding accepted build pixel for pixel. All 93 protected model/texture/UV/decoder files are SHA-256 identical. Only the experience's preload hints and the opening preloader's queue order changed.
- LAN preview responds on port 3000. Browser projector controls respond; deferred corridor committed. Existing THREE.Clock dependency deprecation warning persists. No new errors observed. The complete outer-logo/page-return sequence was not retested.

No GLB, texture, UV, geometry, material, normal, camera, animation, loading-card timer or quality change. All textures remain at their existing resolutions (at most 2K). No commit or external deployment.

Evidence, before-source copies, exported fresh-download diagnostic, image comparison, source diff and reproducible verification script: `D:/CodexOutputs/Opening_Request_Priority_20261025/`.

## Phone follow-up

Use a new private/incognito tab for http://192.168.1.5:3000/?diagnostics=1 to obtain a fresh-download measurement. Keep it visible, wait for **Opening ready**, save a report, reload in that same private tab and save again. Automatic camera movement does not prevent saving. Compare actual resource transfer/cache state as well as total time; do not attribute a cached reload improvement entirely to this scheduling change.
