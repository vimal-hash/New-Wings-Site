// Packs the exported rope model with meshopt, which loses nothing: every number comes back exactly. Run after scripts/export-rope-model.py.
// The encoder is not a project dependency: npm install meshoptimizer in any folder and point MESHOPT_DIR at it.
// Usage: MESHOPT_DIR=<folder> node scripts/compress-rope-model.mjs <in.glb> <out.glb>
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const [, , input, output] = process.argv;
const { MeshoptEncoder } = await import(
  pathToFileURL(createRequire(process.env.MESHOPT_DIR + "/").resolve("meshoptimizer")).href
);
await MeshoptEncoder.ready;

const file = readFileSync(input);
const jsonLength = file.readUInt32LE(12);
const gltf = JSON.parse(file.subarray(20, 20 + jsonLength).toString());
const blob = file.subarray(20 + jsonLength + 8);

const sizes = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 },
  bytes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4 };
const use = new Map();
gltf.meshes.forEach((mesh) =>
  mesh.primitives.forEach((primitive) => {
    Object.entries(primitive.attributes).forEach(([name, index]) =>
      use.set(gltf.accessors[index].bufferView, { name, accessor: gltf.accessors[index] }),
    );
    if (primitive.indices !== undefined)
      use.set(gltf.accessors[primitive.indices].bufferView, {
        name: "indices",
        accessor: gltf.accessors[primitive.indices],
      });
  }),
);

const parts = [],
  totals = {};
let cursor = 0;
gltf.bufferViews.forEach((view, i) => {
  const { name, accessor } = use.get(i);
  const source = new Uint8Array(blob.buffer, blob.byteOffset + view.byteOffset, view.byteLength);
  // The file stores positions at 8 bytes a point even though they are three 16-bit numbers; everything else fits its size exactly.
  const stride = view.byteStride ?? Math.max(sizes[accessor.type] * bytes[accessor.componentType], 4);
  const packed =
    name === "indices"
      ? MeshoptEncoder.encodeIndexBuffer(source, accessor.count, 4)
      : MeshoptEncoder.encodeVertexBuffer(source, accessor.count, stride);
  const padded = new Uint8Array((packed.length + 3) & ~3);
  padded.set(packed);
  view.extensions = {
    EXT_meshopt_compression: {
      buffer: 0,
      byteOffset: cursor,
      byteLength: packed.length,
      byteStride: name === "indices" ? 4 : stride,
      mode: name === "indices" ? "TRIANGLES" : "ATTRIBUTES",
      count: accessor.count,
    },
  };
  if (name !== "indices") view.byteStride = stride;
  view.buffer = 1;
  parts.push(padded);
  cursor += padded.length;
  totals[name] = totals[name] || [0, 0];
  totals[name][0] += view.byteLength;
  totals[name][1] += packed.length;
});
gltf.buffers = [
  { byteLength: cursor },
  { byteLength: blob.length, extensions: { EXT_meshopt_compression: { fallback: true } } },
];
gltf.extensionsUsed = [...new Set([...(gltf.extensionsUsed || []), "EXT_meshopt_compression"])];
gltf.extensionsRequired = [...new Set([...(gltf.extensionsRequired || []), "EXT_meshopt_compression"])];

const text = Buffer.from(JSON.stringify(gltf));
const json = Buffer.concat([text, Buffer.alloc(-text.length & 3, 0x20)]);
const body = Buffer.concat(parts);
const head = Buffer.alloc(12);
head.writeUInt32LE(0x46546c67, 0);
head.writeUInt32LE(2, 4);
head.writeUInt32LE(12 + 8 + json.length + 8 + body.length, 8);
const chunk = (length, type) => {
  const b = Buffer.alloc(8);
  b.writeUInt32LE(length, 0);
  b.writeUInt32LE(type, 4);
  return b;
};
const out = Buffer.concat([head, chunk(json.length, 0x4e4f534a), json, chunk(body.length, 0x004e4942), body]);
writeFileSync(output, out);

for (const [name, [before, after]] of Object.entries(totals))
  console.log(
    name.padEnd(12),
    (before / 1e6).toFixed(1).padStart(7),
    "MB ->",
    (after / 1e6).toFixed(1).padStart(6),
    "MB",
  );
console.log(
  "file",
  (file.length / 1e6).toFixed(1),
  "MB ->",
  (out.length / 1e6).toFixed(1),
  "MB; sent with gzip about",
  (gzipSync(out, { level: 6 }).length / 1e6).toFixed(1),
  "MB",
);
