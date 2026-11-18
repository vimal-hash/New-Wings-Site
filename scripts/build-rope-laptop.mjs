// Builds the small rope file for the laptop page from the desktop file. The desktop file is only read.
// node scripts/build-rope-laptop.mjs [--points 500000] [--core 3000] [--rescore]
// Every view along the camera's one straight path is drawn in software, and each thread segment is scored by how many pixels of the final picture it really owns, and how bright they are. The best segments that fit the budget are kept, then their points are thinned to what still shows.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync, inflateSync } from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..").replace(/\\/g, "/") + "/";
const arg = (name, fallback) => {
  const i = process.argv.indexOf("--" + name);
  return i < 0 ? fallback : Number(process.argv[i + 1]);
};
const POINT_BUDGET = arg("points", 450000),
  CORE_TRIS = arg("core", 1100),
  TOLERANCE_PX = arg("tol", 0.8),
  RUN_COST = arg("runcost", 2),
  GRID_PX = arg("gridpx", 0.7),
  BRIDGE_PX = arg("bridge", 120),
  CRUMB_PX = arg("crumb", 24);
// --join L closes the holes in a thread up to --joinpx pixels long on screen, with what fills them at L of its light, so a thread does not read as broken. Left out, threads are cut as they always were.
const JOIN = arg("join", -1),
  JOIN_PX = arg("joinpx", 800),
  SHOULDER_PX = arg("shoulder", 60),
  HOLE_TOLERANCE = arg("holetol", 2);
const CACHE = process.env.ROPE_CACHE || ROOT + ".rope-laptop-cache/";
const named = (i) => process.argv[process.argv.indexOf(i) + 1];
const OUT = ROOT + (process.argv.includes("--out") ? named("--out") : "public/rope-laptop/rope.bin"); // the flight has its own file: its camera goes the whole length of the tunnel
const TOOLS = process.env.MESHOPT_DIR;
if (!TOOLS)
  throw new Error(
    "Set MESHOPT_DIR to a folder holding the meshoptimizer package (it is not a project dependency).",
  );

const { MeshoptDecoder } = await import(
  pathToFileURL(ROOT + "node_modules/three/examples/jsm/libs/meshopt_decoder.module.js").href
);
await MeshoptDecoder.ready;
const { MeshoptSimplifier } = await import(pathToFileURL(TOOLS + "/meshopt_simplifier.js").href);
const { MeshoptEncoder } = await import(pathToFileURL(TOOLS + "/meshopt_encoder.js").href);
await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

// ---- Read the desktop file ----
// The ORIGINAL desktop file, kept outside the project: the one in public has had its unseen threads removed, and this build chooses its own threads from all of them.
const file = readFileSync("D:/CodexOutputs/Rope_Speed_20261104/step30-desktop-size/rope-red.glb");
const jsonLength = file.readUInt32LE(12),
  gltf = JSON.parse(file.subarray(20, 20 + jsonLength).toString()),
  bin = file.subarray(20 + jsonLength + 8);
function view(i) {
  const v = gltf.bufferViews[i],
    e = v.extensions.EXT_meshopt_compression,
    out = new Uint8Array(e.count * e.byteStride);
  MeshoptDecoder.decodeGltfBuffer(
    out,
    e.count,
    e.byteStride,
    bin.subarray(e.byteOffset, e.byteOffset + e.byteLength),
    e.mode,
    e.filter || "NONE",
  );
  return out;
}
const extras = gltf.extras,
  look = extras.look,
  ranges = extras.ranges,
  radiusScale = ranges.radius[1];
const srgb = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) LINEAR[i] = srgb(i / 255);

let total = 0;
const ropes = [],
  cores = [];
for (const node of gltf.nodes) {
  const mesh = gltf.meshes[node.mesh],
    p = mesh.primitives[0],
    m = node.matrix,
    count = gltf.accessors[p.attributes.POSITION].count;
  const raw = view(gltf.accessors[p.attributes.POSITION].bufferView),
    q = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2);
  const P = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    P[i * 3] = (q[i * 4] / 32767) * m[0] + m[12];
    P[i * 3 + 1] = (q[i * 4 + 1] / 32767) * m[5] + m[13];
    P[i * 3 + 2] = (q[i * 4 + 2] / 32767) * m[10] + m[14];
  }
  if (p.mode === 3) {
    const T = view(gltf.accessors[p.attributes._ROPE_T].bufferView),
      t = new Uint16Array(T.buffer, T.byteOffset, T.byteLength / 2);
    const G = view(gltf.accessors[p.attributes._ROPE_G].bufferView),
      L = view(gltf.accessors[p.attributes._ROPE_L].bufferView),
      X = view(gltf.accessors[p.attributes._ROPE_X].bufferView);
    const end = new Uint8Array(count);
    for (let i = 0; i < count; i++) end[i] = q[i * 4 + 3] > 16383 ? 1 : 0;
    const number = /^Rope_(\d+)$/.exec(mesh.name);
    ropes.push({
      name: mesh.name,
      index: number ? Number(number[1]) : 18,
      P,
      t,
      G,
      L,
      X,
      end,
      count,
      base: total,
    });
    total += count;
  } else {
    const I = view(gltf.accessors[p.indices].bufferView),
      C = view(gltf.accessors[p.attributes.COLOR_0].bufferView),
      colorType = gltf.accessors[p.attributes.COLOR_0].componentType;
    const colors = colorType === 5121 ? C : new Uint16Array(C.buffer, C.byteOffset, C.byteLength / 2);
    const number = /^Rope_(\d+)/.exec(mesh.name);
    cores.push({
      name: mesh.name,
      index: Number(number[1]),
      P,
      I: new Uint32Array(I.buffer, I.byteOffset, I.byteLength / 4),
      colors,
      colorMax: colorType === 5121 ? 255 : 65535,
      colorStride: colors.length / count,
      count,
    });
  }
}
ropes.sort((a, b) => a.index - b.index);
console.log("points", total, "ropes", ropes.length, "cores", cores.length);

