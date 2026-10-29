# Scene finish — 25 October 2026

Historical first pass. The sofa, curtain, particle quality and opening-loading sections below are superseded by `../scene-fixes/README.md`. Follow the current manifests and newer report.

Implemented in `D:/New folio/new site code/new_site_three`. The previous project, `new_si_two`, was read only. Source Blender files were opened in background Blender, never saved or modified. The live Blender bridge was unavailable; it was not needed for the exports.

## Current behavior

| Target | Implementation | Runtime files |
| --- | --- | --- |
| Four moon mirrors | Real reflected-camera rendering, one capture for each coplanar wall. Visible room content changes with the camera. Hidden captures and recursive mirror feedback are skipped. | Geometry extracted from the existing theatre model; no extra mirror GLB or reflection atlas. `design-moons.tsx`, `planar-mirror.ts`. |
| Sofas | Reused the previous project's accepted UV model and per-seat Blender radiance arrays. Same 1,479-triangle shape, twelve placements and size envelopes. Three instanced rows. | `public/models/theatre/sofa/sofa-baked-draco.glb`; `public/textures/theatre/sofa/row-{b,c,d}.ktx2`. |
| Projector | Restored 59 source PBR material definitions, custom normals and brushed chassis maps. Single Draco-compressed batched mesh with GPU part poses. | `public/models/projector/`; `public/textures/projector/`. |
| Projector effects | Ported the original particle flight/reveal code and original sampled particle IDs, timing and root transform. Four-second formation, then two-second assembly. | `projector-particles.tsx`, `projector-fx/`, compressed mobile/desktop particle buffers. |
| Blue curtain | Original Blender material rendered to a 1K compressed texture. A single screen-space transition veil fades in through the 0.3-second wide-stop pause, then fades out over the next 0.7 seconds. Gone before particle formation. Replaying projector buttons does not restart it. Restart reloads the journey. | `public/textures/corridor/curtain/blue-curtain.ktx2`; `curtain-cue.ts`, `blue-curtain.tsx`. |

The curtain is deliberately a brief transition veil. A far-depth background was tested and rejected because the enclosed corridor walls completely hid it. It is excluded from mirror captures and is invisible for the rest of the journey. Its source pattern is a fixed source-material frame; only its fade animates.

## Resolution selection

Reuse the existing user-compressed 6K files; no new wall/floor/ceiling baking was done.

| Surface | Laptop/desktop, max texture size >=6144 | Phone/tablet, or max size <6144 |
| --- | --- | --- |
| Theatre ceiling | 6144 x 6144, 4,138,235 bytes | Existing 2K |
| Theatre floor slab | 6144 x 6144, 5,591,046 bytes | Existing 2K |
| Corridor LEFT wall (`wall-red`, updated fill source) | 6144 x 6144, 7,384,866 bytes | Existing 2K |
| Corridor slate floor | 6144 x 6144, 5,964,611 bytes | Existing 2K |
| Corridor RIGHT wall (`wall-connecting`) | Existing 2K | Existing 2K |

Other surfaces retain their prior texture sizes. The moon steel border remains its existing accepted bake; the inner mirror discs now have live reflections. No multi-camera bake bundle or camera-dependent texture switching was introduced.

`texture-quality.ts` chooses a URL before loading. Actual consumers and preloads use identical URLs and batch keys. Phone/tablet detection includes Android tablets and iPads using desktop user agents. Tests cover these cases and a 4096 hardware limit. Desktop browser resource evidence confirms the four 6K files were requested without requesting their 2K alternatives.

## Asset cost

Sizes below are decimal MB of selected files on disk, before any HTTP transport compression. They are not measured network transfer or GPU memory.

| Tier | Opening assets | Deferred corridor/curtain | Particle buffer | Total selected assets |
| --- | ---: | ---: | ---: | ---: |
| Phone/tablet | 23.91 MB | 5.25 MB | 0.61 MB | 29.77 MB |
| Laptop/desktop | 32.23 MB | 17.07 MB | 1.22 MB | 50.52 MB |

JS, decoder downloads, later page/logo resources and generated render targets are additional. These totals cover the opening, deferred corridor and projector FX, not every later site feature. Corridor assets begin after the opening paints. The two sizes of each target are stored separately; only the chosen tier downloads. Asset-budget figures include the new material/model files, and particle buffers are separately listed.

