// Reuse the approved UASTC texture's existing mip blocks: no rebake/re-encoding.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
const manifest = JSON.parse(fs.readFileSync("components/corridor/baked-surfaces.json"));
const left = JSON.parse(fs.readFileSync("components/corridor/theatre-left-wall-assets.json"));
const sources = [
  left.texture,
  ...manifest.items
    .filter((i) => i.active && i.source === "theatre" && i.item !== "floor-slab")
    .map((i) => i.texture),
];
const mapping = {};
const records = [];
for (const url of [...new Set(sources)]) {
  const input = fs.readFileSync("public" + url),
    width = input.readUInt32LE(20),
    height = input.readUInt32LE(24),
    levels = input.readUInt32LE(40);
  if (input.readUInt32LE(44) !== 2 || input.readUInt32LE(32) > 1 || input.readUInt32LE(36) !== 1)
    throw Error("Expected one 2D UASTC/Zstd mip chain: " + url);
  const header = Buffer.from(input.subarray(0, 80)),
    count = levels - 1,
    index = Buffer.alloc(count * 24),
    chunks = [];
  let offset = 80 + index.length;
  const append = (data, alignment = 4) => {
    const aligned = Math.ceil(offset / alignment) * alignment;
    chunks.push(Buffer.alloc(aligned - offset), data);
    offset = aligned + data.length;
    return aligned;
  };
  for (const [off, len] of [
    [48, 52],
    [56, 60],
  ]) {
    const size = input.readUInt32LE(len),
      data = input.subarray(input.readUInt32LE(off), input.readUInt32LE(off) + size);
    header.writeUInt32LE(size ? append(data) : 0, off);
  }
  const sgdSize = Number(input.readBigUInt64LE(72));
  header.writeBigUInt64LE(
    sgdSize
      ? BigInt(
          append(
            input.subarray(Number(input.readBigUInt64LE(64)), Number(input.readBigUInt64LE(64)) + sgdSize),
          ),
        )
      : 0n,
    64,
  );
  // Smallest levels first, preserving compressed bytes and uncompressed lengths.
  for (let level = count - 1; level >= 0; level--) {
    const src = 80 + (level + 1) * 24,
      start = Number(input.readBigUInt64LE(src)),
      size = Number(input.readBigUInt64LE(src + 8));
    index.writeBigUInt64LE(BigInt(append(input.subarray(start, start + size), 1)), level * 24);
    index.writeBigUInt64LE(BigInt(size), level * 24 + 8);
    index.writeBigUInt64LE(input.readBigUInt64LE(src + 16), level * 24 + 16);
  }
  header.writeUInt32LE(Math.max(1, width >> 1), 20);
  header.writeUInt32LE(Math.max(1, height >> 1), 24);
  header.writeUInt32LE(count, 40);
  const output = url.replace(/\.ktx2$/, "-first-paint.ktx2");
  fs.writeFileSync("public" + output, Buffer.concat([header, index, ...chunks]));
  execFileSync(
    "D:/New folio/new site code/_tools/basisu/bin/basisu.exe",
    ["-validate", "-file", path.resolve("public" + output)],
    { stdio: "ignore" },
  );
  mapping[url] = output;
  records.push({
    source: url,
    preview: output,
    sourceBytes: input.length,
    previewBytes: fs.statSync("public" + output).size,
    width: width >> 1,
    height: height >> 1,
  });
}
fs.writeFileSync("components/corridor/first-paint-textures.json", JSON.stringify(mapping, null, 2) + "\n");
fs.writeFileSync("docs/laptop-five/first-paint-assets.json", JSON.stringify(records, null, 2) + "\n");
console.log(
  JSON.stringify({
    textures: records.length,
    oldBytes: records.reduce((s, r) => s + r.sourceBytes, 0),
    firstPaintBytes: records.reduce((s, r) => s + r.previewBytes, 0),
  }),
);