// ---- Score every segment from every view ----
const W = 1920,
  H = 1200,
  F = W / 2 / 0.75,
  CX = W / 2,
  CY = H / 2,
  NEAR = 0.05;
// --behind adds views from outside the near mouth: the flight looks into the green tunnel from there, through the red.
const VIEWS = [
  ...Array.from({ length: arg("behind", 0) }, (_, i) => i + 1),
  ...Array.from({ length: arg("views", 25) }, (_, i) => -i),
];
const scorePath = CACHE + "scores.bin";
let score, nearest, coreSeen;
const coreTrisTotal = cores.reduce((a, c) => a + c.I.length / 3, 0);
if (existsSync(scorePath) && !process.argv.includes("--rescore")) {
  const b = readFileSync(scorePath),
    s = new Float32Array(b.buffer, b.byteOffset, total * 2 + Math.ceil(coreTrisTotal / 4));
  score = s.slice(0, total);
  nearest = s.slice(total, total * 2);
  coreSeen = new Uint8Array(s.buffer, s.byteOffset + total * 8, coreTrisTotal).slice();
  console.log("scores from cache");
} else {
  score = new Float32Array(total);
  nearest = new Float32Array(total).fill(Infinity);
  coreSeen = new Uint8Array(coreTrisTotal);
  const depth = new Float32Array(W * H),
    id = new Int32Array(W * H),
    hits = new Uint32Array(total),
    grainMean = (look.height_mean * 1.6 + 0.2) * look.cavity_mean;
  const started = Date.now();
  const VIEW_MEAN = 0.69;
  for (const cz of VIEWS) {
    depth.fill(Infinity);
    id.fill(0);
    // Core: id below zero.
    let triBase = 0;
    for (const c of cores) {
      const { P, I } = c;
      for (let i = 0; i < I.length; i += 3) {
        const a = I[i] * 3,
          b = I[i + 1] * 3,
          d = I[i + 2] * 3,
          da = cz - P[a + 2],
          db = cz - P[b + 2],
          dd = cz - P[d + 2];
        if (da < NEAR || db < NEAR || dd < NEAR) continue;
        const ax = CX + (P[a] / da) * F,
          ay = CY - (P[a + 1] / da) * F,
          bx = CX + (P[b] / db) * F,
          by = CY - (P[b + 1] / db) * F,
          ex = CX + (P[d] / dd) * F,
          ey = CY - (P[d + 1] / dd) * F;
        const x0 = Math.max(0, Math.floor(Math.min(ax, bx, ex))),
          x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, ex))),
          y0 = Math.max(0, Math.floor(Math.min(ay, by, ey))),
          y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, ey)));
        if (x0 > x1 || y0 > y1) continue;
        const area = (bx - ax) * (ey - ay) - (by - ay) * (ex - ax);
        if (area === 0) continue;
        const ia = 1 / da,
          ib = 1 / db,
          id3 = 1 / dd,
          tri = -(triBase + i / 3) - 1;
        for (let y = y0; y <= y1; y++)
          for (let x = x0; x <= x1; x++) {
            const px = x + 0.5,
              py = y + 0.5,
              w0 = ((bx - px) * (ey - py) - (by - py) * (ex - px)) / area,
              w1 = ((ex - px) * (ay - py) - (ey - py) * (ax - px)) / area,
              w2 = 1 - w0 - w1;
            if (w0 < 0 || w1 < 0 || w2 < 0) continue;
            const dep = 1 / (w0 * ia + w1 * ib + w2 * id3),
              at = y * W + x;
            if (dep < depth[at]) {
              depth[at] = dep;
              id[at] = tri;
            }
          }
      }
      triBase += I.length / 3;
    }
    // Threads: a thread thinner than a pixel only claims the pixel some of the time, as edge samples would.
    for (const r of ropes) {
      const { P, t, L, end, count, base } = r;
      for (let k = 0; k < count - 1; k++) {
        if (end[k]) continue;
        const a = k * 3,
          b = (k + 1) * 3,
          da = cz - P[a + 2],
          db = cz - P[b + 2];
        if (da < NEAR || db < NEAR) continue;
        const near = Math.min(da, db),
          ax = CX + (P[a] / da) * F,
          ay = CY - (P[a + 1] / da) * F,
          bx = CX + (P[b] / db) * F,
          by = CY - (P[b + 1] / db) * F;
        if ((ax < 0 && bx < 0) || (ax >= W && bx >= W) || (ay < 0 && by < 0) || (ay >= H && by >= H))
          continue;
        const radius = ((t[k * 4 + 2] + t[k * 4 + 6]) / 2 / 65535) * radiusScale,
          width = (Math.max((2 * radius * F) / near, 0.5) * L[k * 4 + 3]) / 255;
        const steps = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
        if (steps > 6000) continue;
        const half = width >= 1.5 ? Math.floor(width / 2) : 0,
          chance = Math.min(width, 1) * 4294967295,
          seg = base + k + 1;
        for (let s = 0; s <= steps; s++) {
          const f = s / steps,
            x = Math.floor(ax + (bx - ax) * f),
            y = Math.floor(ay + (by - ay) * f),
            dep = da + (db - da) * f;
          if (half === 0) {
            if (x < 0 || x >= W || y < 0 || y >= H) continue;
            const at = y * W + x;
            if (
              dep < depth[at] &&
              (chance >= 4294967295 || (Math.imul(seg, 2654435761) ^ Math.imul(at, 40503)) >>> 0 < chance)
            ) {
              depth[at] = dep;
              id[at] = seg;
            }
          } else {
            for (let v = Math.max(0, y - half); v <= Math.min(H - 1, y + half); v++)
              for (let u = Math.max(0, x - half); u <= Math.min(W - 1, x + half); u++) {
                const at = v * W + u;
                if (dep < depth[at]) {
                  depth[at] = dep;
                  id[at] = seg;
                }
              }
          }
        }
      }
    }
    // Who owns the picture from here, and how much light do they show.
    hits.fill(0);
    let threadPixels = 0,
      corePixels = 0;
    for (let i = 0; i < W * H; i++) {
      const v = id[i];
      if (v > 0) {
        hits[v - 1]++;
        threadPixels++;
      } else if (v < 0) {
        coreSeen[-v - 1] = 1;
        corePixels++;
      }
    }
    let touched = 0;
    for (const r of ropes) {
      const { P, t, G, L, X, count, base } = r;
      for (let k = 0; k < count - 1; k++) {
        const n = hits[base + k];
        if (!n) continue;
        touched++;
        const a = k * 3,
          b = (k + 1) * 3,
          dz = cz - P[a + 2];
        nearest[base + k] = Math.min(nearest[base + k], dz);
        let tx = P[b] - P[a],
          ty = P[b + 1] - P[a + 1],
          tz = P[b + 2] - P[a + 2],
          len = Math.hypot(tx, ty, tz) || 1;
        tx /= len;
        ty /= len;
        tz /= len;
        const vx = -P[a],
          vy = -P[a + 1],
          vz = dz,
          vl = Math.hypot(vx, vy, vz) || 1,
          cos = (vx * tx + vy * ty + vz * tz) / vl,
          sideOn = Math.sqrt(Math.max(1 - cos * cos, 0));
        const view = VIEW_MEAN * sideOn ** 1.7,
          st = G[k * 4 + 3] / 255,
          base2 = st * st * look.strength_peak * grainMean,
          value = base2 * (view + 0.07);
        const strength =
          value * Math.min(Math.max((value - 0.054) / 1.026, 0), 1) +
          grainMean * ((t[k * 4 + 3] / 65535) * 1.3 + 0.35) * 0.006;
        const ramp = LINEAR[G[k * 4]],
          glow = (ramp * 0.72 + (ramp * 0.82 + 0.18 - ramp * 0.72) * view) * strength;
        const lit = LINEAR[L[k * 4]] * look.lit_peak;
        const thr = (X[k * 4] / 255) ** 2,
          through = Math.min(thr, 1) ** 0.7;
        const c = (lit + glow) * Math.max(through, smoothstep(0.15, 0.4, glow)) * look.exposure;
        score[base + k] += n * (Math.sqrt(Math.max(c, 0)) + 0.01);
      }
    }
    console.log(
      "view z",
      cz,
      "thread px",
      threadPixels,
      "core px",
      corePixels,
      "segments that own a pixel",
      touched,
      ((Date.now() - started) / 1000).toFixed(0) + "s",
    );
  }
  mkdirSync(CACHE, { recursive: true });
  const pad = new Uint8Array(Math.ceil(coreTrisTotal / 4) * 4);
  pad.set(coreSeen);
  writeFileSync(
    scorePath,
    Buffer.concat([Buffer.from(score.buffer), Buffer.from(nearest.buffer), Buffer.from(pad.buffer)]),
  );
}
function smoothstep(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

// ---- Keep what earns its place ----
function douglas(P, first, last, tolerance, keep) {
  // Points index from first to last; tolerance per point, world units.
  const stack = [[first, last]];
  while (stack.length) {
    const [a, b] = stack.pop();
    if (b - a < 2) continue;
    const ax = P[a * 3],
      ay = P[a * 3 + 1],
      az = P[a * 3 + 2],
      bx = P[b * 3] - ax,
      by = P[b * 3 + 1] - ay,
      bz = P[b * 3 + 2] - az,
      ll = bx * bx + by * by + bz * bz || 1e-12;
    let worst = -1,
      at = -1;
    for (let i = a + 1; i < b; i++) {
      const px = P[i * 3] - ax,
        py = P[i * 3 + 1] - ay,
        pz = P[i * 3 + 2] - az,
        f = Math.min(Math.max((px * bx + py * by + pz * bz) / ll, 0), 1),
        ex = px - bx * f,
        ey = py - by * f,
        ez = pz - bz * f,
        err = Math.hypot(ex, ey, ez) / tolerance(i);
      if (err > worst) {
        worst = err;
        at = i;
      }
    }
    if (worst > 1) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
}
let holesClosed = 0;
function select(threshold) {
  const runs = [];
  let points = 0;
  holesClosed = 0;
  for (const r of ropes) {
    const { P, end, count, base } = r;
    let start = 0;
    for (let i = 0; i < count; i++) {
      if (!end[i]) continue;
      const first = start,
        last = i;
      start = i + 1;
      if (last <= first) continue;
      // Segment scores, softened a little so a thread is not cut into crumbs.
      let open = -1,
        gap = 0;
      const nearOfSegment = (k) => {
        const v = nearest[base + Math.min(k, count - 2)];
        return Number.isFinite(v) && v > 0 ? Math.max(v, 0.25) : Infinity;
      };
      // How long a stretch of this thread looks on screen, at the nearest the camera ever comes to it.
      const pixels = (a, b) => {
        let length = 0,
          near = Infinity;
        for (let k = a; k < b; k++) {
          length += Math.hypot(
            P[(k + 1) * 3] - P[k * 3],
            P[(k + 1) * 3 + 1] - P[k * 3 + 1],
            P[(k + 1) * 3 + 2] - P[k * 3 + 2],
          );
          near = Math.min(near, nearOfSegment(k));
        }
        return { length, near };
      };
      const close = (a, b) => {
        let peak = 0,
          sum = 0,
          good = 0;
        for (let k = a; k < b; k++) {
          sum += score[base + k];
          peak = Math.max(peak, score[base + k]);
          if (score[base + k] >= threshold * 0.5) good++;
        }
        const segments = b - a;
        // A run costs its table entry as well as its points, so short crumbs must earn more. A closed hole is free: only the parts that show are counted.
        if (segments < 1 || sum / (good + RUN_COST) < threshold) return;
        const keep = new Uint8Array(b - a + 1);
        keep[0] = keep[b - a] = 1;
        const nearOf = (i) => {
          const v = Math.min(
            nearest[base + Math.min(i, count - 2)] || Infinity,
            nearest[base + Math.max(i - 1, 0)] || Infinity,
          );
          return Number.isFinite(v) ? Math.max(v, 0.25) : 8;
        };
        const local = new Float32Array((b - a + 1) * 3);
        for (let k = 0; k <= b - a; k++) {
          local[k * 3] = P[(a + k) * 3];
          local[k * 3 + 1] = P[(a + k) * 3 + 1];
          local[k * 3 + 2] = P[(a + k) * 3 + 2];
        }
        douglas(local, 0, b - a, (k) => (TOLERANCE_PX * nearOf(a + k)) / F, keep);
        const list = [];
        for (let k = 0; k <= b - a; k++) if (keep[k]) list.push(a + k);
        runs.push({ rope: r, list, value: sum / segments });
        points += list.length;
      };
      const pieces = [];
      for (let k = first; k < last; k++) {
        const good = score[base + k] >= threshold * 0.5;
        if (good) {
          if (open < 0) open = k;
          gap = 0;
        } else if (open >= 0 && ++gap > 2) {
          pieces.push([open, k - gap + 1]);
          open = -1;
          gap = 0;
        }
      }
      if (open >= 0) pieces.push([open, last - gap]);
      // A thread cut into short pieces reads as dashes. Close the short holes, whose straight parts cost almost nothing once thinned, and drop what is still only a crumb.
      const joined = [];
      for (const piece of pieces) {
        const before = joined[joined.length - 1];
        if (before) {
          const hole = pixels(before[1], piece[0]),
            near = Math.min(nearOfSegment(before[1] - 1), nearOfSegment(piece[0]));
          if ((hole.length * F) / near < BRIDGE_PX) {
            before[1] = piece[1];
            continue;
          }
        }
        joined.push([...piece]);
      }
      if (JOIN >= 0) {
        const kept = joined.filter(([a, b]) => {
          const { length, near } = pixels(a, b);
          if ((length * F) / near < CRUMB_PX) return false;
          let sum = 0,
            good = 0;
          for (let k = a; k < b; k++) {
            sum += score[base + k];
            if (score[base + k] >= threshold * 0.5) good++;
          }
          return b > a && sum / (good + RUN_COST) >= threshold;
        });
        const groups = [];
        for (const piece of kept) {
          const before = groups[groups.length - 1],
            previous = before && before[before.length - 1];
          if (previous) {
            const hole = pixels(previous[1], piece[0]),
              near = Math.min(nearOfSegment(previous[1] - 1), nearOfSegment(piece[0]));
            if ((hole.length * F) / near < JOIN_PX) {
              before.push(piece);
              continue;
            }
          }
          groups.push([piece]);
        }
        for (const group of groups) {
          const a = group[0][0],
            b = group[group.length - 1][1],
            keep = new Uint8Array(b - a + 1),
            dim = new Float32Array(b - a + 1).fill(1),
            hole = new Uint8Array(b - a + 1);
          keep[0] = keep[b - a] = 1;
          const distance = (i, j) =>
            Math.hypot(P[j * 3] - P[i * 3], P[j * 3 + 1] - P[i * 3 + 1], P[j * 3 + 2] - P[i * 3 + 2]);
          let sum = 0,
            segments = 0;
          for (const [c, d] of group) {
            segments += d - c;
            for (let k = c; k < d; k++) sum += score[base + k];
          }
          for (let i = 0; i < group.length - 1; i++) {
            const h0 = group[i][1],
              h1 = group[i + 1][0];
            if (h1 <= h0) continue;
            // Along the hole, from each end, with its fade over a fixed length on screen. The far points of the fade are kept, or thinning would stretch it across the whole hole.
            const along = new Float32Array(h1 - h0 + 1);
            for (let k = h0 + 1; k <= h1; k++) along[k - h0] = along[k - h0 - 1] + distance(k - 1, k);
            const total = along[h1 - h0],
              near = Math.max(Math.min(nearOfSegment(h0 - 1), nearOfSegment(h1)), 0.25),
              span = Math.min((SHOULDER_PX * near) / F, total / 2);
            let firstFull = -1,
              lastFull = -1;
            for (let k = h0; k <= h1; k++) {
              const from = along[k - h0],
                to = total - from,
                t = Math.min(Math.min(from, to) / (span || 1), 1),
                smooth = t * t * (3 - 2 * t);
              dim[k - a] = 1 + (JOIN - 1) * smooth;
              hole[k - a] = 1;
              if (t >= 1) {
                if (firstFull < 0) firstFull = k;
                lastFull = k;
              }
            }
            keep[h0 - a] = keep[h1 - a] = 1;
            if (firstFull < 0) firstFull = lastFull = h0 + ((h1 - h0) >> 1);
            keep[firstFull - a] = keep[lastFull - a] = 1;
            holesClosed++;
          }
          const local = new Float32Array((b - a + 1) * 3);
          for (let k = 0; k <= b - a; k++) {
            local[k * 3] = P[(a + k) * 3];
            local[k * 3 + 1] = P[(a + k) * 3 + 1];
            local[k * 3 + 2] = P[(a + k) * 3 + 2];
          }
          // A hidden stretch has no record of how near the camera comes. The camera stays on the middle line, so its distance from that line is the nearest it can be.
          const toleranceOf = (k) => {
            const i = a + k;
            if (hole[k])
              return (HOLE_TOLERANCE * TOLERANCE_PX * Math.max(Math.hypot(P[i * 3], P[i * 3 + 1]), 0.25)) / F;
            const v = Math.min(
              nearest[base + Math.min(i, count - 2)] || Infinity,
              nearest[base + Math.max(i - 1, 0)] || Infinity,
            );
            return (TOLERANCE_PX * (Number.isFinite(v) ? Math.max(v, 0.25) : 8)) / F;
          };
          douglas(local, 0, b - a, toleranceOf, keep);
          const list = [],
            dims = [];
          for (let k = 0; k <= b - a; k++)
            if (keep[k]) {
              list.push(a + k);
              dims.push(dim[k]);
            }
          runs.push({ rope: r, list, value: sum / segments, dim: dims });
          points += list.length;
        }
        continue;
      }
      for (const [a, b] of joined) {
        const { length, near } = pixels(a, b);
        if ((length * F) / near >= CRUMB_PX) close(a, b);
      }
    }
  }
  return { runs, points };
}
let low = 0,
  high = 2000,
  picked = null;
for (let i = 0; i < 9; i++) {
  const mid = low === 0 ? Math.sqrt(1 * high) : Math.sqrt(low * high),
    result = select(mid);
  console.log("threshold", mid.toFixed(2), "runs", result.runs.length, "points", result.points);
  if (result.points > POINT_BUDGET) low = mid;
  else {
    high = mid;
    picked = result;
  }
  if (picked && picked.points > POINT_BUDGET * 0.97 && picked.points <= POINT_BUDGET) break;
}
if (!picked) picked = select(high);
const runs = picked.runs;
console.log("kept runs", runs.length, "points", picked.points, "segments", picked.points - runs.length);
if (JOIN >= 0) console.log("holes closed in the last try", holesClosed);

// ---- Pack threads ----
const GRID = 0.0005; // world units per step of the finest position grid
const quant = (v) => Math.round(v / GRID);
// Sorted so that runs next to each other start near each other: the packer likes small steps.
runs.sort((a, b) => a.rope.index - b.rope.index || b.rope.P[a.list[0] * 3 + 2] - 0 || 0);
for (const run of runs) {
  run.z = run.rope.P[run.list[0] * 3 + 2];
}
runs.sort((a, b) => a.rope.index - b.rope.index || b.z - a.z);
const zig = (v) => (v >= 0 ? v * 2 : -v * 2 - 1);
class Bytes {
  constructor() {
    this.a = [];
  }
  push(v) {
    this.a.push(v & 255);
  }
  varint(v) {
    while (v > 127) {
      this.a.push((v & 127) | 128);
      v = Math.floor(v / 128);
    }
    this.a.push(v);
  }
  get data() {
    return Uint8Array.from(this.a);
  }
}
const S = {
  counts: new Bytes(),
  shift: new Bytes(),
  startX: new Bytes(),
  startY: new Bytes(),
  startZ: new Bytes(),
  rampR: new Bytes(),
  rampG: new Bytes(),
  rampB: new Bytes(),
  random: new Bytes(),
  alpha: new Bytes(),
  radius: new Bytes(),
  u0Low: new Bytes(),
  u0High: new Bytes(),
  u1: new Bytes(),
  rank: new Bytes(),
  litTint: new Bytes(),
  thrTint: new Bytes(),
  amber: new Bytes(),
  hot: new Bytes(),
  dx: new Bytes(),
  dy: new Bytes(),
  dz: new Bytes(),
  strength: new Bytes(),
  lit: new Bytes(),
  thrR: new Bytes(),
};
const ropeRuns = new Array(19).fill(0);
const LIGHT_MAX = 31; // light along a thread is kept in 32 steps
const level = (v, max = 255, steps = 31) => Math.min(steps, Math.round((v / max) * steps));
// Light along a thread, softened over its neighbours: fine noise costs the most to store, and the grain picture puts fine detail back.
const soft = (list, read) =>
  list.map(
    (k, i) =>
      (read(list[Math.max(i - 1, 0)]) + 2 * read(k) + read(list[Math.min(i + 1, list.length - 1)])) / 4,
  );
const values = runs.map((r) => r.value).sort((a, b) => b - a);
const rankOf = (v) => {
  let lo = 0,
    hi = values.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (values[m] > v) lo = m + 1;
    else hi = m;
  }
  return Math.min(255, Math.floor((lo / values.length) * 256));
};
let lastX = 0,
  lastY = 0,
  lastZ = 0,
  amberRuns = 0;
for (const run of runs) {
  const r = run.rope,
    { P, t, G, L, X } = r,
    list = run.list,
    first = list[0],
    lastPoint = list[list.length - 1];
  ropeRuns[r.index]++;
  S.counts.varint(list.length);
  // A thread only ever seen from far away does not need the finest grid.
  let near = Infinity;
  for (let k = first; k < lastPoint; k++) near = Math.min(near, nearest[r.base + k]);
  const shift = Math.max(
    0,
    Math.min(5, Math.floor(Math.log2(Math.max((GRID_PX * Math.max(near, 0.25)) / F / GRID, 1)))),
  );
  S.shift.push(shift);
  const step = 1 << shift;
  const sx = Math.round(quant(P[first * 3]) / step) * step,
    sy = Math.round(quant(P[first * 3 + 1]) / step) * step,
    sz = Math.round(quant(P[first * 3 + 2]) / step) * step;
  S.startX.varint(zig(sx - lastX));
  S.startY.varint(zig(sy - lastY));
  S.startZ.varint(zig(sz - lastZ));
  lastX = sx;
  lastY = sy;
  lastZ = sz;
  S.rampR.push(level(G[first * 4], 255, 63));
  S.rampG.push(level(G[first * 4 + 1], 255, 63));
  S.rampB.push(level(G[first * 4 + 2], 255, 63));
  S.random.push(t[first * 4 + 3] >> 10);
  S.alpha.push(level(L[first * 4 + 3], 255, 15));
  // Radius once per run: the middle of the thread, as a square root so thin ones keep their steps. The ends taper in the shader's data on load.
  let rad = 0,
    rn = 0;
  for (const k of list) {
    const v = t[k * 4 + 2] / 65535;
    if (v > 0) {
      rad += v;
      rn++;
    }
  }
  S.radius.push(level(Math.sqrt(rn ? rad / rn : 0), 1, 31));
  const us = t[first * 4] >> 4,
    ue = t[lastPoint * 4] >> 4; // 4096 steps along a rope
  S.u0Low.push(us);
  S.u0High.push(us >> 8);
  S.u1.varint(zig(ue - us));
  S.rank.push(rankOf(run.value) >> 3);
  let litR = 0,
    litG = 0,
    thrR = 0,
    thrG = 0;
  for (const k of list) {
    litR += LINEAR[L[k * 4]];
    litG += LINEAR[L[k * 4 + 1]];
    thrR += X[k * 4];
    thrG += X[k * 4 + 1];
  }
  S.litTint.push(level(litR > 0 ? litG / litR : 0, 1, 31));
  S.thrTint.push(level(thrR > 0 ? thrG / thrR : 1, 1, 31));
  // Hot and side only decide the amber part of the file's look. Once per run.
  let amber = 0,
    hot = 0;
  for (const k of list) {
    const h = X[k * 4 + 2] / 255,
      s = -1 + (X[k * 4 + 3] / 255) * 2,
      w = Math.min(Math.max((h - 0.05) / 0.35, 0), 1) * Math.min(Math.max(s / 0.35, 0), 1);
    if (w > amber) {
      amber = w;
      hot = h;
    }
  }
  if (amber > 0) amberRuns++;
  S.amber.push(Math.round(amber * 255));
  S.hot.push(Math.round(hot * 255));
  let px = sx,
    py = sy,
    pz = sz,
    ls = 0,
    ll = 0,
    lr = 0;
  const softStrength = soft(list, (k) => G[k * 4 + 3]),
    softLit = soft(list, (k) => L[k * 4]),
    softThrough = soft(list, (k) => X[k * 4]);
  list.forEach((k, index) => {
    if (index > 0) {
      const qx = Math.round(quant(P[k * 3]) / step) * step,
        qy = Math.round(quant(P[k * 3 + 1]) / step) * step,
        qz = Math.round(quant(P[k * 3 + 2]) / step) * step;
      S.dx.varint(zig((qx - px) / step));
      S.dy.varint(zig((qy - py) / step));
      S.dz.varint(zig((qz - pz) / step));
      px = qx;
      py = qy;
      pz = qz;
    }
    const dim = run.dim ? run.dim[index] : 1,
      a = level(softStrength[index] * dim, 255, LIGHT_MAX),
      b = level(softLit[index] * dim, 255, LIGHT_MAX),
      c = level(softThrough[index], 255, LIGHT_MAX);
    S.strength.push(zig(a - ls));
    S.lit.push(zig(b - ll));
    S.thrR.push(zig(c - lr));
    ls = a;
    ll = b;
    lr = c;
  });
}
console.log("runs with amber", amberRuns, "of", runs.length);
const names = Object.keys(S);
const threadRaw = new Map(names.map((n) => [n, S[n].data]));

// ---- Pack the core: what was ever seen, far fewer triangles, only position and light. ----
const seenAround = coreSeen,
  CORE_GRID = 0.002,
  tintSum = [0, 0, 0];
let triBase = 0;
const corePacks = [];
let coreOut = 0;
for (const c of cores.sort((a, b) => a.index - b.index)) {
  const tris = c.I.length / 3,
    kept = [];
  for (let i = 0; i < tris; i++)
    if (seenAround[triBase + i]) kept.push(c.I[i * 3], c.I[i * 3 + 1], c.I[i * 3 + 2]);
  triBase += tris;
  const positions = c.P,
    attrs = new Float32Array(c.count * 3);
  for (let i = 0; i < c.count; i++)
    for (let k = 0; k < 3; k++)
      attrs[i * 3 + k] = srgb(c.colors[i * c.colorStride + k] / c.colorMax) * look.light_peak;
  let simple = Uint32Array.from(kept);
  if (simple.length / 3 > CORE_TRIS) {
    const [out] = MeshoptSimplifier.simplifyWithAttributes(
      simple,
      positions,
      3,
      attrs,
      3,
      [0.5, 0.5, 0.5],
      null,
      CORE_TRIS * 3,
      0.2,
      [],
    );
    simple = out;
  }
  const [map, unique] = MeshoptSimplifier.compactMesh(simple.slice());
  // compactMesh rewrites indices in place on its argument copy, so read them back through the remap.
  const remapped = new Uint32Array(simple.length);
  for (let i = 0; i < simple.length; i++) remapped[i] = map[simple[i]];
  const [order] = MeshoptEncoder.reorderMesh(remapped.slice(), true, true);
  const reordered = new Uint32Array(simple.length);
  for (let i = 0; i < simple.length; i++) reordered[i] = order[remapped[i]];
  const count = Math.max(...order) + 1;
  // Position on a coarser grid; the threads lie over the core, so its edge never shows sharply. Light as one number: red carries it, and the tint is nearly constant.
  const pos = new Int16Array(count * 4),
    col = new Uint8Array(count * 4);
  for (let i = 0; i < c.count; i++) {
    const m = map[i];
    if (m === undefined || m === 4294967295 || m >= unique) continue;
    const o = order[m];
    if (o === undefined || o === 4294967295) continue;
    pos[o * 4] = Math.round(positions[i * 3] / CORE_GRID);
    pos[o * 4 + 1] = Math.round(positions[i * 3 + 1] / CORE_GRID);
    pos[o * 4 + 2] = Math.round(positions[i * 3 + 2] / CORE_GRID);
    for (let k = 0; k < 3; k++)
      col[o * 4 + k] =
        Math.round(Math.sqrt(Math.min(srgb(c.colors[i * c.colorStride + k] / c.colorMax), 1)) * 63) * 4;
    col[o * 4 + 3] = 255;
  }
  const indexPack = MeshoptEncoder.encodeIndexBuffer(
    new Uint8Array(reordered.buffer, reordered.byteOffset, reordered.byteLength),
    reordered.length,
    4,
  );
  const posPack = MeshoptEncoder.encodeVertexBuffer(new Uint8Array(pos.buffer), count, 8);
  const colPack = MeshoptEncoder.encodeVertexBuffer(col, count, 4);
  for (let i = 0; i < count; i++) {
    tintSum[0] += col[i * 4];
    tintSum[1] += col[i * 4 + 1];
    tintSum[2] += col[i * 4 + 2];
  }
  corePacks.push({ index: c.index, vertices: count, indices: reordered.length, indexPack, posPack, colPack });
  coreOut += reordered.length / 3;
}
console.log(
  "core tris",
  coreOut,
  "bytes",
  corePacks.reduce((a, c) => a + c.indexPack.length + c.posPack.length + c.colPack.length, 0),
);

console.log("core light average, r g b", tintSum.map((v) => Math.round(v / 1e3)).join(" "));

// ---- A small grain picture: the desktop's two grain pictures in one, one read per pixel. ----
function readPng(path) {
  const b = readFileSync(path);
  let at = 8,
    width = 0,
    height = 0,
    depth = 0,
    type = 0;
  const data = [];
  while (at < b.length) {
    const n = b.readUInt32BE(at),
      kind = b.toString("latin1", at + 4, at + 8),
      body = b.subarray(at + 8, at + 8 + n);
    if (kind === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      type = body[9];
    }
    if (kind === "IDAT") data.push(body);
    at += 12 + n;
  }
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[type],
    bytes = depth / 8,
    step = channels * bytes,
    stride = width * step,
    raw = inflateSync(Buffer.concat(data)),
    out = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)],
      row = y * stride,
      from = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const v = raw[from + x],
        left = x >= step ? out[row + x - step] : 0,
        up = y > 0 ? out[row - stride + x] : 0,
        corner = y > 0 && x >= step ? out[row - stride + x - step] : 0;
      let add = 0;
      if (filter === 1) add = left;
      else if (filter === 2) add = up;
      else if (filter === 3) add = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - corner,
          pa = Math.abs(p - left),
          pb = Math.abs(p - up),
          pc = Math.abs(p - corner);
        add = pa <= pb && pa <= pc ? left : pb <= pc ? up : corner;
      }
      out[row + x] = v + add;
    }
  }
  return { width, height, channels, bytes, data: out, step, stride };
}
const sheet = readPng(ROOT + "public/rope-model/maps/grain.png");
console.log("grain sheet", sheet.width, sheet.height, "channels", sheet.channels, "bytes", sheet.bytes);
const TILE_W = 256,
  TILE_H = 64,
  tileValues = new Float32Array(TILE_W * TILE_H);
