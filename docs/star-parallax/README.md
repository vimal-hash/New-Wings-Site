# Subtle star parallax

`logo-particle-eye/depth-field.ts` now applies `STAR_PARALLAX_GAIN=4` to the distant stars' camera-translation response. The original field already used world-space coordinates, but the 40–140-unit range produced less than one pixel of translation between the two close stops. The adjustment makes that component readable without moving the camera or nearby grains.

Only the projected star centre changes. Size/coverage calculation still uses the original depth, so the sprite footprint, brightness hierarchy, original fixed positions, counts and near-grain motion stay intact. The full camera rotation remains physically correct; do not slow or smooth the rotation of the sky. The translation gain is relative to the existing turned-stop origin, preserving that composition. It is calculated directly from the current camera pose, with no time uniform, accumulated offset, easing, lag, CPU per-point update or additional pass.

The private bloom/material clones inherit the same vertex shader and shared gain uniform, so highlights and occlusion masks track the star centres. Original background atmosphere and colour grade are unchanged. Existing early-pullback fading still removes the stars before the final eye.

Verification: `D:/CodexOutputs/Star_Parallax_20261027/` contains screenshots, recorded live GPU camera/uniform/geometry samples, and projection reports for desktop/laptop/mobile shader profiles during the actual scroll move from View 1 through the turn to View 2. At 1920×945, isolated translation changes from a median ~0.84 pixels to ~3.34 pixels for stars, versus ~24 pixels for nearby grains. Camera rotation is held fixed only in the **analysis** to separate parallax from the shared turn; the production camera and shader use its full authored rotation. No visible trailing motion or new star animation. Turned-anchor displacement is effectively zero; the final eye submits no star draw. The browser reports no errors in all three profiles.

Build, TypeScript, scoped ESLint and 63 regressions pass. The two new tests check readable but restrained depth separation, a stable reference pose, history-free response and retained buffer/sprite properties. Protected camera, eye-motion, LUT, grade and bloom sources are unchanged. The eye-one checkpoint remains `fe1ad8ec53c888be42f08c814ff0192513aae31a`.

Next.js feedback audit: no qualifying framework issue retained. Optional video capture was unavailable because the browser tool's ffmpeg binary was absent; verification used live render samples and screenshots without adding a video dependency.
