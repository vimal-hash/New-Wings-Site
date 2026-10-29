# Authored logo particle eye — 27 October 2026

Approved Blender revision 16 is now the runtime point source. It retains the full upper/lower particle deposits, rounded compact ends, three locally rounded shoulders, and continuous dense-to-sparse outer reach. Source and authoring archives remain in `D:/CodexOutputs/Logo_Eye_Studio_20261027/revision-16/`. Web export evidence is in `D:/CodexOutputs/Logo_Eye_Web_20261027/`.

## Current runtime

- Two-point separation correction (27 October): the far volume now starts at 40 and ends at 140 authoring units (about 4,559–15,956 world units). Existing angular groupings and physical grain radii are retained, while the star screen-radius bounds shrink from 0.7–1.6 to 0.4–0.9 CSS pixels. A smooth world-elevation attenuation quiets the lowest stars, avoiding the appearance of a continuation of the close fringe. Transparent instances now submit all far stars before the nearby grains, correcting the previous shared-draw compositing order. The near records themselves remain byte-for-byte unchanged. A restrained directional teal region now blends alongside the turned view's violet; no room material or eye colour is changed. Counts, allocations, draw count, camera and final-eye fade remain unchanged. Current archive: `D:/CodexOutputs/Logo_Eye_Star_Separation_20261027/`, including the pre-correction version in `component-before/`.
- Earlier six-point star polish (27 October): counts and distance range stayed fixed in that pass. Sharper pixel-filtered luminous centres replace the softer, steel-compressed star response; the halo is four times weaker and appears only around the stronger stars. Size-linked strength has a wider range, leaving faint points behind a few brighter anchors. Broad density pockets are stronger and the uniform background density is lower, preserving generous irregular gaps. The world-space horizon blends from the existing slate/champagne direction to a broader indigo-violet region with a cool lower edge in the turned view. This raises the glow above the foreground in that view, without a phase-triggered colour switch, camera change or room relighting. Both regions fade smoothly into dark upper sky and disappear with the existing pullback envelope.
- Earlier polish archive: `D:/CodexOutputs/Logo_Eye_Stars_Refinement_20261027/`, including the preceding liked version in `component-before/`. Desktop and phone-layout full journeys passed with no browser/shader errors; both temporary draws stop before the final eye, and reduced-motion holds submit no scene draws. Near attributes match the previous version byte-for-byte at every tier. All 58 regressions, production build, TypeScript and scoped ESLint pass. Desktop and phone-profile cadence stays about 13.34 ms at the workstation's 75 Hz limit; phone layout emulation does not establish physical-phone performance. No new public asset, draw call or particle allocation was added by this polish.
- Initial distant-star refinement (27 October): the restored near grains remain byte-for-byte unchanged. Only the far population doubled: desktop 240 near + 2,880 distant; laptop 160 + 1,920; mobile 80 + 960. The initial far range was 20–80 authoring units; the separation correction above supersedes this range. Loose concentrations and empty pockets replace an even spread. Physical radius, intrinsic strength and opacity increase together; distance supplies perspective and parallax.
- Distant points now have an analytic, antialiased light core with a restrained halo and mostly cool-white tint, distinct from the steel-grain atlas retained by the eye and nearby particles. Tiny-screen coverage is bounded to keep distant points legible. A faint horizon dome at the far range's start adds a little lower-sky glow, fading dark above; it adds no light to room materials. No new model, texture, particle file, simulation target or bloom pass is downloaded. Near/far points share one instanced draw, with one additional atmosphere draw. Point attributes total 124,800 / 83,200 / 41,600 bytes, plus the small dome geometry. Geometry remains in world space; clip depth is assigned to the background so the original camera far plane and foreground occlusion are retained.
- The environment layer softly fades with travelled distance over the early pullback and becomes invisible before the approved final view. At `logoDone` (and the last `done` transition frame), it is explicitly disabled and contributes no draw. The existing camera, full-eye positions, lid heights, widths, density tiers and production logo remain unchanged. Near grains have only a slow GPU drift; distant grains stay fixed, so parallax comes from the actual camera. Reduced motion freezes drift. Existing stationary-stop compilation/private preparation and owned-resource cleanup cover both fields.
- Placement and camera analysis: `components/corridor/logo-particle-eye/depth-field.ts` and `scripts/logo-eye-depth-analysis.mjs`. Current comparison archive: `D:/CodexOutputs/Logo_Eye_Stars_20261027/`; earlier restored scatter: `D:/CodexOutputs/Logo_Eye_Depth_20261027/`. Local diagnostics can compare `/?diagnostics=1&fx-test=desktop&eye-depth=off`; the ordinary experience includes the layer. The isolated `/eye-study` stays the approved final eye without this temporary environment.
- Verified both close stops and full browser journeys. Instrumented draws show particles and atmosphere at the slide/turned stops, and neither in the final eye. Reduced-motion holds stop requesting scene draws. Desktop on/off cadence remains approximately 13.34 ms per frame at a 75 Hz limit; this is not physical laptop/phone performance or GPU-time evidence. Build, TypeScript, scoped ESLint and all 58 regression checks pass. Original eye shaders, point assets, fit, lighting and protected camera/projector/light sources are unchanged.
- Web refinement (27 October): the authored end noses now reach both screen edges through horizontal fitting, including expansion on wide screens. Vertical scale, pupil clearance, original logo and camera remain unchanged. The isolated study uses the same width fit.
- Close-up grain radius now rolls down gently and is capped at 3 CSS pixels; distant coverage is retained. A smooth luminance shoulder softens the brightest baked reflection peaks while retaining darker steel tones. These are shader appearance adjustments to the existing atlas, not a new physical roughness bake. Counts, authored positions and density tiers are unchanged. Before/after captures and verification: `D:/CodexOutputs/Logo_Eye_Web_Refinement_20261027/`.
- The existing `LogoParticleEye` integration and feature flag are retained. No camera, logo material, projector, scrolling or room-light changes.
- Authored 16-bit positions, projected grain size/aspect/orientation and material category; 9 GPU attribute bytes per particle. Maximum position quantization error is 0.000203 authoring units, with a 3.5-unit reference logo diameter.
- A single instanced billboard mesh, two triangles per grain, with 64 original worn-steel appearance samples in one 512-square UASTC KTX2 atlas. No individual mesh per grain and no per-grain CPU animation loop.
- Atlas colours include the approved Blender materials, lighting and AgX display transform. Sixteen low-frequency RGB lighting gains restore field illumination from matched-camera source/browser energy measurements. This is frozen baked illumination and a view-dependent grain-sprite approximation, not general Cycles/PBR equivalence. The production logo keeps its existing material.
- The exact desktop point set has 238,353 grains. Spatially stratified nested subsets retain the density regions and both halves: laptop 98,304; mobile 49,152. Smaller tiers use a bounded grain-size bias. They preserve the silhouette and distribution at reduced granularity, not identical pixel detail.
- Horizontal scale follows viewport width: the eye expands or compresses to touch both screen edges. Lid height remains proportional to the existing logo, preserving pupil clearance. Camera choreography is unchanged.
- The subtle current travels right within small local neighbourhoods, with faded recycling and a stationary tip envelope. Reduced motion is still; hidden tabs stop requesting eye frames. This is not a fluid simulation.
- No eye point worker, atlas fetch, decode, geometry allocation or GPU preparation before `screensDone`. Loading and GPU preparation use the existing stationary-stop scheduler; the effect never gates projector readiness. Workers transfer compact arrays and terminate after decoding; component cleanup cancels queued work and disposes owned resources.
- The existing immutable content-versioned URL convention applies to the point tiers, worker and atlas.

