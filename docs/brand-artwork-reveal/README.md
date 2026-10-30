# Brand artwork after the colour mark

Uses the supplied positions.json and 26 original transparent WebP layers
(138,520 bytes total). The existing colour mark is reused; the duplicate logo
layer is omitted. No image pixels, eye materials, geometry or camera are changed.

The entry point is calculated from the diagonal mask's opaque shoulder and the
complete projected logo rectangle. A 1.2% scroll margin ensures that text begins
after the mark is clear of the feather. Entering this state automatically runs
finite Web Animations: the two title layers resolve gently outward from the
centre, then cinema icons, peripheral motifs and small accents fade/settle in.
No extra scroll or click is required. Returning below the entry point cancels
and resets the entrance. Reduced motion uses an immediate still composition.

Desktop/laptop title spacing derives from the existing logo width, preserving
the reference's relationships. Peripheral layers use their supplied relative
positions with native aspect ratios. Below 700px, the two title layers stack
below the logo to keep the full name readable. Assets use next/image unoptimized
so the already prepared WebP line work and lettering remain unchanged.

Checks: production build, TypeScript, scoped ESLint and five transition tests.
Chrome confirmed all 26 assets loaded and visible at completion, zero visible
artwork layers at the half-way pupil crossover, the 1366x768 layout, narrow-screen
reflow and reverse reset. The existing covered-scene pause remains in place.
Snapshots and pre-task source: D:/CodexOutputs/Brand_Artwork_Reveal_20261030/.
Named eye-one/two/three checkpoints remain untouched.
