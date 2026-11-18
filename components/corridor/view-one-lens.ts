import { Matrix4, PerspectiveCamera, Quaternion, Vector3 } from "three";
import { lensControls } from "./lens-controls";
import { createLensMotion, viewOneLensWeight } from "./lens-motion";
import { cinemaControls } from "./cinema-controls";

/** Applied only after the authored pose has been sampled afresh. Never accumulates. */
export function createViewOneLens() {
  const motion = createLensMotion(),
    right = new Vector3(),
    up = new Vector3(),
    forward = new Vector3(),
    target = new Vector3();
  const matrix = new Matrix4(),
    rotation = new Quaternion();
  return {
    pointer: motion.pointer,
    reset: motion.reset,
    apply(
      camera: PerspectiveCamera,
      stage: string,
      progress: number,
      seconds: number,
      reduce: boolean,
      focusDepth: number,
    ) {
      const values = lensControls.read().presets.view1,
        weight = viewOneLensWeight(stage, progress);
      if (!values.enabled || weight === 0 || cinemaControls.read().baseline) {
        motion.reset();
        return false;
      }
      const sample = motion.tick(seconds, values, reduce);
      const fov = camera.fov + (values.fov - camera.fov) * weight;
      camera.fov = fov;
      camera.updateProjectionMatrix();
      camera.projectionMatrix.elements[0] /= 1 + (values.squeeze - 1) * weight;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      up.set(0, 1, 0).applyQuaternion(camera.quaternion);
      forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
      const distance = Math.max(10, Math.min(120, focusDepth));
      target.copy(camera.position).addScaledVector(forward, distance);
      camera.position
        .addScaledVector(right, sample.x * distance * 0.012 * weight)
        .addScaledVector(up, -sample.y * distance * 0.012 * weight);
      rotation.setFromRotationMatrix(matrix.lookAt(camera.position, target, up));
      camera.quaternion.copy(rotation);
      camera.rotateZ((-sample.roll * weight * Math.PI) / 180);
      camera.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
      return sample.moving;
    },
  };
}
