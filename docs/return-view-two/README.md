# Return from Section 4 and the View 2 key light (2026-11-16)

The user asked for five changes to the trip back from the page sections to the corridor, and to View 2.

## Latest: the white stays at the liquid sphere's spot

The user: "that white section should stay there like liquid sphere", "stay ther exact position. dont FOLLOW". Later: "remove the glow", and "just leave the section's position where it was ... it dont have to visible at view 1".

- The section turns plain white on screen over 0.3 s.
- At 0.4 s, just before the camera starts back, the screen white hands over to a plain white panel fixed in the 3D corridor. It sits at the liquid sphere's spot, 14 ahead of the page camera, and fills the view exactly.
  - Code: `end-box.ts`, placed by `full-journey.tsx` on the first return frame. The screen white goes at `HANDOVER` in `page-exit.ts`.
- The panel never moves. The camera backs away, so it gets smaller with distance and drops below the frame about 1.5 s in. It is not visible at View 1 or View 2.
- It draws over the floor and walls (no depth test), so the corridor never cuts into it.
- Plain flat white, no glow. A glow ring was tried the same day and removed at the user's request. There is no texture, pass or light.
- Menu jumps hide it; Restart reloads the page.
- Measured in headless Chrome (1920×940): at the hand-over the panel covers the view exactly (NDC −1…1) and stays at world position (−147.01, 3.37, −116.86) in every frame.

## Before: Section 4 ends in a white box that stays (screen-fixed, superseded)

Later the same day the user wanted the white back, and then the box: "it should resize and stay", "50%", "just stay", "it should stay in that position. in that place."

- Scrolling past Section 4's last card turns the section plain white over 0.3 s.
- Then the solid white sheet shrinks over 1.05 s to a box exactly half the screen's size, the same shape as the screen, at the screen centre.
- The box stays there, in that same screen position, for good. It is there through the climb, View 1, the hold, the turn, View 2, the pullback and the final eye.
  - It never fades, glows, drifts or gets smaller than half.
  - It is fixed to the screen, not placed in the 3D corridor.
  - It never takes input, so scrolling drives the camera behind it as before.
- Code:
  - `page-exit.ts`: `WHITE_SECONDS=.3`, `COVER_SECONDS=1.35`, `END_BOX_SCALE=.5`.
  - `journeyControls.pageEndBox`: set when Section 4 ends. Only menu jumps clear it (through `common` in `full-journey.tsx`); Restart reloads the page.
  - `experience.tsx`: keeps `PageReturnCover` mounted after `pageReturning` ends.
- Measured in headless Chrome (1920×940):
  - The white goes 0 → 1 in about 0.25 s.
  - The box reaches 960×470 by about 1.3 s.
  - Its centre stayed at (960, 470) in all 897 logged frames, and it was still there at the final eye.
- Tried and rejected the same day:
  - The white staying full screen with no camera return.
  - The section shrinking to nothing.

The View 2 shadow side was also made another 30% darker (see the key light table below).

## The return to the corridor

### What happens (desktop, 1920×940, measured in headless Chrome)

