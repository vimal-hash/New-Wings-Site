# Cinema lens comparison

Option 3 is approved for asset preparation: separate depth groups while authoring, two static registered appearances during playback. No independent artwork motion is required.

This comparison uses the user's approved clean master and their current ghosted candidate. It displays the clean image through two movable lens-shaped masks with identical image coordinates and scale. The dark frame is a two-dimensional comparison guide, not the final 3D glasses model.

The production scene and camera journey have not been modified. The original supplied PNGs are preserved under `assets/`. Lossless WebP copies reduce the size of the inline comparison; the build checks exact decoded RGBA pixel equality.

Build with `node docs/cinema-opening/build-preview.cjs` from the project root. The output is the thread-scoped `cinema-lens-comparison.html` conversation preview. It has full-width and 360-pixel image modes, plus clean/ghosted/lens comparison controls.

This is a visual registration and clarity check. It is not a stereo display, a theatre-screen camera test, a physical-device performance test or an FPS benchmark. The actual final screen size and framing must still be checked during integration.

## Comparison review, 21 October 2026

- Browser-checked lens, clean-only and ghosted-only modes; verified keyboard lens-position changes.
- Checked a 736-pixel viewport, phone-sized image mode in a 390-pixel viewport, and a 320-pixel narrow viewport. Actual artwork width depends on surrounding padding.
- No browser warnings/errors were reported during this check. The lossless WebP decoded pixels match the input PNGs exactly.
- The clean image is visibly sharper within the lenses and remains registered. At phone width the difference is subtle; the candidate's ghosting still resembles a soft shadow in places. Recommend refining the secondary edges rather than adding stronger blanket blur.
- `lens-comparison-wide.png` and `lens-comparison-phone.png` record the browser views. These are preview screenshots, not final scene renders.
