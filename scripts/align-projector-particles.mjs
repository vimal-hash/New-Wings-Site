// Rebuild only landing samples from the shipped GLB's actual frame-96 triangles.
// Source model, assembly poses, particle IDs/counts and flight program are preserved.
import fs from "node:fs";
import zlib from "node:zlib";
import { pathToFileURL } from "node:url";
import { Matrix4, Vector3, Quaternion, Triangle } from "three";
import assert from "node:assert/strict";
const out = "D:/CodexOutputs/Three_Fixes_20261026";
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
const metadata = JSON.parse(fs.readFileSync("components/corridor/projector-animation.json"));
const fx = JSON.parse(fs.readFileSync("components/corridor/projector-fx-config.json"));
const owners = JSON.parse(fs.readFileSync("docs/three-fixes/source-fx-owners.json"));
const particleMeta = JSON.parse(fs.readFileSync("components/corridor/projector-particles.json"));
const doc = await io.read("public" + metadata.modelUrl),
  primitive = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const xyz = primitive.getAttribute("POSITION").getArray(),
  ids = primitive.getAttribute("_PART").getArray(),
  index = primitive.getIndices().getArray();
const raw = zlib.gunzipSync(fs.readFileSync("public" + metadata.dataUrl)),
  poses = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
const rootInverse = new Matrix4().fromArray(fx.matrix).invert(),
  v = new Vector3(),
  q = new Quaternion(),
  scale = new Vector3(),
  translation = new Vector3();
const transformed = new Float64Array(xyz.length),
  partMatrices = fx.parts.map((_, part) => {
    const off = part * 12;
    translation.fromArray(poses, off);
    q.fromArray(poses, off + 4);
    scale.fromArray(poses, off + 8);
    return new Matrix4().multiplyMatrices(rootInverse, new Matrix4().compose(translation, q, scale));
  });
for (let i = 0; i < ids.length; i++) {
  const id = Math.round(ids[i]);
  v.fromArray(xyz, i * 3).applyMatrix4(partMatrices[id]);
  transformed.set([v.x, -v.z, v.y], i * 3);
}
const groups = Array.from({ length: particleMeta.parts.length }, () => ({
  triangles: [],
  cdf: [],
  mass: 0,
  min: Infinity,
  max: 0,
  bounds: [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity],
}));
const a = new Vector3(),
  b = new Vector3(),
  c = new Vector3(),
  n = new Vector3(),
  edge = new Vector3();
