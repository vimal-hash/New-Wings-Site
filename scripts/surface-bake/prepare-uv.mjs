// Deterministic bake charts for one restoration item, derived only from its runtime triangle positions.
// Writes: authoring layout (Blender bake input), runtime chart sidecar (*.uv.bin) and the item's manifest entry.
// No GLB is written. Usage: node scripts/surface-bake/prepare-uv.mjs <item>
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const deps = "D:/New folio/new site code/new_si_two/node_modules/.pnpm/";
const load = (p) => import(pathToFileURL(deps + p).href);
const { NodeIO } = await load("@gltf-transform+core@4.5.0/node_modules/@gltf-transform/core/dist/index.js");
const { ALL_EXTENSIONS } = await load(
  "@gltf-transform+extensions@4.5.0/node_modules/@gltf-transform/extensions/dist/index.js",
);
const { default: draco } = await load("draco3dgltf@1.5.7/node_modules/draco3dgltf/draco3dgltf.js");
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "draco3d.decoder": await draco.createDecoderModule() });

const name = process.argv[2];
const cfg = JSON.parse(fs.readFileSync("scripts/surface-bake/items.json"));
const spec = cfg.items[name],
  src = cfg.sources[spec.source];
if (!spec) throw Error("Unknown item " + name);
const M = src.runtimeToBlender;
const toBlender = (p) =>
  [0, 1, 2].map((r) => M[r * 4] * p[0] + M[r * 4 + 1] * p[1] + M[r * 4 + 2] * p[2] + M[r * 4 + 3]);
const doc = await io.read(src.glb);

// 1. Runtime triangles in the exact order the website extracts them.
const tris = [];
let ids;
if (src.merged !== false && spec.source === "theatre") {
  const rows = JSON.parse(
    fs.readFileSync("D:/CodexOutputs/Approved_Theatre_Corridor_20261020/verification.json"),
  ).objects.theatre;
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0],
    C = prim.getAttribute("COLOR_0"),
    P = prim.getAttribute("POSITION"),
    I = prim.getIndices();
  const groups = new Map();
  for (let i = 0; i < I.getCount(); i += 3) {
    const k = C.getElement(I.getScalar(i), []).slice(0, 3).join(",");
    groups.set(k, (groups.get(k) ?? 0) + 1);
  }
  const hsv = (h, s, v) => {
    const f = (n) => {
      const k = (n + h * 6) % 6;
      return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    };
    return [f(5), f(3), f(1)];
  };
  ids = spec.objects.map((object) => {
    const index = rows.findIndex((r) => r.name === "THEATRE | " + object);
    if (index < 0) throw Error("No runtime object " + object);
    const expected = hsv((index * 0.61803398875) % 1, 0.55, 0.65);
    const best = [...groups]
      .map(([k, count]) => ({
        k,
        count,
        d: k.split(",").reduce((s, v, c) => s + (+v - expected[c]) ** 2, 0),
      }))
      .sort((a, b) => a.d - b.d)[0];
    if (best.count !== rows[index].triangles || best.d > 1e-7) throw Error("Colour ID mismatch " + object);
    return {
      name: object,
      key: best.k,
      decodedColor: best.k.split(",").map(Number),
      expectedTriangles: best.count,
    };
  });
  const objectOf = new Map(ids.map((id, i) => [id.key, i]));
  for (let i = 0; i < I.getCount(); i += 3) {
    const v = [0, 1, 2].map((k) => I.getScalar(i + k)),
      o = objectOf.get(C.getElement(v[0], []).slice(0, 3).join(","));
    if (o === undefined) continue;
    tris.push({ object: o, p: v.map((j) => toBlender(P.getElement(j, []))) });
  }
  ids.forEach((id, i) => {
    if (tris.filter((t) => t.object === i).length !== id.expectedTriangles)
      throw Error("Triangle count " + id.name);
  });
} else {
  const nodes = doc
    .getRoot()
    .listNodes()
    .filter((n) => n.getMesh());
  ids = spec.objects.map((object, i) => {
    const material = spec.runtimeMaterials?.[i] ?? "ID | " + object;
    const node = nodes.filter((n) =>
      n
        .getMesh()
        .listPrimitives()
        .some((p) => p.getMaterial()?.getName() === material),
    );
    if (node.length !== 1) throw Error("Runtime node for " + object + ": " + node.length);
    return { name: object, node: node[0].getName(), material };
  });
  ids.forEach((id, o) => {
    const node = nodes.find((n) => n.getName() === id.node),
      world = node.getWorldMatrix();
    for (const prim of node.getMesh().listPrimitives()) {
      const P = prim.getAttribute("POSITION"),
        I = prim.getIndices();
      const w = (p) =>
        [0, 1, 2].map((r) => world[r] * p[0] + world[4 + r] * p[1] + world[8 + r] * p[2] + world[12 + r]);
      for (let i = 0; i < I.getCount(); i += 3)
        tris.push({ object: o, p: [0, 1, 2].map((k) => toBlender(w(P.getElement(I.getScalar(i + k), [])))) });
    }
    id.expectedTriangles = tris.filter((t) => t.object === o).length;
  });
}

