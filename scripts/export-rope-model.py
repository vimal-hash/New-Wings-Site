# Exports every rope and thread of the optimized rope file to one web file, keeping what textures will need later. Nothing is thinned. The .blend is only read, never saved.
# Usage: BAKE_DIR=<bake folder> blender -b Rope_Red_r3f.blend --factory-startup --python scripts/export-rope-model.py -- <raw.glb>
# Then pack it for the page with scripts/compress-rope-model.mjs.
#
# Ropes: nodes Rope_00..Rope_17 with bodies Rope_00_Core.., and Rope_Fuzz. Blender's X, Y, Z become X, Z, -Y.
# Threads are LINE_STRIP with one extra copy of the first and last point; POSITION's fourth value (padding in glTF) is 32767 on a thread's last point.
# Inside a rope the threads run nearest first, cut into stretches along the tunnel. extras.chunks gives each rope [first point, point count, x low, x high, y low, y high, z low, z high] per stretch, so the page can skip those it cannot see.
# Thread data per point: _ROPE_T = rope_uv, radius, random; _ROPE_G = glow colour (sRGB), glow strength (square root); _ROPE_L = light (sRGB), opacity; _ROPE_X = see-through red, green (square roots), hot, side (Rope_Fuzz has no hot or side: 0).
# All are 0 to 1 here; extras.ranges gives each one's real minimum and maximum.
import bpy, json, os, struct, sys
import numpy as np

OUT = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
BAKE = os.environ["BAKE_DIR"]  # written by scripts/bake-rope-maps.py
scene = bpy.data.scenes["Rope_Macro"]
thread_uv = np.load(os.path.join(BAKE, "thread_uv.npz"))
core_bake = np.load(os.path.join(BAKE, "core_bake.npz"))
maps = json.load(open(os.path.join(BAKE, "maps.json")))
ATLAS_SIZE = 6144
encode = lambda v: np.where(np.clip(v, 0, 1) <= .0031308, np.clip(v, 0, 1) * 12.92, 1.055 * np.power(np.clip(v, 0, 1), 1 / 2.4) - .055)
camera = scene.camera
CHUNK = float(os.environ.get("CHUNK", 2))
WIDE =["radius", "rope_energy", "rope_glow", "rope_depth"]
LOW_B = ["rope_seed", "rope_tone", "rope_hue", "rope_rough"]
LOW_C = ["rope_gold", "rope_film", "rope_hot", "rope_side"]
to_web = lambda p: np.stack((p[:, 0], p[:, 2], -p[:, 1]), 1)


def curve_random(index):
    """The number Cycles gives each thread as Curves Info > Random, same as in scripts/bake-rope-maps.py."""
    def rot(x, k):
        return (x << np.uint32(k)) | (x >> np.uint32(32 - k))
    start = (0xdeadbeef + (2 << 2) + 13) & 0xffffffff
    a = np.full(len(index), start, np.uint32) + np.asarray(index, np.uint32)
    b, c = np.full(len(index), start, np.uint32), np.full(len(index), start, np.uint32)
    c = (c ^ b) - rot(b, 14)
    a = (a ^ c) - rot(c, 11)
    b = (b ^ a) - rot(a, 25)
    c = (c ^ b) - rot(b, 16)
    a = (a ^ c) - rot(c, 4)
    b = (b ^ a) - rot(a, 14)
    c = (c ^ b) - rot(b, 24)
    return c.astype(np.float32) / np.float32(4294967295.0)


def read(attribute):
    size = {"FLOAT2": 2, "FLOAT_VECTOR": 3}.get(attribute.data_type, 1)
    values = np.empty(len(attribute.data) * size, np.float32)
    attribute.data.foreach_get("vector" if size > 1 else "value", values)
    return values.reshape(-1, size) if size > 1 else values


strands = sorted((o for o in scene.objects if o.type == "CURVES"), key=lambda o: o.name)
cores = {o.name[: -len("_core")]: o for o in scene.objects if o.type == "MESH" and o.name.endswith("_core")}
ropes = []
for ob in strands:
    data = ob.data
    offsets = np.empty(len(data.curves) + 1, np.int32)
    data.curve_offset_data.foreach_get("value", offsets)
    world = np.array(ob.matrix_world, np.float64)
    rope = {"ob": ob, "offsets": offsets, "P": to_web(read(data.attributes["position"]) @ world[:3, :3].T + world[:3, 3]), "uv": read(data.attributes["rope_uv"])}
    for name in WIDE + LOW_B + LOW_C:
        attribute = data.attributes.get(name)
        rope[name] = read(attribute) if attribute else None
    ropes.append(rope)

