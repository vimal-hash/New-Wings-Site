import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Section typeface (2026-11-19): the logo's lettering (Righteous) on the big section lines, Jost for everything read.
const layout = fs.readFileSync("app/layout.tsx", "utf8");
const css = fs.readFileSync("app/globals.css", "utf8");
const about = fs.readFileSync("components/corridor/about-card.tsx", "utf8");
const owner = fs.readFileSync("components/corridor/owner-card.tsx", "utf8");

test("Jost and Righteous are self-hosted through next/font with their variables", () => {
  assert.match(layout, /import \{[^}]*\bJost\b[^}]*\bRighteous\b[^}]*\} from "next\/font\/google"/);
  assert.match(layout, /Jost\(\{\s*variable: "--font-read"/);
  assert.match(layout, /Righteous\(\{\s*variable: "--font-brand",\s*weight: "400"/);
  assert.match(layout, /\$\{jost\.variable\} \$\{righteous\.variable\}/);
  assert.doesNotMatch(layout, /\bGeist\(/);
});

test("the page reads in Jost: no Arial body and no leftover Geist sans", () => {
  assert.match(css, /body \{[^}]*font-family: var\(--font-read\), sans-serif;/);
  for (const dir of ["app", "components"])
    for (const file of fs.readdirSync(dir, { recursive: true }).filter((f) => /\.(tsx?|css)$/.test(f)))
      assert.doesNotMatch(fs.readFileSync(`${dir}/${file}`, "utf8"), /--font-geist-sans/, `${dir}/${file}`);
});

test("the About line and the team title use the logo's font at its one weight", () => {
  for (const [source, rule] of [
    [about, "nw-about-line"],
    [owner, "nw-owner-title"],
  ]) {
    const line = source.match(new RegExp(`\\.${rule}\\{[^}]*\\}`))?.[0] ?? "";
    assert.match(line, /font:400 [^;]*var\(--font-brand\)/, rule);
    assert.doesNotMatch(line, /font-weight:(?!400)/, rule);
  }
});
