// Compression audit for one 6K texture: re-encodes from its high-quality master with candidate settings, decodes level 0
// (BC7 for desktop, ASTC 4x4 for phones) and scores each against the 16-bit master with decoded-quality.py.
// Variants: "<input>:<rdo>[:<zstd>]" with input d = the approved triangular-dithered 8-bit master, u = plain rounding.
// "d:0.25" reproduces the live settings. Never touches public/.
// Usage: node scripts/surface-bake/compression-audit.mjs <name> <master16.png> <dithered8.png> <out-dir> <variant>...
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const [name, master, dithered, out, ...variants] = process.argv.slice(2);
const BLENDER = "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe",
  BASISU = "D:/New folio/new site code/_tools/basisu/bin/basisu.exe";
fs.mkdirSync(out, { recursive: true });
const rounded = path.join(out, `${name}-undithered-8.png`);
if (variants.some((v) => v.startsWith("u:")) && !fs.existsSync(rounded))
  execFileSync(
    BLENDER,
    [
      "-b",
      "--python-expr",
      `import OpenImageIO as o, numpy as np
a=o.ImageBuf(r'${master}').get_pixels(o.FLOAT)[...,:3];q=np.round(np.clip(a,0,1)*255).astype(np.uint8)
im=o.ImageBuf(o.ImageSpec(a.shape[1],a.shape[0],3,o.UINT8));im.set_pixels(o.ROI(0,a.shape[1],0,a.shape[0],0,1,0,3),q);im.write(r'${rounded}')`,
    ],
    { stdio: "ignore" },
  );
const decoded = [];
for (const v of variants) {
  const [input, rdo, zstd = "19"] = v.split(":"),
    tag = `${name}-${input}-rdo${rdo}-z${zstd}`,
    ktx = path.join(out, tag + ".ktx2");
  if (!fs.existsSync(ktx))
    execFileSync(
      BASISU,
      [
        "-uastc",
        "-uastc_level",
        "3",
        "-uastc_rdo_l",
        rdo,
        "-uastc_rdo_d",
        "32768",
        "-mipmap",
        "-mip_filter",
        "box",
        "-mip_smallest",
        "12",
        "-mip_srgb",
        "-ktx2",
        "-ktx2_zstandard_level",
        zstd,
        "-max_threads",
        "16",
        "-file",
        input === "u" ? rounded : dithered,
        "-output_file",
        ktx,
      ],
      { stdio: "ignore" },
    );
  const dir = path.join(out, "unpack-" + tag);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
    execFileSync(BASISU, ["-unpack", "-no_ktx", "-file", ktx], { cwd: dir, stdio: "ignore" });
    for (const f of fs.readdirSync(dir))
      if (!/unpacked_rgb_(BC7_RGBA|ASTC_LDR_4X4_RGBA)_level_0_/.test(f)) fs.rmSync(path.join(dir, f));
  }
  for (const f of fs.readdirSync(dir)) decoded.push(path.join(dir, f));
  console.log("AUDIT_KTX2", JSON.stringify({ variant: v, file: ktx, bytes: fs.statSync(ktx).size }));
}
const log = execFileSync(
  BLENDER,
  ["-b", "--python", "scripts/blender/surface-bake/decoded-quality.py", "--", master, ...decoded],
  { encoding: "utf8", maxBuffer: 1 << 26 },
);
for (const l of log.split("\n")) if (l.startsWith("DECODED")) console.log(l);
