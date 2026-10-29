# Camera and projector sequence corrections

25–26 October 2026. Active project: `D:/New folio/new site code/new_site_three`.
Preview: http://192.168.1.5:3000/. Diagnostics: http://192.168.1.5:3000/?diagnostics=1.
This report supersedes the particle, formation-lighting and preparation policy in `docs/scene-performance/README.md`. No commit or deployment.

## Corrections, in verification order

1. **Opening input:** replaced the almost-stationary tail of the opening ease with cubic smoothstep over the same 2.5-second travel. The original 2-second opening hold remains. The last 15% of opening travel can queue the next forward gesture; input is released at the actual endpoint. No additional two-second lock was added. Both authored endpoints are unchanged.
2. **Invisible projector:** the initial state is now `hidden`. Body, optics and effects stay invisible until the formation cue, including in ordinary shadows and live reflections. Assemble is disabled while hidden. Resources may download and prepare invisibly; downloading only at the reveal would introduce another wait. The first pullback remains usable while preparation finishes; a second gesture is retained if the projector is not ready yet.
3. **Darkness:** one shared formation clock smoothly reduces the theatre's baked light to 0.8%, including its floor and the projector platform. Removed the room flash and floor light pool. Darkness is latched through assembly, camera return, idle and scene remount; Restart reloads the initial lit scene. The projector retains its brighter local key and rim. Forty-four screenshots of the ceiling and screen show monotonically falling brightness, with no increases in the sampled regions. This is measured evidence for those regions, not proof that every specular pixel is constant.
4. **Laptop particles:** replaced the sampled-flight streak/sibling system with the original procedural grain field and 32,768 unique source samples, plus 2,500 ambient grains. The desktop program uses 65,536 source samples plus 5,000 ambient grains. The samples' positions, normals, timing/group, part IDs and source IDs match the original export exactly. This is source-data correspondence, not a claim of pixel-identical Cycles rendering. Sustained slow laptop frames can reduce the field to 65% of samples; phones still request/render no flying field.
5. **Formation continuity:** particle landing, part surfaces and part shadows now use the same source noise/sweep mask. Removed the unrelated low-tier mask and screen-space random holes. The visible surface follows the source landing front rather than popping in as a separate timed effect. Original assembly poses and duration are retained. One wall-clock clip controls parts, particles and lighting; dropped frames no longer stretch the clip, and hidden tabs pause it.
6. **Mobile clarity:** solid part reveal uses multisample alpha coverage where available, with a stable threshold fallback for non-multisampled targets. Optics keep continuous transparency. No screen-pixel speckle discard remains. Actual phones can render up to DPR 1.5 instead of 1.25; the texture tier remains 2K. The mobile effect program was exercised without shader errors, but the workstation override is not a physical-phone or phone-DPR test.
7. **Preparation and scrolling:** early projector requests start after the opening paints. Expensive rig construction waits for a stationary stop. Shader compilation is followed by a private one-pixel draw that prepares first-use GPU resources while the projector remains invisible on screen. Critical preparation can use the initial stationary hold; it is deferred during authored camera movement. Page-return preparation can run while the native page covers the scene, avoiding a readiness deadlock. Detailed tracing found another first-view hitch after that remount: reflection rendering created seven programs and the normal frame created nine more, taking about 162 ms combined. Preparing the logo alone did not fix this and was removed. The covered return now compiles and privately draws the whole scene before readiness releases the page. This includes normal-framebuffer and reflection variants, without changing any model or appearance.
8. **Optional detail:** the four computer-only 6K upgrades are serial from request through decode and deferred GPU upload. They start at resting stops and retain the 2K base on optional-detail failure. The projector floor texture is deferred because it is behind the opening camera. Its GLB, geometry, UVs and accepted texture are unchanged. Foreground camera timing no longer silently discards time beyond a delta cap; this preserves authored duration but cannot render frames lost to an actual stall.

## Loading and size

Opening asset dependency: **14,351,808 bytes**, down from 15,654,264. The deferred platform accounts for 1,302,456 bytes of that difference; this changes startup dependency, not total journey size.

Laptop flying-effect download: **614,558 bytes**, down from 2,952,233. The file has the historical name `particles-mobile.bin.gz`; laptops use its 32,768 genuine source samples. Phones do not request that file. Desktop effects use 1,218,366 bytes.

All-journey asset budgets, excluding JavaScript, fonts, decoders and transport overhead: phone 26,674,777 bytes; laptop 46,765,536 bytes; desktop 47,369,344 bytes. The four optional 6K files add 19,476,201 bytes on supported computers. These are transfer budgets, not GPU-memory estimates. Base and high-detail caches can coexist.

