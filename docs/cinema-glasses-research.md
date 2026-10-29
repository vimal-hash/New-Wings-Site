# Cinema-glasses opening: research and implementation plan

Research date: 21 October 2026. Status: research only; the opening has not been changed.

Current user-approved decision: option 3 during asset preparation, with two static appearances at runtime. Use the supplied New Wings Solutions brand artwork separated into background, cinema decorations, text and logo. Prepare the clean and depth-dependent ghosted compositions offline; display the clean image through virtual lens masks and the ghosted image outside. No independent artwork-layer movement is required. Earlier live-parallax proposals below are superseded by this decision. The glasses departure and existing camera transition can still move.

Follow-up: [Detailed investigation of layers, blur amounts and cinema lens filtering](./cinema-glasses-optics-deep-dive.md). It distinguishes established optics from proposed numerical settings for our opening.

## Conclusion

Reproduce the reference as an optical-filter illusion combined with a layered image. The real theatre effect and the browser effect are different mechanisms. The website can show clear imagery through virtual lenses and doubled imagery outside them, with compelling depth cues, but cannot send separate pictures to the viewer's physical eyes on an ordinary display.

The reference is a supplied still, not an inspectable original video or application. Its exact projector type, processing, motion and rendering cannot be established. The explanation below distinguishes established optics, plausible interpretation and proposed art direction.

## What cinema glasses actually do

Stereo projection supplies different views for the two eyes. Glasses separate them using polarization, wavelength filtering or timed shutters. They filter unwanted imagery rather than refocus a blurred picture. A camera filming through one lens can therefore capture one cleaner eye view; that single recording does not preserve the audience's binocular stereopsis. [Barco: Can you watch 3D with one eye closed?](https://www.barco.com/de/news/news-insights/2016-03-03-can-you-watch-3d-with-one-eye-closed)

