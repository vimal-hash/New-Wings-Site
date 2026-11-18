import fs from "node:fs";
import path from "node:path";
import { Matrix4, Vector3, CatmullRomCurve3 } from "three";

const output = "D:/CodexOutputs/Approved_Theatre_Corridor_20261020/";
const directory = "components/corridor/";
const manifest = JSON.parse(fs.readFileSync(output + "export-manifest.json"));
const report = JSON.parse(fs.readFileSync(output + "layout-report.json"));
const verification = JSON.parse(fs.readFileSync(output + "verification.json"));
if (verification.above_floor_intersections.length) throw Error("Blender layout verification failed");
const animation = JSON.parse(fs.readFileSync(output + "projector-animation.json"));
const projectorSource = JSON.parse(fs.readFileSync(output + "projector-static-source.json"));
const expectedTranslation = report.theatre_translation.map((v, i) => v + projectorSource.centering_offset[i]);
if (animation.translation.some((v, i) => Math.abs(v - expectedTranslation[i]) > 1e-5))
  throw Error("Re-export projector animation for the current Blender placement");
for (const name of ["projector-animated.glb", "projector-motion.bin.gz", "projector-motion.bin"])
  fs.copyFileSync(output + name, "public/models/" + name);

for (const [group, asset] of Object.entries(manifest)) {
  fs.copyFileSync(asset.file, `public/models/${group}-marked.glb`);
}
const write = (name, data) => fs.writeFileSync(directory + name, JSON.stringify(data, null, 2));
write("projector-animation.json", animation);
const colourKey = JSON.parse(fs.readFileSync(output + "colour-key.json"));
const escapeHtml = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const hexColour = (rgb) =>
  "#" +
  rgb
    .map((v) =>
      Math.round((v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
fs.writeFileSync(
  "public/object-colour-key.html",
  `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Blender layout colour key</title><style>body{font:16px system-ui;padding:24px;background:#11151a;color:#eee}td,th{padding:12px;text-align:left;border-bottom:1px solid #444}a{color:#bfefff}.swatch{display:inline-block;width:24px;height:24px;margin-right:8px;vertical-align:middle}</style><a href="/">Back to scene</a><h1>Blender layout — diagnostic colours</h1><p>${
    colourKey.length
  } corridor, logo and slide objects. Theatre vertex colours are separate. Swatches identify materials; scene lighting affects their appearance.</p><table><tr><th>ID</th><th>Colour</th><th>Mesh</th></tr>${colourKey
    .map((r, i) => {
      const hex = hexColour(r.rgb);
      return `<tr><td>${
        i + 1
      }</td><td><span class="swatch" style="background:${hex}"></span>${hex}</td><td>${escapeHtml(
        r.name,
      )}</td></tr>`;
    })
    .join("")}</table></html>`,
);
write("corridor-assets.json", {
  bytes: manifest.corridor.bytes,
  objects: manifest.corridor.source_objects,
  triangles: manifest.corridor.triangles,
});
write("theatre-assets.json", {
  models: 3,
  bytes:
    manifest.theatre.bytes + manifest["projector-floor"].bytes + animation.modelBytes + animation.motionBytes,
  objects: manifest.theatre.source_objects + manifest["projector-floor"].source_objects + animation.parts,
  triangles: manifest.theatre.triangles + manifest["projector-floor"].triangles + animation.triangles,
});
write("projector-assets.json", {
  ...manifest.projector,
  ...JSON.parse(fs.readFileSync(output + "projector-placement.json")),
  activeModel: animation.modelUrl,
  activeTriangles: animation.triangles,
});
write("placement.json", {
  matrix: new Matrix4().toArray(),
  scale: 1,
  source: report.file + "; all model coordinates baked from Blender; no runtime fit",
});
write("blender-layout.json", {
  file: report.file,
  theatreTranslationBlender: report.theatre_translation,
  theatreScale: report.theatre_scale,
  theatreFrontY: report.theatre_front_y,
  projectorFloorY: report.projector_floor_y,
  slides: report.slides,
  verification: path.join(output, "verification.json"),
});
const [x, y, z] = report.theatre_translation;
const camera = {
  source: report.file + "; original camera framing translated with the theatre",
  screenCentre: [x, 3.22 + z, -0.802 - y],
  start: [x, 3.22 + z, -0.802 - y - 9.6],
  stop: [x, 3.22 + z, -22.2 - y],
  fov: 40,
  near: 0.05,
  far: 1200,
  holdSeconds: 2,
  pullbackSeconds: 2.5,
};
write("reference-camera.json", camera);

// Convert the final corridor's authored centreline into the same Blender export
// frame. Never infer a scene fit from a screenshot or scale one model in R3F.
const matrix = JSON.parse(
  fs.readFileSync(
    "D:/CodexOutputs/Theatre_Optimization_20261017/Web_Export_20261019/upgraded-coordinate-map.json",
  ),
).blenderMatrix;
const conversion = new Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1);
const world = conversion
  .clone()
  .multiply(new Matrix4().fromArray(matrix))
  .multiply(conversion.clone().invert());
const original = JSON.parse(fs.readFileSync(directory + "route.json"));
const height = camera.stop[1];
const platformEnd = report.projector_floor_y[1];
const points = [
  new Vector3(...camera.stop),
  new Vector3(0, height, -platformEnd),
  new Vector3(0, height, -30),
];
for (const sample of original.samples) {
  const p = new Vector3(...sample.position).applyMatrix4(world);
  p.y = height;
  if (p.z < -31) points.push(p);
}
points.push(new Vector3(-160.32785, height, -112.542465));
const curve = new CatmullRomCurve3(points, false, "centripetal");
write("scene-route.json", {
  up: [0, 1, 0],
  samples: Array.from({ length: 641 }, (_, i) => ({ position: curve.getPointAt(i / 640).toArray() })),
  source: report.file + "; translated theatre camera, projector platform and authored corridor centreline",
});
let source = fs.readFileSync(directory + "scene.tsx", "utf8");
source = source.replace(/const MODEL = .*?;/, 'const MODEL = "/models/corridor-marked.glb";');
source = source.replace(
  /const THEATRE_MODELS = .*?;/,
  'const THEATRE_MODELS = ["/models/theatre-marked.glb", "/models/projector-floor-marked.glb"];',
);
source = source.replace("maxDistance={300}", "maxDistance={900}");
source = source.replace("near: 0.05, far: 200", "near: referenceCamera.near, far: referenceCamera.far");
fs.writeFileSync(directory + "scene.tsx", source);
console.log({
  manifest,
  camera,
  activeProjector: animation.modelUrl,
  triangles:
    manifest.corridor.triangles +
    manifest.theatre.triangles +
    manifest["projector-floor"].triangles +
    animation.triangles,
});
