# Ceiling-only PBR restoration — 23 October 2026

Scope: the ten visible HALO II ceiling meshes above Z=6m. Walls, floor, furniture, projector, corridor, camera and journey were not redesigned. The approved optimized Blender file and live Blender document are never overwritten; all baking occurs in background processes on a dedicated copy.

The original three materials retain their base colours, metallic values, roughness, IOR and LED emission constants. Their colour/roughness are constants, so they require no redundant colour or roughness image files. The ceiling uses a PBR normal map, one source-room diffuse lighting map, one small local environment and one active-camera glossy calibration. This is not the floor's 49-direction texture-array method.

Source: `D:/CodexOutputs/Theatre_Optimization_20261017/Theatre_Moon_Projector_optimized.blend`. Review copy: `D:/CodexOutputs/Theatre_Ceiling_PBR_20261023/Ceiling_PBR_baked.blend`. This full-room review copy contains packed authoring assets and is not a website download.

## UVs and geometry

The ten evaluated ceiling meshes share a non-overlapping 2K atlas. Native material coordinates are retained before adding the new UV map. Islands have 12 pixels of bake padding, with additional texel protection before generating mips. The raster audit finds no overlapping pixel centres and no zero-area UV triangles at the actual 2048 resolution. This is a finite-resolution audit, not an analytic subpixel proof.

All 4,992 ceiling triangles are preserved. The new Draco GLB is positioned within 7.72 micrometres of the existing diagnostic ceiling. Runtime excludes precisely the ten old ceiling colour IDs before showing the replacement. It does not draw a second ceiling over the original. Source model buffers and the twenty existing model files remain unchanged.

## Appearance and artefact fixes

Ceiling lights use receiver-collection linking in Blender. Copies retain the original collection membership and ray visibility; root-only copies lose the white cove illumination. Broad illumination and reflection fields are denoised offline. Subpixel normal detail is vector-filtered to 1K. Atlas gutters are filled before mip generation to prevent unused black texels causing dark or coloured seams. The source AgX contrast/exposure transform is applied only to the new ceiling materials.

The local environment supplies live PBR response. One source-camera glossy map calibrates its spatial response at the approved view; the live PBR change is retained as the eye moves, with calibration faded for large angular departure. This is an approximation during movement, not a promise of pixel-identical Cycles reflections at every camera.

## Assets

Final ceiling package: **4,150,396 bytes (4.15 MB decimal)**: one 61,440-byte GLB and five maps totalling 4,088,956 bytes. The normal map is 1024 square, broad lighting 2048 square and the single reference glossy map 1024 square. No raw EXR is loaded by the ceiling component.

Geometry: `public/models/theatre/ceiling.glb`.

Maps: `public/textures/theatre/ceiling/` (`irradiance.ktx2`, `normal.ktx2`, `environment.ktx2`, `specular.ktx2`, `display-lut.png`). The runtime manifest is `components/corridor/theatre-ceiling-assets.json`; it records exact current file sizes. Raw EXR bakes and the full .blend stay outside public assets. Shared Draco/Basis decoders and application code are not included in that manifest's total.

## Reproduction

Run `inspect-theatre-ceiling.py`, `prepare-theatre-ceiling.py`, `audit-ceiling-uv.py`, `bake-theatre-ceiling.py`, the approved camera-pass script, `clean-ceiling-normal.py`, and `denoise-ceiling-lightmap.py` in background Blender. Encode with `encode-theatre-ceiling.mjs`. Verify using `prepare-ceiling-ids.mjs`, `verify-theatre-ceiling.mjs`, TypeScript, ESLint, a production build and matching browser captures. `compare-ceiling-reference.mjs` records three source-camera appearance regions and a non-ceiling image patch; these are limited image comparisons, not a fidelity percentage.

The previous heavy floor assets remain unchanged because the current authorised work is ceiling alone. Whole-site loading speed is therefore separate from this ceiling package's size and performance.

## Power-cut recovery and polish

Resumed the interrupted camera-diffuse bake after power recovery. Broad diffuse and reference glossy fields are baked with geometric normals; fine plaster detail remains in the separate PBR normal map. Illumination fields receive a small offline median/firefly filter, OIDN denoising and a final low-pass polish. This removes bake mottling without changing model shape or smoothing the normal map indiscriminately. Unused atlas regions are protected with filled gutters before mips; the normal background is filled and vector-filtered before reducing to 1K.

