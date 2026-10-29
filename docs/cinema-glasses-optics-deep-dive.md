# Cinema opening: layers, blur and lens filtering in detail

Research date: 21 October 2026. Research only; no site, model or runtime rendering changes.

Current user-approved decision: use option 3 to prepare the supplied four-layer brand composition, then export two static aligned images for playback (clean and ghosted). No live artwork-layer motion is required. Treat the live-layer/parallax discussion below as research alternatives, not the selected implementation.

This supplements [the initial research](./cinema-glasses-research.md). It answers the follow-up about exact layer counts, blur types, blur amounts and premium cinema glasses. Scientific findings, interpretation of the supplied still and proposed website settings are kept separate.

## 1. What can and cannot be reverse engineered

The supplied reference is a 335 × 597 pixel still of a cinema scene. Visible facts: a large dark glasses frame, more coherent imagery within its opening, coloured/soft duplicated features outside it, and a foreground subject against a landscape. This establishes the desired visual relationship.

It does not establish the original layer count, blur kernel, blur radius, projector, filter system, shutter timing or footage-processing pipeline. It also cannot prove whether the visible glasses were held in front of the recording camera, were part of the projected content, or were composited later. Several pipelines can produce a similar still.

Its apparent softness includes unknown contributions from the artwork, projection, camera focus, motion/exposure, resampling and compression. There is no defensible way to report an exact original Gaussian sigma or percentage opacity from this image alone. The earlier answer explained the mechanism; it did not measure those parameters.

Matching the visual appearance is possible. Claiming to have recovered the original implementation is not justified. Exact reconstruction would need the original clip or application plus sufficiently sharp, corresponding uncovered/covered frames; ideally one would also have clean source imagery or projector test patterns. Even a video would not uniquely reveal hidden compositing layers.

## 2. Four different meanings of “layers”

| Meaning | Real cinema | Proposed website |
|---|---|---|
| Eye views | Two different perspective images, left and right | A clean composition plus deliberately ghosted presentation; no physical eye separation |
| Artwork depth layers | Any number of surfaces/objects in the filmed or rendered scene | Start with four aligned depth groups |
| Visible duplicate contributions | Usually the two eye images superposed without filtering | Two contributions for optical fidelity; optionally a third faint contour for the reference's style |
| Physical lens layers | Technology-specific optical films, substrates or coatings | No need to reproduce a microscopic film stack as geometry |

These counts must not be confused. Four artwork groups do not mean four projected eye images. Three mountain silhouettes do not prove three photographs or three optical channels.

## 3. Uncovered image: displaced views, not just a blur filter

Edmund Optics' engineering explanation describes two polarized projected pictures: without the matching filters, their superposition looks fuzzy; the glasses direct the appropriate image to each eye. Its demonstration explains linear polarization, rather than every cinema system. [Engineering explanation and transcript](https://www.edmundoptics.com.tw/knowledge-center/video/tutorials/how-do-3d-movies-work-polarization/)

For a brightness-normalized, simplified model with equal channel brightness:

`uncovered = 0.5 * leftView + 0.5 * rightView`

This is an explanatory image model, not a claim that a real projector is configured to those display-code values. Physical light adds; display encoding, exposure and tone mapping also affect the recorded result.

Locally, if one small object differs mainly by horizontal displacement d, a two-view approximation is:

`U(x) = 0.5 * C(x - d/2) + 0.5 * C(x + d/2)`

For small separations, overlapping edges can look softened. With larger separations, duplicate contours become distinguishable. Siegel's experiments specifically explored the distinction between perceived blur and visible doubling; their apparatus-specific thresholds are not universal browser settings. [Original CMU/SPIE paper](https://www.cs.cmu.edu/afs/cs/project/sensor-9/ftp/papers/SPIE2001-4297-06t.pdf)

The model is only local. True left/right perspectives have different occlusion and sometimes different visible surface content. A single flat image translated twice is not a complete stereo conversion. Disney's work explicitly handles disparity-based warping, foreground/background compositing and filling exposed areas. [Disney Research, WACV 2024](https://studios.disneyresearch.com/2024/01/03/stereo-conversion/)

### Why Gaussian blur alone gives the wrong result

Two shifted copies produce a two-lobed horizontal point-spread function. A conventional Gaussian spreads detail smoothly around each point. It cannot substitute for separated, recognisable duplicate edges.

As an original mathematical illustration: if each copy has horizontal variance sigma0², an equal pair separated by d has variance `sigma0² + d²/4`. Matching that variance with a Gaussian still does not match the pair's shape. Two crisp outlines 8 pixels apart can remain recognisably doubled even though the pair's standard deviation is 4 pixels. This is not a measurement of the reference.

Therefore control separation and softness independently. Start with no extra softness, establish the displaced contours, then add restrained softness only where needed.

### Different causes of “blur”