const sample = (sx, sy, channel) => {
  const x = ((Math.floor(sx) % sheet.width) + sheet.width) % sheet.width,
    y = ((Math.floor(sy) % sheet.height) + sheet.height) % sheet.height;
  return sheet.data[y * sheet.stride + x * sheet.step + channel * sheet.bytes] / 255;
};
let tileSum = 0,
  tileMax = 0;
for (let y = 0; y < TILE_H; y++) {
  // Whole rows from the sheet: averaging across rows would wash the grain out.
  const row = sheet.height - 1 - Math.floor(((y + 0.5) / TILE_H) * sheet.height);
  for (let x = 0; x < TILE_W; x++) {
    let sum = 0;
    for (let a = 0; a < 4; a++) {
      const s = (x + (a + 0.5) / 4) / TILE_W,
        height = sample(3 * s * sheet.width, row, 0),
        cavity = sample(s * sheet.width, row, 1);
      sum += (height * 1.6 + 0.2) * cavity;
    }
    const v = sum / 4;
    tileValues[y * TILE_W + x] = v;
    tileSum += v;
    tileMax = Math.max(tileMax, v);
  }
}
const tileMean = tileSum / tileValues.length,
  tile = new Uint8Array(TILE_W * TILE_H);
for (let i = 0; i < tile.length; i++) tile[i] = Math.round((tileValues[i] / tileMax) * 255);

