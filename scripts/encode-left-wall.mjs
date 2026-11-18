// Left wall atlas: 8-bit display-referred bake -> UASTC KTX2 (sRGB, box mipmaps, light RDO, zstd 19).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
const basis = "D:/New folio/new site code/_tools/basisu/bin/basisu.exe";
const source = "D:/CodexOutputs/Theatre_LeftWall_Bake_20261023/left-wall-final-8.png";
const output = "public/textures/theatre/left-wall/left-wall-surface.ktx2";
execFileSync(
  basis,
  [
    "-uastc",
    "-uastc_level",
    "3",
    "-uastc_rdo_l",
    "0.25",
    "-uastc_rdo_d",
    "32768",
    "-mipmap",
    "-mip_filter",
    "box",
    "-mip_srgb",
    "-ktx2",
    "-ktx2_zstandard_level",
    "19",
    "-max_threads",
    "12",
    "-file",
    source,
    "-output_file",
    output,
  ],
  { stdio: "inherit" },
);
const path = "components/corridor/theatre-left-wall-assets.json",
  m = JSON.parse(fs.readFileSync(path));
m.bytes = fs.statSync(output).size;
fs.writeFileSync(path, JSON.stringify(m, null, 2) + "\n");
console.log(m);
