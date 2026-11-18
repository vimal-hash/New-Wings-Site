import { MathUtils, Matrix4, Quaternion, Vector3 } from "three";

type Sample = { position: readonly number[] };

export function createJourneySampler(samples: readonly Sample[], up: readonly number[]) {
  const points = samples.map(({ position }) => new Vector3().fromArray(position));
  const floorUp = new Vector3().fromArray(up).normalize();
  const target = new Vector3();
  const matrix = new Matrix4();

  function positionAt(progress: number, output: Vector3) {
    const index = MathUtils.clamp(progress, 0, 1) * (points.length - 1);
    const low = Math.floor(index),
      high = Math.min(low + 1, points.length - 1);
    return output.lerpVectors(points[low], points[high], index - low);
  }

  const startVelocity = positionAt(0.018, new Vector3()).sub(points[0]).divideScalar(0.018);
  // Look toward the passage centre ahead of the viewer, so the framing follows
  // the bend too. These frames are sampled with the exact same progress as position.
  const rotations = points.map((position, i) => {
    const progress = i / (points.length - 1);
    positionAt(progress - 0.09, target);
    if (progress < 0.09) target.addScaledVector(startVelocity, progress - 0.09);
    target.sub(position);
    // Exported positions are float32. Do not turn tiny height noise into pitch.
    target.addScaledVector(floorUp, -target.dot(floorUp)).add(position);
    matrix.lookAt(position, target, floorUp);
    return new Quaternion().setFromRotationMatrix(matrix);
  });

  return {
    sample(progress: number, position: Vector3, rotation: Quaternion) {
      const index = MathUtils.clamp(progress, 0, 1) * (points.length - 1);
      const low = Math.floor(index),
        high = Math.min(low + 1, points.length - 1);
      positionAt(progress, position);
      rotation.slerpQuaternions(rotations[low], rotations[high], index - low);
    },
  };
}