ranges = {}
for name in WIDE + LOW_B + LOW_C:
    parts = [r[name] for r in ropes if r[name] is not None]
    ranges[name] = [float(min(p.min() for p in parts)), float(max(p.max() for p in parts))]
ranges["uv_u"] = [float(min(r["uv"][:, 0].min() for r in ropes)), float(max(r["uv"][:, 0].max() for r in ropes))]
ranges["uv_v"] = [float(min(r["uv"][:, 1].min() for r in ropes)), float(max(r["uv"][:, 1].max() for r in ropes))]


def unit(values, name):
    low, high = ranges[name]
    return np.clip((values - low) / max(high - low, 1e-12), 0, 1)


def bake_on_points():
    """Moves the baked sheets onto the thread points. Each thread's values along its run of texels are fitted by the straight pieces between its points, the fit that leaves the least error, so nothing is just skipped."""
    load = lambda name: np.load(os.path.join(BAKE, name)).astype(np.float32)
    u, row = thread_uv["u"].astype(np.float64), thread_uv["row"].astype(np.int64)
    count = len(u)
    last = np.zeros(count, bool)
    cursor = 0
    for rope in ropes:
        last[cursor + rope["offsets"][1:] - 1] = True
        cursor += len(rope["P"])
    seg = np.nonzero(~last)[0]
    if (u[seg + 1] < u[seg]).any():
        raise RuntimeError("a thread runs backwards on the sheet")
    first, stop = np.ceil(u[seg] - .5).astype(np.int64), np.ceil(u[seg + 1] - .5).astype(np.int64)
    runs = stop - first
    which = np.repeat(np.arange(len(seg)), runs)
    texel = first[which] + np.arange(len(which)) - np.repeat(np.cumsum(runs) - runs, runs)
    left = seg[which]
    t = (texel + .5 - u[left]) / np.maximum(u[left + 1] - u[left], 1e-9)
    rows = row[left]
    diag = np.bincount(left, (1 - t) ** 2, count) + np.bincount(left + 1, t ** 2, count)
    side = np.bincount(left, (1 - t) * t, count)
    empty = diag <= 0
    near = np.clip(np.floor(u).astype(np.int64), 0, ATLAS_SIZE - 1)
    report = {"points": count, "texels": len(t), "points_with_no_texel": int(empty.sum())}

    def fit(values, name):
        at = values[rows, texel].astype(np.float64)
        right = np.bincount(left, (1 - t) * at, count) + np.bincount(left + 1, t * at, count)
        solved = np.where(empty, values[row, near], right / np.maximum(diag + side + np.r_[0, side[:-1]], 1e-12))
        for _ in range(6):
            above = np.r_[solved[1:], 0]
            below = np.r_[0, solved[:-1]]
            solved = solved + np.where(empty, 0, (right - diag * solved - side * above - np.r_[0, side[:-1]] * below) / np.maximum(diag, 1e-12))
        solved = np.clip(solved, 0, 1)
        back = (1 - t) * solved[left] + t * solved[left + 1]
        report[name] = {"rms_error": round(float(np.sqrt(((back - at) ** 2).mean())), 5), "p99_error": round(float(np.percentile(np.abs(back - at), 99)), 4), "mean_sheet": round(float(at.mean()), 5), "mean_points": round(float(back.mean()), 5)}
        return solved

    glow = load("emission_linear.npy")
    ramp = np.stack([fit(encode(glow[..., c]), "ramp_" + "rgb"[c]) for c in range(3)], 1)
    del glow
    strength = load("strength_linear.npy")
    stored = fit(strength, "strength")
    at = strength[rows, texel].astype(np.float64)
    back = (1 - t) * stored[left] + t * stored[left + 1]
    report["strength_light"] = {"mean_sheet": float((at ** 2).mean()), "mean_points": float((back ** 2).mean())}
    del strength, at, back
    base, light, ao = load("base_linear.npy"), load("light_linear.npy"), load("ao_linear.npy")
    lit = base * light * ao[..., None]
    del base, light, ao
    lit_peak = float(np.percentile(lit[rows, texel].max(axis=1), 99.9))  # a few extreme texels would otherwise leave too few of the 8-bit steps for everything else
    lit_points = np.stack([fit(encode(lit[..., c] / lit_peak), "lit_" + "rgb"[c]) for c in range(3)], 1)
    del lit
    opacity = fit(load("opacity_linear.npy"), "opacity")
    through = load("through_linear.npy")
    through_points = np.stack([fit(through[..., c], "through_" + "rg"[c]) for c in range(2)], 1)
    del through
    to8 = lambda v: np.round(np.clip(v, 0, 1) * 255).astype(np.uint8)
    print("ROPE_FIT", json.dumps(report), flush=True)
    return {"glow": to8(np.c_[ramp, stored]), "lit": to8(np.c_[lit_points, opacity]), "through": to8(through_points)}, lit_peak


