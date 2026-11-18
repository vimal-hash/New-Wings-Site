import { BufferGeometry, Float32BufferAttribute, Matrix3, Mesh, Vector3 } from "three";
import { matchingTriangles } from "./surface-index";

export type SurfaceId = { name: string; decodedColor: readonly number[]; expectedTriangles: number };

/** Copies only the given colour-ID objects' triangles (index order). Positions and normals are unchanged. */
export function extractSurface(source: BufferGeometry, ids: readonly SurfaceId[]) {
  const index = source.getIndex(),
    colors = source.getAttribute("color"),
    positions = source.getAttribute("position"),
    normals = source.getAttribute("normal");
  if (!index || !colors || !normals) throw new Error("Baked surface: unexpected diagnostic mesh");
  const triangles = matchingTriangles(source, ids),
    position = new Float32Array(triangles.length * 9),
    normal = new Float32Array(position.length);
  let offset = 0;
  for (const t of triangles)
    for (let k = 0; k < 3; k++) {
      const v = index.getX(t + k);
      position.set([positions.getX(v), positions.getY(v), positions.getZ(v)], offset);
      normal.set([normals.getX(v), normals.getY(v), normals.getZ(v)], offset);
      offset += 3;
    }
  const result = new BufferGeometry();
  result.setAttribute("position", new Float32BufferAttribute(position, 3));
  result.setAttribute("normal", new Float32BufferAttribute(normal, 3));
  result.computeBoundingSphere();
  return result;
}

/** World-space copy of separate runtime meshes, concatenated in order (index order within each). Positions and normals are unchanged. */
export function concatenateMeshes(meshes: readonly Mesh[], expected: readonly number[]) {
  const position: number[] = [],
    normal: number[] = [],
    p = new Vector3(),
    n = new Vector3(),
    normalMatrix = new Matrix3();
  meshes.forEach((mesh, m) => {
    const g = mesh.geometry,
      index = g.getIndex(),
      positions = g.getAttribute("position"),
      normals = g.getAttribute("normal");
    const count = index ? index.count : positions.count;
    if (count / 3 !== expected[m]) throw new Error("Baked surface: unexpected corridor mesh");
    mesh.updateWorldMatrix(true, false);
    normalMatrix.getNormalMatrix(mesh.matrixWorld);
    for (let i = 0; i < count; i++) {
      const v = index ? index.getX(i) : i;
      p.fromBufferAttribute(positions, v).applyMatrix4(mesh.matrixWorld);
      position.push(p.x, p.y, p.z);
      n.fromBufferAttribute(normals, v).applyMatrix3(normalMatrix).normalize();
      normal.push(n.x, n.y, n.z);
    }
  });
  const result = new BufferGeometry();
  result.setAttribute("position", new Float32BufferAttribute(position, 3));
  result.setAttribute("normal", new Float32BufferAttribute(normal, 3));
  result.computeBoundingSphere();
  return result;
}

const PLANE = [
  [1, 2],
  [0, 2],
  [0, 1],
];

/** Adds bake UVs from a scripts/surface-bake/prepare-uv.mjs sidecar: each triangle's chart projects its
 *  Blender-space positions onto one atlas rectangle, exactly as in the Blender bake. */
export function applySurfaceUV(geometry: BufferGeometry, buffer: ArrayBuffer, toBlender: readonly number[]) {
  const [magic, triangles, count, width, height] = new Uint32Array(buffer, 0, 5);
  const positions = geometry.getAttribute("position");
  if (magic !== 0x56555343 || positions.count !== triangles * 3)
    throw new Error("Baked surface: UV sidecar does not match geometry");
  const charts = new Uint16Array(buffer, 20, triangles),
    table = new Float32Array(buffer, 20 + Math.ceil(triangles / 2) * 4, count * 5);
  const m = toBlender,
    uv = new Float32Array(triangles * 6),
    p = [0, 0, 0];
  for (let t = 0; t < triangles; t++) {
    const c = charts[t] * 5,
      label = table[c],
      su = table[c + 1],
      sv = table[c + 2],
      ou = table[c + 3],
      ov = table[c + 4];
    let [a1, a2] = PLANE[label % 6 >> 1];
    if (label >= 6) [a1, a2] = [a2, a1];
    for (let k = 0; k < 3; k++) {
      const v = t * 3 + k,
        x = positions.getX(v),
        y = positions.getY(v),
        z = positions.getZ(v);
      for (let r = 0; r < 3; r++) p[r] = m[r * 4] * x + m[r * 4 + 1] * y + m[r * 4 + 2] * z + m[r * 4 + 3];
      // Blender UVs start at the image bottom; KTX2 rows start at the top.
      uv[v * 2] = (p[a1] * su + ou) / width;
      uv[v * 2 + 1] = 1 - (p[a2] * sv + ov) / height;
    }
  }
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
}
