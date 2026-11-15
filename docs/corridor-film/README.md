# Corridor film: removed (2026-11-14)

The user scrapped the corridor film plan: "no popup, no video and no stop there". Removed:

- **Corridor stop.** The camera now walks the corridor in one go.
  - `full-journey.tsx` `CORRIDOR_MOVE` speeds up over the first leg and eases out over the second.
  - The leftover time from the first leg carries into the second.
  - `CORRIDOR_STOP.arc` is only where the two legs meet.
  - The `screensDone` phase no longer exists.
- **Glasses in the corridor.**
  - The "Remove glasses / Wear 3D glasses" buttons are gone.
  - The head-pointer and `cinema-glasses-action` listener are gone.
  - The theatre-opening glasses (worn, then removed on the first scroll) are unchanged.
- **Film and displays.** Removed:
  - `public/films/`
  - `corridor-film.ts`, `corridor-display-content.ts`
  - the car/rocket modules (`corridor-barco.ts`, `corridor-galalite.ts`, `corridor-bubbles.ts`, `corridor-film-kit.ts`)
  - `FEATURE_DISPLAYS` / `createDisplayPower`, and the display shaders in `corridor-screen-walls.ts`
  - `scripts/corridor-films.test.mjs`
- **Old corridor wall bakes.**
  - Deleted `public/textures/corridor/wall-red/` and `wall-connecting/`. In git history, the left wall is 44 MB and the right wall is 21 MB.
  - These bakes used to cross-fade back over the glass on the slide toward View 1. That cross-fade is gone:
    - In `baked-surfaces.json`, both wall items are now plain meshes with no texture or UV.
    - `baked-surfaces.tsx` skips loading for items without a bake.
    - The display-glass walls hide those meshes and draw their geometry. They stay closed grey glass from the corridor exit to View 1 and the final eye.
    - `screenTransition` returns only `{off}`.
  - Blender tooling that once produced these files still mentions them (`scripts/blender/*wall*`, `scripts/surface-bake/check-6k.mjs`, `items.json`). It is not used by the site.

The white lit display-glass wall panels are unchanged. The Blender parade work stays in `D:/CodexOutputs/Corridor_Parade_20261114/` and `Corridor_Parade_Fix_20261114/`.
