# Cinematic step 3 — deep-space grade

`space-grade.ts` applies one creative display-space grade after the existing particle view-LUT, original transparent compositing and star bloom. `star-bloom.tsx` owns its preparation, draw order and cleanup. No camera, GLB, particle geometry/data, physics, original blending, original shader or view-LUT source changes. No new dependency or downloaded asset. Keep `refs/checkpoints/eye-one` unchanged.

## Look and controls

`SPACE_GRADE` contains the artistic controls:

| Control | Current value | Purpose |
| --- | --- | --- |
| pools | .20 | Faint lighter/darker variations multiplying the existing nebula colour |
| vignette | .105 | Up to 10.5% darkening toward the outer frame |
| contrast | .12 | Gentle, zero-preserving luminance S-curve |
| shadowToe | .028 | Deepen shadows without a lifted black floor |
| silver | .55 | Selectively neutralise bright low-chroma foreground metal toward platinum, with a very small blue bias |
| shadowCool | .12 | Restrained cool bias only on neutral near-black tones |

The pools use low-frequency noise evaluated on world-space camera rays. They stay in the distant environment as the authored camera turns, rather than becoming a screen-fixed cloud overlay. They multiply existing light: no new palette, fog or illumination appears in black regions. The existing green, purple, champagne/teal directions are not neutralised. The existing bloom occlusion mask keeps the pools off foreground geometry and grains; a dark-colour classification is the conservative fallback when that mask is unavailable.

Metal selection uses foreground coverage, highlight luminance and low saturation. It leaves the coloured nebula and warm stars alone. It changes grain tone/contrast without blurring or expanding a grain. The grade runs **after** the private bloom extraction and cannot feed back into it, so it cannot make resting iris particles bloom. The final eye still has no bloom draw.

Fine monochrome grain is evaluated at native framebuffer pixels. It is static and does not invalidate frames; this avoids noise shimmer and preserves reduced-motion/demand idle. Its dark fade keeps literal black at zero. Grain masks quantisation/banding; it cannot reconstruct tone precision already lost in the source display framebuffer.

## Display pipeline and scope

The source is copied on the GPU from the already-rendered display framebuffer into a native-size `FramebufferTexture` using `NoColorSpace` and nearest filtering. The fullscreen shader reads/writes those display values directly: no sRGB decode/encode, new LUT, exposure or second display transform. The renderer remains NoToneMapping, including the existing step-1 compatibility treatment for ordinary legacy materials. The source particle shaders are untouched.

An identity diagnostic verifies this copy path against grade-off captures: only isolated one-code-value rounding differences are allowed. The original particle compositing framebuffer is retained; rendering all particles into a different linear intermediate would change their approved appearance.

The creative grade is active during `logoReveal` / `logoDone`, after the eye becomes visible. Earlier theatre, projector and HTML-page stages retain their current appearance. The isolated `/eye-study` is unaffected. Nebula modulation requires the sky to be visible and is disabled in the final black-background eye; contrast, platinum treatment, vignette and fine grain remain.

## Cost and ownership

One native-size GPU framebuffer copy plus one fullscreen draw per existing demand frame. No scene/particle rerender for grading, CPU readback, new bloom threshold, continuous animation, or camera edits. Reuse the already-paid star-bloom mask.

| Profile | Pool noise octaves | Grain hash samples | Grain amplitude in display code values |
| --- | --- | --- | --- |
| desktop | 3 | 2 | .65 |
| laptop | 2 | 1 | .55 |
| mobile | 1 | 1 | .45 |

`effectQuality(gl)` / its existing mobile detection select the profile. Native image sampling stays full resolution on every tier so the particles do not become blurry. The tradeoff is keeping one RGBA8 frame texture (about 6.9 MiB at 1920×945); lower tiers remove procedural work rather than downsample the subject. No HDR frame copy is needed for a display-referred artistic grade.

Prepare the shader into a private 1-pixel target in the same stationary job as bloom, after the original eye atlas is available. Do not render the grade before preparation. Do not gate projector readiness. Restore render target and renderer auto-clear after preparation/draw, release old frame textures on resize, and dispose owned frame/mask/material/quad resources on unmount. Never capture or grade a mirror/private framebuffer.

Local diagnostics (localhost/127.*, with `diagnostics=1`):

- `grade=off`: bypass copy and grade, retain existing star bloom.
- `grade=identity`: exercise the native copy/output without a creative transform.
- `grade-grain=off`: compare the same grade without the grain/dither.

## Verification

Evidence directory: `D:/CodexOutputs/Space_Grade_Step3_20261027/`. Native 3840×1890 before/after captures use the same two existing stops, aspect ratio and reduced motion. HTML diagnostic panels are hidden only during capture.

Build, TypeScript, scoped ESLint and 61 regressions pass. The three new checks cover native source precision/resolution, no camera mutation, disabled/private/unprepared draws, resource reuse/resize and renderer-state restoration after a draw error. Browser comparisons additionally check identity, both camera stops, every compiled quality profile, resize and the final eye. Desktop cadence remains approximately 13.3 ms / 75fps at 1920×945, p95 about 13.5 ms on this workstation. Profile/emulation checks are not physical laptop/phone performance claims; 4K images are inspection artifacts, not a 4K/60 guarantee.

The full ordinary scroll journey passes, with grade draws at both close stops and the final eye, no final iris bloom draw, and no draw during reduced-motion idle. Eye asset requests still begin at `screensDone`. An Android/touch/DPR-3 context keeps its 585×1266 native canvas and 1040-instance temporary field and survives `/eye-study` navigation/remount without errors.

Pixel checks: grade identity differs by at most one display code value at a few isolated pixels; no pure-black source pixel is lifted. Measured bright low-chroma grains move toward neutral (G/R approximately 1.076→1.036 in View 1 and 1.062→1.030 in View 2), retaining a slight cool bias. A grain-on/off comparison adds at most one code value per channel in sampled dark sky (approximately .46–.49 code RMS); inspect the native captures rather than a compressed preview for its fine texture. The PNGs show no obvious banding rings. Original camera/particle/LUT/assets and the scene entry source pass the integrity comparison.

Next.js feedback audit: no qualifying framework issue retained. Routine shader/test-double corrections are implementation debugging.
