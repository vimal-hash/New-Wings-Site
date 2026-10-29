# Step 1: star glow, with matte iris headroom

`components/corridor/star-bloom.tsx` adds an HDR **glow-only** composer to the existing corridor Canvas. `postprocessing` 6.39.5 is the only new dependency. No GLB, texture, particle data, camera sampler, particle material, blending mode, physics or view-LUT source changed. `refs/checkpoints/eye-one` remains unchanged.

## Why a separate extraction

The approved display-referred steel highlights can be brighter than the tiny stars. A low whole-image threshold would brighten the steel before delivering useful star glow. Instead, the private HDR pass reuses the existing star mesh geometry, positions and live uniforms, discards its near-grain instances and extracts star radiance at 12× into HalfFloat buffers. This gain is exclusive to the private extraction; visible star cores do not change. The luminance threshold is 1.15, smoothing .15, mip radius .35; the final additive halo gain is .24 (raised from .16 during the visibility audit).

The remaining scene supplies black occlusion masks. The eye and near grains retain their exact atlas alpha coverage in those masks. Opaque surfaces block the extraction, and the alpha mask also clips the blurred halo at the final composite. Iris/near-grain colour never enters bloom. The final shot currently has no active stars and submits no bloom pass. A future pupil/iris light response must be deliberately added to the HDR extraction; it is not enabled by this step.

Keep the original premultiplied particle rendering on its original framebuffer. Only the extracted light passes through the HDR composer; then a small display-relative additive halo is drawn over the original. This avoids changing the approved display-LUT/transparent blending space or regrading the atmosphere. There is no global exposure, new LUT, fog, background colour change or animated twinkle clock.

## NoToneMapping compatibility

The original Canvas actually used Fiber's default ACES mapping for ordinary `toneMapped:true` materials. Simply enabling `flat` changed their corridor appearance. The Canvas now explicitly uses NoToneMapping. Ordinary built-in materials retain their **previous** ACES response through a reversible compile hook; all ShaderMaterials and `toneMapped:false` materials are excluded. In particular, neither particle/LUT shader receives another tone map. Original material hooks/cache keys are restored on cleanup.

## Cost and lifetime

| Profile | HDR extraction scale | Blur input relative to extraction | Mip levels |
| --- | --- | --- | --- |
| desktop | 1 | .5 | 4 |
| laptop | .75 | .5 | 3 |
| mobile | .5 | .5 | 2 |

The existing `effectQuality(gl)` selects the profile, including its `isMobileDevice` handling. Composer multisampling is zero; the original scene retains its canvas antialiasing. Resize only private targets: this library's `composer.setSize()` also resizes the visible renderer, so it must not be used for tier scaling. Resize the mip chain explicitly; `BloomEffect.resolutionScale` alone does not resize a mipmap chain.

Tradeoff: foreground occlusion needs another cheap material render using shared source geometry. No duplicate particle buffers or atlas downloads. Allocate/prepare only after the sky atlas is ready, at an allowed stationary stop (priority 16), including the preceding stop while the sky is still hidden. Do not change the source hierarchy's visibility during this private warmup or gate projector readiness. Run only on existing demand frames while stars are visible; do not request a continuous loop. Restore uniforms, render target, clear state, shadow update flag and renderer auto-clear after every private draw. Aggregate renderer statistics across the base and post passes. Dispose the composer, masks and fullscreen resources, never shared geometry/atlases. Without HDR colour-buffer support, retain the unchanged base scene.

Local diagnostic comparison: `/?diagnostics=1&fx-test=desktop&bloom=off`. The off switch is restricted to localhost/127.* and does not affect the LAN production URL. When grading is enabled, retain the private foreground-mask render but disable the blur pass and halo composite. Removing the mask would also change the grade, invalidating this comparison.

## Visibility audit after grading and parallax

Evidence: `D:/CodexOutputs/Cinematic_Audit_20261027/`. The user clarified that “twinkle” means the original soft halo, **not animated brightness**. Keep the stars steady; no new animation clock, particle shader change or motion was added.

The existing bloom was drawing correctly on the live LAN page, but its .16 halo was visually very restrained after grading. Only the final additive gain increased to .24; thresholds, kernel, star cores, quality resolutions and all subject shaders/data remain unchanged. The bloom-off diagnostic now retains the grade's mask. A replaced source material also removes its old near-grain mask, avoiding an orphan proxy on shader replacement.

Both existing stops were compared with bloom suppressed while retaining the identical grade/mask. At 1920×945, desktop halo additions peak at 22/27 display code values, versus the previous 16/18. Sampled solid foreground regions have zero difference. Grade identity matches the ungraded framebuffer within one code value; all 31,305/6,368 pure-black source pixels remain zero. Grain changes sampled dark sky by at most one code value. Native 3840×1890 before/after PNGs are included without resizing.

The complete ordinary scroll journey reaches the final eye with bloom/grade active at both close stops, no final sky/bloom draw, and no reduced-motion idle draw. All three quality profiles pass close-stop, HDR RGBA16F, gain, mask, final-eye and reduced-motion checks without browser errors. Desktop cadence remains approximately 13.3ms / 75fps on this workstation; profile checks are not physical laptop/phone performance claims. The existing 63 regressions, production build, TypeScript and scoped lint pass. Camera/iris/near-star/grade sources and the eye-one checkpoint are preserved.

Actual camera-move GPU samples reconfirm ~3.34px distant translational parallax versus ~24.08px for nearby grains, with full authored rotation and zero turned-anchor displacement. The phone/touch/DPR-3 context retains its 585×1266 canvas, 1040-instance field and error-free route remount. The repaired URL bloom bypass keeps `uHasMask=1` and makes no overlay draw; its dark-sky and solid-foreground comparison is exact. Separate-context captures differ at a few grain-edge pixels (maximum two codes at one pixel), not across the nebula. No qualifying Next.js feedback issue was retained in this audit.

## Verification and limits

Evidence: `D:/CodexOutputs/Cinematic_Star_Bloom_Matte_20261027/`.

- Production build, TypeScript, changed-file ESLint and 58 existing regressions pass.
- Both existing camera buttons, resize and the final eye are checked in desktop/laptop/mobile profiles, with no WebGL/browser errors. The final eye submits no star bloom draws.
- The ordinary complete scroll journey also passes: stars submit HDR extraction draws at both close stops, reduced-motion idle submits no draw, and the final eye has no sky/atmosphere/bloom draw. Eye asset requests still start at `screensDone`. An Android/touch/DPR-3 browser context uses the mobile 1040-instance depth field, retains the intended 585×1266 drawing buffer at both stops, and survives navigation to `/eye-study` and back without errors. This is device emulation on the workstation.
- 1920×945 desktop active-frame cadence is about 13.3 ms, p95 13.5 ms (75 Hz workstation), with bloom both on and off. These local profile checks are not physical laptop/phone performance claims. Existing late background preparation can still cause a startup pause, including in the bloom-off baseline; this work does not resolve the separately deferred projector preparation task.
- Bloom-off comparison against the pre-change capture found exact RGB matches in sampled first-view sky, field and architecture regions. View 2 had only isolated one-level rounding differences. With bloom on, sampled dark architecture remains unchanged; visible additions are localized around stars.
- Four native 3840×1890 PNG captures use the same original camera stops/aspect, reduced motion, and bloom off/on. Diagnostic HTML panels are hidden only for these captures. These are native renderer images, not enlarged 480p pictures. The 4K capture size is for inspection; the 60fps target is checked at the normal desktop viewport.

Next.js agent feedback audit: no qualifying framework issue was retained during this step; the shader/colour-management corrections above were implementation debugging.
