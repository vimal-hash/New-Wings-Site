# Camera, upholstery, curtain and device performance fixes

25 October 2026. Active project: `D:/New folio/new site code/new_site_three`.
Preview: http://192.168.1.5:3000/. Nothing committed or deployed.

## What changed

1. **Opening camera:** provide an explicit Euler rotation as well as setting `lookAt` when the renderer is created. The installed R3F version applies an origin-facing default when camera options omit `rotation`; supplying only a quaternion did not prevent it. `FullJourney` also maintains the screen-facing pose while waiting for the opening assets, rather than waiting for projector FX readiness. The existing hold and pullback timings remain.
2. **Sofas:** remove the coarse quilt/grunge radiance arrays from the active manifest. Keep the existing 39,484-byte Draco mesh, 1,479 triangles per sofa, twelve original placement envelopes and one instanced draw. Use the source upholstery atlas, neutralized toward charcoal, plus a packed clean geometry AO / roughness / metalness atlas. Both are 1024 square KTX2 with mipmaps. The old quilt normal is deliberately excluded. This is a new clean material interpretation, not a claim of exact Cycles leather equivalence.
3. **Curtain:** render the original surrounding dome topology, with spherical UVs and the existing compressed source-material pattern. It fades through the same 0.3-second wide-stop hold and the following 0.7 seconds, once per page load. It is gone before formation. Only exterior corridor walls, caps, roof datums and diagnostic Slide materials briefly fade to reveal the dome. Seats, theatre, projector, floors and slot lights remain opaque; the dome does not paint blue over them. Outer logo materials are unchanged.
4. **Projector effects:** strong recognized desktop GPUs retain the original procedural particle field. Laptop, unknown and integrated GPUs use 6,144 source data grains plus 512 ambient grains; phones use 2,048 plus 128. Original flight paths were evaluated offline on the GPU into 97 samples and stored as three compressed RGBA16F atlases. Runtime interpolates samples instead of evaluating the large noise field four times per grain. Lower tiers also use lighter reveal/material noise. Poor measured frame times reduce grain count further, distributed across the whole field. Original assembly poses, model, source textures and nominal four-second formation / two-second assembly remain unchanged. Long frames are capped in the animation clock so a stall cannot skip most of the sequence; on very slow hardware this can extend duration.
5. **Loading:** the offscreen projector module, GLB, motion and maps now start after the opening paints, in their own Suspense boundary. The large projector no longer suspends the theatre. The first user pullback works before it is ready; a queued second pullback waits for both projector and dome, showing `Preparing projector…` if needed. High-priority decoder hints stay; the projector's high-priority HTML model preload was removed. Asset-budget numbers reflect the actual new opening set.

## Asset cost

| Item | Current cost |
| --- | ---: |
| Sofa base KTX2 | 457,539 bytes |
| Sofa AO/roughness/metalness KTX2 | 533,992 bytes |
| Sofa textures combined | 991,531 bytes, versus 2,332,485 previously |
| Surrounding dome Draco GLB | 168,788 bytes |
| Curtain pattern | Existing 976,505-byte texture, unchanged |
| Laptop flight cache | 2,952,233 bytes gzip; 15,495,168 decoded bytes |
| Phone flight cache | 929,438 bytes gzip; 5,363,712 decoded bytes |
| Mobile opening asset set | 15,654,264 bytes, versus 23,906,171 |
| Laptop/desktop opening asset set | 23,980,098 bytes, versus 32,232,005 |

Moving projector work after the opening reduces the initial dependency set; it does not eliminate later downloads. Laptop flight-cache download is larger than the old particle seed buffer, trading a small later download for substantially less runtime computation. Full route assets remain substantial, especially the four selected 6K surfaces.

Theatre ceiling/floor and corridor LEFT wall/floor retain the approved compressed 6K files on capable laptop/desktop devices. Phones/tablets retain 2K. Corridor RIGHT wall stays 2K. No wall, floor or ceiling rebake was performed.

## Verification and evidence

- Production build including TypeScript passes. Targeted ESLint passes. All 26 camera/control regression tests pass.
- All 118 pre-existing public assets remain byte-identical, including every existing GLB, original poses, wall/floor/ceiling textures and old sofa arrays. Old sofa arrays remain recoverable but are no longer requested. New assets are additive.
- Source-to-runtime sofa UV comparison: 1,266 vertices, zero UV mismatches above 0.002; maximum normalized position difference 0.00000158. Placement envelopes remain exact.
- Original projector pose audit passes; assembled bounds differ by less than 0.000001 m. The older audit's `particleCountMobile` describes the original seed buffer; actual current compatible-tier counts are in `projector-trajectories.json` and the cache audit here.
- Cache audit checks exact byte lengths, finite half-float values and populated trajectories in both profiles.
- Browser: screen-facing opening, cleaner sofas, actual dome during its cue, cue disappearance, formation, assembly, return, screens and corridor panel checked. Desktop, laptop-compatible and phone-compatible shaders run without new console errors.
- Fresh-origin desktop LAN captures: previous opening card gone at 2.116 s; current at 2.141 s. Observed opening transfer falls from 31.88 MB to 24.41 MB. This powerful local workstation was already fast; these figures do **not** establish an improvement from the user's ten-second device result. The smaller opening dependency set needs a real laptop/phone check.
- Compatible profiles were exercised using a localhost-only diagnostic override on this workstation, not real phone hardware or CPU emulation. `?diagnostics=1&fx-test=laptop` / `mobile` works only on localhost or 127.*. The LAN preview automatically selects quality.
- React performance review: offscreen lazy boundary, parallel independent requests with stable loader batch keys, no animation-frequency React state updates, owned resource disposal, shared loader cache retained. Next.js feedback review found no qualifying framework issue; the camera behavior was R3F configuration and the fixed compile failure was our compact shader helper.

Images: `final-theatre.jpg`, `curtain-corrected-dome.jpg`, `laptop-flight-peak.jpg`, `mobile-flight-peak.jpg`. Raw fresh-load reports, active file lists and integrity audit are alongside this file. Screenshots are browser captures, not Blender renders.

## Reproduction and pitfalls

Authoring files and backups: `D:/CodexOutputs/Scene_Fixes_20261025/`. This includes `prepare-sofa.py`, `bake-sofa-ao.py`, `prepare-dome.mjs`, `particle-cache-server.cjs`, `pack-trajectories.mjs`, `verify-sofa-uv.mjs`, `verify-cache-integrity.mjs` and `update-budget.mjs`.

The source dome uses normalized signed-integer positions. Read decoded accessor elements into a new Float32 array, apply world transforms, and clear normalization before Draco export. Mutating the raw Int16 array preserves normalization and creates a tiny incorrect dome. The exported dome is expanded around its original centre to enclose the current layout. No original Blender file was saved.

Generate upholstery from the original source GLB maps, not from baked row radiance. Bake AO without the old quilt normal. Verify UV correspondence after compression rather than assuming atlas compatibility. The source atlas contains stitching and hardware masks; retain them.

Generate flight caches by evaluating the original shader in the local authoring utility, then pack using the recorded metadata. Keep authoring utilities and raw caches outside `public`. The utility is not a runtime dependency. Compatible material shaders need their own `mapRangeLinear` helper when replacing the large original noise library. Compile and actually render every tier before accepting it.

Source material matching is still subject to the earlier fixed-bake reflection limitations. This task improves seating and effects; it does not make every baked wall reflection view-dependent.