| Tier | Grains | Point download | Shared atlas | GPU point attributes |
| --- | ---: | ---: | ---: | ---: |
| Desktop | 238,353 | 1,625,055 B | 155,101 B | 2,145,177 B |
| Laptop | 98,304 | 687,535 B | 155,101 B | 884,736 B |
| Mobile | 49,152 | 352,638 B | 155,101 B | 442,368 B |

The small decoder worker, JavaScript, and already-shared Basis decoder are additional. Downloads, transient decode buffers, GPU attributes and texture memory are distinct measures. The authoring NPZ and Blender preview meshes are not browser payloads.

## Review and reproduction

Open `/eye-study` to inspect the same runtime field without the full journey. It starts still with automatic device-tier selection, manual quality options and a current toggle. Its satin logo is only a review reference; the full experience's existing logo is unchanged. `/eye-study?lighting=raw` disables the low-frequency gain correction for material QA and calibration reproduction. The review page is removable with `app/eye-study/` and `study.tsx`.

`scripts/export-logo-eye.py` reads the approved NPZ, includes the exact frame-1 depth wave, exports three spatially balanced point tiers and encodes the shared atlas. It uses NumPy/Pillow and the existing local Basis encoder. The atlas source render script and material inventory are preserved beside the web export evidence. `calibrate-field.py` records the matched-camera low-frequency lighting calibration; do not recalculate against a previously calibrated screenshot.