## Verification and limits

- Production build and TypeScript pass; ESLint passes on all 19 changed runtime files. All **39 regression tests** pass, including opening endpoint/input, clip timing, latched darkness, private-render state restoration, asynchronous framebuffer restoration on compile failure, serial texture leases and page-return scheduling.
- All **127 pre-existing public files are byte-identical**, including every GLB, UV sidecar and accepted texture. No source Blender file was saved or rebaked.
- Texture audit covers 26 mappings with no invalid/out-of-atlas coordinates or collapsed UV area. This request changes neither UVs nor texture pixels; existing chart anisotropy remains reported.
- Final laptop and mobile-program captures have no console/shader errors. Laptop journey exercised formation, assembly, camera return, corridor, native-page scrolling, scene remount and full logo reveal. Mobile exercised reveal and assembly with zero particle-file requests.
- Fresh-origin workstation laptop-program check: opening paint opportunity **1.073 s**, loading card removed **1.132 s**, camera settled **5.611 s**. Hidden projector GPU preparation ran during the stationary opening hold and took 206.8 ms. The opening capture's largest browser pause was 200 ms; no pauses were recorded during its opening travel. The four 6K uploads followed serial loads, with submission spans 17–33 ms.
- These are RTX 4070 workstation checks, not real laptop/phone timings or a throttled network test. The previous user-reported 10-second laptop load still needs a fresh device report. High reported FPS does not prove a hitch-free journey. Reports retain all foreground pauses over 50 ms, including covered preparation; no timing filter or artificial timer hides them.
- Earlier isolated replays retained a 160–174 ms exit pause. The detailed trace showed new theatre/reflection programs at that moment; warming the logo alone was insufficient and was removed. Preparing the full scene removed the moving-shot pause but initially made one covered draw take 503 ms. Compiling **both normal and offscreen variants asynchronously before that draw** reduced the final covered GPU submission to **75 ms**; asynchronous shader preparation took 230 ms. The final complete replay records **no pauses over 50 ms during camera travel, formation, assembly, page recession or the logo reveal**. Its six recorded pauses are confined to loading/the stationary opening hold and covered `pageReturnLoading`; the largest is 187 ms during the initial hold, and the largest covered-return pause is 80 ms. Zero errors and zero pauses of 250 ms or more in this run. This is a measured workstation result, not a guarantee for every device. See `final-complete.json`; earlier investigation reports are retained separately.
- React review: stable resource promises and frame references, effect cancellation, mount-owned disposal, shared source geometry ownership, optional Suspense/error boundaries and queue release paths were checked. No qualifying Next.js framework issue was retained; these were application state/shader/resource problems.

Screenshots are actual 1280×720 browser captures. Animation frames are phase examples, not exact frame-by-frame before/after comparisons. Source inputs, component backup, detailed logs, all 44 lighting captures and reproducible checks remain in `D:/CodexOutputs/Sequence_Corrections_20261025/`. The diagnostic file `report-cold-local.json` records a first-frame uniform bug discovered and fixed before the final build; use the `final-*` reports for the shipped build.

## Evidence

- [Empty platform before formation](before-formation.jpg)
- [Laptop source grains during formation](laptop-particles.jpg)
- [Previous laptop particle appearance](before-laptop-particles.jpg)
- [Formed original parts](formed-laptop.jpg)
- [Darkness after assembly and return](dark-after-return.jpg)
- [Previous returned lighting](before-return-lighting.jpg)
- [Mobile clean reveal](mobile-reveal.jpg)
- [Full logo after native-page return](logo.jpg)
- [Lighting measurements](lighting-fade-verification.json)
- [Source sample correspondence](source-particle-correspondence.json)
- [Asset integrity](integrity-final.json)
- [Texture audit](texture-audit.json)
- [Final complete journey and pause report](final-complete.json)
- [Verification summary](verification-summary.json)
- [Trace identifying the former exit hitch](exit-before-covered-preparation.json)

Three.js `compileAsync(object, camera, targetScene)` gathers lighting from the target scene but compiles materials on `object`. Passing the full scene merely as the third argument does not warm its other materials. The normal framebuffer and offscreen render targets also use different output-colour-space variants; compile both before the private draw. Framebuffer state is restored immediately while asynchronous compilation is pending, including failure paths. The startup GLB-decoded metric now preserves its first value across scene remounts instead of displaying time spent reading the native page as decoding time.

Recheck with `npm run build`, `node --test scripts/*.test.mjs`, and `node scripts/audit-active-textures.mjs`. For physical-device review, open the diagnostics link, complete the journey, save the report, then reload and save a second report. Compare opening paint, camera-settled time and pauses by phase separately.
