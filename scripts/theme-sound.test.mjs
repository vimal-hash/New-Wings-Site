import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as beat from "../components/corridor/story-beat.ts";

// The active score uses three recordings from draft 1.4 of the song.
const source = fs.readFileSync("components/corridor/theme-sound.ts", "utf8");
const revisions = JSON.parse(fs.readFileSync("components/corridor/asset-revisions.json", "utf8"));
const files = [...source.matchAll(/"(\/sound\/[a-z-]+\.mp3)"/g)].map((m) => m[1]);

test("the three active sound files exist, are versioned and are fetched through assetURL", () => {
  assert.deepEqual(files.sort(), [
    "/sound/projector-hum.mp3",
    "/sound/theme-drop.mp3",
    "/sound/theme-opening.mp3",
  ]);
  for (const file of files) {
    assert.ok(fs.statSync("public" + file).size > 50_000, file);
    assert.match(revisions[file] ?? "", /^[a-f0-9]{12}$/, file);
  }
  assert.match(source, /fetch\(assetURL\(FILES\[cue\]\)\)/);
});

// Drive the real theme with journey snapshots. The audio nodes record which clip plays, its start offset,
// loop points and stops; audio rendering and the clock inside a native loop are the browser's job.
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function score(initial) {
  let snapshot = initial;
  const listeners = new Set();
  const sources = [];
  const journeyControls = {
    read: () => snapshot,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  const nop = () => {};
  class AudioContext {
    currentTime = 1;
    resume() { return Promise.resolve(); }
    decodeAudioData(url) { return Promise.resolve({ url, duration: 30.5 }); }
    createGain() {
      return {
        connect(target) { return target; },
        gain: {
          value: 1,
          cancelScheduledValues: nop,
          setValueAtTime: nop,
          linearRampToValueAtTime: nop,
          exponentialRampToValueAtTime: nop,
        },
      };
    }
    createBufferSource() {
      const node = {
        stopped: false,
        connect(target) { return target; },
        start(when, offset = 0) { this.offset = offset; },
        stop() { this.stopped = true; },
      };
      sources.push(node);
      return node;
    }
  }
  const env = {
    exports: {},
    require(id) {
      const imports = {
        "./asset-url": { assetURL: url => url },
        "./journey-controls": { journeyControls },
        "./story-beat": beat,
      };
      assert.ok(id in imports, id);
      return imports[id];
    },
    fetch: async url => ({ ok: true, arrayBuffer: async () => url }),
    document: new EventTarget(),
    window: Object.assign(new EventTarget(), { AudioContext, setInterval: () => 1, clearInterval: nop, setTimeout: nop }),
    performance,
  };
  vm.runInNewContext(compiled, env);
  return {
    sound: env.exports.themeSound,
    advance(changes) {
      snapshot = { ...snapshot, ...changes };
      listeners.forEach(fn => fn());
    },
    drops: () => sources.filter(node => node.buffer?.url === "/sound/theme-drop.mp3"),
  };
}

const settled = () => new Promise(resolve => setImmediate(resolve));

test("the first scroll plays the intro once, and the same four-bar loop continues through the final page and back", async () => {
  const visit = score({ phase: "idle", cinemaStage: "wearing" });
  visit.sound.toggle();
  await settled();
  assert.equal(visit.drops().length, 0);
  visit.advance({ cinemaStage: "removing" });
  visit.advance({ phase: "glassesExit", cinemaStage: "removing" });
  await settled();
  const [drop] = visit.drops();
  assert.ok(drop);
  assert.equal(drop.offset, 0);
  assert.equal(drop.loop, true);
  assert.equal(drop.loopStart, beat.DROP_BARS.roundTwo);
  assert.equal(drop.loopEnd, beat.DROP_BARS.lastChord);
  const stages = [
    "pullback", "awaitAssembly", "returnHold", "return", "done", "screens",
    "drawings", "corridor", "panel", "page", "logoReveal", "logoDone",
  ];
  for (const phase of stages) {
    visit.advance({ phase, cinemaStage: "clear" });
    await settled();
  }
  visit.advance({ finalCovered: true });
  await settled();
  visit.advance({ finalCovered: false });
  await settled();
  visit.advance({ phase: "idle", cinemaStage: "wearing" });
  await settled();
  assert.deepEqual(visit.drops(), [drop]);
  assert.equal(drop.stopped, false);
});

test("the phone keeps its first-scroll source at the assembled projector and when sound is toggled", async () => {
  const visit = score({ phase: "idle", cinemaStage: "wearing" });
  visit.sound.toggle();
  visit.advance({ phase: "pullback", cinemaStage: "clear" });
  await settled();
  const [drop] = visit.drops();
  assert.equal(drop.offset, 0);
  visit.advance({ phase: "done" });
  visit.sound.toggle();
  visit.advance({ phase: "drawings" });
  visit.sound.toggle();
  await settled();
  assert.deepEqual(visit.drops(), [drop]);
  assert.equal(drop.stopped, false);
});

test("a projector menu jump or switching on sound in a later section starts at round two", async () => {
  const jumped = score({ phase: "idle", cinemaStage: "wearing" });
  jumped.sound.toggle();
  await settled();
  jumped.advance({ phase: "done", cinemaStage: "clear" });
  const late = score({ phase: "page", cinemaStage: "clear" });
  late.sound.toggle();
  await settled();
  for (const visit of [jumped, late]) {
    assert.equal(visit.drops().length, 1);
    assert.equal(visit.drops()[0].offset, beat.DROP_BARS.roundTwo);
    assert.equal(visit.drops()[0].loop, true);
  }
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