Run `node --test scripts/*.test.mjs`, TypeScript, scoped ESLint and the production build. The eye regression independently decodes the actual worker format, checks malformed input, nested tier membership, pupil clearance and unchanged-camera horizontal framing. Real-browser verification also needs all three tiers, still/moving/reduced-motion states, loading eligibility and the normal journey through the final reveal. Workstation browser cadence is not physical laptop/phone FPS evidence.

## Removal

Set `LOGO_PARTICLE_EYE_ENABLED = false` to stop production allocation, loading and drawing. Permanent removal: remove the existing `<LogoParticleEye>` integration/import, the component folder, `public/models/logo-eye/`, `public/textures/logo-eye/`, the review route and associated export/test. Regenerate asset revisions afterward. Authoring files remain outside the website.

## Verified code handoff

- Production build, TypeScript, scoped ESLint and all 55 regression tests pass. Six checks cover the actual authored eye format, corrupt input, tier nesting, clear pupil and final-camera framing.
- Actual Chrome on this RTX 4070 rendered all three tiers without console errors. The isolated scene has four draws: three logo parts and one eye. At 1600×900 the desktop eye contributes 476,706 billboard triangles; at 1280×720 the laptop eye contributes 196,608; the mobile eye contributes 98,304 at 390×844.
- Moving-preview browser cadence over 180 rAF intervals was about 13.34 ms mean for all tiers; p95 was 13.6 / 13.5 / 13.5 ms (desktop/laptop/mobile). This is a workstation/viewport profile result, not physical-device GPU timing or phone/laptop FPS.
- Reduced-motion playback settled with an unchanged frame counter over an 800 ms idle sample.
- The normal production journey completed opening, formation/assembly, HTML page return, slide/turn and the full-logo reveal in laptop and phone programs. Eye requests began at `screensDone` in both. No browser errors. At the laptop final hold, mean browser cadence was 13.41 ms and p95 13.5 ms. Earlier journey pauses, including a roughly 2.9-second cold preparation pause in this workstation run, are not represented by those final-hold numbers; the earlier projector-preparation task remains deferred.
- SHA-256 checks confirm all 142 pre-existing public files and all eight protected camera/projector/lighting files are unchanged. The approved Blender source is preserved. No commit or deployment.
- `preview-verification.json`, `journey-verification.json`, `final-browser-verification.json`, `integrity.json` and `protected-scene-verification.json` are preserved in the web export folder, with actual browser screenshots and build/regression logs.

## Historical prototype — superseded

