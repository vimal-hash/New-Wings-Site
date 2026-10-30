# Individual letter interaction

Each of the 17 visible characters now has an independent mouse-repulsion wrapper.
The word wrappers no longer move. Letter force is capped at 6px with a 70px local
influence, easing back to rest through the existing event-driven controller.

The original two WebP word images are unchanged. Read-only alpha/ink analysis
identified the 8 + 9 glyph ranges. SVG source windows partition each entire image
exactly, preserving all original type, spacing, shading and colour. The manifest
records the ink bounds so tests can guard against clipped glyphs. The existing
opposing centre-out reveal masks stay in place during entry and are removed when
entry completes, allowing moved letters to cross the former word box freely.
Screen-reader text, reduced motion, mobile stacking and other object animations
are retained.

Build, TypeScript, scoped ESLint and four letter/repulsion checks passed. Source
backups and read-only analysis: D:/CodexOutputs/Brand_Letter_Motion_20261030/.
Named visual checkpoint refs are untouched.
