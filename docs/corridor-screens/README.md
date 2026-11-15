# Corridor display screens (2026-10-31)

## Glasses sheet switched to circular (2026-11-15, user: "Yes. Also top right image having small screw. Can you remove those two alone? After that replace")

The glasses sheet on both walls now shows circular-polarised lenses, so it matches the 3D system sheet. It replaces the laser version.

- **What changed.**
  - It is the same frame, arms and three views, with lens rings, turn glyphs and the captions "CIRCULAR POLARISED LENSES · TILT-FREE" and "ONE IMAGE FOR EACH EYE".
  - The two loose hinge screws are removed from the exploded view only. The assembled and plan views keep their hinges.
- **Texture.** The first texture's B channel. The R channel (projector) and G channel (screen) have the same pixels as before.
  - The file is renamed `sheets-outer-v2.png` / `sheets-inner-v2.png` because `/textures` is immutable.
  - No section, shader or cache-key change.
- **Source.** `D:/CodexOutputs/Corridor_Blueprint_Draft_20261114/`:
  - `blender/glasses_sheet.py`: the exploded build skips the screws.
  - `glasses/sheet-circ.html`.
  - `sheets6/pack.html`.
- **Check.** Headless walk poses E and G (`compare/s6after-*.jpg`): the circular sheet shows on both walls, with no console errors.
- **Revert this step only.**
  1. Copy `pre-task-s6/corridor-screen-walls.ts` back.
  2. Delete the two `sheets-*-v2.png` files.
  3. Copy back `pre-task-s6/sheets-outer.png` and `sheets-inner.png`.
  4. Restore this file from `pre-task-s6/README.md`.
  5. To restore the old screws, copy `pre-task-s6/glasses_sheet.py` and `pre-task-s6/glasses/*` back.

## 3D system sheet added (2026-11-15, user: "Use this on wall")

A passive 3D system sheet, with no brand names, now sits on the section just before the sound sheet, on both walls. The walk now shows 3D, sound, glasses, screen, then projector.

- **What it shows.**
  - The 3D unit on a slide plate in front of the projector lens.
  - The inside along the light path: rear glass, polariser, switching cell with its driver board, front glass.
  - An auditorium side section: left and right images take turns along the beam, and the silver screen sends each turn back to the seat.
  - The models are our own, built in Blender. The single-path type was chosen after reading Sony (two-lens, discontinued) and Leonis (current single-lens units) material.
- **Where it lives.** The G channel of the second texture, which was white before. The R channel (sound) is unchanged.
  - The textures are renamed `sheets2-outer-v2.png` and `sheets2-inner-v2.png`, because `/textures` is served immutable and the old URLs would keep stale pixels.
  - `SCREEN_INK.section2` is now left `[8,7,-10]` and right `[9,8,-10]`.
  - There is no extra texture, sample or shader change. The program cache key stays `corridor-screen-glass-v8`.
- **Note.** The matching circular glasses sheet replaced the laser one afterwards (see the section above).
- **Source.** `D:/CodexOutputs/Corridor_Blueprint_Draft_20261114/`:
  - `blender/threed_sheet.py` and `threed/sheet.html`.
  - `sheets5/pack.html` packs R sound and G 3D.
- **Check.** Headless walk captures at poses H and J (`D:/CodexOutputs/Corridor_Blueprint_Draft_20261114/compare/s5after-*.jpg`). The sheet reads the right way on both walls, with no console errors.
- **Revert this step only.**
  1. Copy `pre-task-s5/corridor-screen-walls.ts` back to `components/corridor/`.
  2. Delete the two `sheets2-*-v2.png` files.
  3. Copy back `pre-task-s5/sheets2-outer.png` and `sheets2-inner.png`.
  4. Restore this file from `pre-task-s5/README.md`.

## Sound sheet added (2026-11-15, user: "Good. Put this wall")

A cinema sound sheet, with no brand names, now sits on the section just before the glasses sheet, on both walls. The walk now shows sound, glasses, screen, then projector.

- **What it shows.**
  - The sound processor and amplifier rack.
  - A whole screen speaker: a horn over two woofers.
  - A room plan with speakers behind the screen, on the side and back walls and in the ceiling, all reaching one seat.
  - The models are our own, built in Blender.