| Appearance | Mechanism | Appropriate reproduction |
|---|---|---|
| Two outlines or horizontal fuzz | Superposed perspective views | Depth-dependent horizontal offsets |
| Soft mountains in a clean view | Authored defocus, atmosphere or image detail | Preserve authored softness; possibly a small per-layer filter |
| Faint blue duplicate | Spectral/recording effects or deliberate styling; unknown in this reference | Restrained cool-tinted duplicate, labelled artistic |
| Broad halo around bright highlights | Scatter, exposure or bloom | Separate highlight treatment, only if visibly needed |
| Streaks or extra edges during movement | Capture/display timing, motion integration | Do not imitate by permanently blurring everything |

Depth-of-field blur comes from a finite aperture and defocus; its physical point-spread shape depends on the optics. Gaussian is an efficient approximation, not the identity of all optical blur. [NVIDIA's lens and circle-of-confusion explanation](https://developer.nvidia.com/gpugems/gpugems3/part-iv-image-effects/chapter-28-practical-post-process-depth-field)

## 4. What premium glasses actually do

No common cinema technology intentionally applies a Gaussian blur to merge layers. There is no standard “premium glasses blur: 2 px / 5%” specification. Desired behaviour is image separation with good clarity, usable brightness and limited distortion.

- **Polarization systems:** each lens analyses its intended polarization. A circular analyser can use a quarter-wave retarder followed by a linear polarizer in the appropriate orientation. Protective layers and exact construction vary. Thorlabs documents the conversion between circular and linear polarization; this does not identify the reference's eyewear. [Optical explanation](https://www.thorlabs.com/newgrouppage9.cfm?objectgroup_id=7234&pn=WPQ10M-370)
- **Wavelength-separation systems:** lens filters transmit the corresponding wavelength bands. Dolby specifies projector-matched glasses for its 6P system. [Dolby documentation](https://professional.dolby.com/product/dolby-cinema-imaging-products/dolby-3d-bundles/)
- **Active systems:** liquid-crystal shutters synchronise each eye with its image sequence. XPAND's cinema manual describes that mechanism directly. [Manufacturer manual](https://www.xpandvision.com/wp-content/uploads/product_pdf/manuals/26.pdf)

Calling one system universally best would require specifying the projector, screen, seating and measurements. A frame that looks expensive cannot recover channel separation that the projection system does not provide.

An ideal filter passes the intended view and rejects the other. A simplified real system can be modelled as:

`leftEye ≈ intendedLeft + leakage * rightView`

`rightEye ≈ intendedRight + leakage * leftView`

Transmission and black-level terms have been omitted here for clarity. Leakage is crosstalk; it is not a blur radius. Measurements show that crosstalk varies with display technology, luminance levels and sometimes viewing parameters. One percentage cannot fully characterise every system. [Zafar and Badano: measured crosstalk characteristics](https://pmc.ncbi.nlm.nih.gov/articles/PMC5935021/)

For our software lens, **start at zero added blur and zero deliberate leaked duplicate**. This is a visual design target, not a claim of perfect real-world optics. Preserve whatever softness already belongs to the composition. Add modest lens tint and reflections separately, with no magnification and no global sharpening to disguise ghosting.

## 5. How two eye views become one depth percept

The lenses do not align every object into one flat picture. Each eye receives a different view; binocular matching and fusion allow corresponding features to be interpreted as one scene with depth. Objects retain different disparities, which help establish foreground/background relationships. A photo through one lens contains one filtered view and does not preserve that binocular experience.

Pictorial cues still matter: occlusion, shading, perspective and atmospheric contrast contribute alongside stereopsis. The visual system combines cues according to their usefulness and consistency. [Banks, Read, Allison and Watt: Stereoscopy and the Human Visual System](https://pmc.ncbi.nlm.nih.gov/articles/PMC3490636/)

Blur does not have a universal amount that signals a particular depth. Held, Cooper and Banks describe natural geometric defocus approximately as `beta = pupilDiameter * abs(1/focusDistance - 1/objectDistance)` in angular units. Their experiment used a volumetric display to produce real focus cues, not painted Gaussian blur. Applying its outcomes directly as a CSS pixel recipe would be incorrect. [Original study](https://pmc.ncbi.nlm.nih.gov/articles/PMC3298574/)

In conventional cinema, the actual light comes from the screen plane, even when an object seems in front of or behind it. Looking at a mountain in a projected film does not let the eyes optically refocus to the mountain's depicted distance. A browser likewise cannot infer where the viewer is looking or give independent eye views just by drawing two virtual lenses.

Design implication: keep the subject recognisable and relatively crisp, let the landscape's haze and detail establish distance, and use modest relative motion/occlusion to suggest separation. Blur alone cannot establish depth direction or volume. No scientific evidence guarantees the same strength of depth illusion for every viewer.

## 6. Specific starting values for our opening

All numbers below are **proposed art-direction settings to calibrate**, not extracted reference values, manufacturer settings, stereo-comfort thresholds or measured performance results. They belong to a monoscopic website illusion.

### Coordinate convention

Use an artwork width of 1,000 reference pixels. These are pixels across the projected artwork, not across the entire browser or physical phone screen. Scale offsets and filter widths with the artwork's displayed size. A 1 px reference amount becomes 0.3 displayed pixels when the artwork is 300 pixels wide. Keep CSS/display pixels distinct from framebuffer pixels and device pixel ratio.

Specify Gaussian softness by **sigma**, its standard deviation, not an ambiguous radius. W3C's filter specification uses standard deviation for Gaussian blur. A custom shader or authoring application must be checked for the same convention. [W3C Filter Effects](https://www.w3.org/TR/filter-effects-1/)

### Start with four authored depth groups

| Group | Purpose | Example signed L–R separation at 1,000 px width | Base authored softness, Gaussian sigma if added |
|---|---|---:|---:|
| Sky/haze | Continuous background; fill hidden areas | 0 initially if essentially featureless | 0 additional; use authored haze |
| Distant mountains | Background structure | -8 px | 0.8–1.5 px |
| Near landscape | Intermediate reference | -2 px | 0.2–0.5 px |
| Main subject | Crisp foreground anchor | +10 px | 0 px |

These choices establish one example depth ordering; signs reverse if the stereo-view convention reverses. They are not inferred physical distances. The convergence plane and artistic focus plane are separate decisions. If the main subject's contour becomes messy, first reduce its separation rather than blanket-blur it.

In the two-view construction, a separation of +10 px means views displaced -5 and +5 around their common centre, not two copies each displaced by 10. The clean view must use a consistent chosen anchor. The sky exception is a practical shortcut for a featureless field, not a statement that sky has zero physical disparity.

### Optional three-contribution styling to match the user's description

This is an alternative to the equal two-view construction, not an extra effect to stack on top of it:

| Contribution | Normalised mix weight | Horizontal position | Extra Gaussian sigma |
|---|---:|---:|---:|
| Dominant artwork | 0.75 | Registered clean-view anchor | 0 |
| Cool ghost | 0.20 | Layer-specific displacement d | 0.6–1.0 px |
| Faint contour | 0.05 | Approximately 1.5–2 times d | 1.2–2.0 px |

Start without the third contribution; enable it only if it improves the reference match. Prefer an edge-limited contour to a third fully visible subject. The weights are normalised linear-light mixture coefficients, not sequential transparent-layer opacity values and not optical crosstalk percentages. The base layer softness remains; “extra” means beyond that base. Colour/tone mapping must not accidentally increase total brightness when ghosts are introduced.

Through a lens, use the registered clean composition with the same base softness. Set added ghost weights to zero. The mountains can remain soft; the subject stays detailed. Add no blanket lens blur. Background/subject separation comes from artwork depth and motion, not the lens bending or magnifying the picture.

These values should be reviewed at the actual opening framing. Large contrast differences and small mobile screen sizes can make the same nominal setting look very different.

## 7. Calibration and integration plan

1. Prepare the aligned composition and hidden background first. Keep one source of truth for positions, crop and masks.
2. Establish a clean view with no ghosts and no lens effects. Check subject detail and believable background depth.
3. Add horizontal separation only. Examine mountain silhouettes, subject outline and high-contrast features; vary separation before blur.
4. Adjust contribution strength and only then softness. Compare the equal-pair model against the optional three-contribution style. Do not claim that a preferred style is a recovered physical parameter.
5. Move the lens boundary across several recognisable details. Their size/crop must not jump. Shared parallax must run on both sides of that boundary.
6. Add the glasses frame and restrained highlights. Both virtual lenses can show the same registered clean view for this monoscopic illusion; imitate neither mismatched eyes nor a magnifying glass.
7. Keep the small screen effect separate from theatre rendering. Precompute suitable softness and masks offline; avoid a full-theatre blur, second theatre render or heavy refractive material just to remove ghosts.
8. Integrate with existing opening progress, glasses departure, projection fade and light rise. Remove temporary effects afterward. No new prototype route is required.
9. Compare feature-on/off frame cost, screen readability, edge stability and transition continuity on real laptop and mobile hardware. Screenshots cannot validate stereopsis, timing or GPU performance.

If higher-quality original reference footage becomes available, rectify the screen perspective, compare the same features over time, estimate horizontal offsets separately from edge spread and account for resampling. Such measurements would still have uncertainty from unknown focus and compression. For a video, test whether apparent extra edges move with disparity or instead trail motion; those are different causes.

## Decision resulting from this research

Use a four-group artwork with depth-dependent ghost displacement outside and one registered clean composition inside. Treat the third contour as optional art direction. Keep lens-added blur at zero initially. The next asset decision is the subject/composition and glasses framing; numerical settings should be tuned against that actual artwork rather than declared universally correct in advance.
