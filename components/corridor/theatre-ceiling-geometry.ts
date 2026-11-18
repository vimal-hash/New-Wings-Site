import { BufferGeometry, Uint32BufferAttribute } from "three";
import { matchingTriangles } from "./surface-index";

/** Removes only ceiling diagnostic faces from an owned copy; source stays intact. */
export function withoutTheatreCeiling(
  source: BufferGeometry,
  ids: readonly { decodedColor: readonly number[]; expectedTriangles: number }[],
) {
  const index = source.getIndex(),
    colors = source.getAttribute("color");
  if (!index || !colors) throw new Error("Ceiling: unexpected diagnostic mesh");
  const removed = new Set(matchingTriangles(source, ids)),
    retained: number[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i),
      b = index.getX(i + 1),
      c = index.getX(i + 2);
    if (!removed.has(i)) retained.push(a, b, c);
  }
  const result = source.clone();
  result.setIndex(new Uint32BufferAttribute(retained, 1));
  result.clearGroups();
  result.setDrawRange(0, retained.length);
  return result;
}