// ---- Write ----
const parts = [],
  table = {};
let offset = 0;
const add = (name, data) => {
  const packed = gzipSync(data, { level: 9 });
  table[name] = [offset, packed.length, data.length];
  parts.push(packed);
  offset += packed.length;
  return packed.length;
};
const sizes = {};
for (const [name, data] of threadRaw) sizes[name] = add(name, data);
sizes.grain = add("grain", tile);
const coreTable = corePacks.map((c) => {
  const entry = { index: c.index, vertices: c.vertices, indices: c.indices };
  for (const [key, data] of [
    ["i", c.indexPack],
    ["p", c.posPack],
    ["c", c.colPack],
  ]) {
    const packed = gzipSync(data, { level: 9 });
    entry[key] = [offset, packed.length];
    parts.push(packed);
    offset += packed.length;
  }
  return entry;
});
const meta = {
  version: 2,
  grid: GRID,
  coreGrid: CORE_GRID,
  grain: { width: TILE_W, height: TILE_H, gain: tileMax, mean: tileMean },
  runs: runs.length,
  points: picked.points,
  ropeRuns,
  camera: extras.camera,
  ranges: { radius: ranges.radius, uv_u: ranges.uv_u, rope_hot: ranges.rope_hot },
  look,
  table,
  cores: coreTable,
  lightPeak: look.light_peak,
};
const json = Buffer.from(JSON.stringify(meta));
const head = Buffer.alloc(8);
head.writeUInt32LE(0x4c504f52, 0);
head.writeUInt32LE(json.length, 4);
const all = Buffer.concat([head, json, ...parts.map((p) => Buffer.from(p))]);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, all);
console.log("streams", JSON.stringify(sizes));
console.log("file", (all.length / 1e6).toFixed(3), "MB", OUT);