- **Second texture per wall.** The first texture's R/G/B channels were full, so each wall has a second 2048² texture, `sheets2-outer.png` and `sheets2-inner.png`:
  - R: sound.
  - G and B: white (no ink), kept free for later sheets.
  - This adds one 2048² texture per wall on desktop. Phones still request no ink textures.
  - `SCREEN_INK.section2` holds the second texture's sections: left `[8,-10,-10]` (big section 2) and right `[9,-10,-10]` (big section 3). -10 means unused.
  - The shader samples only one ink texture per fragment, and only inside an ink section.
  - Program cache key `corridor-screen-glass-v8`.
- **Source.** `D:/CodexOutputs/Corridor_Blueprint_Draft_20261114/`:
  - `blender/sound_sheet.py` and `sound/sheet.html`.
  - `sheets4/pack.html` builds the wall textures with the same heavier lines and inner-wall squeeze as before.
  - The first, cut-open speaker version is kept as `sound/*-v1.*`.
- **Before/after.** `compare/s4-pair.jpg`, at two real walk poses (J and E).
- **Revert this step only.**
  1. Copy `pre-task-s4/corridor-screen-walls.ts` back to `components/corridor/`.
  2. Delete `public/textures/corridor/blueprint/sheets2-*.png`.
  3. Restore this file from `pre-task-s4/README.md`.

## Screen and 3D-glasses sheets added (2026-11-15, user: "put them on walls")

Two more graphite sheets now sit beside the projector sheet, on both walls. Walking towards the projector, you see the glasses, then the screen, then the projector.

- **Screen sheet (Galalite).** New Wings is an official Galalite dealer, so the name is used. Facts come from galalitescreens.com:
  - Prism 3D 2.4: gain 2.4 with a 50° half-gain angle.
  - Lensray: a microlens surface.
  - The screen is perforated with the speakers behind it.
  - The views are a front view with a Lensray close-up circle, a rear view of the laced frame and speakers, and a plan with the 50° viewing lines.
  - The model is our own; no logo.
- **Glasses sheet (laser 3D).** It shows the six-primary colour-filter glasses used by today's large-format laser cinemas: three primaries for each eye.
  - The IMAX name must never appear.
  - The front frame is the site's own glasses model; the arms are ours.
- **One texture per wall, three sheets in it.** `sheets-outer.png` and `sheets-inner.png` (2048²) hold one sheet per colour channel:
  - R: the approved projector wall copy, unchanged.
  - G: screen.
  - B: glasses.
  - The texture count and memory are the same as before (one 2048² texture per wall).
  - `SCREEN_INK.section` is now `[projector, screen, glasses]` per wall: left `[11,10,9]` (big sections 5, 4, 3), right `[12,11,10]` (big sections 6, 5, 4).
  - The shader picks the channel by section.
  - Program cache key `corridor-screen-glass-v7`.
- **Source.** `D:/CodexOutputs/Corridor_Blueprint_Draft_20261114/`:
  - `blender/screen_sheet.py` and `glasses_sheet.py`.
  - `screen/sheet.html` and `glasses/sheet.html`.
  - `sheets3/pack.html` builds the wall textures, using the same 2 px heavier lines and inner-wall 1/1.45 squeeze as `proj-v3/wall.html`.
- **Before/after.** `compare/s3-pair-A/B/C.jpg` show the same three walk poses as before. `s3after-E/F/G.jpg` are earlier poses where the new sections are near.
- **Revert this step only.** Copy `pre-task-s3/corridor-screen-walls.ts` back to `components/corridor/`. Copy `pre-task-s3/textures/projector-sheet-*.png` back to `public/textures/corridor/blueprint/` and delete `sheets-*.png` there. Restore this file from `pre-task-s3/README.md`.

## Graphite projector sheet on the big screen (2026-11-15, approved for the wall)

The user approved a draft of technical line drawings printed on our existing lit walls. The wall itself does not change. Choices: dark graphite ink, both walls, phones stay plain.

