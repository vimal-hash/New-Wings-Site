# Object-specific brand motion

Text wipes from the centre mark outward: New Wings is revealed from its final S
toward N; Solutions starts at its first S and advances to its final s. The two
soft gradient masks run in opposing directions. No replacement font or artwork.

The four bottom-left rings are isolated with SVG annular masks over the original
WebP. Each scales from .42 to 1 around the actual circle centre, with 160ms stagger.
An alpha check confirmed that the four masks contain every original visible ring
pixel. Sparkles use 89 display-only source crops; 19 larger stars independently
vary brightness with distinct durations and phase offsets. Original pixels/files
are unchanged. Tiny dots stay quiet.

Reels/apertures rotate slowly; notes drift; speakers breathe; the waveform pulses;
signal equipment shimmers softly; the spotlight aims gently; glasses/ticket sway;
the clapper/projector nod; the film strip and valance move slightly. The screen
opens from the centre; seats enter from below. Text/logo stay steady at rest.

All 118 outer artwork wrappers, including the colour mark, have a separate mouse
repulsion layer. Displacement is capped at 3–8 CSS px depending on the object.
Ring hit distance uses the actual arc, not its empty interior. Pointer events use
pointerType=mouse rather than a primary-device media query, supporting laptop
mouse/trackpad inputs without making touch gestures move the artwork. One eased
rAF owner sleeps after settling; CSS idle motion pauses on hidden/unrevealed
states. Reduced motion shows a still composition. All owned listeners/animations
are cleaned up; reversing the section resets the entrance.

Build, TypeScript, scoped ESLint and seven motion/transition tests passed. Original
artwork/GLBs and eye-one/two/three refs remain unchanged. Pre-task source and
read-only alpha/component analysis: D:/CodexOutputs/Brand_Object_Motion_20261030/.
