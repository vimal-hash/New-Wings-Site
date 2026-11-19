import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { BAR, BEAT, DROP_BARS, OPENING_ECHO } from "../components/corridor/story-beat.ts";

// The picture is matched to the theme (draft 1.4, 110 BPM); these numbers come from the song's own source.
test("the room tour lands on the five repeats of the opening's echo", () => {
  assert.ok(Math.abs(BEAT - 60 / 110) < 1e-12);
  assert.ok(Math.abs(OPENING_ECHO.longE - 4.3636) < 1e-3); // the long E, bar 3 of the song
  assert.ok(Math.abs(OPENING_ECHO.every - (3 * BEAT) / 4) < 1e-12); // the echo's delay: three sixteenths
  assert.ok(Math.abs(OPENING_ECHO.first - (OPENING_ECHO.longE + OPENING_ECHO.every)) < 1e-12);
  // Five repeats, all before the hush at the opening cue's end.
  assert.equal(OPENING_ECHO.count, 5);
  assert.ok(OPENING_ECHO.first + (OPENING_ECHO.count - 1) * OPENING_ECHO.every < OPENING_ECHO.end);
  const hover = fs.readFileSync("components/corridor/hover-catalogue.tsx", "utf8");
  assert.match(hover, /OPENING_ECHO\.first\) \/ OPENING_ECHO\.every/);
  assert.match(hover, /\["seats"\], \["interior", "ceiling", "lights"\], \["screen"\], \["speakers"\], \["floor", "steps"\]/);
  assert.doesNotMatch(hover, /showSeatCue/);
});

test("the drop has four whole bars from round two to the last chord and the corridor keeps its timing", () => {
  assert.ok(Math.abs(DROP_BARS.whoomp - (3 * BAR + 1 - 7.535)) < 1e-12);
  for (const [a, b, bars] of [
    ["whoomp", "roundOne", 1],
    ["roundOne", "roundTwo", 4],
    ["roundTwo", "lastBar", 3],
    ["lastBar", "lastChord", 1],
  ])
    assert.ok(Math.abs(DROP_BARS[b] - DROP_BARS[a] - bars * BAR) < 1e-9, a + " to " + b);
  const journey = fs.readFileSync("components/corridor/full-journey.tsx", "utf8");
  // The build (2 s) and its 0.9 s move plus the first leg make three bars; the last leg is one bar.
  assert.match(journey, /const CORRIDOR_MOVE = \{ arrive: 3 \* BAR - 2\.9, leave: BAR \} as const;/);
  assert.ok(Math.abs(DROP_BARS.lastChord - DROP_BARS.roundTwo - 4 * BAR) < 1e-9);
});
