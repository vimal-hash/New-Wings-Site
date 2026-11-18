import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  Scene,
  type Camera,
  type Material,
  type Object3D,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from "three";

type FinishPasses = { toPictures: Material[]; toScreen: Material[] };

/**
 * Sections only: compiles a flight's programs in the background (the browser's parallel compile), while the flight is
 * still hidden, so its first moving frame is not a freeze. A program depends on where it draws, so the scene is compiled
 * for the picture it is drawn into, the finishing passes for their pictures, and the last pass for the screen.
 */
export async function compileFlight(
  gl: WebGLRenderer,
  scene: Object3D,
  camera: Camera,
  target: WebGLRenderTarget,
  passes: FinishPasses,
) {
  // The same attributes as the full-screen triangle the passes are drawn with (a program depends on them).
  const plane = new BufferGeometry();
  plane.setAttribute("position", new Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3));
  plane.setAttribute("uv", new Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
  const group = (materials: Material[]) => {
    const made = new Scene();
    for (const material of materials) made.add(new Mesh(plane, material));
    return made;
  };
  const compileAt = async (object: Object3D, output: WebGLRenderTarget | null) => {
    const was = gl.getRenderTarget();
    try {
      gl.setRenderTarget(output);
      return gl.compileAsync(object, camera);
    } finally {
      gl.setRenderTarget(was);
    }
  };
  try {
    await Promise.all([
      compileAt(scene, target),
      compileAt(group(passes.toPictures), target),
      compileAt(group(passes.toScreen), null),
    ]);
  } finally {
    plane.dispose();
  }
}
