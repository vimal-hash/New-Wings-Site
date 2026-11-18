// One item's bake -> 8-bit display PNG (triangular dither) -> UASTC KTX2 (sRGB, box mips, light RDO, zstd 19).
// Usage: node scripts/surface-bake/encode-item.mjs <item> [--activate]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const name = process.argv[2];
const cfg = JSON.parse(fs.readFileSync("scripts/surface-bake/items.json")),
  spec = cfg.items[name];
const dir = path.join(cfg.authoringRoot, name),
  png = path.join(dir, "bake-display-8.png");
const blender = "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe";
execFileSync(
  blender,
  ["-b", "--python", "scripts/blender/surface-bake/to8.py", "--", path.join(dir, "bake-display.png"), png],
  { stdio: "ignore" },
);
const output = path.join("public", spec.runtimeFolder, name + ".ktx2");
execFileSync(
  "D:/New folio/new site code/_tools/basisu/bin/basisu.exe",
  [
    "-uastc",
    "-uastc_level",
    "3",
    "-uastc_rdo_l",
    String(spec.rdo ?? 0.25),
    "-uastc_rdo_d",
    "32768",
    "-mipmap",
    "-mip_filter",
    "box",
    ...(spec.mipSmallest ? ["-mip_smallest", String(spec.mipSmallest)] : []),
    "-mip_srgb",
    "-ktx2",
    "-ktx2_zstandard_level",
    "19",
    "-max_threads",
    "12",
    "-file",
    png,
    "-output_file",
    output,
  ],
  { stdio: "ignore" },
);
const manifestPath = "components/corridor/baked-surfaces.json",
  manifest = JSON.parse(fs.readFileSync(manifestPath));
const entry = manifest.items.find((i) => i.item === name);
entry.bytes = {
  uv: fs.statSync(path.join("public", spec.runtimeFolder, name + "-uv.bin")).size,
  texture: fs.statSync(output).size,
};
if (process.argv.includes("--activate")) entry.active = true;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + "\n");
// UASTC transcodes to 4x4 blocks (BC7/ASTC): 1 byte/texel at level 0, about 4/3 with mips.
console.log(
  "ENCODED",
  name,
  JSON.stringify({
    ...entry.bytes,
    atlas: entry.atlas,
    gpuBytesWithMips: Math.round((entry.atlas[0] * entry.atlas[1] * 4) / 3),
    active: entry.active,
  }),
);
