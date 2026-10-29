import { BufferGeometry, Float32BufferAttribute } from "three";
import layout from "./left-wall-uv.json";

type Region = keyof typeof layout.regions;
export const leftWallId = { decodedColor: layout.decodedColor, expectedTriangles: layout.triangles };

/** Copies only the left wall triangles and adds the planar bake UVs shared with
 *  scripts/blender/left-wall/bake-left-wall-direct.py. Positions and normals are unchanged. */
export function leftWallGeometry(source: BufferGeometry) {
  const index = source.getIndex(), colors = source.getAttribute("color"), positions = source.getAttribute("position"), normals = source.getAttribute("normal");
  if (!index || !colors || !normals) throw new Error("Left wall: unexpected diagnostic mesh");
  const c = layout.decodedColor, [dx, dy, dz] = layout.webFromBlender, [lo, hi] = layout.bounds, [width, height] = layout.atlas;
  const matches = (v: number) => Math.abs(colors.getX(v)-c[0])<.000002 && Math.abs(colors.getY(v)-c[1])<.000002 && Math.abs(colors.getZ(v)-c[2])<.000002;
  const position: number[] = [], normal: number[] = [], uv: number[] = [];
  for (let i=0; i<index.count; i+=3) {
    const corners = [index.getX(i), index.getX(i+1), index.getX(i+2)];
    if (!matches(corners[0])) continue;
    if (!corners.every(matches)) throw new Error("Left wall: crossed object IDs");
    // Blender space: web (x, y, z) = (bx + dx, bz + dy, dz - by).
    const b = corners.map(v => [positions.getX(v)-dx, dz-positions.getZ(v), positions.getY(v)-dy]);
    const e1 = b[1].map((x, a) => x-b[0][a]), e2 = b[2].map((x, a) => x-b[0][a]);
    const n = [e1[1]*e2[2]-e1[2]*e2[1], e1[2]*e2[0]-e1[0]*e2[2], e1[0]*e2[1]-e1[1]*e2[0]];
    const axis = [0, 1, 2].reduce((best, a) => Math.abs(n[a]) > Math.abs(n[best]) ? a : best, 0);
    const region = layout.regions[`${n[axis] > 0 ? "+" : "-"}${"XYZ"[axis]}` as Region], [ua, va] = region.axes, box = region.box;
    corners.forEach((v, k) => {
      const s = b[k].map((x, a) => (x-lo[a])/(hi[a]-lo[a]));
      if (s.some(x => x < -.0001 || x > 1.0001)) throw new Error("Left wall: outside baked bounds");
      position.push(positions.getX(v), positions.getY(v), positions.getZ(v));
      normal.push(normals.getX(v), normals.getY(v), normals.getZ(v));
      // Blender UVs start at the image bottom; KTX2 rows start at the top.
      uv.push((box[0]+s[ua]*(box[2]-box[0]))/width, 1-(box[1]+s[va]*(box[3]-box[1]))/height);
    });
  }
  if (position.length/9 !== layout.triangles) throw new Error("Left wall: missing or duplicated faces");
  const result = new BufferGeometry();
  result.setAttribute("position", new Float32BufferAttribute(position, 3));
  result.setAttribute("normal", new Float32BufferAttribute(normal, 3));
  result.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  result.computeBoundingSphere();
  return result;
}
