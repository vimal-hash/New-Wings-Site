import fs from "node:fs";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const deps = "D:/New folio/new site code/new_si_two/node_modules/.pnpm/";
const load = (p) => import(pathToFileURL(deps + p).href);
const { NodeIO } = await load("@gltf-transform+core@4.5.0/node_modules/@gltf-transform/core/dist/index.js");
const { ALL_EXTENSIONS } = await load(
  "@gltf-transform+extensions@4.5.0/node_modules/@gltf-transform/extensions/dist/index.js",
);
const { default: draco } = await load("draco3dgltf@1.5.7/node_modules/draco3dgltf/draco3dgltf.js");
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "draco3d.decoder": await draco.createDecoderModule() });
const doc = await io.read("public/models/theatre-marked.glb");
const p = doc.getRoot().listMeshes()[0].listPrimitives()[0],
  colors = p.getAttribute("COLOR_0"),
  index = p.getIndices();
const groups = new Map();
for (let i = 0; i < index.getCount(); i += 3) {
  const rgb = colors.getElement(index.getScalar(i), []);
  const k = rgb.slice(0, 3).join(",");
  groups.set(k, (groups.get(k) ?? 0) + 1);
}
const rows = JSON.parse(
  fs.readFileSync("D:/CodexOutputs/Approved_Theatre_Corridor_20261020/verification.json"),
).objects.theatre;
const names = new Set(
  JSON.parse(fs.readFileSync("docs/theatre-ceiling-audit/preparation.json")).ceilingObjects.map(
    (o) => "THEATRE | " + o.source,
  ),
);
function hsv(h, s, v) {
  const f = (n) => {
    let k = (n + h * 6) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}
const ids = [];
rows.forEach((row, i) => {
  if (!names.has(row.name)) return;
  const expected = hsv((i * 0.61803398875) % 1, 0.55, 0.65);
  const best = [...groups]
    .map(([k, count]) => ({ decodedColor: k.split(",").map(Number), count }))
    .sort(
      (a, b) =>
        a.decodedColor.reduce((s, v, c) => s + (v - expected[c]) ** 2, 0) -
        b.decodedColor.reduce((s, v, c) => s + (v - expected[c]) ** 2, 0),
    )[0];
  assert.equal(best.count, row.triangles, `Ceiling colour count ${row.name}`);
  assert(Math.max(...best.decodedColor.map((v, c) => Math.abs(v - expected[c]))) < 0.0002);
  ids.push({ name: row.name, decodedColor: best.decodedColor, expectedTriangles: row.triangles });
});
assert.equal(ids.length, 10);
assert.equal(
  ids.reduce((s, v) => s + v.expectedTriangles, 0),
  4992,
);
fs.writeFileSync(
  "components/corridor/theatre-ceiling-ids.json",
  JSON.stringify({ sourceModel: "/models/theatre-marked.glb", ids }, null, 2),
);
console.log("CEILING_IDS_VERIFIED", ids.length, 4992);
