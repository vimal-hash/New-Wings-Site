import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { FILM_PRODUCTS } from "../components/film-reel/film-data.ts";

test("every film frame has one short line under its product name", () => {
  assert.equal(FILM_PRODUCTS.length, 6);
  for (const product of FILM_PRODUCTS) {
    assert.match(product.line, /^[A-Z][^.]*\.$/, `${product.name}: one sentence, ending in a full stop`);
    // Drawn at 40 px on the frame's 1400 px text strip (film-content.ts); longer lines would crowd the frame.
    assert.ok(product.line.length <= 44, `${product.name}: "${product.line}" is too long`);
  }
});

test("each section title line has its REEL word above it", () => {
  const source = fs
    .readFileSync(new URL("../components/corridor/title-card.tsx", import.meta.url), "utf8")
    .replace(/\/\/.*$/gm, ""); // the notes beside the lines quote old wording
  const list = (name) =>
    [...source.match(new RegExp(`export const ${name} = \\[([^\\]]*)\\]`))[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const lines = list("SECTION_LINES"),
    reels = list("SECTION_REELS");
  assert.deepEqual(reels, ["REEL ONE", "REEL TWO", "REEL THREE", "REEL FOUR"]);
  assert.equal(lines.length, reels.length);
  assert.equal(lines[2], "PEOPLE BRING THE COLOUR");
});

test("the theatre caption fits the lit room it is shown in", () => {
  const source = fs.readFileSync(new URL("../components/corridor/story-caption.tsx", import.meta.url), "utf8");
  // The house lights are up at the theatre stop (they rise as it begins), so it never says "Lights down".
  const theatre = source.match(/theatre: \{\s*line: "([^"]+)"/)?.[1];
  assert.equal(theatre, "Take your seat. Everything in this room is our work.");
  assert.doesNotMatch(source, /Lights down/);
});
