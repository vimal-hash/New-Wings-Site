import { BufferGeometry, Material, Mesh, Object3D } from "three";

type Surface = { item: string; geometry: BufferGeometry };
type PreparedTheatre = {
  scenes: Object3D[];
  leftWall: BufferGeometry;
  surfaces: Surface[];
  moons?: Surface[];
  side: Material["side"];
  platform: { surfaces: Surface[]; side?: Material["side"] };
};

// Initial Suspense retries can discard useMemo. Keep CPU-only templates with the
// loaded source models instead. A new model identity gets a fresh preparation.
const prepared = new WeakMap<Object3D, WeakMap<Object3D, PreparedTheatre>>();

/** Each mount owns its mutable geometry; cached templates are never rendered. */
export function instantiateTheatre(
  sourceTheatre: Object3D,
  sourcePlatform: Object3D,
  prepare: () => PreparedTheatre,
): PreparedTheatre {
  let platforms = prepared.get(sourceTheatre);
  if (!platforms) {
    platforms = new WeakMap();
    prepared.set(sourceTheatre, platforms);
  }
  let template = platforms.get(sourcePlatform);
  if (!template) {
    template = prepare();
    platforms.set(sourcePlatform, template);
  }

  const scenes = template.scenes.map((scene) => scene.clone(true));
  // The theatre's retained diagnostic mesh is disposed by its mount. The hidden
  // platform node continues to share its source geometry, as it did previously.
  scenes[0].traverse((object) => {
    if (object instanceof Mesh) object.geometry = object.geometry.clone();
  });
  const cloneSurfaces = (surfaces: Surface[]) =>
    surfaces.map((surface) => ({
      item: surface.item,
      geometry: surface.geometry.clone(),
    }));
  return {
    scenes,
    leftWall: template.leftWall.clone(),
    side: template.side,
    surfaces: cloneSurfaces(template.surfaces),
    moons: cloneSurfaces(template.moons ?? []),
    platform: { side: template.platform.side, surfaces: cloneSurfaces(template.platform.surfaces) },
  };
}
