# Corridor display screens (2026-10-31)

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
