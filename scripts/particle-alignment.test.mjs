import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import zlib from "node:zlib";
import { pathToFileURL } from "node:url";
import { Matrix4, Quaternion, Vector3, Triangle } from "three";
import { particleProfiles } from "../components/corridor/projector-particle-profiles.ts";
import { keepProjectorPart } from "../components/corridor/projector-edit.ts";

test("shipped grains land on their own current projector part, including the marked cover and panels", async () => {
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
  const meta = JSON.parse(fs.readFileSync("components/corridor/projector-animation.json"));
  const aligned = JSON.parse(fs.readFileSync("components/corridor/projector-formation-aligned.json"));
  const fx = JSON.parse(fs.readFileSync("components/corridor/projector-fx-config.json"));
  const particle = JSON.parse(fs.readFileSync("components/corridor/projector-particles.json"));
  const removed = new Set(
    JSON.parse(fs.readFileSync("components/corridor/projector-removed-parts.json")).removed,
  );
  const doc = await io.read("public" + meta.modelUrl),
    primitive = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const p = primitive.getAttribute("POSITION").getArray(),
    ids = primitive.getAttribute("_PART").getArray(),
    ix = primitive.getIndices().getArray();
  assert.deepEqual(
    new Set(Array.from(ids, (id) => aligned.owners[id])),
    new Set(
      aligned.owners.flatMap((owner, id) =>
        keepProjectorPart(aligned.names[owner]) && !removed.has(id) ? [owner] : [],
      ),
    ),
  );
  assert.ok(
    Array.from(ids).every((id) => !removed.has(Math.round(id))),
    "a removed part is still shipped",
  );
  const poseBytes = zlib.gunzipSync(fs.readFileSync("public" + meta.dataUrl)),
    pose = new Float32Array(poseBytes.buffer, poseBytes.byteOffset, poseBytes.byteLength / 4);
  const root = new Matrix4().fromArray(fx.matrix).invert(),
    v = new Vector3(),
    q = new Quaternion(),
    s = new Vector3(),
    t = new Vector3();
  const matrices = fx.parts.map((_, i) =>
    new Matrix4().multiplyMatrices(
      root,
      new Matrix4().compose(
        t.fromArray(pose, i * 12),
        q.fromArray(pose, i * 12 + 4),
        s.fromArray(pose, i * 12 + 8),
      ),
    ),
  );
  const points = new Float64Array(p.length);
  for (let i = 0; i < ids.length; i++) {
    v.fromArray(p, i * 3).applyMatrix4(matrices[Math.round(ids[i])]);
    points.set([v.x, -v.z, v.y], i * 3);
  }
  const triangles = Array.from({ length: 489 }, () => []),
    a = new Vector3(),
    b = new Vector3(),
    c = new Vector3(),
    tri = new Triangle(),
    nearest = new Vector3();
  for (let i = 0; i < ix.length; i += 3) {
    const part = Math.round(ids[ix[i]]);
    if (pose[part * 12 + 3] < 0.5) continue;
    const owner = aligned.owners[part];
    triangles[owner].push([ix[i], ix[i + 1], ix[i + 2]]);
  }
  for (const [profile, { count, path }] of Object.entries(particleProfiles)) {
    const data = zlib.gunzipSync(fs.readFileSync("public" + path));
    assert.equal(data.byteLength, count * 34);
    const targets = new Float32Array(data.buffer, data.byteOffset, count * 3),
      owners = new Uint16Array(data.buffer, data.byteOffset + count * 28, count);
    const sampled = new Uint8Array(489);
    let checked = 0,
      max = 0;
    for (let i = 0; i < count; i++) {
      const owner = owners[i];
      assert.ok(keepProjectorPart(aligned.names[owner]));
      if (sampled[owner] >= 24) continue;
      sampled[owner]++;
      v.fromArray(targets, i * 3);
      let distance = Infinity;
      for (const face of triangles[owner]) {
        a.fromArray(points, face[0] * 3);
        b.fromArray(points, face[1] * 3);
        c.fromArray(points, face[2] * 3);
        tri.set(a, b, c);
        if (tri.getArea() < 1e-12) continue;
        tri.closestPointToPoint(v, nearest);
        distance = Math.min(distance, v.distanceTo(nearest));
      }
      assert.ok(distance < 0.000601, `${profile}: grain ${i} misses ${aligned.names[owner]} by ${distance}m`);
      max = Math.max(max, distance);
      checked++;
    }
    assert.ok(checked > 1500);
    assert.ok(sampled[aligned.names.indexOf("SH_Top_cover")] > 0);
    assert.ok(max > 0.0005);
  }
  // Components inherit the owner's clock as well as its landing coordinate system.
  aligned.owners.forEach((owner, i) => {
    assert.deepEqual(aligned.timings[i].slice(0, 2), particle.parts[owner]);
  });
});
