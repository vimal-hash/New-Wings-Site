# Loading diagnostics — 25 October 2026

Open http://192.168.1.5:3000/?diagnostics=1 on the actual laptop and phone, connected to the same local network as this PC. Keep this PC/server on. Wait for “Opening ready”, without scrolling or switching tabs. Click Save report. Reload the same URL, wait and save a second report. Send both reports per device (four files total), identifying which device each pair came from. If downloads are inconvenient, a screenshot of the diagnosis panel is a useful first step, but the JSON contains the detailed trace.

This is measurement, not a speed fix or a countdown. The normal URL has no diagnosis panel or loader/renderer instrumentation. No asset, camera, animation, render quality, cache policy, resource priority, or Suspense boundary was changed. No extra shader compile, texture upload or GPU synchronization was introduced.

The opt-in recorder captures navigation and resource timing (including buffered early requests), instrumented loader load/parse callback spans, KTX transcode output format/dimensions, synchronous surface/material construction, projector motion fetch plus streamed decompression, existing compileAsync calls, initial render submissions, an opening next-frame paint opportunity, loading-card removal, deferred-corridor readiness, visibility and errors. Browser long tasks are observed when supported. Save report downloads a local JSON; nothing is uploaded. Query strings/origin are omitted from resource paths in the export.

Caveats: overlapping spans must not be added together. GLB parse includes decoder/dependency work; KTX processing includes worker startup/queue time and main-thread callback delays. No claim of isolated worker CPU time is made. Render spans measure CPU/driver submission, not GPU execution. A next animation frame is a presentation opportunity, not proof that the physical display painted. Timing/byte availability varies by browser; cache revalidation may report about 300 transfer bytes for a much larger stored asset. The opening transfer figure includes observed relevant resources ending before the opening render estimate; it is not the asset-budget file size. Font/CSS and browser overhead can differ. Limits: 2,000 resources/spans, 1,000 long tasks, 50 errors; long-task observation stops after two minutes. Do not run multiple heavy WebGL tabs while measuring.

## Checks

- Production build/TypeScript and targeted ESLint: pass, no warnings on edited files.
- Recorder tests: disabled mode leaves loaders alone; loader callback/return identities preserved; GLB/KTX callback indexing, sync failure/error callback paths, texture metadata, renderer invocation count, overlapping timing boundaries and cache/deferred-resource accounting pass. Test script is outside the project in this evidence folder.
- Production browser: opening and deferred corridor load, report downloads parse as JSON, no console errors. Existing Three.Clock deprecation warning remains.
- Normal URL: no diagnosis panel; opening appearance and renderer counters verified.
- LAN URL: HTTP 200 from this PC; actual laptop/phone require the user test above.
- All 88 protected model/texture/UV files checked against their pre-change SHA-256 hashes: unchanged.

## Preliminary desktop evidence — not the user's devices

First observed report used a mixed/warm cache: opening scene commit 4.499 s, next-frame estimate 4.597 s, loading card removed 4.618 s. Fourteen repeated theatre surface construction spans totaled 3.696 s of synchronous CPU work. UV sidecars started around 3.15 s, after atlas processing had already begun, with the projector-floor sidecar starting around 3.73 s. This is a strong optimization lead, not a diagnosis of the entire real-device 18-second wait.

An isolated repeat load showed opening scene commit 4.33 s, render estimate 4.40 s, loading card removed 4.56 s, with only about 0.01 MB observed opening transfer due to cache. Thus this desktop's remaining wait is not predominantly fresh downloading. No fix was applied in this diagnostic pass. Compare real-device traces before changing the pipeline.

Evidence: desktop-report-first.json, desktop-report-repeat.json, trace-tests.cjs, protected-before.json, asset-verification.json, diagnostic-panel.jpg, and before/ source snapshots in D:/CodexOutputs/Loading_Diagnostics_20261025/. Server is the production build on port 3000, bound to the existing LAN interface. Nothing committed or externally deployed.
