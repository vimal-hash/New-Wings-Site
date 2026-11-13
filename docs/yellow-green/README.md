# Yellow → green — Section 3 to Section 4

Implemented 6 November 2026, after finishing and verifying the Section 2 white/camera smoothing task. Section 3 turns smoothly white, leaves a depth-tested white opening inside yellow, backs through yellow into the attached green tunnel, holds at the existing authored stop, then continues to Section 4. The connection reverses. Green/red 1→2 and blue 2→3 retain their material programs; phones retain four native sections.

## Source and runtime assets

Existing optimized sources, opened read-only and never saved:

- `D:/CodexOutputs/Loki_Rope_20261103/r3f/Rope_Yellow_r3f.blend`
- `D:/CodexOutputs/Loki_Rope_20261103/r3f/Rope_Green_80_Amber_r3f.blend`

Their export reports share geometry hash `7af2c0d27b363682` with red. No GLB or geometry binary was generated. Desktop still requests `public/rope-model/rope-red.glb?v=2` (41,976,548 bytes); laptop still requests `public/rope-flight-laptop/rope.bin?v=3` (2,939,151 bytes). The standalone laptop binary is unchanged too. The same decoded model and canvas serve all three connections.

`scripts/blender/export-yellow-rope-look.py` reads the actual yellow material's ramp and source constants. It exports only no-bloom RGB emission lookups: desktop 1024×1 / 538 bytes and laptop 256×1 / 394 bytes. Both use the existing point's monotonic red ramp coordinate, decode sRGB once, and leave grain/geometry/strength data shared. `components/rope-model/yellow-look.json` is the active source manifest. The new `rope-yellow.ts` owns source constants, tint conversion, joined grading and the measured desktop emission calibration.

## Placement, camera and transition

This reuses the approved first connection's geometry join and complete camera profile:

| Property | Value |
| --- | --- |
| Far yellow placement | 1.72 uniform scale, .62 radian axial rotation, Z=-22.5 |
| Near green placement | original model placement |
| Camera start / hold / end | Z=-59.6 / -9 / 0 |
| Scroll screens / hold | 28 / .832–.852 |
| White phase | .594 viewport heights; finite .18 s damped follow |
| Camera follow | original .35 s spring, seeded at the covered starting pose |
| Portal | Z=-60.2, radius 3.05, soft edge .26, strength .85 |
| Portal close | camera Z=-23 to -12; remains white while closing |
| Join shape / hue span | original thinning overlap; hue Z=-36 to -18 |

`YELLOW_FLIGHT` copies the original profile and changes only the green card tint. The far copy is yellow; the near original is green. Existing join thinning, core clearance, far-thread softening and demand ownership remain. Only the near tunnel answers hover, with its own independent 1–5 card counter. Existing placeholder cards remain; no project images were invented.

Both device programs use source tints: yellow side [.72,.5616,.0384], face [1,.86,.0408], core [.012,.00936,.00072]; green side [.22,.72,.32], face [1,.86,.34], core [.002,.012,.006]. Diffuse light and spectral transmission are reconstructed from the shared red fields with the source colour-family rules. This is an approximation of source illumination, not a new Cycles combined-light bake.

Yellow and green retain independent source grade lookups. Yellow's original display toe uses mean encoded RGB / .25 to power .66. The white opening and hovered ropes still bypass the colour curves. The portal's light uses the original falloff with a warm yellow tint. Desktop yellow emission uses a 1.05 calibration only on the far yellow contribution; green and the laptop's existing density calibration remain unchanged. No extra render pass or scene light was added. The source selection through the joined region uses emitted colour plus the existing camera-side hint; it is not object-ID grading or a literal Cycles-equivalent composite.

## Matched reference and verification

Source references use 1920×1080, horizontal 24 mm / 36 mm sensor, Standard/sRGB, 64 Cycles samples with OptiX and the source's display curves. Yellow uses source camera Y=12, local roll=-.62; green uses Y=9, roll=0. Explicit world matrices are saved beside the renders and asserted after dependency-graph evaluation. The browser counterpart uses camera Z=-43.14 for the scaled yellow copy and Z=-9 for green. GPU-uploaded view/projection matrices are checked before capture. The portal is disabled only in the reference test's WebGL interception, so the additional web white opening does not distort a material comparison. For green, the central radius .65 half-height is excluded because the website correctly contains joined yellow there while the standalone Blender source contains green.

| Static comparison | Mean brightness ratio | 8 px block correlation | Mean absolute RGB difference / 255 |
| --- | --- | --- | --- |
| Yellow desktop | 1.0026 | .9495 | 6.90 |
| Yellow laptop path | 1.0117 | .8690 | 10.65 |
| Green desktop, outer region | 1.0151 | .9153 | 9.07 |
| Green laptop path, outer region | .9904 | .8455 | 11.65 |

These measure source-informed matching, not a 100% pixel-equivalence claim. Thin-strand rasterization, illumination reconstruction, source Cycles transparency and laptop density/precision differ. Dynamic energy flow also differs from the static Blender reference. Workstation quality-path checks do not establish physical laptop FPS.

Production build/TypeScript, scoped ESLint and 45 focused tests passed. Preserved shader checks verify original green/red desktop/laptop logic, the exact first/blue portal strings and the blue thread program. The complete home journey passed through all three connections and all four sections, then returned to the original scene. Direct-route round trips passed 3→4→3 on both rendering paths and 3→2→1 on desktop, with hover/cards, one canvas and one geometry download. Laptop step 3, mobile four-section touch navigation (zero rope downloads) and reduced-motion demand rest passed.

## Reproduction and evidence

Run the installed Blender with TEMP/TMP on D:, then:

```text
blender -b --python scripts/blender/export-yellow-rope-look.py -- "D:/New folio/new site code/new_site_three" "D:/CodexOutputs/Yellow_Green_20261106"
```

Backups, source inventory, reference images, camera matrices, matched metrics, browser traces and HD screenshots are in `D:/CodexOutputs/Yellow_Green_20261106/`. The production server listens on 0.0.0.0:3001. Direct preview: `/sections?section=3`; scroll once to enter yellow→green. The earlier blue motion fix has independent evidence in `D:/CodexOutputs/Portal_Smooth_20261106/`.

Reference integrity: wait for the entering gesture's deferred transfer before a diagnostic seek, then check the actual GPU camera matrix. Otherwise a queued entry delta can change the intended comparison pose. In Blender, assign the intended translation in the final world matrix and evaluate it before rendering; reading a stale matrix immediately after changing `location` can overwrite the intended camera position.
