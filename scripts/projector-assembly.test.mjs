import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { assemblyClips, assemblyEnd } from "../components/corridor/projector-assembly.ts";

const meta = JSON.parse(fs.readFileSync("components/corridor/projector-animation.json"));
const bytes = fs.readFileSync("public/models/projector/projector-poses.bin");
const poses = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const at = (frame, part, k) => poses[(frame * meta.textureWidth + part * 3) * 4 + k];

test("every part keeps its exact Blender start and end pose, its build order, and settles before the clock ends", () => {
  const clips = assemblyClips(poses, meta.parts, meta.frames, meta.textureWidth);
  let moving = 0;
  for (let i = 0; i < meta.parts; i++) {
    const [start, end, , travel] = clips.slice(i * 4, i * 4 + 4);
    assert.ok(Number.isInteger(start) && Number.isInteger(end) && start <= end && travel > 0);
    for (let k = 0; k < 12; k++) {
      if (k === 3) continue;
      assert.ok(
        Math.abs(at(start, i, k) - at(0, i, k)) < 1e-6,
        "part " + i + " starts away from its exploded pose",
      );
      assert.ok(
        Math.abs(at(end, i, k) - at(meta.frames - 1, i, k)) < 1e-6,
        "part " + i + " ends away from its assembled pose",
      );
    }
    if (start < end) moving++;
  }
  assert.ok(moving > 300);
  // Blender order is kept: a part that starts later in Blender never starts more than the jitter earlier here.
  for (let i = 0; i < meta.parts; i++)
    for (let j = 0; j < meta.parts; j++) {
      const si = clips[i * 4],
        sj = clips[j * 4];
      if (si === clips[i * 4 + 1] || sj === clips[j * 4 + 1] || si >= sj) continue;
      assert.ok(clips[i * 4 + 2] <= clips[j * 4 + 2] + 0.05 + 1e-6, `part ${j} would start before ${i}`);
    }
  const end = assemblyEnd(clips);
  assert.ok(end > 1.3 && end <= meta.assemblySeconds - 0.1, "last part settles at " + end + "s");
  assert.equal(meta.assemblySeconds, 2);
});