// 2. Charts: edge-connected triangles of one object sharing a dominant normal axis, projected along it.
const sub = (a, b) => a.map((x, i) => x - b[i]),
  cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const extent = Math.max(
  ...[0, 1, 2].map(
    (a) =>
      Math.max(...tris.flatMap((t) => t.p.map((p) => p[a]))) -
      Math.min(...tris.flatMap((t) => t.p.map((p) => p[a]))),
  ),
);
const q = extent * 1e-6,
  vkey = (p) => p.map((x) => Math.round(x / q)).join(",");
const PLANE = [
  [1, 2],
  [0, 2],
  [0, 1],
];
tris.forEach((t) => {
  const n = cross(sub(t.p[1], t.p[0]), sub(t.p[2], t.p[0]));
  const a = [0, 1, 2].reduce((b, i) => (Math.abs(n[i]) > Math.abs(n[b]) ? i : b), 0);
  t.label = a * 2 + (n[a] > 0 ? 0 : 1);
  t.area = Math.hypot(...n) / 2;
  t.uv = t.p.map((p) => PLANE[a].map((k) => p[k]));
  t.slope = Math.abs(n[a]) / (Math.hypot(...n) || 1);
});
const parent = tris.map((_, i) => i),
  root = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
const edges = new Map();
tris.forEach((t, i) => {
  const k = t.p.map(vkey);
  for (const [a, b] of [
    [0, 1],
    [1, 2],
    [2, 0],
  ]) {
    const e = t.object + "|" + t.label + "|" + [k[a], k[b]].sort().join("|");
    if (edges.has(e)) parent[root(i)] = root(edges.get(e));
    else edges.set(e, i);
  }
});
const groups = new Map();
tris.forEach((t, i) => {
  const r = root(i);
  if (!groups.has(r)) groups.set(r, []);
  groups.get(r).push(i);
});

// Separate any self-overlapping projection (overhangs) into further non-overlapping charts.
function overlaps(a, b) {
  for (const T of [a, b])
    for (let e = 0; e < 3; e++) {
      const p = T[e],
        r = T[(e + 1) % 3],
        n = [r[1] - p[1], p[0] - r[0]];
      const pa = a.map((v) => v[0] * n[0] + v[1] * n[1]),
        pb = b.map((v) => v[0] * n[0] + v[1] * n[1]);
      const eps = 1e-9 * Math.hypot(...n) * extent;
      if (Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)) <= eps)
        return false;
    }
  return true;
}
const charts = [];
let splits = 0;
for (const members of groups.values()) {
  const parts = [];
  for (const i of members) {
    const t = tris[i];
    if (t.area <= extent * extent * 1e-14) {
      (parts[0] ??= []).push(i);
      continue;
    }
    let placed = false;
    for (const part of parts) {
      if (!part.some((j) => tris[j].area > extent * extent * 1e-14 && overlaps(t.uv, tris[j].uv))) {
        part.push(i);
        placed = true;
        break;
      }
    }
    if (!placed) parts.push([i]);
  }
  splits += parts.length - 1;
  // Opt-in: long curved strips (caps, datums) would waste their whole bounding box; bisect sparse charts.
  const sparse = (part) => {
    const us = part.flatMap((i) => tris[i].uv),
      lo = [0, 1].map((k) => Math.min(...us.map((u) => u[k]))),
      hi = [0, 1].map((k) => Math.max(...us.map((u) => u[k])));
    const box = (hi[0] - lo[0]) * (hi[1] - lo[1]),
      fill =
        part.reduce((t, i) => {
          const [p0, p1, p2] = tris[i].uv;
          return t + Math.abs((p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1])) / 2;
        }, 0) / (box || 1);
    if (!spec.splitSparse || fill >= 0.35 || part.length <= 8) return [part];
    const k = hi[0] - lo[0] >= hi[1] - lo[1] ? 0 : 1,
      c = (i) => (tris[i].uv[0][k] + tris[i].uv[1][k] + tris[i].uv[2][k]) / 3;
    const sorted = [...part].sort((x, y) => c(x) - c(y) || x - y),
      mid = sorted.length >> 1;
    return [...sparse(sorted.slice(0, mid)), ...sparse(sorted.slice(mid))];
  };
  const before = parts.length;
  parts.splice(0, parts.length, ...parts.flatMap(sparse));
  splits += parts.length - before;
  for (const part of parts) {
    const us = part.flatMap((i) => tris[i].uv);
    charts.push({
      label: tris[part[0]].label,
      tris: part,
      min: [Math.min(...us.map((u) => u[0])), Math.min(...us.map((u) => u[1]))],
      max: [Math.max(...us.map((u) => u[0])), Math.max(...us.map((u) => u[1]))],
    });
  }
}

