import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Hover outline (2026-11-19): one line round the selected object's own silhouette (pmndrs "shopping" style), drawn
// from a mask of that object alone, not round the part of it that happens to be in view.
const source = fs.readFileSync("components/corridor/hover-catalogue.tsx", "utf8");
const css = fs.readFileSync("app/globals.css", "utf8");
const shader = (name) => source.match(new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`))?.[1] ?? "";

test("the mask holds catalogue items only: occluders go to the ID scene, never the mask", () => {
  assert.match(source, /maskScene\.add\(proxy\(object, material\(id, true\)\)\)/);
  assert.match(source, /idScene\.add\(proxy\(object, material\(0\)\)\)/);
  assert.doesNotMatch(source, /maskScene\.add\([^)]*material\(0\)/);
  // Unselected IDs leave the view in mask builds, so only the selected object is drawn, whole.
  assert.match(shader("maskCull"), /#ifdef MASK[\s\S]*uSelected[\s\S]*gl_Position=vec4\(2\.,2\.,2\.,1\.\)/);
  assert.match(source, /defines: forMask \? \{ MASK: "" \} : \{\}/);
});

test("the line comes from the mask alone: no ID buffer, fill or glow in the outline shader", () => {
  const outline = shader("outlineFragment");
  assert.match(outline, /uniform sampler2D uMask;/);
  assert.doesNotMatch(outline, /uIds|uSelected|uFill|uGlow|halo/);
  assert.match(outline, /line=clamp\(uWidth\*\.5\+\.5-d,0\.,1\.\)/);
  assert.match(source, /const OUTLINE_WIDTH = 1\.5,\s*OUTLINE_RADIUS = 2;/);
});

test("the mask is one smooth channel at CSS-pixel size", () => {
  assert.match(source, /const mask = new WebGLRenderTarget\(1, 1, \{\s*format: RedFormat,\s*samples: 4,\s*depthBuffer: false,/);
  assert.match(source, /mask\.setSize\(Math\.max\(1, Math\.round\(size\.x \/ css\)\), Math\.max\(1, Math\.round\(size\.y \/ css\)\)\)/);
});

test("while the theatre camera glides, only the mask is redrawn; the ID buffer waits for a pick", () => {
  assert.match(source, /followTheatre\(camera: Camera\) \{\s*if \(collected === "theatre" && current\) setPose\(camera\);/);
  assert.match(source, /drawOutline\(gl: WebGLRenderer, strength: number\) \{\s*if \(!current\) return;\s*maskAtPose\(gl\);/);
  assert.match(source, /tools\.sync\(gl, scene, camera, mode\);\s*idsAtPose\(gl\);/);
});

test("the sections scroll without a visible scrollbar", () => {
  assert.match(css, /\.normal-page \{[^}]*overflow-y: auto;[^}]*scrollbar-width: none;/);
  assert.match(css, /\.normal-page::-webkit-scrollbar \{\s*display: none;/);
});
