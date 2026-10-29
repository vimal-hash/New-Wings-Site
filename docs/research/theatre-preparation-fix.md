# Theatre preparation retry fix — 25 October 2026

The user story: open the existing theatre, prepare its restored surfaces without repeating expensive extraction during initial Suspense retries, display the same appearance and preserve the projector/corridor journey.

## Cause and change

The mobile traces showed 13 calls to “Construct theatre surface geometry” before the opening commit, totaling 14.78 s and 14.76 s of synchronous CPU work. Initial Suspense retries discard React's uncommitted useMemo state. Keeping preprocessing only in that memo allowed repeated full scans/extraction while child texture/model requests resolved. The returned model-array identity was also an unsuitable dependency for preparation.

Only components/corridor/scene.tsx and the new theatre-preparation.ts implementation changed. A nested WeakMap, keyed by both loaded source scene identities, now retains the prepared CPU-only template across retries. New source models get a fresh template. Failed preparation is not cached. Each mount receives independent scene objects and copies of all owned geometry; baked UV attachment and mount cleanup cannot mutate/dispose the canonical template or another mounted route. Original material sharing and the hidden platform source-node ownership are preserved. useMemo now depends on stable source scene identities.

The cache does not skip the original triangle-count/matching checks. No GLB, texture, UV sidecar, extraction algorithm, UV algorithm, normal, transform, camera, animation, resolution, light or loading boundary changed. There is no new bake or network asset. A CPU template remains available while its model pair remains in the existing loader cache; weak keys permit collection when the model identities are released. Cheap per-mount cloning can still occur on an uncommitted retry; the expensive preparation runs once. The outer “Clone prepared theatre for mount” diagnostic span includes the first preparation, so its time overlaps the inner construction span and must not be added to it.

## Verification

- Production build / TypeScript and targeted ESLint pass.
- Ownership/cache test: 13 simulated retries build once; changing either model identity rebuilds; failure can be retried; per-instance UVs, positions and normals remain isolated; transforms/materials/visibility match; disposal does not affect source/template geometry.
- Production diagnostic browser: one expensive preparation, 246 ms. First opening render estimate 1.334 s, loading-card removal 1.598 s. Earlier desktop sample was 4.597 s / 4.618 s with 14 preparations totaling 3.696 s. This is an indicative localhost comparison with cached resources, not a controlled cold-device benchmark or a promise for the phone.
- Browser checks: orbit movement, projector particles/assembly and return, then scrolling into the corridor all worked without console errors. The deferred corridor committed normally. This did not exercise the final outer-logo/page-return sequence.
- Browser reported no errors and 75 active FPS. Opening counts remain 30 draw calls, 97,902 visible triangles and 23 textures / 37 geometries.
- Same-camera screenshot comparison: ceiling, screen/stage and seats/aisle crops were pixel-identical to the pre-fix JPEG screenshot (mean RGB difference 0). Screenshots include the unchanged accepted 2K look.
- All 88 protected model/texture/UV files match their pre-change SHA-256 hashes.

## Real-device follow-up

Retest the phone first at http://192.168.1.5:3000/?diagnostics=1. Wait for Opening ready and save a report; reload and save again. No need to beat the automatic camera movement. Keep the tab visible and avoid manual scrolling until saving. Laptop measurements can follow afterward as the user requested.

Evidence: scene-before.tsx, protected-before.json, asset-verification.json, cache-tests.cjs, desktop-after-first.json, after-opening.jpg in D:/CodexOutputs/Theatre_Preparation_Fix_20261025/. Nothing committed or externally deployed.

## User mobile retest

The actual-phone reports confirm the fix: opening loading-card removal is 5.778 s on first navigation and 5.179 s on reload, compared with 17.284 s and 17.317 s before. The expensive preparation runs exactly once in both reports, taking 984.8 ms and 1,144.3 ms rather than approximately 14.8 s of repeated work. No errors or hidden-tab intervals were recorded. Cheap clone spans still occur during initial retries, as designed; their totals include the one-time preparation and overlap its span.

Both reports record about 16.87 MB of opening resource transfer, including the reload. Remaining costs include resource requests, texture processing/queueing and one legitimate geometry preparation. These overlap and must not be summed. A caching/request investigation is a possible subsequent step; it was not changed or diagnosed by this fix. Next requested evidence is the laptop's first-load and reload reports.

## User laptop retest

Chronological order is the reverse of the attachment numbering. Both navigation entries are reloads, so these are not labeled controlled cold/warm benchmarks. The earlier capture opens in 3.631 s with about 16.92 MB observed transfer; the later capture opens in 3.102 s with only 12,000 observed transfer bytes due to cache/revalidation. Both perform the expensive theatre preparation once, taking approximately 495 ms and 493 ms, and record no errors or hidden-tab intervals. The saved file paths are listed in laptop-after-summary.json.

This confirms that the repeated preparation is fixed on both actual target devices. Remaining laptop waiting persists even when most assets are cached. KTX processing spans reach approximately 1.2 s including worker queue/init and callback scheduling; some heavy requests begin about 1.2 s after navigation. These point to processing and request scheduling as subsequent investigation areas. No additional application change was made during report review.
