import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { PerspectiveCamera, Quaternion, Vector3 } from "three";
import { createLogoReveal, LOGO_FOV } from "../components/corridor/logo-reveal.ts";
import { eyeDimensions } from "../components/corridor/logo-particle-eye/field.ts";
import {
  createDepthLayout,
  depthLayerVisibility,
} from "../components/corridor/logo-particle-eye/depth-field.ts";
const root = new URL("../", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root));
const assets = JSON.parse(read("components/corridor/logo-particle-eye/assets.json"));
const context = vm.createContext({ self: {}, DataView, Uint16Array, Uint8Array, Number, Error });
vm.runInContext(read("public/models/logo-eye/decode-worker.js").toString(), context);
const decode = (buffer) =>
  context.decodeEyeBuffer(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
const decoded = {};
test("sparse depth grains stay bounded and fixed without changing the authored point data", () => {
  const origin = new Vector3(-184, 34, -107),
    unit = 113.9715053;
  for (const quality of ["desktop", "laptop", "mobile"]) {
    const data = createDepthLayout(quality, origin, 0.49, unit),
      again = createDepthLayout(quality, origin, 0.49, unit);
    assert.deepEqual(data.positions, again.positions, "placement must not change while travelling");
    assert.ok(
      data.count < assets.tiers[quality].count * 0.025,
      "addition must remain a small fraction of the eye",
    );
    let near = 0,
      far = 0,
      sawNear = false;
    for (let i = 0; i < data.count; i++) {
      const p = new Vector3().fromArray(data.positions, i * 3),
        distance = p.distanceTo(origin);
      assert.ok(distance > 130 && distance < 16000, "depth spread stays in its bounded world-space volume");
      assert.ok(p.y > origin.y - 400, "grains occupy the upper environment and distant horizon");
      assert.ok(data.details[i * 4] > 0 && data.details[i * 4 + 1] < 64, "uses the existing grain atlas");
      if (data.appearance[i * 3 + 2]) {
        assert.equal(sawNear, false, "transparent background stars must draw before nearby grains");
        far++;
        assert.ok(distance > 4500);
      } else {
        sawNear = true;
        near++;
        assert.ok(distance < 580);
      }
    }
    assert.ok(far > near * 4, "most added grains belong to the very distant region");
    assert.equal(
      far,
      { desktop: 2880, laptop: 1920, mobile: 960 }[quality],
      "only the original distant count doubles",
    );
  }
});
test("depth layer fades continuously during pullback and never returns in the final eye", () => {
  assert.equal(depthLayerVisibility("intro", "slide", 0), 0);
  assert.equal(depthLayerVisibility("logoReveal", "slide", 0), 1);
  assert.equal(depthLayerVisibility("logoReveal", "turned", 0), 1);
  let previous = 1;
  for (let t = 0; t <= 1; t += 0.001) {
    const opacity = depthLayerVisibility("logoReveal", "pullback", t);
    assert.ok(opacity <= previous && opacity >= 0);
    assert.ok(previous - opacity < 0.008);
    previous = opacity;
  }
  assert.equal(depthLayerVisibility("logoReveal", "pullback", 0.22), 0);
  assert.equal(depthLayerVisibility("logoReveal", "done", 0), 0, "no last-frame flash");
  assert.equal(depthLayerVisibility("logoDone", "done", 1), 0);
});
test("distant star strength increases with physical star size", () => {
  const data = createDepthLayout("desktop", new Vector3(), 0.49, 113.9715053),
    stars = [];
  for (let i = 0; i < data.count; i++)
    if (data.appearance[i * 3 + 2])
      stars.push([data.details[i * 4], data.appearance[i * 3], data.appearance[i * 3 + 1]]);
  stars.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < stars.length; i++) {
    assert.ok(stars[i][1] >= stars[i - 1][1] - 0.00001, "larger stars must not become weaker");
    assert.ok(stars[i][2] >= stars[i - 1][2] - 0.0001, "intrinsic brightness follows size");
  }
  assert.ok(stars.at(-1)[2] > stars[0][2] * 4, "the distant field retains bright anchors and faint stars");
});
for (const [quality, tier] of Object.entries(assets.tiers)) {
  test(`authored ${quality} tier decodes to bounded grains with the approved clear pupil`, () => {
    const packed = read("public" + tier.url);
    assert.equal(packed.length, tier.bytes);
    assert.equal(createHash("sha256").update(packed).digest("hex"), tier.sha256);
    const data = decode(gunzipSync(packed));
    decoded[quality] = data;
    assert.equal(data.count, tier.count);
    assert.equal(data.positions.byteLength + data.grains.byteLength, tier.gpuAttributeBytes);
    let upper = 0,
      lower = 0;
    for (let i = 0; i < data.count; i++) {
      const [x, y, z] = data.min.map(
        (value, axis) => value + (data.positions[i * 3 + axis] / 65535) * data.extent[axis],
      );
      assert.ok(Math.hypot(x, y) > 1.8, "grain crosses the pupil");
      assert.ok(Math.abs(x) < 11.05 && Math.abs(y) < 7.4 && Math.abs(z) < 1.7);
      assert.ok(data.grains[i * 3] > 0 && data.grains[i * 3 + 2] < 64);
      if (y > 0) upper++;
      else lower++;
    }
    assert.ok(Math.abs(upper - lower) / data.count < 0.03, "both eye halves retain their density");
  });
}
test("lower quality tiers are nested subsets of the approved full point cloud", () => {
  const key = (d, i) => `${d.positions[i * 3]},${d.positions[i * 3 + 1]},${d.positions[i * 3 + 2]}`;
  const full = decoded.desktop,
    medium = decoded.laptop,
    small = decoded.mobile;
  const all = new Set(Array.from({ length: full.count }, (_, i) => key(full, i)));
  const laptop = new Set(Array.from({ length: medium.count }, (_, i) => key(medium, i)));
  for (let i = 0; i < medium.count; i++) assert.ok(all.has(key(medium, i)));
  for (let i = 0; i < small.count; i++) assert.ok(laptop.has(key(small, i)));
});
test("worker rejects malformed/truncated input before allocating particle arrays", () => {
  assert.throws(() => decode(Buffer.alloc(47)), /header/);
  const raw = gunzipSync(read("public" + assets.tiers.mobile.url));
  assert.throws(() => decode(raw.subarray(0, -1)), /length/);
  const corrupt = Buffer.from(raw);
  corrupt.writeUInt32LE(0xffffffff, 8);
  assert.throws(() => decode(corrupt), /length/);
});
test("both authored ends reach the unchanged reveal camera edges without changing lid height", () => {
  const bounds = JSON.parse(read("components/corridor/logo-reveal.json")).blenderBounds;
  const slide = JSON.parse(read("components/corridor/blender-layout.json")).slides[1];
  const diameter = Math.max(bounds[0][1] - bounds[0][0], bounds[1][1] - bounds[1][0]);
  for (const aspect of [0.462, 1, 1280 / 720, 2.05, 3]) {
    const reveal = createLogoReveal(bounds, slide, 5, aspect, new Vector3(), new Quaternion());
    const camera = new PerspectiveCamera(LOGO_FOV, aspect, 0.05, reveal.far);
    camera.position.copy(reveal.finalPosition);
    camera.quaternion.copy(reveal.finalRotation);
    camera.updateMatrixWorld(true);
    const d = eyeDimensions(diameter, camera.position.distanceTo(reveal.centre), aspect, LOGO_FOV),
      data = decoded.desktop;
    let cropped = 0,
      left = 0,
      right = 0;
    for (let i = 0; i < data.count; i++) {
      const p = new Vector3(
        ...data.min.map(
          (v, a) =>
            (v + (data.positions[i * 3 + a] / 65535) * data.extent[a]) * (a === 0 ? d.scaleX : d.scale),
        ),
      );
      p.applyQuaternion(reveal.finalRotation).add(reveal.centre).project(camera);
      assert.ok(Math.abs(p.x) < 1.02, `excess horizontal crop at aspect ${aspect}`);
      if (Math.abs(p.y) < 0.25) {
        left = Math.min(left, p.x);
        right = Math.max(right, p.x);
      }
      if (Math.abs(p.y) > 1.02) cropped++;
    }
    assert.ok(
      left < -0.995 && right > 0.995,
      `end noses stop short of the screen at aspect ${aspect}: ${left}, ${right}`,
    );
    assert.ok(
      cropped / data.count < 0.002,
      "only the approved distant halo may reach beyond the top/bottom frame",
    );
    assert.equal(d.scale, diameter / 3.5, "horizontal fitting must not change lid height");
    assert.ok(d.scale * 2.15 > diameter * 0.5, "the dense body must clear the logo");
  }
});
