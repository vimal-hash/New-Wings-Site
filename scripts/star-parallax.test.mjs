import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Matrix4, PerspectiveCamera, Quaternion, Vector3 } from "three";
import { createJourneySampler } from "../components/corridor/journey.ts";
import { createLogoReveal } from "../components/corridor/logo-reveal.ts";
import {
  createDepthField,
  createDepthLayout,
  STAR_PARALLAX_GAIN,
} from "../components/corridor/logo-particle-eye/depth-field.ts";
const read = (name) =>
  JSON.parse(fs.readFileSync(new URL("../components/corridor/" + name, import.meta.url)));
const bounds = read("logo-reveal.json").blenderBounds,
  route = read("scene-route.json"),
  reference = read("reference-camera.json");
const index = route.samples.findIndex((s) => s.position[2] <= -55 + reference.stop[2] + 14.2),
  position = new Vector3(),
  rotation = new Quaternion();
createJourneySampler(route.samples.slice(index), route.up).sample(1, position, rotation);
position.y = read("projector-assets.json").centre_blender[2] + 0.1;
const initial = new Quaternion().setFromRotationMatrix(
  new Matrix4().lookAt(
    position,
    new Vector3(0, 0, -1).applyQuaternion(rotation).multiplyScalar(14).add(position),
    new Vector3(0, 1, 0),
  ),
);
const path = createLogoReveal(
  bounds,
  read("blender-layout.json").slides[1],
  position.y,
  1920 / 945,
  position,
  initial,
);
const first = new Vector3(),
  origin = new Vector3(),
  qFirst = new Quaternion(),
  qTurn = new Quaternion();
path.sampleSlide(0.985, first, qFirst);
path.sampleTurn(1, origin, qTurn);
const unit = (bounds[1][1] - bounds[1][0]) / 3.5,
  forward = new Vector3(0, 0, -1).applyQuaternion(qTurn);
const data = createDepthLayout("desktop", origin, Math.atan2(forward.x, forward.z), unit);
const camera = new PerspectiveCamera(40, 1920 / 945, 0.05, 20000);
function project(point, pose, gain) {
  camera.position.copy(origin).addScaledVector(pose.clone().sub(origin), gain);
  // Hold orientation fixed to measure translational parallax, not the shared
  // camera turn (which must remain physically correct at every depth).
  camera.quaternion.copy(qTurn);
  camera.updateMatrixWorld(true);
  return point.clone().project(camera);
}
const pixels = (a, b) => Math.hypot((a.x - b.x) * 960, (a.y - b.y) * 472.5);
const median = (values) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];

test("distant star translation is readable but substantially slower than foreground grains", () => {
  const old = [],
    stars = [],
    near = [];
  for (let i = 0; i < data.count; i++) {
    const point = new Vector3().fromArray(data.positions, i * 3),
      distant = data.appearance[i * 3 + 2] > 0.5;
    const stop = project(point, origin, 1),
      start = project(point, first, distant ? STAR_PARALLAX_GAIN : 1);
    if (
      Math.abs(stop.x) > 0.9 ||
      Math.abs(stop.y) > 0.9 ||
      Math.abs(start.x) > 0.95 ||
      Math.abs(start.y) > 0.95
    )
      continue;
    if (distant) {
      old.push(pixels(project(point, first, 1), stop));
      stars.push(pixels(start, stop));
    } else near.push(pixels(start, stop));
  }
  assert.ok(stars.length > 500 && near.length > 5, "measure representative visible points");
  assert.ok(median(old) < 1, "the previous translation was subpixel");
  assert.ok(median(stars) > 2 && median(stars) < 6, "subtle few-pixel response, not obvious floating");
  assert.ok(median(near) > median(stars) * 5, "foreground still translates much faster");
});

test("star response has no history and retains its anchor, buffers and sprite properties", () => {
  const field = createDepthField(data, unit, 3.5, "in vec2 vUV; void main(){}");
  assert.equal(field.material.uniforms.uStarParallax.value, STAR_PARALLAX_GAIN);
  assert.equal(field.geometry.instanceCount, data.count);
  assert.equal(field.geometry.getAttribute("grainPosition").array, data.positions);
  assert.equal(field.geometry.getAttribute("detail").array, data.details);
  for (let i = 0; i < 2880; i += 17) {
    const point = new Vector3().fromArray(data.positions, i * 3),
      a = project(point, first, STAR_PARALLAX_GAIN);
    const oldAnchor = project(point, origin, 1),
      newAnchor = project(point, origin, STAR_PARALLAX_GAIN);
    assert.ok(oldAnchor.distanceTo(newAnchor) < 1e-10, "the turned anchor composition stays fixed");
    assert.ok(
      a.distanceTo(project(point, first, STAR_PARALLAX_GAIN)) < 1e-10,
      "returning to a pose cannot leave a lagging offset",
    );
  }
  field.geometry.dispose();
  field.material.dispose();
  field.haze.geometry.dispose();
  field.haze.material.dispose();
});