for (let k = 0; k < index.length; k += 3) {
  const runtime = Math.round(ids[index[k]]),
    owner = owners.runtimeOwners[runtime];
  assert.notEqual(owner, null);
  if (poses[runtime * 12 + 3] < 0.5) continue; // Never attract grains to a component the renderer hides.
  assert.equal(Math.round(ids[index[k + 1]]), runtime);
  assert.equal(Math.round(ids[index[k + 2]]), runtime);
  a.fromArray(transformed, index[k] * 3);
  b.fromArray(transformed, index[k + 1] * 3);
  c.fromArray(transformed, index[k + 2] * 3);
  n.subVectors(b, a).cross(edge.subVectors(c, a));
  const area = n.length() * 0.5;
  if (area < 1e-12) continue;
  n.normalize();
  const g = groups[owner];
  g.mass += area;
  g.cdf.push(g.mass);
  g.triangles.push([...a, ...b, ...c, ...n]);
  for (const p of [a, b, c]) {
    const d = p.distanceTo(new Vector3(0.211, 0.321, 0.877));
    g.min = Math.min(g.min, d);
    g.max = Math.max(g.max, d);
    for (let j = 0; j < 3; j++) {
      g.bounds[j] = Math.min(g.bounds[j], p.getComponent(j));
      g.bounds[j + 3] = Math.max(g.bounds[j + 3], p.getComponent(j));
    }
  }
}
const names = Array.from({ length: 489 }, () => null);
for (const [name, id] of Object.entries(owners.fx)) names[id] = name;
assert.ok(names.every(Boolean));
assert.ok(groups.every((g) => g.mass > 0));
const formation = JSON.parse(
  JSON.stringify({
    names,
    owners: owners.runtimeOwners,
    timings: fx.parts.map((p, i) => {
      const g = groups[owners.runtimeOwners[i]],
        old = particleMeta.parts[owners.runtimeOwners[i]];
      return [...old, g.min, g.max];
    }),
    spans: {},
  }),
);
for (let id = 0; id < groups.length; id++) {
  const g = groups[id],
    axis = names[id] === "SH_Non_operator_side_panel" ? [0, 1, 0] : [-0.707107, 0.707107, 0];
  let min = Infinity,
    max = -Infinity;
  for (const t of g.triangles)
    for (let i = 0; i < 9; i += 3) {
      const d = t[i] * axis[0] + t[i + 1] * axis[1] + t[i + 2] * axis[2];
      min = Math.min(min, d);
      max = Math.max(max, d);
    }
  formation.spans[names[id]] = [max, min];
}
// The chassis pieces share a single sweep through their combined box.
const chassis = [
  "CH_Structural_frame_posts_rails_bulkhead",
  "CH_Base_tray_plus_floor_channels",
  "CH_Upper_frame_band",
  "CH_Lower_skirt_band",
  "CH_Integrated_carrying_handle_slots",
];
const box = [
  Math.max(...chassis.map((n) => formation.spans[n][0])),
  Math.min(...chassis.map((n) => formation.spans[n][1])),
];
for (const name of chassis) formation.spans[name] = box;
fs.writeFileSync("components/corridor/projector-formation-aligned.json", JSON.stringify(formation));
function random(id, salt) {
  let x = (id ^ salt) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
const report = {
  method: "Area-weighted visible current-mesh targets, preserving original IDs and source flight math",
  source: metadata.modelUrl,
  ownerParts: groups.length,
  runtimeParts: fx.parts.length,
  sourcePose: 96,
  hiddenComponentsExcluded: fx.parts.filter((_, i) => poses[i * 12 + 3] < 0.5).map((p) => p.name),
  normalOffsetMetres: 0.0006,
  profiles: {},
};
for (const [profile, count, path] of [
  ["desktop", 65536, "particles-desktop.bin.gz"],
  ["laptop", 32768, "particles-mobile.bin.gz"],
]) {
  const payload = zlib.gunzipSync(fs.readFileSync("public/models/projector/" + path));
  fs.copyFileSync("public/models/projector/" + path, out + "/" + path);
  const blocks = {};
  let offset = 0;
  for (const [name, width, type] of particleMeta.blocks) {
    const T = type === "f32" ? Float32Array : type === "u16" ? Uint16Array : Uint32Array;
    blocks[name] = new T(payload.buffer, payload.byteOffset + offset, count * width);
    offset += count * width * T.BYTES_PER_ELEMENT;
  }
  let maxError = 0,
    oldOutside = 0,
    oldDistance = 0;
  const target = new Vector3(),
    nearest = new Vector3(),
    tri = new Triangle();
  for (let i = 0; i < count; i++) {
    const owner = blocks.fx_part[i],
      g = groups[owner],
      id = blocks.id[i];
    let lo = 0,
      hi = g.cdf.length - 1,
      choice = random(id, 73129) * g.mass;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (g.cdf[mid] < choice) lo = mid + 1;
      else hi = mid;
    }
    const t = g.triangles[lo],
      s = Math.sqrt(random(id, 23131)),
      u = random(id, 9817);
    a.fromArray(t);
    b.fromArray(t, 3);
    c.fromArray(t, 6);
    n.fromArray(t, 9);
    let lowerBound = 0;
    for (let j = 0; j < 3; j++) {
      const x = blocks.position[i * 3 + j],
        d = Math.max(g.bounds[j] - x, 0, x - g.bounds[j + 3]);
      lowerBound += d * d;
    }
    oldDistance = Math.max(oldDistance, Math.sqrt(lowerBound));
    if (lowerBound > 0.002 * 0.002) oldOutside++;
    target
      .copy(a)
      .multiplyScalar(1 - s)
      .addScaledVector(b, s * (1 - u))
      .addScaledVector(c, s * u)
      .addScaledVector(n, 0.0006);
    blocks.position.set(target.toArray(), i * 3);
    blocks.fx_n.set(n.toArray(), i * 3);
    blocks.fx_g[i] = Math.max(
      0,
      Math.min(
        1,
        (target.distanceTo(new Vector3(0.211, 0.321, 0.877)) - g.min) / Math.max(0.001, g.max - g.min),
      ),
    );
    target.fromArray(blocks.position, i * 3);
    tri.set(a, b, c).closestPointToPoint(target, nearest);
    maxError = Math.max(maxError, target.distanceTo(nearest));
  }
  assert.ok(maxError < 0.000601, "Each grain lands within 0.601 mm of its OWN part");
  const encoded = zlib.gzipSync(payload, { level: 9 }),
    destination = `public/models/projector/particles-aligned-${profile}-v2.bin.gz`;
  fs.writeFileSync(destination, encoded);
  report.profiles[profile] = {
    count,
    bytes: encoded.length,
    maxDistanceToOwnTriangleMetres: maxError,
    oldParticlesOutsideOwnPartBounds: oldOutside,
    oldMaxDistanceToPartBoundsMetres: oldDistance,
    destination,
  };
}
fs.writeFileSync(out + "/particle-alignment.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