baked, lit_peak = bake_on_points()
if os.environ.get("FIT_ONLY"):
    raise SystemExit
views, blob, accessors, meshes, nodes = [], bytearray(), [], [], []


def add(array, target, stride=None):
    data = array.tobytes()
    while len(blob) % 4:
        blob.append(0)
    view = {"buffer": 0, "byteOffset": len(blob), "byteLength": len(data), "target": target}
    if stride:
        view["byteStride"] = stride
    views.append(view)
    blob.extend(data)
    return len(views) - 1


def accessor(view, component, count, kind, normalized=True, bounds=None):
    item = {"bufferView": view, "componentType": component, "normalized": normalized, "count": count, "type": kind}
    if bounds:
        item["min"], item["max"] = bounds
    accessors.append(item)
    return len(accessors) - 1


def quantiser(p):
    """Each rope gets its own box per axis, which keeps sideways position to about 0.00004 of a unit."""
    low, high = p.min(0), p.max(0)
    centre, half = (low + high) / 2, np.maximum((high - low) / 2, 1e-6)
    matrix = [float(half[0]), 0, 0, 0, 0, float(half[1]), 0, 0, 0, 0, float(half[2]), 0, float(centre[0]), float(centre[1]), float(centre[2]), 1]
    q = np.round((p - centre) / half * 32767).astype(np.int16)
    error = np.abs(q / 32767 * half + centre - p)
    return np.c_[q, np.zeros(len(q), np.int16)], matrix, error.max(0)


def box_of(q):
    return (q[:, :3].min(0) / 32767).tolist(), (q[:, :3].max(0) / 32767).tolist()