The following describes the earlier analytic draft, not the current runtime:

First-stage prototype: two moving bands of silver/charcoal grains form an almond around the existing logo. The logo is the pupil. The eye stays in the logo's plane; it is not attached to the screen. Both bands flow left to right, with subtle strand motion and depth. The almond itself does not rotate.

## Scope and removal

All effect code lives in `components/corridor/logo-particle-eye/` (`index.tsx` and `field.ts`). One `<LogoParticleEye>` mounts inside the existing corridor group. Set `LOGO_PARTICLE_EYE_ENABLED = false` in `components/corridor/scene-features.ts` to disable the complete effect, including allocation and preparation. To remove it permanently, remove that JSX integration and its imports, then delete the component folder and feature flag.

Existing logo geometry/materials, camera choreography, scroll/input handling, projector preparation/formation and scene lighting are untouched. The still-coloured logo is intentional at this stage. The steel-logo finish, rising board, contact flash, descending particles and reactive edge rays belong to the next design stage, after the eye is reviewed.

## Runtime

- One instanced draw, two triangles per grain. Positions are evaluated in the vertex shader; no per-grain CPU loop or simulation render target.
- 32,768 grains on the desktop tier, 24,576 on laptop, 10,240 on mobile. Seed buffers are approximately 512 / 384 / 160 KiB respectively.
- No additional model, texture or particle-data downloads. Existing quality selection is reused.
- The field is aligned to the unchanged final logo pose and proportioned to its actual bounds. Width adapts to viewport aspect; logo and camera do not move to fit the eye.
- Resources mount only from `screensDone` onward. Shader compilation/private first draw are queued at stationary stops; this effect never gates journey/projector readiness.
- Visible during logo reveal and full-logo hold only. Animation requests frames while visible, stops in a hidden tab, and becomes static for reduced motion. Cleanup cancels pending jobs and disposes owned geometry/material.
- Billboard grains have bounded screen size, individual silver shading and a minimum distant coverage to keep the final wide eye legible. These are stylised shaded grains, not physical light scattering or real reflections.

## Verification

The production build, TypeScript and changed-file ESLint pass. Existing camera/scroll/particle regressions remain required. `scripts/logo-particle-eye.test.mjs` additionally checks final-camera framing, clear pupil space, logo-thickness clearance, bounded seeds and deterministic quality-tier subsets.

Verified the actual production journey in local laptop and mobile effect profiles: opening, formation/assembly, sphere/page, third-section return, slide/turn, and final pullback. No browser errors in either profile. The final eye fits at 1280×720 and 390×844; the close turned view shows the same field in perspective. The optional diagnostic panel says “Moving” because grains continue animating, even while the camera is fully settled at `logoDone`.

- `full-laptop.png`: full front eye, final production shader.
- `turned-laptop.png`: close perspective, final production shader.
- `full-mobile.png`: 390×844 portrait, actual mobile effect program on this workstation.
- `full-laptop-later.png`: later frame at the same settled camera. Comparison found 48,821 changed eye-area pixels above two RGB levels, and zero changed pixels in the central logo/pupil rectangle. The field moves while the logo remains fixed.

Both local profiles showed 75 FPS at the final eye hold on this workstation. This is a functional browser check, not physical laptop/phone performance evidence. Reduced-motion and disposal were reviewed in code; reduced motion was not toggled at OS level during these checks.

Production build, changed-file ESLint and all 51 regression checks pass (including the two new eye checks). SHA-256 checks confirm all eight protected camera/projector/light sources and all 142 existing public files are unchanged; no new public assets. Backups, integrity output and regression log are in `D:/CodexOutputs/Logo_Particle_Eye_20261026/`. No commit or remote deployment.

## Explicitly pending

The user's physical laptop reported approximately 50 seconds at projector preparation after the prior pass. That problem and its lighting are deferred by the user and are not fixed or reclassified by this eye prototype.
