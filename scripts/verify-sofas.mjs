import fs from "node:fs";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const root = "D:/New folio/new site code/new_si_two/node_modules/.pnpm/";
const load = (p) => import(pathToFileURL(root + p).href);
const { NodeIO } = await load("@gltf-transform+core@4.5.0/node_modules/@gltf-transform/core/dist/index.js");
const { ALL_EXTENSIONS } = await load(
  "@gltf-transform+extensions@4.5.0/node_modules/@gltf-transform/extensions/dist/index.js",
);
const { default: draco } = await load("draco3dgltf@1.5.7/node_modules/draco3dgltf/draco3dgltf.js");
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "draco3d.decoder": await draco.createDecoderModule() });
const base = "D:/New folio/new site code/new_site_three/";
const data = JSON.parse(fs.readFileSync(base + "components/corridor/sofa-assets.json"));
const doc = await io.read(base + "public" + data.model);
assert.equal(doc.getRoot().listMeshes().length, 1);
assert.equal(doc.getRoot().listTextures().length, 0);
const primitives = doc.getRoot().listMeshes()[0].listPrimitives();
assert.equal(primitives.length, 1);
const p = primitives[0];
assert.equal(p.getIndices().getCount() / 3, 1479);
assert.ok([...p.getAttribute("POSITION").getArray()].every(Number.isFinite));
const source = JSON.parse(
  fs.readFileSync("D:/CodexOutputs/Approved_Theatre_Corridor_20261020/sofa-source-layout.json"),
);
const t = JSON.parse(
  fs.readFileSync(base + "components/corridor/blender-layout.json"),
).theatreTranslationBlender;
assert.equal(data.count, 12);
let maximumError = 0;
for (const copy of data.instances) {
  const b = source.find((r) => r.name === copy.name).bounds;
  const expected = [
    [b[0][0] + t[0], b[2][0] + t[2], -b[1][1] - t[1]],
    [b[0][1] + t[0], b[2][1] + t[2], -b[1][0] - t[1]],
  ];
  for (let axis = 0; axis < 3; axis++)
    for (let side = 0; side < 2; side++)
      maximumError = Math.max(
        maximumError,
        Math.abs(expected[side][axis] - [copy.minimum, copy.maximum][side][axis]),
      );
  assert.ok(/Row [BCD]/.test(copy.name));
  assert.ok(copy.maximum[0] < 0 || copy.minimum[0] > 0, "Sofa crosses centre aisle");
}
assert.ok(maximumError < 1e-7);
const report = {
  trianglesPerSofa: 1479,
  instances: 12,
  totalTriangles: 17748,
  drawCalls: 1,
  bytes: data.bytes,
  textures: 0,
  rows: ["B", "C", "D"],
  maximumPlacementEnvelopeErrorMetres: maximumError,
};
fs.writeFileSync(
  "D:/CodexOutputs/Approved_Theatre_Corridor_20261020/sofa-verification.json",
  JSON.stringify(report, null, 2),
);
console.log(report);