point_cursor = 0
chunks = {}
stats ={"ropes": 0, "threads": 0, "points": 0, "core_faces": 0, "core_triangles": 0, "worst_position_error": [0.0, 0.0, 0.0]}
for rope in ropes:
    ob, n = rope["ob"], len(rope["P"])
    name = "Rope_Fuzz" if ob.name == "Strand_Fuzz" else f"Rope_{ob.name[-2:]}"
    pad = lambda a: np.concatenate((a[:1], a, a[-1:]))
    q, matrix, error = quantiser(rope["P"])
    stats["worst_position_error"] = np.maximum(stats["worst_position_error"], error).tolist()
    q[rope["offsets"][1:] - 1, 3] = 32767
    # Nearest thread first, measured at its far tip: a thread only leaves the view once its far tip is behind the camera.
    offsets = rope["offsets"]
    far_tip = np.minimum.reduceat(rope["P"][:, 2], offsets[:-1])
    thread_order = np.argsort(-far_tip, kind="stable")
    order = np.concatenate([np.arange(offsets[t], offsets[t + 1]) for t in thread_order])
    starts = np.r_[0, np.cumsum(np.diff(offsets)[thread_order])]
    stretch = np.floor(far_tip[thread_order] / CHUNK).astype(np.int64)
    edges = np.r_[0, np.nonzero(np.diff(stretch))[0] + 1, len(stretch)]
    chunks[name] = []
    for a, b in zip(edges[:-1], edges[1:]):
        part = rope["P"][order[starts[a]:starts[b]]]
        chunks[name].append([int(starts[a]), int(starts[b] - starts[a]), *np.c_[part.min(0), part.max(0)].ravel().round(4).tolist()])
    q = pad(q[order])
    q[0, 3] = 32767
    uv = np.stack((unit(rope["uv"][:, 0], "uv_u"), unit(rope["uv"][:, 1], "uv_v")), 1)
    span = slice(point_cursor, point_cursor + n)
    random = np.repeat(curve_random(np.arange(len(rope["offsets"]) - 1)), np.diff(rope["offsets"]))
    # Everything a point needs, baked: tile place, thickness and Blender's random number for its thread; glow colour and strength; light with its colour and opacity; the see-through tint with hot and side.
    place = np.round(np.c_[uv, unit(rope["radius"], "radius"), random] * 65535).astype(np.uint16)[order]
    extra = np.round(np.c_[unit(rope["rope_hot"], "rope_hot") if rope["rope_hot"] is not None else np.zeros(n), unit(rope["rope_side"], "rope_side") if rope["rope_side"] is not None else np.zeros(n)] * 255).astype(np.uint8)[order]
    attributes = {
        "POSITION": accessor(add(q, 34962, 8), 5122, n + 2, "VEC3", True, box_of(q)),
        "_ROPE_T": accessor(add(pad(place), 34962), 5123, n + 2, "VEC4"),
        "_ROPE_G": accessor(add(pad(baked["glow"][span][order]), 34962), 5121, n + 2, "VEC4"),
        "_ROPE_L": accessor(add(pad(baked["lit"][span][order]), 34962), 5121, n + 2, "VEC4"),
        "_ROPE_X": accessor(add(pad(np.c_[baked["through"][span][order], extra]), 34962), 5121, n + 2, "VEC4"),
    }
    point_cursor += n
    meshes.append({"name": name, "primitives": [{"mode": 3, "attributes": attributes}]})
    nodes.append({"name": name, "mesh": len(meshes) - 1, "matrix": matrix})
    stats["ropes"] += name != "Rope_Fuzz"
    stats["threads"] += len(rope["offsets"]) - 1
    stats["points"] += n

    core = cores.get(ob.name)
    if core is None:
        continue
    mesh = core.data
    mesh.calc_loop_triangles()
    corners = np.empty(len(mesh.loop_triangles) * 3, np.int32)
    mesh.loop_triangles.foreach_get("loops", corners)
    vertex = np.empty(len(mesh.loops), np.int32)
    mesh.loops.foreach_get("vertex_index", vertex)
    positions = np.empty(len(mesh.vertices) * 3, np.float32)
    mesh.vertices.foreach_get("co", positions)
    world = np.array(core.matrix_world, np.float64)
    positions = to_web(positions.reshape(-1, 3) @ world[:3, :3].T + world[:3, 3])
    normals = np.empty(len(mesh.loops) * 3, np.float32)
    mesh.corner_normals.foreach_get("vector", normals)
    normals = to_web(normals.reshape(-1, 3))
    corner_uv = np.empty(len(mesh.loops) * 2, np.float32)
    mesh.uv_layers.active.uv.foreach_get("vector", corner_uv)
    corner_uv = corner_uv.reshape(-1, 2)
    if "core_uv_u" not in ranges:
        all_uv = []
        for other in cores.values():
            values = np.empty(len(other.data.loops) * 2, np.float32)
            other.data.uv_layers.active.uv.foreach_get("vector", values)
            all_uv.append(values.reshape(-1, 2))
        all_uv = np.concatenate(all_uv)
        ranges["core_uv_u"], ranges["core_uv_v"] = [float(all_uv[:, 0].min()), float(all_uv[:, 0].max())], [float(all_uv[:, 1].min()), float(all_uv[:, 1].max())]
    uv16 = np.round(np.stack((unit(corner_uv[:, 0], "core_uv_u"), unit(corner_uv[:, 1], "core_uv_v")), 1) * 65535).astype(np.uint16)
    n8 = np.round(np.clip(normals, -1, 1) * 127).astype(np.int8)
    # A corner with its own UV or normal needs its own vertex, which is what UV seams need for textures.
    keys = np.c_[vertex, uv16, n8].astype(np.int32)
    _, first, index = np.unique(keys, axis=0, return_index=True, return_inverse=True)
    index = index.ravel()
    qc, core_matrix, _ = quantiser(positions[vertex[first]])
    # The node's scale is uneven, so a normal must be stored scaled the same way for it to come back correct in world space.
    local = normals[first] * [core_matrix[0], core_matrix[5], core_matrix[10]]
    local /= np.maximum(np.linalg.norm(local, axis=1, keepdims=True), 1e-9)
    attributes = {
        "POSITION": accessor(add(qc, 34962, 8), 5122, len(qc), "VEC3", True, box_of(qc)),
        "NORMAL": accessor(add(np.c_[np.round(local * 32767).astype(np.int16), np.zeros(len(first), np.int16)], 34962, 8), 5122, len(first), "VEC3"),
        "TEXCOORD_0": accessor(add(uv16[first], 34962), 5123, len(first), "VEC2"),
        # Baked per corner: light in RGB, on the same scale as the Light sheet. AO in alpha.
        "COLOR_0": accessor(add(np.round(np.c_[encode(core_bake[f"{core.name}:DIFFUSE"][vertex[first]] / maps["light"]["peak"]), np.clip(core_bake[f"{core.name}:AO"][vertex[first]], 0, 1)] * 255).astype(np.uint8), 34962), 5121, len(first), "VEC4"),
    }
    triangles = index[corners].astype(np.uint32)
    meshes.append({"name": f"{name}_Core", "primitives": [{"mode": 4, "indices": accessor(add(triangles, 34963), 5125, len(triangles), "SCALAR", False), "attributes": attributes}]})
    nodes.append({"name": f"{name}_Core", "mesh": len(meshes) - 1, "matrix": core_matrix})
    stats["core_faces"] += len(mesh.polygons)
    stats["core_triangles"] += len(triangles) // 3

