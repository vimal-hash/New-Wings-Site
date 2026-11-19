# Hover outline and section scrollbar (2026-11-19)

Two design items from the 2026-11-16 three-lens review. The user's answers: scrollbar "do it"; contact pill "its fine, let it be"; rope tunnels and grey sphere "keep them, dont touch"; hover outline "do it", "make sure it dont look like AI", "make it as object based outline", "make it simple", "smart and optimized", with the pmndrs "shopping" example as the reference (https://pmndrs.github.io/examples/examples/shopping).

## Section scrollbar

`.normal-page` (the HTML sections) keeps `overflow-y: auto` but hides its bar: `scrollbar-width: none` plus `::-webkit-scrollbar { display: none }` for older Safari. Steps move the page (`scroll-step.ts`), so nothing needed the bar. The page still scrolls (keyboard, find-in-page, programmatic steps); the section frame is now centred on the full window width (the 15 px bar is gone).

## Hover outline: round the object, not round what is in view

Before: the outline was found from the picking ID buffer, which also draws every other theatre mesh (occluders). So it traced only the visible part of the hovered object, and every seat, rail or wall in front of it cut a notch into the line ("the outline is coming in visible direction").

Now (`hover-catalogue.tsx`), like the shopping example's selection outline:

- `collect()` builds two proxy scenes from the same live meshes: the ID scene (catalogue items plus occluders, for picking, unchanged) and a **mask scene** (catalogue items only).
- The mask materials are the ID shaders built with `MASK`: a vertex whose ID is not in the selection table (`uSelected`) is moved outside the view, so only the selected object is rasterised, and nothing stands in front of it. Its full silhouette lands in the mask, including the parts hidden behind other things (a back-row sofa's line runs down through the front-row sofa).
- The mask is one channel (`RedFormat`), CSS-pixel size, 4x MSAA: smooth edges at one byte per sample, a quarter of an RGBA target of the same size.
- `outlineFragment` reads only the mask: nine taps that all agree discard most pixels; near the silhouette, the share of a 2 px disc inside the mask gives the distance to the edge (straight-edge relation `covered = .5 + 2d/(πr)`), and the line is drawn `OUTLINE_WIDTH = 1.5` CSS px wide, anti-aliased by one pixel. No fill and no glow (the old faint fill and the exploded-view halo are gone).
- Strength per stop: theatre .92 white, exploded projector .78 white, assembled projector .22 cool; fade in/out .18 s; the lit theatre's seat cue (all sofas at 65%) uses the same mask.
- Optimised: while the theatre camera glides after the mouse, a lit outline now redraws only the mask (selected object only) each frame. The ID buffer (every theatre mesh) is redrawn only when a pick asks for it, at most once per 136 ms (`THEATRE_STILL_MS` + 16), instead of every frame. `pose` counters keep each target drawn once per camera pose. The new programs are compiled ahead of the first hover in the existing dry runs (`prepare`, `prepareProjector`).

Unchanged: picking, catalogue names, the screen name and plate, click-to-enquire, the assembled projector's focus look (blur, cool key light and faint halo of `focusFragment`; not part of this request).

## Checked (headless Chrome on the RTX PC, dev server 3100)

- Theatre: hovering the seats, screen, ceiling, left wall and the "Interior design" moon rings picks the right item and draws one clean line round the whole object (front-row sofa, back-row sofa through the front row, the wall, the rings' outer and inner edges).
- Lit theatre: seat cue at 65% round the sofas; hovering a sofa lifts it to full.
- Exploded projector: "Outer shell and panels" outlines every panel of the group whole.
- Assembled projector: picks "RGB laser cinema projector, 4K", line and focus as before.
- Frame pacing while the outline follows the gliding camera across the seats (400 frames): median 13.3 ms, worst 13.6 ms, none over 25 ms (75 fps). No console errors.
- Sections: `.normal-page` computes `scrollbar-width: none`, bar width 0, still scrollable.
- `scripts/hover-outline.test.mjs` (5) guards the mask, the shader, the target and the scrollbar; 238 tests pass, tsc and eslint clean.

Not checked: Safari, a laptop GPU, hi-DPI screens by eye (the width and radius scale with the pixel ratio).

Evidence and backup: `D:/CodexOutputs/Hover_Outline_Scrollbar_20261119/`.

## Revert

Restore `app/globals.css`, `components/corridor/hover-catalogue.tsx` from `D:/CodexOutputs/Hover_Outline_Scrollbar_20261119/backup/` and delete `scripts/hover-outline.test.mjs` and this folder.
