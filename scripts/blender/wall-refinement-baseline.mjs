import fs from "node:fs";
import { Vector3 } from "three";
const route = JSON.parse(fs.readFileSync("components/corridor/scene-route.json")).samples,
  ref = JSON.parse(fs.readFileSync("components/corridor/reference-camera.json")),
  projector = JSON.parse(fs.readFileSync("components/corridor/projector-assets.json"));
const start = route.findIndex((s) => s.position[2] <= -55 + ref.stop[2] + 14.2),
  passage = route.slice(start),
  idx = 0.91 * (passage.length - 1),
  lo = Math.floor(idx),
  target = new Vector3()
    .fromArray(passage[lo].position)
    .lerp(new Vector3().fromArray(passage[lo + 1].position), idx - lo),
  eye = new Vector3().fromArray(passage.at(-1).position),
  dir = target.clone().sub(eye);
dir.y = 0;
dir.normalize();
eye.y = projector.centre_blender[2] + 0.1;
target.copy(eye).addScaledVector(dir, 14);
const b = (v) => [v.x, -v.z, v.y];
fs.writeFileSync(
  "docs/corridor-wall-red-refinement/page-pose.json",
  JSON.stringify({ eye: b(eye), target: b(target), fov: 40, width: 1600, height: 788 }),
);
const files = ["public", "components", "app"].flatMap((d) =>
  fs
    .readdirSync(d, { recursive: true })
    .map((f) => d + "/" + f.split(String.fromCharCode(92)).join("/"))
    .filter((f) => fs.statSync(f).isFile()),
);
const c = await import("node:crypto");
fs.writeFileSync(
  "docs/corridor-wall-red-refinement/baseline.json",
  JSON.stringify(
    Object.fromEntries(
      files.map((p) => [p, c.createHash("sha256").update(fs.readFileSync(p)).digest("hex")]),
    ),
  ),
);
console.log({ eye: b(eye), target: b(target) });