start = np.array(camera.matrix_world, np.float64)[:3, 3]
y = np.concatenate([r["P"][:, 2] for r in ropes])
gltf = {
    "asset": {"version": "2.0", "generator": "scripts/export-rope-model.py"},
    "extensionsUsed": ["KHR_mesh_quantization"], "extensionsRequired": ["KHR_mesh_quantization"],
    "scene": 0, "scenes": [{"nodes": list(range(len(nodes)))}], "nodes": nodes, "meshes": meshes, "accessors": accessors, "bufferViews": views, "buffers": [{"byteLength": 0}],
    "extras": {"source": os.path.basename(bpy.data.filepath), "ranges": ranges, **stats, "chunks": chunks,
               "camera": {"lens": camera.data.lens, "sensor": camera.data.sensor_width, "near": camera.data.clip_start, "far": camera.data.clip_end, "position": to_web(start[None])[0].tolist(), "depth_of_field": camera.data.dof.use_dof},
               "tunnel": {"front": float(y.min()), "back": float(y.max())},
               # The look's fixed numbers, read from the file so nothing on the page is a guess.
               "look": {"exposure": scene.cycles.film_exposure, "world": list(scene.world.node_tree.nodes["Background"].inputs["Color"].default_value)[:3],
                        "lit_peak": lit_peak * maps["base_color"]["peak"] * maps["light"]["peak"], "strength_peak": maps["emission"]["strength_peak"], "light_peak": maps["light"]["peak"],
                        "height_mean": maps["normal"]["height_mean"], "cavity_mean": maps["normal"]["cavity_mean"], "core_color": list(bpy.data.materials["Rope_Core"].node_tree.nodes["Diffuse BSDF"].inputs["Color"].default_value)[:3],
                        "amber": [[e.position, list(e.color)[:3]] for e in bpy.data.materials["Rope_Fibre"].node_tree.nodes["AMBER_RAMP"].color_ramp.elements],
                        "grade": [[[e.position, e.color[0]] for e in scene.compositing_node_group.nodes[f"Red_Grade_{c}"].color_ramp.elements] for c in ("Red", "Green", "Blue")]}},
}
while len(blob) % 4:
    blob.append(0)
gltf["buffers"][0]["byteLength"] = len(blob)
text = json.dumps(gltf, separators=(",", ":")).encode()
text += b" " * (-len(text) % 4)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "wb") as file:
    file.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(text) + 8 + len(blob)))
    file.write(struct.pack("<I", len(text)) + b"JSON" + text)
    file.write(struct.pack("<I", len(blob)) + b"BIN\0")
    file.write(blob)
blender = {"threads": sum(len(o.data.curves) for o in strands), "points": sum(len(o.data.points) for o in strands), "core_faces": sum(len(o.data.polygons) for o in cores.values())}
samples = {("Rope_Fuzz" if r["ob"].name == "Strand_Fuzz" else f"Rope_{r['ob'].name[-2:]}"): [[int(i), r["P"][i].tolist(), float(r["radius"][i])] for i in np.linspace(0, len(r["P"]) - 1, 5).astype(int)] for r in ropes}
print("ROPE_SAMPLES", json.dumps(samples))
print("ROPE_CHUNKS", sum(len(c) for c in chunks.values()), "tallest", max(c[7] - c[6] for r in chunks.values() for c in r))
print("ROPE_MODEL", json.dumps({"blender": blender, "file": stats, "tunnel": gltf["extras"]["tunnel"], "ranges": {k: [round(v[0], 4), round(v[1], 4)] for k, v in ranges.items()}, "mb": round(os.path.getsize(OUT) / 1e6, 1)}))
