import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// The theme on the story (components/corridor/theme-sound.ts): four files cut from draft 1.4 of the song.
const source = fs.readFileSync("components/corridor/theme-sound.ts", "utf8");
const revisions = JSON.parse(fs.readFileSync("components/corridor/asset-revisions.json", "utf8"));
const files = [...source.matchAll(/"(\/sound\/[a-z-]+\.mp3)"/g)].map((m) => m[1]);

test("the four sound files exist, are versioned and are fetched through assetURL", () => {
  assert.deepEqual(files.sort(), [
    "/sound/projector-hum.mp3",
    "/sound/theme-drop.mp3",
    "/sound/theme-end.mp3",
    "/sound/theme-opening.mp3",
  ]);
  for (const file of files) {
    assert.ok(fs.statSync("public" + file).size > 50_000, file);
    assert.match(revisions[file] ?? "", /^[a-f0-9]{12}$/, file);
  }
  assert.match(source, /fetch\(assetURL\(FILES\[cue\]\)\)/);
});

test("the hum's copies overlap by whole turns of the 24 Hz motor and fit inside its 21.5 s file", () => {
  const hum = source.match(/const HUM = \{ offset: ([\d.]+), length: ([\d.]+), overlap: ([\d.]+)/);
  assert.ok(hum);
  const [offset, length, overlap] = hum.slice(1).map(Number);
  assert.ok(offset + length <= 21.5);
  for (const seconds of [length, length - overlap]) assert.ok(Math.abs(seconds * 24 - Math.round(seconds * 24)) < 1e-9);
});

test("sound waits for the visitor: nothing is fetched or started before a click, tap or key press", () => {
  // The audio context and the downloads begin in start(); only turnOn() calls it, from the Sound tab or from the
  // visitor's first click, tap or key press anywhere (one the browser counts), never from a scroll or by itself.
  const [before, after] = source.split("export const themeSound");
  assert.equal(before.match(/\bstart\(\)/g).length, 2); // its own definition and turnOn()
  assert.match(before, /function start\(\) \{\n\s+if \(!context\) \{[\s\S]*?new Audio\(\)[\s\S]*?Promise\.all\(/);
  assert.match(before, /function turnOn\(\) \{\n\s+if \(!start\(\)\) return;/);
  assert.match(after, /toggle\(\) \{[\s\S]*turnOn\(\);/);
  assert.match(after, /arm\(\) \{[\s\S]*userActivation[\s\S]*turnOn\(\);/);
  assert.doesNotMatch(after, /"wheel"|"scroll"|"touchmove"/);
  // Turned off with the tab, it stays off.
  assert.match(after, /chosenOff = true;/);
  assert.equal(source.match(/new Audio\(\)/g).length, 1);
  const reel = fs.readFileSync("components/film-reel/reel-click.ts", "utf8");
  assert.match(reel, /themeSound\.read\(\)\.enabled/);
});
