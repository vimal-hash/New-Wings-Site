import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Vector3 } from "three";
import {
  grainReactionAt,
  grainReactionsAt,
  grainReactionGroupAt,
  GRAIN_REACTION,
} from "../components/corridor/pupil-grain-reaction.ts";
import { createDepthField, createDepthLayout } from "../components/corridor/logo-particle-eye/depth-field.ts";

test("contact catch, delayed transfer and uneven release are distinct visible moments", () => {
  const response = (age) => grainReactionAt(650 - age * 52, 650, 52, 0.8, 0.5);
  assert.deepEqual(response(-1), { body: 0, glint: 0, wake: 0 });
  assert.ok(response(0.1).glint > 0.9, "a sharp contact catches before the material wakes");
  assert.equal(response(0.1).body, 0);
  assert.ok(response(1).body > 0.8, "received silver rises after the initial catch");
  assert.ok(response(4).wake > response(4).body, "a softer wake outlives the strong crest");
  assert.ok(response(4).glint < 0.001, "the release cannot keep flashing");
  assert.ok(response(30).wake < 0.0001, "the retained facets eventually return to dark steel");
  assert.deepEqual(grainReactionAt(650, 650, 52, 0.5, 0.5, 0), { body: 0, glint: 0, wake: 0 });
  let previous = response(3);
  for (let age = 3.01; age < 10; age += 0.01) {
    const next = response(age);
    for (const key of ["body", "glint", "wake"])
      assert.ok(next[key] <= previous[key] + 1e-10, "release is monotonic, without flicker");
    previous = next;
  }
  assert.equal(GRAIN_REACTION.brightness, 1.3, "preserve the approved particle-only gain");
});

test("multiple fronts retain independent grain responses without adding a global brightness wash", () => {
  const width = 52,
    seed = 0.8,
    size = 0.5;
  const fronts = [
    { radius: 300, strength: 1 },
    { radius: 1000, strength: 1 },
    { radius: 1700, strength: 0.7 },
  ];
  for (const front of fronts) {
    const distance = front.radius - width;
    const single = grainReactionAt(distance, front.radius, width, seed, size, front.strength);
    const combined = grainReactionsAt(distance, fronts, width, seed, size);
    assert.ok(
      combined.body >= single.body && combined.glint >= single.glint,
      "every travelling front still excites its own material",
    );
    assert.ok(combined.body + combined.wake <= 1);
  }
  const single = grainReactionsAt(280, [fronts[0]], width, seed, size),
    duplicate = grainReactionsAt(280, [fronts[0], fronts[0]], width, seed, size);
  assert.deepEqual(single, duplicate, "duplicate/overlapping energy cannot double the surface exposure");
  assert.deepEqual(
    grainReactionsAt(2400, fronts, width, seed, size),
    { body: 0, glint: 0, wake: 0 },
    "grains ahead of every wave stay matte",
  );
});

test("source size, grain variation and real depth stagger excitation without history", () => {
  const a = grainReactionAt(650 - 0.7 * 52, 650, 52, 0.1, 0.9),
    b = grainReactionAt(650 - 0.7 * 52, 650, 52, 0.9, 0.1);
  assert.ok(a.body > b.body);
  assert.notEqual(a.glint, b.glint);
  assert.ok(
    grainReactionAt(640, 700, 52, 0.5, 0.5).body >
      grainReactionAt(Math.hypot(640, 220), 700, 52, 0.5, 0.5).body,
  );
  for (let age = -1; age < 12; age += 0.01) {
    const s = grainReactionAt(650 - age * 52, 650, 52, 0.6, 0.4);
    assert.ok(s.body >= 0 && s.body <= 1 && s.glint >= 0 && s.glint <= 1 && s.wake >= 0 && s.wake <= 0.375);
    assert.ok(s.body + s.wake <= 1, "wake receives energy as the crest recedes, without doubling its peak");
  }
  assert.deepEqual(grainReactionAt(650, 670, 52, 0.2, 0.4), grainReactionAt(650, 670, 52, 0.2, 0.4));
});

test("only a minority of stable facets retain a longer silver afterglow", () => {
  const wakes = Array.from(
    { length: 100 },
    (_, i) => grainReactionAt(650 - 4 * 52, 650, 52, i / 100, 0.5).wake,
  );
  const retained = wakes.filter((x) => x > 0.04).length;
  assert.ok(retained >= 15 && retained <= 35, "silver persistence is sparse, with generous dark neighbours");
  assert.ok(
    Math.max(...wakes) > Math.min(...wakes) * 20,
    "retained facets are clearly separate from the rapidly cooled grains",
  );
  const early = grainReactionAt(650 - 4 * 52, 650, 52, 0.8, 0.5),
    late = grainReactionAt(650 - 7 * 52, 650, 52, 0.8, 0.5);
  assert.ok(late.wake < early.wake && late.wake > 0, "release settles without another flash");
});

test("connected groups have smooth spatial boundaries and readable transfer delays", () => {
  const group = grainReactionGroupAt(-3.2, 2.4, 0.3);
  assert.ok(Math.abs(group - grainReactionGroupAt(-3.1999, 2.4, 0.3)) < 0.001);
  assert.equal(group, grainReactionGroupAt(-3.2, 2.4, 0.3));
  const values = Array.from({ length: 20 }, (_, i) => grainReactionGroupAt(i * 0.41, -i * 0.17, 0.2));
  assert.ok(Math.max(...values) - Math.min(...values) > 0.3);
  for (let cell = -4; cell < 4; cell++) {
    const x = cell / 2.4;
    assert.ok(
      Math.abs(grainReactionGroupAt(x - 0.000001, 0.5, 0) - grainReactionGroupAt(x + 0.000001, 0.5, 0)) <
        0.00001,
      "no hard grid seams",
    );
  }
  const early = grainReactionAt(650 - 0.65 * 52, 650, 52, 0.5, 0.5, 1, 0),
    late = grainReactionAt(650 - 0.65 * 52, 650, 52, 0.5, 0.5, 1, 1);
  assert.ok(
    early.body > 0.8 && late.body === 0,
    "different connected groups transfer energy at visibly different phases",
  );
});

test("shared star shader cannot inherit unbound hero inputs or light up with the pupil", () => {
  const code = readFileSync(
    new URL("../components/corridor/logo-particle-eye/index.tsx", import.meta.url),
    "utf8",
  );
  const fragment = code.match(/const fragmentShader = \/\* glsl \*\/ `([\s\S]*?)`;/)[1];
  const depth = createDepthField(createDepthLayout("mobile", new Vector3(), 0, 1), 1, 1.4667, fragment);
  const outputs = new Map(
    [...depth.material.vertexShader.matchAll(/out\s+(\w+)\s+(\w+)\s*;/g)].map((m) => [m[2], m[1]]),
  );
  for (const input of depth.material.fragmentShader.matchAll(/in\s+(\w+)\s+(\w+)\s*;/g))
    assert.equal(outputs.get(input[2]), input[1], input[2] + " must have a matching vertex output");
  assert.match(depth.material.fragmentShader, /const float vHeroWave=0\.;/);
  assert.match(depth.material.fragmentShader, /const float vHeroSpark=0\.;/);
  assert.match(depth.material.fragmentShader, /const float vHeroWake=0\.;/);
  depth.geometry.dispose();
  depth.material.dispose();
  depth.haze.geometry.dispose();
  depth.haze.material.dispose();
});