| Time after the last scroll | What you see |
|---|---|
| 0 → 1.35 s | Now: the section turns white (0.3 s), then the white shrinks to the half-size box, which stays (see above). Before: the section only shrank to nothing. |
| ≈0.95 → 4.75 s | The camera climbs back up the slide to the very top (progress 1, not View 1's 0.985). The corridor screens stay open the whole way. |
| 4.75 → 5.73 s | It holds at the top for 1 s. |
| 5.73 → 7.14 s | It turns to View 2 on its own (1.4 s). The screens stay open. The logo key light fades in over the turn. |
| after 7.14 s | It rests at View 2, with the screens still open (the corridor is out of sight there). The next fresh scroll starts the pullback, as before. The screens close in its first ~0.8 s, before the camera can see the corridor through the logo's slit. |

The first version (same day) turned the page white for .3 s first, which faded the Section 4 content out, and closed the screens during the turn. The user rejected both ("why the section div gone?", "i told it should stay").

- Scrolling during the climb, hold or turn is ignored.
- The View 1 caption does not show in this flow: `cameraMoving` stays true through the hold.
- The study footer reads "BACK UP THE SLIDE", then "TURNING TOWARD LOGO". It no longer reads "SCROLL TO TURN" while the turn is automatic.
- The View 1 review button still rests at the top. A fresh scroll turns it, as before.

## Where it lives

- **`page-exit.ts`**
  - The white rises over `WHITE_SECONDS`. The scale then eases to `END_BOX_SCALE` by `COVER_SECONDS` and stays there.
  - Opacity is always 1.
- **`normal-page.tsx` and `globals.css`**
  - The cover's surface mixes the Section 4 wall colour to white (`--page-return-white`) while its still copy of the section fades out.
  - The old feather mask and the `::after` glow are removed.
- **`logo-reveal.ts`**
  - `topDistance` and `progressToTop` let the return end at the top of the slide.
- **`exit-stages.ts`**
  - `arrive()` puts the stage at the top with `autoTurn`.
  - `TOP_HOLD=1` sets the hold, then the stage turns by itself.
  - Input is ignored while `autoTurn` is on.
  - `preview('slide')` (the review button) has no auto-turn.
- **`full-journey.tsx`**
  - The return travels to the top.
  - At arrival it calls `arrive()` and publishes `revealStage:'top'` in the same update that clears `pageReturning`, so the footer does not flicker.
  - It places the key light once per framing from `sampleTurn(1)`.
- **`corridor-screen-state.ts`**
  - The screens stay open through `slide`, `top`, `turn` and `turned`.
  - They close over pullback progress 0 → 0.18 (about 0.8 s) and stay closed after that.
  - Checked by forcing them open: View 2 is identical either way. About 1.5 s into the pullback, open screens would show as a white strip inside the logo's slit, so they must be closed by then. The final eye is unchanged.
- **`logo-material.ts`**
  - `LOGO_KEY`, `logoKey` and `logoKeyAmount` drive the key light.
  - It is written into the logo's private steel material only, in view space, at `#include <opaque_fragment>`.
  - There is no scene light, pass, texture or new draw.
  - The program cache key is `logo-steel-view-two-key-v4`.
- **`scene-idle.ts` and `experience.tsx`**
  - Review mode treats `top` as the View 1 stop.

## The key light

The light is one soft point key, fixed in world space. Its position is set relative to the View 2 camera: 280 ahead, 150 right, 80 up. That puts it off the far right end of the logo, so the falloff runs along the logo instead of forming a pool on one face.

| Setting | Value |
|---|---|
| reach | 235, shaped exp(-(d/235)^6): flat near the key, a sharp edge further on |
| self-fill left in shadow | 8.5% |
| broad lift | 0.35 |
| steel sheen | 1.5, shininess 10 |
| colour | warm white (1, .97, .93) |

The look has no rim, glow, bloom or blur.

How much of the key is applied (`logoKeyAmount`):

| Stage | Amount |
|---|---|
| View 1 | 0 |
| turn | rises with a quintic ease to 1 |
| View 2 | 1 |
| pullback | gone by 35% |
| final eye | 0 (the material takes the phase gate too) |

Measured on the logo (mean of a 9×9 patch, 0–255) after a real return from Section 4:

| Point | Key off | First key (reach 180, falloff 2, fill 12%) | 30% darker (reach 220, falloff 4, fill 11%) | Now, another 30% (reach 235, falloff 6, fill 8.5%) |
|---|---|---|---|---|
| left face (200,650) | 70 | 39 | 26 | 17 |
| left face (600,800) | 97 | 52 | 37 | 26 |
| right end (1500,850) | 108 | 111 | 114 | 116 |
| upper band (600,450) | 95 | 77 | 90 | 100 |

With the key on, the step faces fall to near black. The user asked twice for the shadow side 30% darker. The first time the shadow points dropped 33% and 29%, the second time 35% and 30%, while the lit right end held. Lowering the fill alone only gave about 20%, so the second step also sharpens the edge (falloff 6) and reaches a little further (235), which keeps the right end lit. The upper band faces the key, so it rises a little each time (77 → 90 → 100). The user's own screenshot of the first key measured 40/51/113/81 at the same points, matching the headless numbers.

The last column was measured with the same shader math through a temporary hook after a real return. After baking, the compiled shader was checked to hold 235/6/0.085, and the View 2 review button measured 8/11/115/86 (its base is darker, see below). The half-size white box now covers the centre of View 2 (x 480–1440, y 235–705 at 1920×940). The two left-face points and the right end sit outside it; (600,450) and (1100,700) are inside it.

- The View 2 review button gives a darker base (key off: 39/45) than a menu-jump return. That is the scene's existing light state, not this change.
- A bright soft patch on the logo early in the pullback is there with the key pinned off too: it is the existing lighting, not the key.
- The dark gradient shows 1-level 8-bit steps when stretched ×5. The unlit logo shows the same, so this is pre-existing, and the space grade's grain covers it at normal viewing.

## Not checked

- Phones, tablets and the laptop tier.
- Real devices.
- Other aspect ratios. The key light is placed relative to the View 2 camera, so it follows the framing.

Backups, captures, the diff and revert steps are in `D:/CodexOutputs/Return_View_Two_20261116/` (first version), `D:/CodexOutputs/Return_View_Two_Fixes_20261116/` (visible shrink, screens open through the turn, darker shadow side) `D:/CodexOutputs/Section4_White_Stays_20261116/` (full-screen white trial, shadow side another 30% darker) and `D:/CodexOutputs/Section4_White_Box_20261116/` (the half-size white box that stays).
