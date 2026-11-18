import type { BufferGeometry } from "three";
type Id = { decodedColor: readonly number[]; expectedTriangles: number };
type Group = { color: number[]; triangles: number[] };
const cached = new WeakMap<BufferGeometry, Group[]>();
/** One immutable colour partition per decoded model, shared by every surface extractor. */
export function matchingTriangles(source: BufferGeometry, ids: readonly Id[]) {
  const index = source.getIndex(),
    colors = source.getAttribute("color");
  if (!index || !colors) throw new Error("Surface partition requires indexed colour IDs");
  let groups = cached.get(source);
  if (!groups) {
    const byColor = new Map<string, Group>();
    for (let t = 0; t < index.count; t += 3) {
      const v = index.getX(t),
        color = [colors.getX(v), colors.getY(v), colors.getZ(v)],
        key = color.join(",");
      let group = byColor.get(key);
      if (!group) {
        group = { color, triangles: [] };
        byColor.set(key, group);
      }
      group.triangles.push(t);
      for (let k = 1; k < 3; k++) {
        const c = index.getX(t + k);
        if (
          Math.abs(colors.getX(c) - color[0]) >= 0.000002 ||
          Math.abs(colors.getY(c) - color[1]) >= 0.000002 ||
          Math.abs(colors.getZ(c) - color[2]) >= 0.000002
        )
          throw new Error("Surface partition: crossed colour IDs");
      }
    }
    groups = [...byColor.values()];
    cached.set(source, groups);
  }
  const selected: number[] = [];
  for (const id of ids) {
    const matching = groups.filter((g) =>
        g.color.every((c, i) => Math.abs(c - id.decodedColor[i]) < 0.000002),
      ),
      triangles = matching.flatMap((g) => g.triangles);
    if (triangles.length !== id.expectedTriangles)
      throw new Error("Surface partition: missing or duplicated faces");
    selected.push(...triangles);
  }
  selected.sort((a, b) => a - b);
  if (selected.some((t, i) => i > 0 && selected[i - 1] === t))
    throw new Error("Surface partition: overlapping IDs");
  return selected;
}
