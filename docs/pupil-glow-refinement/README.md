# Silver-white / icy blue pupil glow — 2026-10-28

The user approved the first pulse sequence and requested the concentrated silver-white highlights and pale icy blue/cyan halo shown in their glass-flower screenshots, plus the agreed fuller source, clearer travelling rays and more coherent particle response. The reference is visual direction for emitted light; the pupil remains dark steel and keeps its original form. No glass/transmission material, new camera, display LUT, source asset or particle physics is introduced.

## Changes

`pupil-pulse-state.ts` exposes one shared palette: core `[.92,.98,1]`, halo `[.42,.76,1]`. The border has a narrow white core, softer blue shoulder, broad restrained glints and a moving trace head. Its physical ribbon span is 9 world units; its contours and the previous timing stay unchanged.

The ray now has a brighter narrow crest and a soft blue trailing body. Both use the same world-space radius/width as the grain reaction. The wave width is .62 pupil radii. Grain lighting has a more consistent floor, quieter seed variation, retained atlas shadows/facets and a highlight soft knee. Hero grain HDR extraction is 4.5×, limiting featureless white patches while retaining a clear curved band. Source counts, coverage, drift, atlas and blend state are unchanged.

The private HDR emitters previously inherited ordinary additive blending while writing zero alpha for the occlusion mask. That combination suppressed their radiance. `pupil-pulse-material.ts` now uses explicit premultiplied CustomBlending (One / OneMinusSrcAlpha for colour and alpha), so emitted RGB survives zero mask alpha. The visible source material and shared wave uniforms are preserved. `scripts/pupil-emission.test.mjs` covers this regression.

`star-bloom.tsx` uses hero gain .58 and blur radius .65 on the existing quality-scaled HalfFloat buffers/blur levels. Its artistic composite gives low-energy wings a pale blue tint and hot cores a near-white colour. Hero light may bloom over its own emitting surface; depth occlusion is retained in extraction. The existing star mode still uses gain .24, radius .35, its prior colour and foreground mask. The final HDR pass stops after the finite pulse, as before. Renderer NoToneMapping and the established grade order remain intact.

No extra render target, blur level, package, external texture or ongoing animation loop was added. Owned emitter resources still dispose with their controller. Replay light, camera review reset, hidden-document pause and reduced-motion behaviour remain as before.

## Reference and verification

The pmndrs examples skill was used to inspect the current [Glass Flower source](https://github.com/pmndrs/examples/tree/main/examples/glass-flower). Its strong local highlights and soft bloom informed the look; its transmission, LUT and tone-mapping stack were not copied into this project.

Pre-refinement restore copies, screenshots, actual GPU observations and the recording live at `D:/CodexOutputs/Pupil_Glow_Refine_20261028/`. Build, TypeScript/lint and 73 tests pass. Desktop/laptop/mobile quality profiles retain 238353 / 98304 / 49152 main grains, with no shader/browser errors, correct replay/reset, no reduced-motion flash, final bloom shutdown and successful route remount. These profiles were exercised on the workstation, not physical low-tier devices. Native `pupil-flash-3840.png` / `hero-3840.png` show the source and travelling wave. `halo-on.png` / `halo-off.png` isolate the post-processing contribution at a held pulse time.

To revert only this refinement, restore its archived `pupil-pulse-state.ts`, `pupil-pulse.ts`, `star-bloom.tsx` and `eye-index.tsx` (to `logo-particle-eye/index.tsx`), remove the new emission helper/test and this refinement note. Preserve the accepted pupil fill and initial pulse. The protected `eye-one` reference stays at `fe1ad8ec53c888be42f08c814ff0192513aae31a`.