- **What it is.** The user-approved projector sheet v3: three views (outside, cutaway, top view with the light cone to a curved screen) and one line of tech words per view. No brand, title block or footer.
  - The model is our own, built in Blender from the published unit size and specs of the site's (unbranded) projector. Nothing is traced from photos.
  - Tonal fills and Freestyle lines come from Blender; the sheet is composed in HTML at 4096².
  - Source: `D:/CodexOutputs/Corridor_Blueprint_Draft_20261114/blender/projector_sheet_v3.py` and `proj-v3/sheet.html`. `proj-v3/wall.html` makes the wall copies, with lines 2 px heavier so they read from a distance. The lighter first wall copies are kept as `proj-v3/wall-*-light.png`.
  - `projector-sheet-outer.png` (2048²) is for the left wall, the outer side of the bend.
  - `projector-sheet-inner.png` (2048²) is for the right wall. The sheet is squeezed into the central 1412 px; the 1.45 stretch restores its proportions.
  - Ink = 1 − red, so the grey fills show as soft graphite shading on the lit wall.
- **Where it shows.**
  - Left wall: big section 5. Right wall: big section 6. These are the near sections seen while walking back.
  - Set in `SCREEN_INK.section`.
  - Ink appears only where the section is lit, so it opens with the section.
- **Right-wall stretch.** The right wall is seen more side-on, measured at about 0.55 against about 0.8 on the left. Its drawing is pre-stretched sideways by `SCREEN_INK.stretch[1]` = 1.45 to make up for it.
- **Mirroring.** `SCREEN_INK.flip` is `[1,0]`, so text reads correctly on both walls.
- **Darker graphite (user request, 2026-11-15).** The shader boosts ink as `pow(ink,.7)`, and ink also tones the final colour (`outgoingLight*=1.-.6*screenInk`) so the glass reflections no longer wash lines out to mid-grey. Program cache key `corridor-screen-glass-v6`.
- **Cost.** One texture sample per wall fragment, only inside the ink section. No new mesh, pass or animation.
- **Phones.** No ink textures are requested.
- **Before/after evidence.** `D:/CodexOutputs/Corridor_Blueprint_Draft_20261114/compare/`: `pair-*.jpg` (plain wall → first draft) and `v3-pair-*.jpg` (first draft → this sheet), at three real walk poses.
- **Old draft sheets.** Removed from the site; copies in `D:/CodexOutputs/Corridor_Blueprint_Draft_20261114/old-draft-textures/`.
- **Revert.**
  1. Copy the files in `D:/CodexOutputs/Corridor_Blueprint_Draft_20261114/pre-task/` back to their places.
     - `corridor-screen-walls.ts`, `corridor-screen-state.ts`, `corridor-screen-runtime.tsx` and `baked-surfaces.tsx` go to `components/corridor/`.
     - `asset-revisions.json` goes to `components/corridor/`.
     - The test goes to `scripts/`.
     - `docs/README.md` replaces this file.
  2. Delete `public/textures/corridor/blueprint/`.
  3. The backup was taken after fixes 1 and 2, so the full-height light and the wide sections stay.

## Full-height big screen in wide sections (2026-11-14)

The user asked for the big screen to light the whole wall and to open part by part, like the small panels by the projector, with wide parts and no extra GLB or mesh.

- **Light height.** `SCREEN_WALL.litTop` is now 28.2, just below the wall cap (y 28.33). It was 20. The glass reaches 28.9, so the grey unlit band at the top is gone.
- **Wide sections.** The big screen (arc 30.1 to 256.1, `bigLength` 226) is split into `bigSections` 8 sections of about 28.25 units each. Each section is one extra texel in the panel texture, so there are 14 screens per wall.
- **Opening.** Each section powers on when the camera passes its middle (`bigTrigger` .5, see `screenTrigger`). It then plays the same centre-line → vertical-open animation as the small panels.
- **Seams.** The shader draws a thin soft seam between sections (about 0.18 units). There are no new mullions, meshes or textures.
- **Measured walk (headless Chrome, dev).**
  - The camera faces backwards along the corridor, so each section comes into view while it opens.
  - All 8 open in order between about 1.1 s and 5 s.
  - The last one finishes just after the walk ends.
