import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { BufferGeometry, BufferAttribute, Matrix4, Vector3 } from "three";
import { withoutTheatreCeiling } from "../components/corridor/theatre-ceiling-geometry.ts";
const base = "D:/New folio/new site code/new_si_two/node_modules/.pnpm/";
const load = (p) => import(pathToFileURL(base + p).href);
const { NodeIO } = await load("@gltf-transform+core@4.5.0/node_modules/@gltf-transform/core/dist/index.js");
const { ALL_EXTENSIONS } = await load(
  "@gltf-transform+extensions@4.5.0/node_modules/@gltf-transform/extensions/dist/index.js",
);
const { default: draco } = await load("draco3dgltf@1.5.7/node_modules/draco3dgltf/draco3dgltf.js");
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "draco3d.decoder": await draco.createDecoderModule() });
const ids = JSON.parse(fs.readFileSync("components/corridor/theatre-ceiling-ids.json")).ids;
const manifest = JSON.parse(fs.readFileSync("components/corridor/theatre-ceiling-assets.json"));
const source = await io.read("public/models/theatre-marked.glb"),
  ceiling = await io.read("public" + manifest.model);
const p = source.getRoot().listMeshes()[0].listPrimitives()[0];
const geometry = new BufferGeometry();
for (const [semantic, name] of [
  ["POSITION", "position"],
  ["NORMAL", "normal"],
  ["COLOR_0", "color"],
]) {
  const a = p.getAttribute(semantic);
  geometry.setAttribute(name, new BufferAttribute(a.getArray(), a.getElementSize(), a.getNormalized()));
}
geometry.setIndex(new BufferAttribute(p.getIndices().getArray(), 1));
const index = geometry.index.array.slice();
const rest = withoutTheatreCeiling(geometry, ids);
assert.deepEqual(geometry.index.array, index);
for (const name of Object.keys(geometry.attributes))
  assert.deepEqual(rest.getAttribute(name).array, geometry.getAttribute(name).array);
const sourceNode = source
    .getRoot()
    .listNodes()
    .find((n) => n.getMesh()),
  sourceMatrix = new Matrix4().fromArray(sourceNode.getWorldMatrix());
const pos = geometry.getAttribute("position"),
  color = geometry.getAttribute("color");
const points = [];
for (let i = 0; i < geometry.index.count; i += 3) {
  const v = geometry.index.getX(i);
  if (
    ids.some(
      ({ decodedColor: c }) =>
        Math.abs(color.getX(v) - c[0]) < 0.000002 &&
        Math.abs(color.getY(v) - c[1]) < 0.000002 &&
        Math.abs(color.getZ(v) - c[2]) < 0.000002,
    )
  )
    for (let k = 0; k < 3; k++)
      points.push(
        new Vector3().fromBufferAttribute(pos, geometry.index.getX(i + k)).applyMatrix4(sourceMatrix),
      );
}
const cells = new Map(),
  cell = 0.0001,
  key = (x, y, z) => `${x},${y},${z}`;
for (const p of points) {
  const k = key(Math.floor(p.x / cell), Math.floor(p.y / cell), Math.floor(p.z / cell));
  if (!cells.has(k)) cells.set(k, []);
  cells.get(k).push(p);
}
let triangles = 0,
  checked = 0,
  maxError = 0;
for (const node of ceiling
  .getRoot()
  .listNodes()
  .filter((n) => n.getMesh())) {
  const matrix = new Matrix4().fromArray(node.getWorldMatrix());
  for (const p of node.getMesh().listPrimitives()) {
    assert(p.getAttribute("TEXCOORD_0"));
    assert(p.getAttribute("TEXCOORD_1"));
    triangles += p.getIndices().getCount() / 3;
    const a = p.getAttribute("POSITION");
    for (let i = 0; i < a.getCount(); i++) {
      const v = new Vector3().fromArray(a.getElement(i, [])).applyMatrix4(matrix),
        q = [v.x, v.y, v.z].map((x) => Math.floor(x / cell));
      let distance = Infinity;
      for (let x = -1; x <= 1; x++)
        for (let y = -1; y <= 1; y++)
          for (let z = -1; z <= 1; z++)
            for (const old of cells.get(key(q[0] + x, q[1] + y, q[2] + z)) ?? [])
              distance = Math.min(distance, v.distanceTo(old));
      assert(distance < 0.00004, `Ceiling position changed ${v.toArray()} ${distance}`);
      maxError = Math.max(maxError, distance);
      checked++;
    }
  }
}
assert.equal(triangles, 4992);
assert.equal(rest.index.count / 3 + triangles, index.length / 3);
const baseline = JSON.parse(fs.readFileSync("docs/theatre-floor-audit/unchanged-model-baseline.json"));
for (const [name, hash] of Object.entries(baseline))
  assert.equal(
    crypto
      .createHash("sha256")
      .update(fs.readFileSync("public/models/" + name))
      .digest("hex")
      .toUpperCase(),
    hash,
    `Unrelated GLB changed: ${name}`,
  );
const assets = JSON.parse(fs.readFileSync("components/corridor/theatre-ceiling-assets.json"));
const report = {
  sourceTriangles: index.length / 3,
  replacementCeilingTriangles: triangles,
  retainedDiagnosticTriangles: rest.index.count / 3,
  nonCeilingBuffersUnchanged: true,
  originalModelFilesUnchanged: Object.keys(baseline).length,
  checkedVertices: checked,
  maximumPositionErrorMetres: maxError,
  materialCount: ceiling.getRoot().listMaterials().length,
  totalBytes: assets.bytes,
};
fs.writeFileSync("docs/theatre-ceiling-audit/geometry-verification.json", JSON.stringify(report, null, 2));
console.log(report);
