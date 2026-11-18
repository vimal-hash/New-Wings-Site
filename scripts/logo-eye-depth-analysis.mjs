import fs from "node:fs";
import { Quaternion, Vector3, PerspectiveCamera } from "three";
import { createJourneySampler } from "../components/corridor/journey.ts";
import { createLogoReveal, LOGO_FOV } from "../components/corridor/logo-reveal.ts";
const read = (name) =>
  JSON.parse(fs.readFileSync(new URL("../components/corridor/" + name, import.meta.url)));
const route = read("scene-route.json"),
  reference = read("reference-camera.json"),
  projector = read("projector-assets.json"),
  layout = read("blender-layout.json"),
  bounds = read("logo-reveal.json").blenderBounds;
const screens = route.samples.findIndex((s) => s.position[2] <= -55 + reference.stop[2] + 14.2);
const position = new Vector3(),
  rotation = new Quaternion();
createJourneySampler(route.samples.slice(screens), route.up).sample(1, position, rotation);
position.y = projector.centre_blender[2] + 0.1;
const reveal = createLogoReveal(bounds, layout.slides[1], position.y, 1920 / 945, position, rotation);
const diameter = Math.max(bounds[0][1] - bounds[0][0], bounds[1][1] - bounds[1][0]),
  unit = diameter / 3.5;
const poses = {};
for (const [name, method, t] of [
  ["slide0", "sampleSlide", 0],
  ["slide45", "sampleSlide", 0.45],
  ["slide80", "sampleSlide", 0.8],
  ["top", "sampleTurn", 1],
  ["final", "samplePullback", 1],
]) {
  const p = new Vector3(),
    q = new Quaternion();
  reveal[method](t, p, q);
  const camera = new PerspectiveCamera(LOGO_FOV, 1920 / 945, 0.05, reveal.far);
  camera.position.copy(p);
  camera.quaternion.copy(q);
  camera.updateMatrixWorld(true);
  poses[name] = {
    position: p.toArray(),
    rotation: q.toArray(),
    forward: new Vector3(0, 0, -1).applyQuaternion(q).toArray(),
    up: new Vector3(0, 1, 0).applyQuaternion(q).toArray(),
    eyeCentreNDC: reveal.centre.clone().project(camera).toArray(),
    eyeOriginLocal: p
      .clone()
      .sub(reveal.centre)
      .applyQuaternion(reveal.finalRotation.clone().invert())
      .multiplyScalar(1 / unit)
      .toArray(),
  };
}
console.log(
  JSON.stringify({ unit, diameter, far: reveal.far, centre: reveal.centre.toArray(), poses }, null, 2),
);
