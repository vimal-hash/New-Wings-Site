import { BufferGeometry, Float32BufferAttribute } from "three";
import pieces from "./moon-surfaces.json";
export const moonIds = pieces;
const key = (x: number, y: number, z: number) =>
  `${Math.round(x * 1e6)},${Math.round(y * 1e6)},${Math.round(z * 1e6)}`;
/** One scan for all moon parts; source mesh and compressed GLB are immutable. */
export function extractMoons(source: BufferGeometry) {
  const colors = source.getAttribute("color"),
    positions = source.getAttribute("position"),
    normals = source.getAttribute("normal"),
    index = source.getIndex();
  if (!colors || !normals || !index) throw new Error("Moon source attributes missing");
  const lookup = new Map(
    pieces.map((piece, i) => [key(...(piece.decodedColor as [number, number, number])), i]),
  );
  const data = pieces.map(() => ({ p: [] as number[], n: [] as number[], count: 0 }));
  for (let i = 0; i < index.count; i += 3) {
    const v = index.getX(i);
    const item = lookup.get(key(colors.getX(v), colors.getY(v), colors.getZ(v)));
    if (item === undefined) continue;
    const d = data[item];
    d.count++;
    for (let c = 0; c < 3; c++) {
      const j = index.getX(i + c);
      d.p.push(positions.getX(j), positions.getY(j), positions.getZ(j));
      d.n.push(normals.getX(j), normals.getY(j), normals.getZ(j));
    }
  }
  return pieces.map((piece, i) => {
    const d = data[i];
    if (d.count !== piece.expectedTriangles) throw new Error(`Moon triangle mismatch: ${piece.name}`);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(d.p, 3));
    geometry.setAttribute("normal", new Float32BufferAttribute(d.n, 3));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return { item: piece.name, geometry };
  });
}
