# Theme sound on the story (2026-11-19)

The user approved draft 1.4 of the New Wings theme ("This is nice") and chose to have it follow the story ("Follow the story") rather than play once. This closes the "sound with mute" item from the 2026-11-16 three-lens review.

> **Final tune (2026-11-19, later the same day) supersedes the cue table below.** Sound now comes on with the visitor's first click, tap or key press anywhere (browsers allow nothing earlier; a scroll never counts). Turned off with the tab, it stays off.
>
> | Moment | Sound now |
> | --- | --- |
> | Opening camera starts to move | `theme-opening.mp3` from that moment, so its echo lands on the room tour |
> | First scroll | Drop part 1, 0 → 10.92 s (whoomp and round one), holding softly at the exploded projector |
> | Build scroll | Drop part 2, 10.92 → 17.47 s (round two), ending as the walk stops at the drawings |
> | Next scroll | Drop part 3, the last bar and chord, landing as the camera stops at the sphere |
> | End of part 1 | The hum comes in under the rest of the journey |
> | Reel One title writes in | The opening's long E and echo (2.25 s), then the drop looping bars 2–10 with no stop |
> | Last white page | Unchanged: the end cue, with everything else fading |
>
> Walking back stops the current part. See `docs/final-tune/README.md` (item 8) and `components/corridor/story-beat.ts` for the bar lines.

## What the visitor gets (first version)

- A **Sound** tab on the bottom-right edge, the menu tab's mirror (`sound-toggle.tsx`, `.sound-toggle` in `globals.css`). Off by default. It shows from the white loader on, so sound turned on there meets the theatre opening. Four small bars move while sound is on (they stay still under reduced motion) and lie flat while it is off. On phones it shows only the bars. It stays usable on the last white page (added to the `data-finale-covered` exception list).
- Nothing is downloaded until the visitor turns sound on. Then the four files (about 1.5 MB in all) are fetched through `assetURL` with content versions.
- Story cues (`theme-sound.ts`, driven by `journeyControls`):

| Moment | Sound |
| --- | --- |
| Loader releases (or sound turned on before the first scroll) | `theme-opening.mp3`, 6.6 s: projector start-up, the glass keys, the long E and its 8D echo, ending in silence. Plays once |
| First scroll (glasses off, house lights up), or the first menu jump past the theatre | `theme-drop.mp3`, 30.5 s: the whoomp, the riser, both orchestra rounds, the last chord ringing out. Plays once; turning sound on later in the journey starts it then |
| 21 s into the drop, as its last chord rings | `projector-hum.mp3`: the projector running in its booth behind you, under the rest of the journey (6 s fade in) |
| The last white page covers the eye (`logoDone` + `finalCovered`) | The hum and drop fade out (3 s); `theme-end.mp3`, 10.8 s: the projector winds down, the keys play the first notes again, the film runs out, lamp off. Plays on each arrival |
| Back from the last page | The end fades out (1.5 s) and the hum comes back |

- Sound off fades out in 0.3 s and suspends the audio. A hidden tab suspends it too. The film reel's projector click (`reel-click.ts`) now follows the button: no click while sound is off.
- Whole-site level `MASTER = 0.6` (the song is mastered with its drop at −12 LUFS; on the page that is about −16.5 LUFS). Hum −30.7 LUFS in its file.

## The files

Cut from draft 1.4 (`D:/CodexOutputs/Music_Song_20261118/source-draft-1-4/`), MP3 192 kbps (hum 128 kbps):

- opening: the mastered song, 0 to 6.6 s.
- drop: a render of the song without the outro's keys and projector sounds, from 7.535 s (just before the whoomp) to the end.
- end: a render of only those outro sounds, from 27.16 s.
- hum: a render of only the projector motor and film crackle, steady, 3.5 to 25 s. The site plays 20 s copies from 0.5 s, overlapping by 2 s; 20 s and 18 s are whole turns of the 24 Hz motor, so the copies hum in step and only the crackle crossfades. This also keeps MP3 encoder padding out of the loop.

All four are mastered with the whole song's own gains (`master-cue.mjs` with `NW_FIX`), so each is exactly as loud as inside the song. Sources and re-render steps: `D:/CodexOutputs/Theme_Sound_20261119/cue-source/` (`make-cues.mjs` makes `song14-cues.js` from `song14.js`, which adds `NWRender({ cue: "drop" | "end" | "bed" })`).

## Checked (headless Chrome, dev server on 3100)

`D:/CodexOutputs/Theme_Sound_20261119/checks/sound-check.mjs` clicks the button on the loader and walks the story. Desktop and phone (touch) both:

- the opening started as the loader released (3.4 s);
- the drop started on the first scroll, as the glasses started to lift;
- the hum started 21.0 s after the drop;
- the end started as the last page covered the eye;
- sound off left the audio suspended; the button stayed on top on the last page.

All 227 earlier tests pass, plus `scripts/theme-sound.test.mjs` (3). Not checked: real speakers or headphones (I cannot hear), Safari or iPhone (an iPhone's silent switch mutes Web Audio), production build.

## Known limits

- `/sound/` is not in `next.config.ts`'s immutable cache list (that file is not edited without the user's OK), so repeat visits revalidate the files (they come back as 304s).
- On computers the tab sits over the triangle-count caption of the study footer, a test tool to be removed later.
- Revert: delete `theme-sound.ts`, `sound-toggle.tsx`, `public/sound/`, `scripts/theme-sound.test.mjs` and this folder; undo the `SoundToggle` lines in `experience.tsx`, the `.sound-toggle` block and the `:not(.sound-toggle)` in `globals.css`, the two lines in `reel-click.ts` and in `scripts/asset-revisions.mjs`; run `node scripts/asset-revisions.mjs`.
