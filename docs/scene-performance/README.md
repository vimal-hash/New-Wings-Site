# Six-item performance and material pass

25 October 2026. Active project: `D:/New folio/new site code/new_site_three`.
Preview: http://192.168.1.5:3000/. Loading report: http://192.168.1.5:3000/?diagnostics=1.
No commit or deployment. This report supersedes the current-policy sections of the earlier scene-polish report.

## What changed

1. **Scroll pauses:** replace repeated whole-theatre ID searches with a shared geometry partition. Original triangle order, positions and normals are preserved. Thirteen extracted surfaces and the retained diagnostic index buffer were compared against the previous implementation using the actual decoded GLB. Projector vertex attributes are shared instead of deep-copied; two preallocated index buffers separate opaque parts from optics. Laptop/phone optics use coated transparency rather than a second full-scene transmission pass. In the inspected laptop projector view, render work fell from 77 calls / 1,078,456 triangles to 40 / 567,371. These figures include auxiliary rendering, not new model triangle counts.
2. **Loading:** opening models and base textures remain parallel requests. Computers first paint the 2K base scene, then refine the same four approved surface atlases to 6K at authored resting stops. Projector mounting, optional refinement and GPU texture uploads are scheduled serially after input settles, away from authored camera movement and formation. Corridor base requests still begin after the opening paints. Optional-detail failure keeps the base appearance. The four selected high-detail surfaces remain theatre ceiling/floor and corridor LEFT wall/floor; phones/tablets never select those 6K URLs. This trades a small extra base download and retained cache memory for an earlier complete scene; it does not reduce every final GPU allocation.
3. **Formation:** theatre illumination falls to 0.8% during formation, with a brighter local warm key, cool rim, floor light pool and one flash. Lighting stays coherent through assembly and recovery. Shadow updates are limited to about 15 Hz on computers / 10 Hz on phones. Desktop keeps its full particle program. Laptop uses 19,968 bounded, curved sampled streaks with tapered tails, rather than four nearly coincident copies. Count reduction only follows sustained slow frames. Mobile requests and renders **no flying particle field**; source materialization and exact assembly poses remain. The real mobile button says Reveal; the workstation's diagnostic override retains its desktop-UA button text.
4. **Projector finish:** keep source material colours and existing compressed maps. The lens has lower roughness, a subtle coating, clearer central visibility and stronger grazing highlights. Desktop retains physical transmission; laptop/mobile use a lighter transparent approximation. No claim of exact Cycles lens equivalence.
5. **Corridor LEFT wall:** clean the original 16-bit 6K bake within its two existing UV charts, preserving original gutters, warm reflections and sharp transitions. Remove the cool cast and low-contrast sampling noise, then encode a true 6K atlas and a 2K derivative. Disable the extra runtime dither on this wall. The existing UV sidecar, right wall, floor and ten light assemblies are unchanged. Architectural reflections in this bake remain fixed-view approximations.
6. **Moon glass:** keep live planar room reflections. Render a crop covering the visible mirror region instead of spending texture pixels on the full camera frame. Captures grow in bounded power-of-two buckets, avoiding target reallocation on every camera movement. Computer cap is 1024, phone cap 512. Projection, inverse projection and sampling matrices agree after cropping. Real reflected room contents can still include large pale cinema-screen areas; no replacement reflection photograph is used.

## Honest loading and pause measurements

The report was previously URL-gated, not deleted. Performance now always contains **Open loading report**. Browser cadence retains long foreground gaps; the old filtered FPS calculation excluded gaps of 250 ms or more. Worst pause and freeze count are visible, and exported reports record pauses over 50 ms with the journey phase. Background/hidden-tab gaps are excluded from freeze counts. Rendering still pauses at rest.

**Opening rendered** and **Opening camera settled** are separate. The authored 2-second hold and 2.5-second opening pullback happen after loading. They are unchanged and must not be presented as asset-download time. No artificial loading timer was added.

Workstation checks at 1280×720 on an RTX 4070, localhost/LAN with cached or mixed-cache resources:

| Program exercised | Opening paint opportunity | Camera settled | Worst browser pause | Pauses ≥250 ms | Errors |
| --- | ---: | ---: | ---: | ---: | ---: |
| Laptop override | 1.08 s | 5.58 s | 107 ms | 0 | 0 |
| Mobile override | 1.16 s | 5.67 s | 120 ms | 0 | 0 |
| Automatic desktop | 1.08 s | 5.59 s | 107 ms | 0 | 0 |

Laptop and desktop journeys were inspected through formation, assembly, return, side screens and the corridor panel. The mobile program was checked through reveal and assembly; its report contains **zero particle-cache requests**. Live reflections were inspected during a small orbit and camera travel. Desktop still recorded two shorter pauses, about 67 ms during pullback and 80 ms during reveal. This is improved work and instrumentation, not a claim of zero stutter everywhere.

The overrides change the effect program, **not** this workstation's GPU, UA or texture policy. Separate regression checks cover Android/iPhone/iPad detection and the 4096px GPU limit. These are not real-phone/laptop tests or cold-network loading measurements. The user's reported 7 seconds must be remeasured on those devices. CPU render submission and browser rAF do not isolate GPU execution or prove physical frame presentation.

