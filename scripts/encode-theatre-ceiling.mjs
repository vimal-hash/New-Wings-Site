import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  sharp = require(require.resolve("sharp", { paths: [require.resolve("next")] }));
const run = promisify(execFile);
const work = "D:/CodexOutputs/Theatre_Ceiling_PBR_20261023";
const output = "public/textures/theatre/ceiling";
await fs.mkdir(output, { recursive: true });
await fs.mkdir("public/models/theatre", { recursive: true });
const basis = "D:/New folio/new site code/_tools/basisu/bin/basisu.exe";
const jobs = [
  { name: "irradiance", hdr: true },
  { name: "normal", hdr: false },
  { name: "environment", hdr: true, flip: true },
  { name: "specular", hdr: true },
];
for (const job of jobs.filter(
  (job) =>
    (!process.argv.includes("--specular-only") || job.name === "specular") &&
    (!process.argv.includes("--irradiance-only") || job.name === "irradiance"),
)) {
  const cameraDiffuse =
    job.name === "irradiance" &&
    (await fs.access(path.join(work, "irradiance-camera-clean.exr")).then(
      () => true,
      () => false,
    ));
  const flat = await fs.access(path.join(work, job.name + "-flat-clean.exr")).then(
    () => true,
    () => false,
  );
  const polished = await fs.access(path.join(work, job.name + "-polished.exr")).then(
    () => true,
    () => false,
  );
  const source = path.join(
    work,
    polished
      ? job.name + "-polished.exr"
      : flat
        ? job.name + "-flat-clean.exr"
        : cameraDiffuse
          ? "irradiance-camera-clean.exr"
          : job.name === "normal"
            ? "normal-clean.png"
            : ["irradiance", "specular"].includes(job.name)
              ? job.name + "-clean.exr"
              : job.name + (job.hdr ? ".exr" : ".png"),
  );
  const args = [
    ...(job.hdr ? ["-hdr"] : ["-uastc", "-linear"]),
    "-uastc_level",
    "3",
    "-mipmap",
    "-mip_filter",
    "box",
    "-ktx2_zstandard_level",
    "19",
    "-max_threads",
    "4",
    ...(job.flip ? ["-y_flip"] : []),
    "-file",
    source,
    "-output_file",
    path.join(output, job.name + ".ktx2"),
  ];
  await run(basis, args, { maxBuffer: 4 * 1024 * 1024 });
  console.log("CEILING_KTX2", job.name, (await fs.stat(path.join(output, job.name + ".ktx2"))).size);
}
await sharp(path.join(work, "display-lut.png"))
  .removeAlpha()
  .png()
  .toFile(path.join(output, "display-lut.png"));
await fs.copyFile(path.join(work, "ceiling.glb"), "public/models/theatre/ceiling.glb");
const textures = {};
for (const name of ["irradiance.ktx2", "normal.ktx2", "environment.ktx2", "specular.ktx2", "display-lut.png"])
  textures[name] = (await fs.stat(path.join(output, name))).size;
const geometryBytes = (await fs.stat("public/models/theatre/ceiling.glb")).size;
const manifest = {
  model: "/models/theatre/ceiling.glb",
  geometryBytes,
  textures,
  bytes: geometryBytes + Object.values(textures).reduce((a, b) => a + b, 0),
  triangles: 4992,
  objects: 10,
  method:
    "PBR material constants and normal map; one diffuse lightmap; one local environment calibrated with one active-camera glossy map",
};
await fs.writeFile("components/corridor/theatre-ceiling-assets.json", JSON.stringify(manifest, null, 2));
console.log(manifest);