Different systems need different filters: Dolby documents wavelength/color separation for its 6P laser system. A blue-looking lens in a recording does not identify its cinema technology. [Dolby professional documentation](https://professional.dolby.com/product/dolby-cinema-imaging-products/dolby-3d-bundles/)

Without glasses, both projected views reach the observer. In simplified parallel-camera geometry, horizontal disparity relative to a chosen screen plane is proportional to `f * B * (1/Z - 1/Z0)`: focal scale, stereo baseline, object distance and screen-plane distance. This is a geometric model, not a pixel setting to copy into our site. Separation is small near the screen plane; foreground and background can shift in opposite directions. Distance alone does not determine the ghost offset.

Residual ghosting through glasses is crosstalk, an imperfection rather than the desired depth effect. Its visibility depends on image contrast, separation and the projection/screen system. [Barco: Of ghosts and screens](https://www.barco.com/en/news/news-insights/2017-02-20-of-ghosts-and-screens)

## Reading the supplied reference

Observed: glasses occupy the foreground, the uncovered screen has coloured duplicate edges, and the image through the lens appears more coherent. Character and landscape retain broadly corresponding screen positions.

Inference: the contrast between filtered and unfiltered eye views plausibly accounts for the clarity change. The character's overlap, detail and contrast against the landscape contribute to the apparent depth. Recording focus, compression or editing could contribute to coloured outlines or softness; the still cannot distinguish these causes.

Correction to our earlier explanation: a third progressively blurred mountain is not a requirement of stereo projection. A central image plus two faint shifted copies is a useful artistic construction, not an exact model of a two-view projection system. Modern cinema stereo also does not require red/cyan colouring.

For our version, retain the user's preferred hierarchy: dominant image, weaker cool ghost, very faint softer contour. Build these from the same artwork, with different offsets for depth layers. Keep the clean image coherent inside the lenses; do not leave obvious ghosting there.

## How depth is perceived

Binocular disparity is one cue. Overlap, perspective, relative scale, shading, atmospheric contrast and blur also contribute to depth in a single-eye view. Mountains may appear more distant because of haze and reduced contrast; softness should support that reading rather than be applied uniformly. [Webvision: The perception of depth](https://www.ncbi.nlm.nih.gov/books/NBK11512/)

Relative movement supplies another cue: near and far objects move differently as viewpoint changes. This supports using a small controlled parallax movement. Pointer position is a user-controlled viewpoint proxy, not actual head tracking; device motion is unnecessary. [Review: The neural basis of depth perception from motion parallax](https://pmc.ncbi.nlm.nih.gov/articles/PMC4901450/)

Accommodation is optical focusing; vergence is the eyes' inward/outward alignment. True stereo displays can ask these systems to respond to different depths. Research links that conflict to discomfort. Our ordinary-screen illusion does not reproduce true stereo vergence demand, so those studies do not provide a numeric safety threshold for our shader. They do reinforce the distinction between visible blur and optical focus. [Hoffman et al.: Vergence-accommodation conflicts hinder visual performance and cause visual fatigue](https://pmc.ncbi.nlm.nih.gov/articles/PMC2879326/)

Design inference: the effect should be understandable before it becomes technically elaborate. The glasses frame establishes a foreground object, clean-versus-ghosted contrast communicates the filtering, and overlap plus subtle relative motion communicates depth. Excessive ghosting would weaken that visual hierarchy. These are design choices, not evidence that all viewers will experience the same depth or emotional response.

## What the artwork needs

Preferred: one authored composition delivered as a few aligned layers—background/sky, distant mountains, middle environment, foreground subject. Include filled-in background behind the subject, alpha masks, a common crop and modest overscan for motion. A compact depth map is optional when layers are insufficient.

A single image and depth map can reveal holes or stretched edges when the viewpoint exposes previously hidden content. Research on layered depth inpainting explicitly addresses those missing regions. Prepare that content offline; do not run an image-generation or depth-estimation model in the visitor's browser. [Shih et al., CVPR 2020: project and examples](https://shihmengli.github.io/3D-Photo-Inpainting/)

Two separately generated pictures are a poor starting point: changed anatomy, crop or object positions would make the lens boundary look like a replacement picture. One flat image can demonstrate ghost removal, but will not support convincing independent foreground/background movement without additional artwork preparation.

## Proposed rendering architecture

Keep this as one removable opening feature in `new_site_three`, using the existing theatre and opening camera.

1. Put the layered composition on the actual theatre screen. Both appearances share the same image coordinates, crop, anchor points and parallax state.
2. Render the ghosted version as the base screen appearance. Offsets are mostly horizontal and vary by authored layer depth. Pre-soften the faint contour in the artwork where possible.
3. Use the projected lens silhouettes to reveal the clean screen version. The clean version uses identical image coordinates: no zoom, refractive UV distortion or independent picture scaling.
4. Render a low-polygon glasses frame, bridge and temples with thin lens surfaces. Use restrained tint, angle-dependent highlights and a small reflection asset. These are visual cues; optical refraction is not what removes the ghosts.
5. Draw the room once. Redraw only the screen content inside the lens mask if needed. The masking system must respect the glasses' real shape, render ordering and scene depth.

Official drei documentation describes stencil masks as a way to restrict content without double scene rendering or portals. This is a candidate implementation, not a measured performance result. Enabling stencil support, anti-aliasing the lens edge and testing transparency ordering remain implementation tasks. A screen shader with projected lens contours is an alternative if stencil edges are inadequate. [drei Mask documentation](https://drei.docs.pmnd.rs/portals/mask), [Three.js Material stencil properties](https://threejs.org/docs/pages/Material.html)

An offscreen render target is justified only if the artwork becomes more complex. It should contain the small screen scene, never a second theatre render. [Three.js Render Targets manual](https://threejs.org/manual/pages/rendertargets.html)

Important continuity rule: if the subject moves relative to the mountains, that same movement must exist outside and inside the lenses. Only ghosting, subtle tint and clarity should change at the boundary. Adding unrelated parallax inside the lenses would create a visible image jump.

## Integration with the current opening

Local code inspection found `reference-camera.json` defines a 2-second hold and a 2.5-second pullback. The current scene uses simple ambient/directional lighting and diagnostic theatre materials. Full theatre material/lighting restoration is not currently active in this rebuild; do not assume the old project's lighting is already driving it.

Proposed sequence:

- On first reveal: room dim, screen illuminated, glasses already framed near the viewer; clear subject visible through at least one lens and ghosted content visible alongside it.
- During the hold: restrained shared parallax, plus foreground shading on the glasses. Keep enough screen detail visible to understand the contrast.
- As pullback begins: glasses rotate and drift out smoothly; mask follows them exactly. Ghosted imagery becomes exposed before the projection fades.
- During the same pullback: projection dims and room lighting rises with overlapping eased curves. Avoid an instant screen toggle or an expensive dynamic projector beam.
- At the end: remove the glasses, projection layers, masks and their temporary resources; return to the approved journey and demand rendering.

Drive all opening effects from the existing intro progress, not independent timers. Start when the opening's required resources are ready. Do not wait for unrelated future high-quality assets. Keep the 2-second hold initially; whether it is enough to read the effect is an artistic decision to verify.

Portrait composition needs explicit attention: two small lenses and a bridge can conceal the subject. Adjust the glasses' position and scale while preserving image registration. One lens can be the main reveal window without inventing different pictures for the two virtual lenses.

## Starting budgets and checks

These are proposed engineering targets, not benchmarks or scientific limits:

- Glasses: approximately 1,000–3,000 triangles, few shared materials.
- Screen artwork: start around 1K resolution with a small layer count; consider 2K only if visibly needed. Measure decoded GPU memory as well as file size.
- No real-time ray tracing, transmission sampling of the theatre, full-screen depth-of-field or recurring environment captures.
- Prefer offline background softness and contour preparation over live multi-pass blur.
- Aim for under 2 ms incremental GPU cost on the actual target laptop; validate rather than promise it. Preserve the existing render-resolution cap.
- Respect reduced motion: suppress parallax and sweeping glasses motion while retaining a readable clear/ghosted comparison and gentle fade. [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)

Acceptance checks: one object does not jump in size across the lens edge; ghosts follow depth and stay outside the clean mask; there are no halos around the subject; glasses do not look like a flat UI sticker; screen remains registered during pullback; screen fade and room lights overlap naturally; no leftover rendering cost after intro. Compare laptop/mobile timings with the feature enabled and disabled.

## Next decision

Agree on the screen subject and glasses framing before preparing assets. Then obtain/create the glasses and aligned artwork layers, implement directly in the opening behind one removable feature switch, and review the full transition. Research does not require us to rebuild the theatre, change the approved camera journey or add a second scene route.