## Files and transfer budget

New selected wall files, under `public/textures/corridor/wall-red/`:

| File | Bytes |
| --- | ---: |
| corridor-left-clean-2k-v2.ktx2 | 656,032 |
| corridor-left-clean-6k-v2.ktx2 | 3,782,309 |

Computer opening base assets are now **15,654,264 bytes**, previously 23,980,098. Selected 6K refinements add 19,476,201 bytes across the journey. Final requested asset totals are approximately 26.67 MB on phones, 47.37 MB on full desktop and 49.10 MB on the laptop effect path. Totals include models/textures/UV and motion/effect data, exclude JS/fonts/decoders/transport overhead, and are not VRAM estimates. GPU texture caches may retain both base and high detail; this pass primarily reduces startup dependency and draw/pass work.

## Verification and evidence

- Production build and TypeScript pass. Targeted ESLint passes on all changed runtime files; no claim about unrelated legacy lint.
- All 33 regression tests pass together, including the new mirror-crop, device-quality, geometry-partition, long-pause and page-return scheduling checks. ESLint passes across all 23 runtime files changed in this pass.
- Texture audit: 26 mappings, no invalid/out-of-atlas UV values or collapsed UV surface area. Existing chart anisotropy is reported; it alone is not evidence of visibly stretched source detail.
- SHA-256 audit: **all 123 pre-existing public files are unchanged**, including every GLB. No Blender scene was saved or rebaked.
- React review: stable surface lists, imperative frame metrics outside React rendering, effect cancellation, shared source-resource ownership, optional Suspense/error boundaries and texture cleanup reviewed.
- Final page-return testing found a scheduling deadlock: the covered `pageReturnLoading` phase waited for the projector while the idle queue refused to mount it. That phase now permits queued preparation; the moving `pageReturning` phase still defers background work. A regression checks critical-job priority and the movement gate. The corrected build was replayed through native-page scrolling, scene remount, page recession, slide ascent, turn and the full logo reveal without console errors; evidence is in `report-page-return-final.json`, `after-page-return.jpg` and `after-logo.jpg`.
- Next.js feedback pass: no qualifying framework issue retained. Application shader, geometry and measurement problems were handled locally.

Screenshots are actual 1280×720 browser captures. Before frames are the previous scene-polish output, matching the backed-up components for this pass. Opening, exploded, returned assembly and corridor comparisons use the same authored stops. Moving particle frames are approximate phase matches, not pixel comparisons. Diagnostic overlays can differ. PNG comparison sheets retain screenshot pixels; they do not turn the underlying JPEG capture into a higher-resolution image.

- [Opening / glass comparison](opening-comparison.png)
- [Projector and lighting comparison](projector-exploded-comparison.png)
- [Laptop formation comparison](laptop-formation-comparison.png)
- [Corridor wall comparison](corridor-comparison.png)
- [Close assembled lens](after-projector-close.jpg)
- [Mobile reveal without flying particles](after-mobile-reveal.jpg)
- [Machine-readable verification](verification-summary.json)

Reports, UV audit, integrity result and asset inventory are alongside this file. Full source inputs, encoding logs, reproducible wall cleanup and component backups are in `D:/CodexOutputs/Scene_Performance_20261025/`. Re-run `npm run build`, `node --test scripts/*.test.mjs` and `node scripts/audit-active-textures.mjs` from the active project. Leave the LAN server on port 3000 for physical-device review.

## Windows/ANGLE first-use stalls (2026-11-10)

Measured on Windows Chrome (ANGLE/D3D11) with GPU timer queries and Chrome GPU traces; fixes keep every look unchanged.

- Particle cache: one MRT pass forced a synchronous D3D pixel-shader compile (~3.4 s cold on laptop). It is now three single-output passes of one program (`projector-fx/particle-cache.ts`).
- Integer vertex attributes fed to float inputs (projector `aPart`/`aSurface`, eye `grain`) forced a synchronous conversion variant. They are uploaded as Float32.
- `compileHiddenGPU` now binds the canvas explicitly for its screen pass. A leftover offscreen target made it compile only linear variants, so the real sRGB screen variant linked on first draw.
- Projector floor, hover outline, star bloom, pupil and grade chains compile ahead of time (`compileByDryRun` turns a draw function into off-thread compiles).
- Desktop corridor (`scene.tsx`): it stays hidden until it has (1) its retained-ACES material patch applied (`prepareLegacyResponse`), (2) compiled off-thread, (3) uploaded its textures one per frame, and (4) finished each program's final link one per frame. Worst glasses-removal frame went from ~1044 ms to ~49 ms. The corridor appears up to ~1 s later than before, without the freeze.
- `scene-idle` also waits 250 ms after theatre gaze motion before starting background work.
- Remaining by design: private warm-ups at stationary stops (screensDone, panel), the projector preparation where the journey already waits, and the approved rope section's own shader warm-up (untouched).
- Backups: `D:/CodexOutputs/Theatre_Projector_Eight_20261110/`.