Final evidence: `ceiling-polished-1920.png`, `appearance-comparison.json`, `cleanup-verification.json`, `geometry-verification.json`, `uv-verification.json`. A checked non-ceiling image rectangle has **zero changed channels over 2,520,000 channel comparisons**. Source-camera appearance is close but not pixel-identical: the outer soffit still differs more than the centre inset and front cove. No fidelity percentage is claimed.

Final production build, TypeScript and targeted ESLint pass. The root, ceiling GLB and all five maps return HTTP 200 on the LAN preview. A desktop opening capture and a 390 × 844 camera-travel check complete without browser errors. The checked warm ceiling patches contain no blue-dominant pixels; this does not establish absence of artefacts on every GPU. The mobile-sized test uses the desktop GPU and is not a real-phone FPS measurement. The floor component, shader, manifest, GLB and nine texture files match their recorded hashes (13 files unchanged).

The final user screenshot is `ceiling-complete.png`. The final production preview is `http://192.168.1.5:3000/` on the same LAN.

## Ceiling cleanup and floor disabled — 2026-10-23
- Floor replacement removed from the mounted scene; original diagnostic floor faces restored.
- Both floor texture folders remain on disk: automatic approval review rejected permanent deletion. They are no longer requested by the scene.
- Ceiling LUT authoring dependency now independent of floor assets.
- Smooth lighting field filtered at 41 texels diffuse / 11 specular; normal map and geometry unchanged.
- Renderer MSAA enabled to reduce jagged trim silhouettes.
- Ceiling download: 3,884,356 bytes; scene asset manifest sum: 8,917,285 bytes. Unused floor files excluded from runtime total.
- TypeScript, production build, ceiling geometry audit passed; browser error log empty. Opening active FPS display 75 on this browser, not a mobile guarantee.
- Screenshot: ceiling-floor-disabled-final.png. Remaining soft tonal variation is visible; exact Blender equivalence is not claimed.

## Third refinement — 2026-10-23
- Current processing: scripts/blender/refine-ceiling-islands.py (supersedes whole-atlas polish).
- 22 UV sections filtered independently with normalized convolution; broad plaster uses a wider filter than the curved trim. Premultiplied push/pull extension protects gutters without borrowing adjacent surface colours. Finite/range assertions prevent HDR padding corruption.
- Ceiling-only anisotropy raised to device-capped 16; material dithering reduces colour banding below one display code value. MSAA from the previous pass retained.
- Geometry, normal texture and all original models unchanged; audit still 4,992 ceiling triangles and 20 original hashes unchanged.
- Ceiling 3,682,212 bytes (3.68 MB), down 202,144 bytes (5.2%) from pass two. Active scene manifest total 8,715,141 bytes (8.72 MB), excluding website JS and decoder code.
- Production build, scoped ESLint, geometry audit, opening and pullback browser inspections passed. Browser console errors empty. Desktop panel showed 75 active FPS; no physical mobile measurement made.
- Matching-view non-ceiling patch: 0 changed channels. Local residual metrics in third-refinement-verification.json; they are limited patch checks, not proof of perfect rendering.
- Review screenshots: ceiling-third-final.png, ceiling-third-1920.png, ceiling-third-closeup.png and ceiling-third-pullback.png.
- Prior approved public KTX2 assets and screenshot preserved in pass-two-backup/.

## Re-run of third refinement — actual accepted runtime
The prior third pass did not resolve the user's visible defects. Investigated official Blender bake margins and Three colour-management documentation. A fresh 4096 combined bake at 1024 samples was produced in a background authoring session, with original source materials and adjacent-face margins. The standalone combined bake was NOT retained in runtime: its rear-view lighting and UV seams were inferior. Files/scripts named combined are experimental authoring artifacts and are not loaded by the final scene.

Final runtime keeps the previous PBR maps for travel and adds a 44,910-byte WebP camera-projected ceiling reference from the approved Blender render. It fades from the opening reference into PBR over camera distance 0.15–9 units. This is a camera-specific appearance correction, not a claim that realtime PBR became pixel-identical to Cycles, nor an all-angle solution. Geometry, original model files, floor, other materials and journey code unchanged.

Active ceiling assets: 3,727,122 bytes. Active scene model/texture manifest sum: 8,760,051 bytes, excluding website and decoders. Larger experimental combined maps remain on disk but are not requested by runtime.