- **Phones** still show every section steady and fully lit (`setAll(1)`), now at full height.
- The exit to View 1 is unchanged: the panels close and the walls stay closed glass.

## Current restoration (2026-10-31)

The user rejected the projector / rippling screen / chrome bubbles composition and requested the earlier car and rocket. `corridor-display-content.ts` is restored from the saved pre-redesign revision: white procedural models with blueprint-blue outlines, transparent wall films, independent take-off / drive-out loops, and a live perspective depth view through the glasses. The original 16 × 11 film windows at stop arc −36 / −18 are restored too. The later journey/loading fixes, glasses, theatre and eye finale remain in place. The rejected composition's source files remain saved but are no longer imported by the corridor display.

Immediate pre-restoration source copies: `D:/CodexOutputs/Corridor_Car_Rocket_Restore_20261031/`. Checks: TypeScript, targeted lint, corridor screen state tests and `scripts/corridor-films.test.mjs`.

`corridor-screen-state.ts` (layout/timing), `corridor-screen-walls.ts` (glass shader, mullions, floor spill, datum skip) and `corridor-screen-runtime.tsx` (per-frame state) replace the two corridor wall bakes with white glossy display glass while the camera is in the corridor. The approved baked walls return before View 1.

Layout, measured in the running scene (wall height 28.9, corridor arc ~256):

- Beside the projector floor (arc 0 to 30.1, where the projector floor ends): six small panels, as before. Glass y .3 to 7.46, dark mullions between panels and one at the boundary, graphite wall above.
- After the projector floor: one big screen per wall. When off, the white glossy glass fills the whole wall, floor to top, with no mullions, seams or plinth. The thin roof datum strip is skipped over it until the baked walls return. When on, it lights from the floor to y 20, the level the user marked; the glass above stays unlit.
- Switch-on is unchanged: a centre line powers on and opens up and down. Small panels open as the camera passes each one. Each big screen opens once the camera passes the end of the projector floor.

Pre-change copies and browser captures: `D:/CodexOutputs/Corridor_Big_Screens_20261031/`.

## Mid-corridor stop, 3D films and liquid hand-off (2026-10-31)

- One scroll in the theatre: glasses lift, screen powers off, then both existing pullback legs run to the projector. If the projector is still preparing, the camera holds at the end of the first leg with "Preparing projector" and continues by itself. `sceneIdleUrgent` lets that preparation run even while the user keeps scrolling (previously every wheel event postponed it, so the journey could look stuck).
- Next scroll from the projector: one eased move to `CORRIDOR_STOP` (arc 132). The camera keeps facing down the corridor (no yaw) and looks up 5° over the last 34 units.
- Film areas (`FEATURE_DISPLAYS`, 16 × 11 on the left wall, 36 and 18 units ahead of the stop) have no screen, frame or backdrop: only the white, blue-outlined models are drawn onto the lit wall (premultiplied, transparent). The far area holds the rocket, the near one the car.
- `corridor-display-content.ts`: each film rests (rocket on its pad with a pilot flicker, car idling) until the glasses are fully on at the stop. Then the rocket ignites, climbs and breaks out over the corridor; the car pulls away and leaps out at the glasses. Each reappears at rest and plays again while the glasses stay on; a run in progress always completes. On the wall the film is flat (rendered from the stop eye); through the lenses it is seen in depth. The films are compiled privately at the projector stop.
- Lit wall brightness `uScreenOn` raised to (.95,.98,1).
- Next scroll: glasses lift, camera moves to the liquid. The pearl spins in fast and settles into a steady turn with a precessing tilt and a satin pearl finish (world-anchored sheen, pale rim, faint nacre shift). Panel stages then advance by themselves: sphere holds 1 s, bursts into the rectangle, holds .35 s, then the sheet sails in and lands exactly flat. After a page return (`pageAtEnd`) nothing auto-advances.
- All journey legs keep their durations but use `settle` (quintic on t^.8): same peak speed, longer glide into each stop.
- Theatre 3D layers are owned by an effect; Strict Mode / Fast Refresh can no longer leave an emptied (all-white) depth view mounted.
- Pre-task backup: `D:/CodexOutputs/Theatre_Corridor_3D_20261031/pre-task/`.
