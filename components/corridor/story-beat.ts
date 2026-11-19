// The picture and the theme on one clock (draft 1.4 of the New Wings theme, 110 BPM). Times in seconds.
// theme-sound.ts plays the cues by these numbers; hover-catalogue.tsx lights the room tour by them and
// full-journey.tsx times its corridor legs to whole bars, so the music lands where the camera stops.

export const BEAT = 60 / 110;
export const BAR = 4 * BEAT;
const S16 = BEAT / 4;

/**
 * The opening cue (theme-opening.mp3) starts as the opening camera starts to move (`openingMovedAt`). Its long E lands
 * at bar 3 and rings into an echo that repeats every three sixteenths, five times before the hush. The house lights
 * are nearly full by the first repeat, so the room tour lights one object on each repeat (user 2026-11-19: "how
 * about that and echo part sync? i mean timing same"; "we are not creating new sound just matching").
 */
export const OPENING_ECHO = { longE: 2 * BAR, first: 2 * BAR + 3 * S16, every: 3 * S16, count: 5, end: 6.6 } as const;

/**
 * Bar lines inside the drop cue (theme-drop.mp3, cut from the song at 7.535 s): the whoomp's bar, round 1, round 2,
 * round 2's last bar and the last chord. The journey plays it in three parts, one per camera move, each ending on a
 * bar line as the camera reaches its stop; the last chord lands as the camera stops at the liquid sphere.
 */
const WHOOMP = 3 * BAR + 1 - 7.535;
export const DROP_BARS = {
  whoomp: WHOOMP,
  roundOne: WHOOMP + BAR,
  roundTwo: WHOOMP + 5 * BAR,
  lastBar: WHOOMP + 8 * BAR,
  lastChord: WHOOMP + 9 * BAR,
} as const;
