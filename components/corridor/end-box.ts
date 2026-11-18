import { DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3, type Camera } from "three";

/** Section 4's white, fixed in the corridor (the user, 2026-11-16: "stay there like liquid sphere", "dont FOLLOW"): just
 *  before the camera starts back, the screen white hands over to this panel at the liquid sphere's spot (END_BOX.distance
 *  ahead of the page camera), filling the view exactly. It stays at that spot for good; the camera moves away from it,
 *  so it gets smaller with distance. Plain flat white, no glow (the user: "remove the glow"). */
export const END_BOX = { distance: 14 } as const;

export function createEndBox() {
  const group = new Group();
  group.name = "Section 4 end box";
  group.visible = false;
  // Drawn over the corridor (no depth test): at the hand-over it is wider and taller than the corridor there, and the
  // floor and walls must not cut into it. It stays at its spot; it is just never hidden by them.
  const face = new MeshBasicMaterial({
    color: "#ffffff",
    toneMapped: false,
    side: DoubleSide,
    fog: false,
    depthTest: false,
    depthWrite: false,
  });
  let core: Mesh | null = null;
  const forward = new Vector3();
  const clear = () => {
    if (!core) return;
    group.remove(core);
    core.geometry.dispose();
    core = null;
  };
  return {
    group,
    get visible() {
      return group.visible;
    },
    /** Put the panel where the screen white is right now: filling the view, END_BOX.distance ahead of the camera. */
    place(camera: Camera) {
      camera.updateMatrixWorld();
      const e = camera.projectionMatrix.elements,
        d = END_BOX.distance;
      const width = (2 * d) / e[0],
        height = (2 * d) / e[5];
      clear();
      core = new Mesh(new PlaneGeometry(width, height), face);
      core.renderOrder = 1000;
      group.add(core);
      camera.getWorldDirection(forward);
      group.position.copy(camera.position).addScaledVector(forward, d);
      group.quaternion.copy(camera.quaternion);
      group.visible = true;
    },
    hide() {
      group.visible = false;
      clear();
    },
    dispose() {
      clear();
      face.dispose();
      group.removeFromParent();
    },
  };
}
