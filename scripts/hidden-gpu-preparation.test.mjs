import test from "node:test";
import assert from "node:assert/strict";
import { Group, Mesh, Scene, PerspectiveCamera } from "three";
import load from "./load-runtime-ts.cjs";
const { prepareHiddenGPU, prepareMobileMeshes, compileHiddenGPU } = load(
  "components/corridor/hidden-gpu-preparation.ts",
);

test("normal and offscreen compilation restore the framebuffer while awaiting completion or rejection", async () => {
  let target = null,
    release,
    entered,
    disposed = false;
  const calls = [],
    offscreenEntered = new Promise((resolve) => {
      entered = resolve;
    });
  const renderer = {
    getRenderTarget: () => target,
    setRenderTarget: (value) => {
      target = value;
    },
    compileAsync() {
      calls.push(target);
      if (!target) return Promise.resolve();
      target.addEventListener("dispose", () => {
        disposed = true;
      });
      return new Promise((_, reject) => {
        release = reject;
        entered();
      });
    },
  };
  const pending = compileHiddenGPU(renderer, new Scene(), new PerspectiveCamera());
  await offscreenEntered;
  assert.equal(calls.length, 2);
  assert.equal(calls[0], null);
  assert.ok(calls[1]);
  assert.equal(target, null);
  assert.equal(disposed, false);
  release(Error("compile failed"));
  await assert.rejects(pending, /compile failed/);
  assert.equal(target, null);
  assert.equal(disposed, true);
});
test("phone warm-up draws only the selected meshes and restores the scene on failure", async () => {
  const scene = new Scene(),
    room = new Group(),
    warm = new Mesh(),
    other = new Mesh();
  room.visible = false;
  room.add(warm);
  scene.add(room, other);
  let target = null;
  const shadowMap = { autoUpdate: true, needsUpdate: true };
  const renderer = {
    shadowMap,
    getRenderTarget: () => target,
    setRenderTarget: (value) => {
      target = value;
    },
    render() {
      assert.equal(room.visible, true);
      assert.equal(warm.frustumCulled, false);
      assert.equal(other.visible, false);
      assert.deepEqual(shadowMap, { autoUpdate: false, needsUpdate: false });
      throw Error("draw failed");
    },
  };
  await assert.rejects(
    prepareMobileMeshes(renderer, scene, new PerspectiveCamera(), [warm], () => true),
    /draw failed/,
  );
  assert.equal(room.visible, false);
  assert.equal(warm.frustumCulled, true);
  assert.equal(other.visible, true);
  assert.equal(target, null);
  assert.deepEqual(shadowMap, { autoUpdate: true, needsUpdate: true });
});
test("private GPU preparation restores invisibility and renderer state even after a failed draw", () => {
  const root = new Group(),
    mesh = new Mesh(),
    scene = new Scene();
  root.visible = false;
  mesh.visible = false;
  root.add(mesh);
  scene.add(root);
  let target = null;
  const renderer = {
    shadowMap: { autoUpdate: true, needsUpdate: true },
    getRenderTarget: () => target,
    setRenderTarget: (value) => {
      target = value;
    },
    render() {
      assert.equal(root.visible, true);
      assert.equal(mesh.visible, true);
      assert.equal(mesh.frustumCulled, false);
      assert.ok(target);
      throw Error("draw failed");
    },
  };
  assert.throws(() => prepareHiddenGPU(renderer, scene, new PerspectiveCamera(), [mesh, root, mesh]), /draw failed/);
  assert.equal(root.visible, false);
  assert.equal(mesh.visible, false);
  assert.equal(mesh.frustumCulled, true);
  assert.equal(target, null);
  assert.deepEqual(renderer.shadowMap, { autoUpdate: true, needsUpdate: true });
});