Sofa model: 39,484 bytes, 1,479 triangles, twelve instances. Three 512 x 512 x 4 KTX2 arrays total 2,332,485 bytes. Geometry was already aggressively optimized, so it was not simplified again.

Projector model: 5,265,476 bytes, 430,417 triangles, 514 parts. The previous diagnostic export had 425,397 triangles and 3,600,200 bytes. The restored export retains evaluated source facets, corner normals, UVs and material boundaries, increasing its size. It is not described as a further triangle reduction. Original assembly data was stripped of the obsolete approximate particle field: poses now download as 50,286 bytes instead of 389,501 bytes. All 65 pose samples are byte-identical to the original data. Assembled bounds differ from the source placement by less than 0.001 mm.

Three projector maps remain 1K: base colour, packed metalness/roughness/specular, and normalized OpenGL normals. The source texture mapping is identity with repeat wrapping. Metallic, specular/IOR and normal strength are read from the source rather than assumed from the node's unlinked defaults. Source glass transmission is zero. Source files, unpacked images and encoding inputs are outside `public/`.

The four 6K atlases alone require about 192 MiB on a typical 8-bit-per-texel compressed GPU format, compared with about 21 MiB for four 2K atlases. Actual transcoded format can change this. Live mirror targets are capped at a 1024-pixel longest edge on desktop and 512 on mobile, with no multisampling; half-float unsupported phones fall back to an unsigned-byte render target. Mirrors render only on demand frames, and invisible walls are skipped.

## Verification

- Production build and TypeScript passed.
- ESLint passed on all changed runtime modules.
- All 26 existing camera, page/exit and projector-control regression tests passed.
- Device-tier and one-shot curtain tests passed.
- Projector source-pose, attributes and assembled-bounds audit passed. Sofa count, UVs and twelve placements checked.
- All 99 files present in `public/` before this task remain SHA-256 identical, including existing GLBs and accepted surface textures. New active sofa/projector assets use new URLs.
- Desktop browser: opening, live mirror orbit, particle formation, assembly/return and corridor transition rendered with no console errors. The curtain was captured during hold and approach and was absent before particles.
- Cached desktop checks: loading card disappeared in 2.1-2.6 seconds; 75 active FPS at 1280 x 720 on this computer. The final report records 2.62 seconds with the new projector channel map downloaded and other files cached. This is not a cold network test, laptop measurement or real-phone measurement. Main-pass draw-call indicators omit additional mirror render passes.

## Visual limits

This is not a claim of exact Cycles equivalence. Existing fixed surface bakes still have frozen sheen. Real moon mirrors omit recursive reflections of other mirrors. Projector lighting uses a compact local studio environment with source PBR parameters; procedural micro-roughness is approximated within source ranges, not a full translation of every Blender node. Particle sampling is 32,768 on mobile and 65,536 on desktop versus the old 216,733; the original flight field and IDs are preserved, but the number of grains is lower. The curtain uses a baked source-pattern frame with animated opacity, not the old continuously running noise shader.

The existing diagnostic Slide A/B geometry and surrounding gaps remain outside this request. They can still appear above the theatre opening. No outer-logo material work was done. Real phones and the user's laptop need a new loading report before making device-performance claims.

## Reproduction and evidence

Runtime manifests: `components/corridor/projector-animation.json`, `sofa-assets.json`, `texture-quality.ts`, `asset-budget.json`, `projector-fx-config.json`, `moon-surfaces.json`.

Authoring scripts, source inspections, original backups, full resource report, model audit and before/after evidence are retained in `D:/CodexOutputs/Scene_Finish_20261025/`. `components-before/` is the pre-task component backup; `assets-before.json` is the protected-file hash baseline. No original source Blender file was saved.

Checks:

```powershell
node node_modules/next/dist/bin/next build
node --test scripts/camera-regression.test.mjs scripts/projector-controls.test.mjs scripts/staged-camera.test.mjs scripts/return-input.test.mjs scripts/reveal-scroll.test.mjs scripts/exit-stages.test.mjs scripts/logo-reveal.test.mjs scripts/page-exit.test.mjs
node scripts/verify-projector-animation.mjs
node D:/CodexOutputs/Scene_Finish_20261025/behavior-tests.cjs
```

Preview: `http://192.168.1.5:3000/`. Diagnostics: `http://192.168.1.5:3000/?diagnostics=1`. Nothing committed or deployed.