// 3. Room-facing charts get full density; faces that face away from every viewpoint get 1/8.
const views = src.viewpoints ?? [src.bakeEye];
charts.forEach((c) => {
  const a = c.label >> 1,
    sign = c.label & 1 ? -1 : 1,
    ts = c.tris.map((i) => tris[i]);
  const centre = [0, 1, 2].map(
    (k) => ts.reduce((s, t) => s + t.p[0][k] + t.p[1][k] + t.p[2][k], 0) / (3 * ts.length),
  );
  c.visible = views.some((v) => sign * (v[a] - centre[a]) > 1e-6);
  c.scale = c.visible ? 1 : 1 / 8;
  c.size = [c.max[0] - c.min[0], c.max[1] - c.min[1]];
});

// 4. Skyline packing (with optional mirror of the two chart axes) into the smallest power-of-two atlas.
const pad = spec.pad ?? 8;
// Thin visible strips keep at least minTexelsAcross texels on each side (anisotropic texels, at most 16x).
const across = spec.minTexelsAcross ?? 0;
const chartScale = (c, d) =>
  c.size.map((e) => {
    const s = d * c.scale;
    return c.visible && across && e > 0 && e * s < across ? Math.min(across / e, s * 16) : s;
  });
function pack(d, W, Hmax) {
  const boxes = charts
    .map((c, i) => {
      const [su, sv] = chartScale(c, d);
      return {
        i,
        w: Math.max(1, Math.ceil(c.size[0] * su)) + 2 * pad,
        h: Math.max(1, Math.ceil(c.size[1] * sv)) + 2 * pad,
      };
    })
    .sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h || a.i - b.i);
  let sky = [[0, 0, W]];
  const at = new Map();
  for (const b of boxes) {
    let choice = null;
    for (const [w, h, flip] of [
      [b.w, b.h, false],
      [b.h, b.w, true],
    ]) {
      if (w > W) continue;
      for (let s = 0; s < sky.length; s++) {
        const x = sky[s][0];
        if (x + w > W) break;
        let y = 0;
        for (let k = s; k < sky.length && sky[k][0] < x + w; k++) y = Math.max(y, sky[k][1]);
        if (
          y + h <= Hmax &&
          (!choice || y + h < choice.y + choice.h || (y + h === choice.y + choice.h && x < choice.x))
        )
          choice = { x, y, w, h, flip };
      }
    }
    if (!choice) return null;
    at.set(b.i, choice);
    const { x, y, w, h } = choice,
      next = [];
    for (const seg of sky) {
      const [sx, sy, sw] = seg;
      if (sx + sw <= x || sx >= x + w) {
        next.push(seg);
        continue;
      }
      if (sx < x) next.push([sx, sy, x - sx]);
      if (sx + sw > x + w) next.push([x + w, sy, sx + sw - x - w]);
    }
    next.push([x, y + h, w]);
    next.sort((p, q) => p[0] - q[0]);
    sky = [];
    for (const seg of next) {
      const last = sky[sky.length - 1];
      if (last && last[1] === seg[1] && last[0] + last[2] === seg[0]) last[2] += seg[2];
      else sky.push([...seg]);
    }
  }
  return { at };
}
// Smallest atlas that still keeps at least minDensity of the requested texel density (largest density for that size).
const target = spec.texelsPerUnit,
  floor = target * (spec.minDensity ?? 0.75),
  area = charts.reduce((t, c) => t + (c.max[0] - c.min[0]) * (c.max[1] - c.min[1]) * c.scale ** 2, 0);
