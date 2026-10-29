import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Quaternion, Vector3 } from "three";
import { createJourneySampler, scrollProgress } from "../components/corridor/journey.ts";

const route = JSON.parse(readFileSync(new URL("../components/corridor/route.json", import.meta.url)));
const journey = createJourneySampler(route.samples, route.up);
const up = new Vector3().fromArray(route.up).normalize();

test("camera remains on the exported centreline, including both exact stops", () => {
  const position = new Vector3(), rotation = new Quaternion(), expected = new Vector3();
  for (let i = 0; i <= 2000; i++) {
    const t = i / 2000, index = t * (route.samples.length - 1);
    const low = Math.floor(index), high = Math.min(low + 1, route.samples.length - 1);
    expected.fromArray(route.samples[low].position).lerp(new Vector3().fromArray(route.samples[high].position), index - low);
    journey.sample(t, position, rotation);
    assert.ok(position.distanceTo(expected) < 1e-10);
  }
});

test("reversing scroll cannot leave camera orientation lagging behind position", () => {
  const a = new Vector3(), b = new Vector3(), qa = new Quaternion(), qb = new Quaternion();
  const poses = [];
  for (let i = 0; i <= 400; i++) {
    journey.sample(i / 400, a, qa);
    poses.push([a.clone(), qa.clone()]);
  }
  for (let i = 400; i >= 0; i--) {
    journey.sample(i / 400, b, qb);
    assert.ok(b.distanceTo(poses[i][0]) < 1e-10);
    assert.ok(qb.angleTo(poses[i][1]) < 1e-7);
  }
});

test("orientation stays level and continuous through the full curved corridor", () => {
  const position = new Vector3(), rotation = new Quaternion(), previous = new Quaternion();
  let biggestStep = 0;
  for (let i = 0; i <= 2000; i++) {
    journey.sample(i / 2000, position, rotation);
    const cameraUp = new Vector3(0, 1, 0).applyQuaternion(rotation);
    const forward = new Vector3(0, 0, -1).applyQuaternion(rotation);
    assert.ok(cameraUp.dot(up) > 0.999999);
    assert.ok(Math.abs(forward.dot(up)) < 0.00001);
    if (i) biggestStep = Math.max(biggestStep, previous.angleTo(rotation));
    previous.copy(rotation);
  }
  assert.ok(biggestStep < Math.PI / 180, `Abrupt direction step: ${biggestStep * 180 / Math.PI} degrees`);
});

test("the live viewport height cannot change a fixed scroll stop; rubber-band values are clamped", () => {
  const stableStage = 844, stableTravel = 450 * 7.4, railHeight = stableStage + stableTravel;
  const scrollY = stableTravel * 0.6;
  for (const visualHeight of [740, 780, 844, 780, 740]) {
    assert.notEqual(railHeight - visualHeight, 0);
    assert.equal(scrollProgress(scrollY, railHeight - stableStage), 0.6);
  }
  assert.equal(scrollProgress(-80, stableTravel), 0);
  assert.equal(scrollProgress(stableTravel + 80, stableTravel), 1);
});

test("theatre placement preserves original proportions without independent floor stretching", () => {
  const placement = JSON.parse(readFileSync(new URL("../components/corridor/placement.json", import.meta.url)));
  const a = placement.matrix;
  const axes = [0, 4, 8].map((i) => new Vector3(a[i], a[i + 1], a[i + 2]));
  const lengths = axes.map((axis) => axis.length());
  assert.ok(Math.max(...lengths) - Math.min(...lengths) < 1e-8);
  assert.equal(placement.floorWidthFactor, undefined);
  assert.ok(Math.abs(axes[0].clone().normalize().dot(axes[1].clone().normalize())) < 1e-6);
});

test("Blender layout is used directly and camera framing moves with the theatre", () => {
  const p = JSON.parse(readFileSync(new URL("../components/corridor/placement.json", import.meta.url)));
  const layout = JSON.parse(readFileSync(new URL("../components/corridor/blender-layout.json", import.meta.url)));
  const camera = JSON.parse(readFileSync(new URL("../components/corridor/reference-camera.json", import.meta.url)));
  assert.deepEqual(p.matrix, [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  assert.equal(layout.theatreScale, 1);
  const [x,y,z] = layout.theatreTranslationBlender;
  assert.deepEqual(camera.screenCentre, [x,3.22+z,-.802-y]);
  assert.equal(camera.fov, 40);
  assert.ok(Math.abs(camera.start[2] - (camera.screenCentre[2] - 9.6)) < 1e-10);
  assert.ok(Math.abs(camera.stop[2] - (-22.2-y)) < 1e-10);
  assert.equal(layout.slides.length, 2);
});
test("connected upgraded route remains level and smooth at the platform join", () => {
  const route = JSON.parse(readFileSync(new URL("../components/corridor/scene-route.json", import.meta.url)));
  const connected = createJourneySampler(route.samples, route.up);
  const p = new Vector3(), q = new Quaternion(), previous = new Quaternion();
  const camera = JSON.parse(readFileSync(new URL("../components/corridor/reference-camera.json", import.meta.url)));
  assert.deepEqual(route.samples[0].position, camera.stop);
  for(let i=0;i<=4000;i++) {
    connected.sample(i/4000,p,q);
    assert.ok(Math.abs(p.y-camera.stop[1])<1e-8);
    assert.ok(new Vector3(0,1,0).applyQuaternion(q).y>.999999);
    if(i) assert.ok(previous.angleTo(q)<Math.PI/180, "Connected route has an abrupt camera turn");
    previous.copy(q);
  }
});

