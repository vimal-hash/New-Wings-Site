# Opening asset scheduling — 25 October 2026

The user story is to open the existing theatre sooner on phone and laptop, with the accepted appearance and journey preserved. This pass changes request scheduling, not texture quality. All active textures remain at their existing resolutions (at most 2K). Selected 6K upgrades are a separate future decision.

## Change

- On Canvas creation, preload the opening theatre/model batch, ceiling model, projector model and motion, eligible sofa model, ceiling and left-wall atlases, and theatre/projector-floor atlases and UV sidecars. Previously several of these started only after the parent theatre model and its surface extraction; sidecar requests then waited for an entire atlas batch.
- Use the same loader constructor and exact ordered URL batches as each consumer. Fiber's Suspense cache is keyed by loader plus the full URL batch, so merging everything into a different preload batch would duplicate work.
- Configure one shared KTX2 loader and initiate its existing Basis wrapper/WASM downloads immediately. Keep the existing two-worker limit; this does not allocate an extra loader or worker pool. Texture processing and normal error propagation still use the loader's original initialization promise.
- Share the existing singleton projector motion promise between preloading and its component. No duplicate fetch or decompression.
- Preserve deferred corridor loading after the first opening render and the preceding theatre preparation cache. Do not request sofas for the floor-only view or when the feature is disabled.

No new bake, asset URL replacement, resolution change, GLB edit, UV edit, geometry edit, material adjustment, camera/animation change or loading-card timer change. No commit or external deployment.

## Verification

Production build (including TypeScript) and targeted ESLint pass. Focused tests cover exact cache batches and all opening texture/UV requests, repeated preload calls, floor-only sofa exclusion and later enable, corridor deferral, one decoder initialization, decoder failure observation, and one shared motion promise with failures still visible to its consumer.

Same-PC production browser measurements, milliseconds from navigation:

| Marker | Before | After |
| --- | ---: | ---: |
| Canvas created | 380.8 | 407.7 |
| Opening UV requests start | 1158.5–1216.0 | 410.5–413.6 |
| Basis JS/WASM requests start | 711.6–711.8 | 409.9–410.0 |
| Opening scene committed | 1238.9 | 1098.8 |
| Next-frame render estimate | 1310.0 | 1171.3 |
| Loading card removed | 1576.8 | 1587.9 |

These are illustrative mostly-cached localhost samples, not controlled cold-cache benchmarks. Transfer differs (12,000 versus 360,063 observed bytes, partly new build chunks). The card timing did not improve in these samples: its existing 500 ms snapshot polling remains. Do not present the earlier renderer estimate as a measured improvement on real mobile hardware or as a reduction in the loading-card time.

Both traces have exactly one expensive theatre preparation, six GLB load/parse jobs and 23 atlas load/processing jobs across opening plus background corridor, with no duplicate jobs per asset and zero captured errors. The new decoder initialization span runs once. Corridor requests still begin after the opening render estimate. Opening counts stay at 30 draw calls, 97,902 visible triangles and 23 textures / 37 geometries.

Same-camera ceiling, screen and seats/aisle crops are pixel-identical between the before/after JPEG captures (mean and maximum RGB difference zero). SHA-256 checks confirm all 88 model/texture/UV files are unchanged. The LAN URL returns HTTP 200 and loads the new build. Browser interactions verified orbit, projector particles, assembly/return, the screen transition and arrival at the corridor panel; the final outer-logo/page-return sequence was not exercised. The existing dependency warning about THREE.Clock remains; no new browser console errors were observed.

Evidence and reversible before-source copies: `D:/CodexOutputs/Opening_Loading_Improvement_20261025/`. Includes before/after exported diagnostics, LAN diagnostic, screenshots, timing-comparison.json, visual-comparison.json, protected-before.json, asset-verification.json and preload-tests.cjs.

## Real-device follow-up

Open http://192.168.1.5:3000/?diagnostics=1 on the phone. Wait for **Opening ready — save this report**, save once, reload and save again. Keep the tab visible and avoid manual scrolling until saving. There is no need to save before the automatic camera movement. Use the actual reports to judge the benefit before increasing selected surfaces to 6K.

## Actual-phone retest

Received two Android reports: first navigation `2-loading-report-1792904279557.json`, then reload `1-loading-report-1792904296365.json`. Chronological order differs from attachment numbering.

| Metric | Previous phone reports | New phone reports |
| --- | ---: | ---: |
| First navigation: loading card removed | 5.778 s | 5.768 s |
| Reload: loading card removed | 5.179 s | 3.756 s |
| First navigation: render estimate | 5.750 s | 5.573 s |
| Reload: render estimate | 5.126 s | 3.269 s |

First-load waiting is effectively unchanged. The reload is faster but caching conditions differ: previous reload transferred 16,868,461 opening bytes, while the new reload reports only 12,000 transfer bytes and reads asset bodies from cache/revalidation. Do not attribute the entire reload improvement to scheduling. Both new traces remain visible throughout, show zero errors, one expensive theatre preparation and no duplicate model/atlas processing jobs. One legitimate preparation takes 905.8 ms on first navigation and 1,218.3 ms on reload; those costs remain.

The fresh-download report identifies a request-priority issue on the local HTTP/1.1 server. The theatre GLB body finishes at 653.4 ms, but its small Draco wrapper and WASM requests queue behind the concurrently requested assets: wrapper start 702.3 ms / actual requestStart 2,823.3 ms, WASM start 702.6 ms / actual requestStart 2,859.4 ms. They finish at 2,931.8 and 2,934.8 ms. This is over 2.1 seconds before the requests are sent, not two seconds of decoder CPU. The projector GLB likewise starts at 642.2 ms but its request is sent at 2,561.8 ms, finishing at 4,172.9 ms; its processing callback completes at 5,197.2 ms. These intervals overlap and must not be added.

Next targeted investigation: prioritize decoder dependencies and critical model requests before bulk texture requests, while retaining parallel UV/texture preparation and deferred corridor loading. This follow-up has not been applied as part of reviewing these reports. Keep the accepted image quality and use a comparable fresh-download phone trace to verify any subsequent change.
