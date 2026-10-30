# Scroll-driven steel-to-colour reveal

The final eye remains unchanged until the following diagonal section is scrolled.
The same smoothed progress drives the white alpha boundary, a native-resolution
camera magnification of 1.00–1.10, and the centred colour mark. The mark shares
its parent's exact feather rather than starting on a separate timer. Its width
is 1.17 times the current projected pupil diameter; the source image keeps its
original aspect ratio. The existing 0–240 px edge control still applies.

The supplied transparent PNG is copied byte-for-byte into public/images. An SVG
viewBox crops its empty canvas margins at display time; no image pixels or GLBs
are edited. Full white coverage continues to pause the existing 3D/pulse work.
Upward input reverses the same progress, and leaving the final stop clears zoom.
Motion uses a 0.18-second time constant and sleeps at its target. Reduced motion
sets the requested progress directly. No per-frame React updates, new shader,
new post-processing pass, particle changes or earlier camera-path edits.

Validation: production build, TypeScript, scoped ESLint and three transition
checks passed. Chrome verified centre crossover, full-white completion and
reverse-to-eye. Native 1920×945 captures and immediate pre-task source backups:
D:/CodexOutputs/Colour_Logo_Reveal_20261029/. Background-tab throttling prevents
an honest desktop FPS measurement here; no new rendering pass was introduced.

Protected eye-one, eye-two and eye-three checkpoint refs are unchanged.