let best;
if (spec.atlas) {
  // Fixed atlas size requested by the user (e.g. 6144x6144): the highest density that fits it.
  const [W, H] = spec.atlas;
  let lo = 1,
    hi = target;
  if (pack(hi, W, H)) lo = hi;
  else
    for (let k = 0; k < 24; k++) {
      const mid = (lo + hi) / 2;
      if (pack(mid, W, H)) lo = mid;
      else hi = mid;
    }
  best = { W, H, d: lo, ...pack(lo, W, H) };
} else
  for (let W = 64; W <= spec.maxSize; W *= 2)
    for (let H = Math.max(64, W / 2); H <= Math.min(spec.maxSize, W * 2); H *= 2) {
      if (best && W * H > best.W * best.H) continue;
      if (area * floor * floor > W * H) continue;
      let lo = floor,
        hi = target,
        fit = pack(hi, W, H) ? hi : null;
      if (!fit) {
        if (!pack(lo, W, H)) continue;
        for (let k = 0; k < 10; k++) {
          const mid = (lo + hi) / 2;
          if (pack(mid, W, H)) lo = mid;
          else hi = mid;
        }
        fit = lo;
      }
      if (!best || W * H < best.W * best.H || fit > best.d) best = { W, H, d: fit, ...pack(fit, W, H) };
    }
if (!best) throw Error("No atlas fits at the minimum density");
let d;
const { W, H, at } = best;
d = best.d;
// Chart table: [label + 6 when mirrored, scaleU, scaleV, offsetU, offsetV] in atlas pixels.
const table = charts.map((c, i) => {
  const { x, y, flip } = at.get(i),
    [s0, s1] = chartScale(c, d);
  return flip
    ? [c.label + 6, s1, s0, x + pad - c.min[1] * s1, y + pad - c.min[0] * s0]
    : [c.label, s0, s1, x + pad - c.min[0] * s0, y + pad - c.min[1] * s1];
});
const chartOf = new Int32Array(tris.length);
charts.forEach((c, i) => c.tris.forEach((t) => (chartOf[t] = i)));

// 5. Outputs.
const outDir = path.join(cfg.authoringRoot, name);
fs.mkdirSync(outDir, { recursive: true });
const used = charts.reduce((t, c) => {
  const [su, sv] = chartScale(c, d);
  return t + c.size[0] * su * c.size[1] * sv;
}, 0);
const stats = {
  item: name,
  triangles: tris.length,
  charts: charts.length,
  hiddenCharts: charts.filter((c) => !c.visible).length,
  overlapSplits: splits,
  atlas: [W, H],
  texelsPerUnit: +d.toFixed(3),
  coverage: +(used / (W * H)).toFixed(4),
  minSlope: +Math.min(...tris.filter((t) => t.area > 0).map((t) => t.slope)).toFixed(3),
};
fs.writeFileSync(
  path.join(outDir, "uv-layout.json"),
  JSON.stringify({
    ...stats,
    pad,
    objects: spec.objects,
    charts: table,
    tris: tris.map((t, i) => [chartOf[i], ...t.p.flat().map((x) => +x.toFixed(6)), t.object]),
  }),
);
const header = new Uint32Array([0x56555343, tris.length, charts.length, W, H]);
const idBytes = Math.ceil(tris.length / 2) * 4,
  buffer = new ArrayBuffer(20 + idBytes + charts.length * 20);
new Uint32Array(buffer, 0, 5).set(header);
const idView = new Uint16Array(buffer, 20, tris.length);
if (charts.length > 65535) throw Error("Too many charts");
idView.set(chartOf);
new Float32Array(buffer, 20 + idBytes, charts.length * 5).set(table.flat());
const runtimeDir = path.join("public", spec.runtimeFolder);
fs.mkdirSync(runtimeDir, { recursive: true });
const uvFile = path.join(runtimeDir, name + "-uv.bin");
fs.writeFileSync(uvFile, Buffer.from(buffer));
const manifestPath = "components/corridor/baked-surfaces.json";
const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath))
  : { sources: {}, items: [] };
manifest.sources[spec.source] = { runtimeToBlender: M };
const previous = manifest.items.find((i) => i.item === name);
const entry = {
  item: name,
  active: previous?.active ?? false,
  source: spec.source,
  uv: "/" + spec.runtimeFolder + "/" + name + "-uv.bin",
  texture: "/" + spec.runtimeFolder + "/" + name + ".ktx2",
  ids: ids.map((id) => Object.fromEntries(Object.entries(id).filter(([k]) => k !== "key"))),
  triangles: tris.length,
  atlas: [W, H],
  bytes: { uv: fs.statSync(uvFile).size, texture: previous?.bytes?.texture ?? 0 },
};
manifest.items = [...manifest.items.filter((i) => i.item !== name), entry];
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + "\n");
console.log("PREPARED", JSON.stringify(stats));
