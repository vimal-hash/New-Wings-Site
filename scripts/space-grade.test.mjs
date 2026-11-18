import test from "node:test";
import assert from "node:assert/strict";
import { NearestFilter, NoColorSpace, PerspectiveCamera, WebGLRenderTarget } from "three";
import { createSpaceGrade } from "../components/corridor/space-grade.ts";

function renderer() {
  let target = null,
    width = 1920,
    height = 945;
  const calls = [],
    frames = [];
  const gl = {
    autoClear: true,
    getRenderTarget: () => target,
    setRenderTarget: (value) => {
      target = value;
    },
    getDrawingBufferSize: (value) => value.set(width, height),
    copyFramebufferToTexture: (texture) => {
      calls.push("copy");
      frames.push(texture);
    },
    render: (object) => {
      calls.push("render");
      gl.material = object.material;
    },
    setSize: () => assert.fail("A colour grade must never resize the visible renderer"),
  };
  return {
    gl,
    calls,
    frames,
    resize: (w, h) => {
      width = w;
      height = h;
    },
  };
}

test("grade copies the composited frame at native resolution without a display conversion or camera mutation", () => {
  for (const tier of ["desktop", "laptop", "mobile"]) {
    const { gl, calls, frames } = renderer(),
      camera = new PerspectiveCamera(40, 1920 / 945, 0.1, 20000);
    camera.position.set(10, 20, 30);
    camera.lookAt(1, 2, 3);
    camera.updateMatrixWorld();
    const pose = camera.matrixWorld.toArray(),
      projection = camera.projectionMatrix.toArray();
    const grade = createSpaceGrade(gl, tier);
    grade.prepare();
    calls.length = 0;
    grade.draw(camera, null, true, 1);
    assert.deepEqual(calls, ["copy", "render"]);
    assert.equal(gl.autoClear, true);
    assert.equal(gl.getRenderTarget(), null);
    assert.deepEqual([frames[0].image.width, frames[0].image.height], [1920, 945]);
    assert.equal(frames[0].colorSpace, NoColorSpace);
    assert.equal(frames[0].minFilter, NearestFilter);
    assert.equal(gl.material.toneMapped, false);
    assert.equal(gl.material.fragmentShader.includes("#include <colorspace_fragment>"), false);
    assert.deepEqual(camera.matrixWorld.toArray(), pose);
    assert.deepEqual(camera.projectionMatrix.toArray(), projection);
    grade.dispose();
  }
});

test("grade stays out of disabled, unprepared, transparent-transition and private framebuffer draws", () => {
  const { gl, calls } = renderer(),
    camera = new PerspectiveCamera(),
    off = createSpaceGrade(gl, "desktop", { enabled: false });
  off.prepare();
  off.draw(camera, null, true, 1);
  assert.deepEqual(calls, []);
  off.dispose();
  const grade = createSpaceGrade(gl, "desktop");
  grade.draw(camera, null, true, 1);
  assert.deepEqual(calls, []);
  grade.prepare();
  calls.length = 0;
  grade.draw(camera, null, true, 0);
  assert.deepEqual(calls, []);
  const probe = new WebGLRenderTarget(1, 1);
  gl.setRenderTarget(probe);
  grade.draw(camera, null, true, 1);
  assert.deepEqual(calls, []);
  assert.equal(gl.getRenderTarget(), probe);
  probe.dispose();
  grade.dispose();
});

test("grade reuses its frame texture, releases it on resize, and restores renderer state on failure", () => {
  const { gl, calls, frames, resize } = renderer(),
    camera = new PerspectiveCamera(),
    grade = createSpaceGrade(gl, "desktop");
  grade.prepare();
  grade.draw(camera, null, true, 1);
  grade.draw(camera, null, true, 1);
  assert.equal(frames[0], frames[1]);
  let released = 0;
  frames[0].addEventListener("dispose", () => released++);
  resize(1280, 720);
  grade.draw(camera, null, true, 1);
  assert.equal(released, 1);
  assert.deepEqual([frames[2].image.width, frames[2].image.height], [1280, 720]);
  gl.render = () => {
    throw Error("synthetic draw failure");
  };
  assert.throws(() => grade.draw(camera, null, true, 1), /synthetic/);
  assert.equal(gl.autoClear, true);
  assert.equal(gl.getRenderTarget(), null);
  grade.dispose();
  assert.ok(calls.length > 0);
});