Production build, scoped ESLint, original-geometry/hash audit passed. Opening and pullback inspected at 1920x1080; console errors empty; opening panel active FPS75. No physical mobile FPS claim. Final screenshot ceiling-corrected-final.png; pullback ceiling-corrected-pullback.png. Comparison remains imperfect: RMS/255 inset3.03, outer-soffit15.92, front-cove1.42. Old report's non-ceiling pixel rectangle compares against a pre-floor-removal baseline, so it is not a valid scope-invariance check; model hashes and code scope provide the invariant evidence here.

Sources: https://docs.blender.org/manual/en/5.1/render/cycles/baking.html and https://threejs.org/manual/pages/color-management.html

## Controlled section test and UV-seam repair
Direct original Blender corner-normal audit matches all 4,992 triangles; max difference0.0532 degrees and zero corners changed over1 degree. The earlier comparison against the diagnostic model was misleading. Do not deploy ceiling-normal-test.glb or ceiling-native-test.glb as a normal repair; originals are correct.

Tests without opening correction: diffuse-only still shows trim break, ruling out normal map and specular reconstruction as necessary causes. Whole-field quartic smoothing removed breaks but worsened reference RMS: trim4.45→6.87, plaster2.54→2.96, rejected. A dedicated native-UV cove bake still showed seams, rejected.

Accepted local method: stitch-ceiling-light-seams.py matches lighting values only across146 UV cuts on smooth connected surfaces of Slim floating soffit and Continuous rolled plaster cove. A4-texel correction band preserves surrounding illumination and leaves materials, bump, geometry and UVs unchanged. Trim reference RMS4.455→4.211; plaster2.543→2.474 in selected patches, not a full-ceiling identity claim. Comparison image rows: Blender, previous PBR without image correction, stitched PBR without image correction. Screenshot section-stitched-after.png. Review URL /?ceiling-test=stitched disables opening-image correction. Standard / retains the existing opening correction.

Accepted stitched irradiance copied into active irradiance.ktx2. Ceiling3,730,063B; scene8,762,992B excluding JS/decoders. Main scene unaffected outside ceiling; original20 model hashes and geometry audit pass. Build and scoped lint pass; test browser console empty. Experimental files remain authoring/test assets, not standard runtime downloads.

## Final requested local refinement
User-marked black ceiling-to-wall strip investigated as existing right crown closure (view-left). Both original closure normals point +X, so that closure's baked front-face illumination was outward-facing. Background-only bake copy reverses that face to calculate the room-facing diffuse/glossy response. Runtime geometry, normals and original .blend files unchanged. New irradiance-final/specular-final retain stitched lighting elsewhere. Newly rebaked chart alone gets3px median/Gaussian cleanup. Opening correction excludes |local X|>8.18 to allow the physical edge lighting to show.

Opening reference receives3px median with restrained edge sharpening and WebP quality98; actual PBR normal/bump texture unchanged. This is a local noise/compression cleanup, not a guarantee of zero aliasing on every display or pixel-identical Cycles.

Final active ceiling:3,741,859 bytes (3.74 MB),11,796B above preceding local repair. Active scene manifests8,774,788B (8.77 MB), excluding website/decoder code. Original20 model hashes,4,992 ceiling triangles and geometry audit unchanged. Scoped lint and production build pass. Browser opening panel75 active FPS at1920x1080; console errors empty. Physical mobile FPS not measured. Final screenshot ceiling-final-refinement.png. Existing image correction retained for opening; PBR travel retained.

## Crispness and intentional shadow restoration
User requested restoration of Blender's thin dark reveal and whiter cove, with less dullness/blur. Kept the room-facing edge bake; added a narrow, smoothly filtered shadow treatment on the existing crown closure at its visible lower join (local |X|8.16–8.21,Y6.74–6.79). This is material shading on existing geometry, no added strip/mesh.

Opening reference now uses the256-sample1920x1080 Blender source, cropped at native resolution, restrained0.5sigma edge sharpening, no median blur, lossless WebP388,960B. Projection texture linear filtering without mip softening; device-capped16x anisotropy. High-luminance ceiling pixels alone receive up to20% neutralisation toward their peak channel and3% gain to bring the cove highlights closer to white. Broad plaster colour is below that highlight range. This is visual calibration, not exact Cycles parity.

Final ceiling4,072,743B (4.07 MB); full active model/texture manifest9,105,672B (9.11 MB), excluding site code/decoders. Increase330,884B over preceding3.74MB version intentionally retains image detail. Original geometry,4,992 ceiling triangles and20 original model hashes unchanged; scoped ESLint, TypeScript/production build and geometry audit pass. Screenshot ceiling-crisp-final.png. Opening panel75 active FPS at1280x720 in test browser; no physical mobile result claimed. Existing opening projection fades into PBR travel; remainder of theatre remains diagnostic colours.

