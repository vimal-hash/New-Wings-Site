import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";

/** Joined ribbons follow the exact front contours; shared corners cannot split apart. */
export function createPupilBorderGeometry(faces: BufferGeometry[], height: number, width: number) {
  const data: number[] = [],
    sides: number[] = [],
    a = new Vector3(),
    b = new Vector3();
  for (const face of faces) {
    const p = face.getAttribute("position"),
      ids = face.getIndex()!,
      edges = new Map<string, { a: number; b: number; n: number }>();
    for (let i = 0; i < ids.count; i += 3)
      for (let j = 0; j < 3; j++) {
        const a = ids.getX(i + j),
          b = ids.getX(i + ((j + 1) % 3)),
          key = a < b ? a + "," + b : b + "," + a;
        const edge = edges.get(key);
        if (edge) edge.n++;
        else edges.set(key, { a, b, n: 1 });
      }
    const boundary = [...edges.values()].filter((edge) => edge.n === 1),
      normals = new Map<number, Vector3[]>();
    for (const edge of boundary) {
      a.fromBufferAttribute(p, edge.a);
      b.fromBufferAttribute(p, edge.b);
      const normal = new Vector3(-(b.z - a.z), 0, b.x - a.x).normalize();
      for (const id of [edge.a, edge.b]) {
        const list = normals.get(id) ?? [];
        list.push(normal);
        normals.set(id, list);
      }
    }
    const offsets = new Map<number, Vector3>();
    for (const [id, list] of normals) {
      const joined = list.reduce((sum, n) => sum.add(n), new Vector3()).normalize();
      offsets.set(id, joined.multiplyScalar(width / Math.max(0.4, Math.abs(joined.dot(list[0])))));
    }
    for (const edge of boundary) {
      a.fromBufferAttribute(p, edge.a);
      b.fromBufferAttribute(p, edge.b);
      a.y = b.y = height;
      const vertices = [
        a.clone().add(offsets.get(edge.a)!),
        a.clone().sub(offsets.get(edge.a)!),
        b.clone().add(offsets.get(edge.b)!),
        b.clone().sub(offsets.get(edge.b)!),
      ];
      for (const id of [0, 2, 1, 2, 3, 1]) {
        data.push(...vertices[id].toArray());
        sides.push(id % 2 === 0 ? 1 : -1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(data, 3));
  geometry.setAttribute("pulseSide", new Float32BufferAttribute(sides, 1));
  geometry.computeBoundingSphere();
  return geometry;
}