## Wide-viewport seams corrected

The preceding shadow treatment was rejected by the user. Removed it completely, including the local-height varying. Two new vertical lines came from hard clipping the 16:9 opening projection inside a 1920x945 viewport. Rendered the original Blender source again at3072x1080 with the same vertical40-degree FOV, camera position and256 samples; original .blend was not saved or altered. The opening crop is3072x360, lossless650,696B. The shader projector now matches that wider source. Its extreme4% horizontal margins feather smoothly rather than switching at a hard boundary; these margins are outside the user's tested1920x945 opening. Removed the additional world-X coverage band, so the opening reference no longer stops across the crown closure.

Verified opening at1920x945 and1280x720, plus pullback at1920x945. The two vertical boundaries are absent; the artificial dark side band is removed. Screenshot ceiling-wide-fixed.png. Scoped ESLint, production build and original geometry/model hash audit pass; browser console errors empty. Ceiling4,334,479B (4.33MB), total active model/texture manifests9,367,408B (9.37MB), excluding code and decoders. No geometry, camera journey or non-ceiling materials changed. This retains the existing camera-specific correction and PBR fallback; it is not a claim of all-angle Cycles equivalence.

## Texture placement check only

Read-only audit of all4,992 exported ceiling triangles: both UV channels present and identical, finite coordinates within0.006205–0.993997, zero collapsed UV triangles. Prepared Blender atlas raster audit at2048x2048 found zero overlapping pixel centres (not an analytic subpixel guarantee). Area-weighted median local UV anisotropy1.000002;95th percentile1.000602. However2.0806% of the surface has more than5% local distortion, with maximum1.4424 on Continuous rolled plaster cove, triangle1199, source centre(2.87578,17.49429,6.51333). Therefore do not call every ceiling UV perfectly unstretched. Broad surfaces are effectively isotropic; distortion is local to the curved cove. Actual lighting/normal/specular resolutions2048/1024/1024; environment1024x512. Source projection3072x1080 and3072x360 top crop use matching aspect and vertical remapping, not a squashed full image. Browser inspection includes both normal opening and actual PBR with opening correction disabled via existing test query. No runtime code, textures, geometry or Blender files edited by this check. Detailed data in texture-mapping-check.json and uv-verification.json.

## Cove UV repair

Re-unwrapped Continuous rolled plaster cove with angle-based flattening and existing chart seams. Kept each chart within its prior reserved rectangle using a uniform similarity transform; four tiny problematic corner cap polygons receive separate planar charts in verified unused atlas space. Minimum-stretch and conformal alternatives were tested in disposable background scenes and rejected. No original Blender file saved or changed.

Lighting and glossy maps were transferred triangle-by-triangle from the existing HDR maps to repaired UV coordinates. Tangent normal directions were rebaked on the cove only at2K, then vector-filtered to the existing1K runtime size. Atlas pixel-centre overlap and gutter checks pass. Non-cove occupied source texture pixels have zero change before encoding. Runtime model contains the same4,992 triangles and original positions/normals; UV vertex splits add24 vertices. Original20 model hashes remain unchanged. Scoped geometry audit position error remains below0.000009m. Draco texcoord precision20bits retained explicitly (TEX_COORD encoder key), followed by exported-model UV audit.

Actual exported cove:2,688 triangles, maximum local anisotropy1.04712 and zero triangles above5% stretch. Overall ceiling area above5% distortion fell2.08064%→0.08346%; remaining distortion is in other existing ceiling trim, outside this cove repair. This is not zero distortion on an intrinsically curved surface. Full report texture-mapping-fixed.json. New model ceiling-uv-fixed.glb55,860B. Active ceiling4,353,649B (4.35MB), increase19,170B. Original appearance projection/environment/LUT unchanged. New lighting, specular and normal filenames prevent stale cache pairing with old UVs. Legacy inspection modes retain their matching old model/maps.

Production build, TypeScript, scoped ESLint and geometry audit pass. Browser opening checked at1920x945, and direct PBR without opening correction plus pullback at1280x720; console errors empty. Screenshots ceiling-uv-fixed-final.png and ceiling-uv-fixed-pullback.png. No changes to floor, walls, sofas, projector, corridor, logo or camera journey.
