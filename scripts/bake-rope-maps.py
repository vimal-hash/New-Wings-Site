# Bakes the no-glow red rope to 6K maps. Blender cannot bake onto hair, so every thread is rebuilt as a flat strip at its real place and size, facing the tunnel's centre line
# (where the camera always is), and every thread gets its own line on one 6K sheet. Colours therefore stay on their own thread when the camera moves.
# The source .blend is only read, never saved.
#
# Usage: blender -b Rope_Red_r3f_no_glow_red.blend --factory-startup --python scripts/bake-rope-maps.py -- <out dir> <stage> [<stage> ...]
# Stages: layout base emission normal roughness ao metallic light core
import bpy, json, os, sys, time
import numpy as np
import OpenImageIO as oiio

args = sys.argv[sys.argv.index("--") + 1:]
OUT, STAGES = os.path.abspath(args[0]), args[1:]
SIZE = int(os.environ.get("BAKE_SIZE", 6144))
os.makedirs(OUT, exist_ok=True)
LAYOUT = os.path.join(OUT, "layout.npz")
scene = bpy.data.scenes["Rope_Macro"]
bpy.context.window.scene = scene
strands = sorted((o for o in scene.objects if o.type == "CURVES"), key=lambda o: o.name)
cores = sorted((o for o in scene.objects if o.type == "MESH" and o.name.endswith("_core")), key=lambda o: o.name)
ATTRIBUTES = ["rope_tone", "rope_hue", "rope_rough", "rope_glow", "rope_energy", "rope_gold", "rope_depth", "rope_film", "rope_hot", "rope_side", "rope_seed"]
log = lambda *a: print("BAKE", round(time.time() - T0), *a, flush=True)
T0 = time.time()
MIN_PIECE = .5


def read(ob, name, size=1):
    attribute = ob.data.attributes.get(name)
    if attribute is None:
        return np.zeros(len(ob.data.points) if size == 1 else (len(ob.data.points), size), np.float32)
    values = np.empty(len(attribute.data) * size, np.float32)
    attribute.data.foreach_get("vector" if size > 1 else "value", values)
    return values.reshape(-1, size) if size > 1 else values


def curve_random(index):
    """The exact number Cycles gives each thread as Curves Info > Random: its own hash of the thread's index. Checked against a Cycles render of 256 curves, error under 1e-7."""
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


def make_layout():
    """One run of texels per thread, one texel tall. Longer threads get more texels; every thread keeps at least one texel per point."""
    points, lengths, owners = [], [], []
    for index, ob in enumerate(strands):
        offsets = np.empty(len(ob.data.curves) + 1, np.int32)
        ob.data.curve_offset_data.foreach_get("value", offsets)
        P = read(ob, "position", 3)
        step = np.linalg.norm(P[1:] - P[:-1], axis=1)
        step[offsets[1:-1] - 1] = 0
        total = np.concatenate(([0], np.cumsum(step)))
        lengths.append(total[offsets[1:] - 1] - total[offsets[:-1]])
        points.append(np.diff(offsets))
        owners.append(np.full(len(offsets) - 1, index, np.int32))
    lengths, points, owners = np.concatenate(lengths), np.concatenate(points), np.concatenate(owners)
    density = (SIZE * SIZE * .985 - points.sum()) / lengths.sum() * 1.5
    while True:
        runs = np.minimum(np.maximum(points, np.ceil(lengths * density).astype(np.int64)), SIZE)
        order = np.argsort(-runs, kind="stable")
        start, row = np.zeros(len(runs), np.int32), np.zeros(len(runs), np.int32)
        head, tail, current = 0, len(order) - 1, 0
        sorted_runs = runs[order]
        fits = True
        while head <= tail:
            used = 0
            while head <= tail and used + sorted_runs[head] <= SIZE:
                i = order[head]; start[i] = used; row[i] = current; used += sorted_runs[head]; head += 1
            while head <= tail and used + sorted_runs[tail] <= SIZE:
                i = order[tail]; start[i] = used; row[i] = current; used += sorted_runs[tail]; tail -= 1
            current += 1
            if current > SIZE:
                fits = False
                break
        if fits:
            break
        density *= .97
    np.savez(LAYOUT, start=start, row=row, runs=runs, lengths=lengths, points=points, owners=owners, density=density, rows=current)
    log("layout", {"threads": len(runs), "texels_per_unit": round(float(density), 1), "rows_used": int(current), "of": SIZE, "filled": round(float(runs.sum() / SIZE / SIZE), 4), "longest_run": int(runs.max())})


def build_proxy():
    """All threads as one mesh: two corners per point, the strip's width is the thread's real width, its face turned to the tunnel's centre line."""
    layout = np.load(LAYOUT)
    corners, uvs, faces, values, first = [], [], [], {n: [] for n in ATTRIBUTES}, 0
    rope_uvs, randoms, point_u, point_row = [], [], [], []
    thread = 0
    for ob in strands:
        offsets = np.empty(len(ob.data.curves) + 1, np.int32)
        ob.data.curve_offset_data.foreach_get("value", offsets)
        count = len(offsets) - 1
        world = np.array(ob.matrix_world, np.float64)
        P = read(ob, "position", 3).astype(np.float64) @ world[:3, :3].T + world[:3, 3]
        R = read(ob, "radius")
        n = len(P)
        first_point, last_point = offsets[:-1], offsets[1:] - 1
        ahead, behind = np.minimum(np.arange(n) + 1, n - 1), np.maximum(np.arange(n) - 1, 0)
        ahead[last_point] = last_point; behind[first_point] = first_point
        T = P[ahead] - P[behind]
        T /= np.maximum(np.linalg.norm(T, axis=1, keepdims=True), 1e-9)
        toward = np.stack((-P[:, 0], np.zeros(n), -P[:, 2]), 1)
        toward /= np.maximum(np.linalg.norm(toward, axis=1, keepdims=True), 1e-9)
        S = np.cross(T, toward)
        weak = np.linalg.norm(S, axis=1) < 1e-4
        S[weak] = np.cross(T[weak], [0.0, 1.0, 0.0])
        S /= np.maximum(np.linalg.norm(S, axis=1, keepdims=True), 1e-9)
        half = np.maximum(R, 1e-4)[:, None]
        corners.append(np.stack((P - S * half, P + S * half), 1).reshape(-1, 3))
        step = np.linalg.norm(P[1:] - P[:-1], axis=1)
        step[last_point[:-1]] = 0
        along = np.concatenate(([0], np.cumsum(step)))
        along -= np.repeat(along[first_point], np.diff(offsets))
        span = np.repeat(along[last_point], np.diff(offsets))
        index = np.arange(n) - np.repeat(first_point, np.diff(offsets))
        last_index = np.repeat(np.diff(offsets) - 1, np.diff(offsets))
        share = np.where(span > 1e-7, along / np.maximum(span, 1e-7), index / np.maximum(last_index, 1))
        # A very short piece must not get a sliver on the sheet: Blender's bake reads wild values from slivers. Every piece keeps at least half a texel; the rest follows length.
        runs, starts, rows = (np.repeat(layout[k][thread:thread + count], np.diff(offsets)) for k in ("runs", "start", "row"))
        room = np.maximum(runs - 1 + .04 - last_index * MIN_PIECE, 0)
        u = starts + .48 + share * room + index * np.minimum(MIN_PIECE, (runs - 1 + .04) / np.maximum(last_index, 1))
        point_u.append(u.astype(np.float32)); point_row.append(rows.astype(np.uint16))
        uvs.append(np.stack((u, rows.astype(np.float64)), 1))
        for name in ATTRIBUTES:
            values[name].append(read(ob, name))
        rope_uvs.append(read(ob, "rope_uv", 2))
        if "id" in ob.data.attributes:
            raise SystemExit("Cycles would hash this curve's id instead of its index")
        randoms.append(np.repeat(curve_random(np.arange(count)), np.diff(offsets)))
        keep = np.ones(n - 1, bool); keep[last_point[:-1]] = False
        i = np.nonzero(keep)[0] + first
        faces.append(np.stack((i * 2, i * 2 + 1, (i + 1) * 2 + 1, (i + 1) * 2), 1))
        first += n
        thread += count
    corners, uvs, faces = np.concatenate(corners), np.concatenate(uvs), np.concatenate(faces)
    np.savez(os.path.join(OUT, "thread_uv.npz"), u=np.concatenate(point_u), row=np.concatenate(point_row))
    mesh = bpy.data.meshes.new("BakeThreads")
    mesh.vertices.add(len(corners)); mesh.loops.add(faces.size); mesh.polygons.add(len(faces))
    mesh.vertices.foreach_set("co", corners.astype(np.float32).ravel())
    mesh.loops.foreach_set("vertex_index", faces.astype(np.int32).ravel())
    mesh.polygons.foreach_set("loop_start", np.arange(len(faces), dtype=np.int32) * 4)
    mesh.update(calc_edges=True)
    mesh.shade_smooth()
    atlas = mesh.uv_layers.new(name="atlas")
    # A strip sits inside its one-texel line, so its centres are always inside the strip.
    corner_uv = np.empty((len(corners), 2), np.float32)
    corner_uv[0::2, 0] = corner_uv[1::2, 0] = uvs[:, 0] / SIZE
    corner_uv[0::2, 1] = (uvs[:, 1] + .02) / SIZE
    corner_uv[1::2, 1] = (uvs[:, 1] + .98) / SIZE
    atlas.uv.foreach_set("vector", corner_uv[faces.ravel()].ravel())
    mesh.uv_layers.active = atlas
    def per_corner(name, data, kind="FLOAT"):
        attribute = mesh.attributes.new(name, kind, "POINT")
        attribute.data.foreach_set("vector" if kind == "FLOAT2" else "value", np.repeat(data, 2, axis=0).ravel())
    for name in ATTRIBUTES:
        per_corner(name, np.concatenate(values[name]))
    per_corner("rope_uv", np.concatenate(rope_uvs), "FLOAT2")
    per_corner("thread_random", np.concatenate(randoms))
    ob = bpy.data.objects.new("BakeThreads", mesh)
    scene.collection.objects.link(ob)
    bpy.context.view_layer.update()
    # Every strip must face the centre line.
    mid = np.empty(len(mesh.polygons) * 3, np.float32); mesh.polygons.foreach_get("center", mid); mid = mid.reshape(-1, 3)
    normal = np.empty(len(mesh.polygons) * 3, np.float32); mesh.polygons.foreach_get("normal", normal); normal = normal.reshape(-1, 3)
    pick = np.random.default_rng(1).integers(0, len(mid), 200000)
    facing = np.sum(normal[pick] * np.stack((-mid[pick, 0], 0 * mid[pick, 1], -mid[pick, 2]), 1), axis=1)
    if np.mean(facing > 0) < .5:
        mesh.flip_normals()
        mesh.update()
    log("proxy", {"corners": len(corners), "faces": len(faces), "facing_centre_share": round(float(max(np.mean(facing > 0), np.mean(facing < 0))), 4)})
    for strand in strands:
        strand.hide_render = True
    return ob


def image_mean(name):
    image = bpy.data.images[name]
    pixels = np.empty(image.size[0] * image.size[1] * image.channels, np.float32)
    image.pixels.foreach_get(pixels)
    return float(pixels.reshape(-1, image.channels)[:, 0].mean())


def bake_material(detail="means"):
    """The real thread material with only what a mesh strip cannot do swapped out: Curves Info, the view angle, and the fine tiled textures (those are baked separately on the Detail tile)."""
    material = bpy.data.materials["Rope_Fibre"].copy()
    material.name = "BakeFibre"
    tree = material.node_tree
    nodes, links = tree.nodes, tree.links
    random = nodes.new("ShaderNodeAttribute"); random.attribute_name = "thread_random"
    for info in ("Curves Info", "Curves Info.001"):
        node = nodes[info]
        for link in list(node.outputs["Random"].links):
            links.new(random.outputs["Fac"] if "Fac" in random.outputs else random.outputs["Factor"], link.to_socket)
        for link in list(node.outputs["Tangent Normal"].links):
            links.remove(link)
    # Around a round thread the view term averages to this.
    term = nodes.new("ShaderNodeValue"); term.outputs[0].default_value = VIEW_TERM
    for link in list(nodes["Math.013"].outputs[0].links):
        links.new(term.outputs[0], link.to_socket)
    if detail == "means":
        for name in ("Image Texture.006", "Image Texture.007", "Image Texture.009", "Image Texture.010"):
            node = nodes[name]
            value = nodes.new("ShaderNodeValue"); value.outputs[0].default_value = image_mean(node.image.name)
            for link in list(node.outputs["Color"].links):
                links.new(value.outputs[0], link.to_socket)
    for name in ("Bump.001", "Bump"):
        for link in list(nodes[name].outputs[0].links):
            links.remove(link)
    return material


def show(material, socket, is_value=False):
    """Sends one value straight to the output, as light, so an Emit bake records exactly that value."""
    tree = material.node_tree
    emit = tree.nodes.new("ShaderNodeEmission")
    emit.inputs["Strength"].default_value = 1
    tree.links.new(socket, emit.inputs["Color"])
    tree.links.new(emit.outputs[0], tree.nodes["Material Output"].inputs["Surface"])
    return emit


def setup_cycles(samples):
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "OPTIX"
    prefs.get_devices()
    for device in prefs.devices:
        device.use = device.type == "OPTIX"
    scene.cycles.device = "GPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = False
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.film_exposure = 1  # the file's 2.3 belongs to the final picture, so the website applies it at the end
    bake = scene.render.bake
    bake.margin = 0
    bake.use_clear = True
    bake.use_selected_to_active = False
    bake.target = "IMAGE_TEXTURES"
    bake.use_pass_direct = bake.use_pass_indirect = True
    bake.use_pass_color = False


def run_bake(ob, material, bake_type, samples, name, **options):
    setup_cycles(samples)
    image = bpy.data.images.new(name, SIZE, SIZE, alpha=True, float_buffer=True)
    image.colorspace_settings.name = "Non-Color"
    ob.data.materials.clear()
    ob.data.materials.append(material)
    node = material.node_tree.nodes.new("ShaderNodeTexImage")
    node.image = image
    node.interpolation = "Closest"
    material.node_tree.nodes.active = node
    for other in bpy.context.selected_objects:
        other.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    started = time.time()
    bpy.ops.object.bake(type=bake_type, **options)
    pixels = np.empty(SIZE * SIZE * 4, np.float32)
    image.pixels.foreach_get(pixels)
    material.node_tree.nodes.remove(node)
    log("baked", name, bake_type, f"{samples} samples", round(time.time() - started), "seconds")
    return pixels.reshape(SIZE, SIZE, 4), image


def fill_and_check(pixels, name):
    """Checks that every thread texel really received the bake, then runs each line's last value on through its empty end, so nothing can read black."""
    layout = np.load(LAYOUT)
    covered = np.zeros((SIZE, SIZE), bool)
    starts, runs, rows = layout["start"], layout["runs"], layout["row"]
    marks = np.zeros((SIZE, SIZE + 1), np.int32)
    np.add.at(marks, (rows, starts), 1)
    np.add.at(marks, (rows, starts + runs), -1)
    covered = np.cumsum(marks, axis=1)[:, :SIZE] > 0
    baked = pixels[..., 3] > .5
    needed, missing = int(covered.sum()), int((covered & ~baked).sum())
    data = pixels.copy()
    # Any miss or empty end takes the nearest baked value on the same line.
    for row in np.nonzero((~baked).any(axis=1))[0]:
        good = np.nonzero(baked[row])[0]
        if len(good):
            nearest = good[np.clip(np.searchsorted(good, np.arange(SIZE)), 0, len(good) - 1)]
            data[row] = data[row, nearest]
        else:
            data[row] = data[row - 1] if row else 0
    report = {"map": name, "thread_texels": needed, "missed": missing, "missed_share": round(missing / max(needed, 1), 7), "rgb_min": data[covered][:, :3].min(0).round(5).tolist(), "rgb_mean": data[covered][:, :3].astype(np.float64).mean(0).round(5).tolist(), "rgb_max": data[covered][:, :3].max(0).round(5).tolist(), "bad_numbers": int((~np.isfinite(data[covered])).sum())}
    log("check", json.dumps(report))
    return data, report


def encode(linear):
    linear = np.clip(linear, 0, 1)
    return np.where(linear <= .0031308, linear * 12.92, 1.055 * np.power(linear, 1 / 2.4) - .055)


def write_png(path, data, bits=8):
    """Blender stores the bottom row first and files store the top row first; the sheet is flipped here so what is on disk is the picture you see."""
    channels = data.shape[2]
    if bits == 8:
        out = np.round(np.clip(data[::-1], 0, 1) * 255).astype(np.uint8)
        spec = oiio.ImageSpec(data.shape[1], data.shape[0], channels, "uint8")
    else:
        out = np.round(np.clip(data[::-1], 0, 1) * 65535).astype(np.uint16)
        spec = oiio.ImageSpec(data.shape[1], data.shape[0], channels, "uint16")
    spec.attribute("oiio:ColorSpace", "raw")
    spec.attribute("oiio:UnassociatedAlpha", 1)  # the fourth channel holds separate data here; without this the writer divides the colours by it
    spec.attribute("png:compressionLevel", 6)
    handle = oiio.ImageOutput.create(path)
    handle.open(path, spec)
    handle.write_image(out)
    handle.close()
    log("wrote", os.path.basename(path), round(os.path.getsize(path) / 1e6, 1), "MB")


def write_preview(path, data, width=1536):
    step = max(1, data.shape[1] // width)
    write_png(path, data[::step, ::step], 8)


def save_note(name, value):
    path = os.path.join(OUT, "maps.json")
    notes = json.load(open(path)) if os.path.exists(path) else {}
    notes[name] = value
    json.dump(notes, open(path, "w"), indent=1)


VIEW_TERM = .6966  # the average of the file's |I.N|^1.7 across a round thread
stage_proxy = None
def proxy():
    global stage_proxy
    if stage_proxy is None:
        stage_proxy = build_proxy()
    return stage_proxy


def flat_stage(name, node_socket, samples=16, encode_srgb=False):
    material = bake_material()
    nodes = material.node_tree.nodes
    show(material, nodes[node_socket[0]].outputs[node_socket[1]])
    pixels, image = run_bake(proxy(), material, "EMIT", samples, name)
    data, report = fill_and_check(pixels, name)
    return data, report


def smooth_lines(data, window):
    """Removes render noise along each thread only. Two different threads never mix, so each thread keeps its own value."""
    layout = np.load(LAYOUT)
    out = data.copy()
    half = window // 2
    for start, run, row in zip(layout["start"], layout["runs"], layout["row"]):
        if run > window:
            line = data[row, start:start + run].astype(np.float64)
            total = np.cumsum(np.concatenate((np.zeros((1, line.shape[1])), line)), axis=0)
            hi, lo = np.minimum(np.arange(run) + half + 1, run), np.maximum(np.arange(run) - half, 0)
            out[row, start:start + run] = (total[hi] - total[lo]) / (hi - lo)[:, None]
    return out


def bake_tile():
    """Fine thread relief and grain on one repeating 6K tile, on a plane of the tile's real world size so slopes are correct. Normal is a true tangent-space bake from the file's Bump."""
    source = bpy.data.materials["Rope_Fibre"].node_tree.nodes
    height, cavity, albedo = source["Image Texture.008"].image, source["Image Texture.009"].image, source["Image Texture.006"].image
    width_world, height_world = 1 / .139, .006 / .004
    mesh = bpy.data.meshes.new("BakeTile")
    mesh.from_pydata([(0, 0, 0), (width_world, 0, 0), (width_world, height_world, 0), (0, height_world, 0)], [], [(0, 1, 2, 3)])
    layer = mesh.uv_layers.new(name="UVMap")
    for i, uv in enumerate(((0, 0), (1, 0), (1, 1), (0, 1))):
        layer.uv[i].vector = uv
    plane = bpy.data.objects.new("BakeTile", mesh)
    plane.location = (0, 0, 500)
    scene.collection.objects.link(plane)
    for other in scene.objects:
        if other is not plane and other.type in ("MESH", "CURVES"):
            other.hide_render = True
    def tile_material(name):
        material = bpy.data.materials.new(name)
        material.use_nodes = True
        tree = material.node_tree
        tree.nodes.clear()
        out = tree.nodes.new("ShaderNodeOutputMaterial"); out.name = "Material Output"
        coord = tree.nodes.new("ShaderNodeUVMap"); coord.uv_map = "UVMap"
        def tex(image, scale=1):
            node = tree.nodes.new("ShaderNodeTexImage"); node.image = image; node.extension = "REPEAT"; node.interpolation = "Cubic"
            if scale == 1:
                tree.links.new(coord.outputs[0], node.inputs[0])
            else:
                mul = tree.nodes.new("ShaderNodeVectorMath"); mul.operation = "MULTIPLY"; mul.inputs[1].default_value = (scale, 1, 1)
                tree.links.new(coord.outputs[0], mul.inputs[0]); tree.links.new(mul.outputs[0], node.inputs[0])
            return node
        return material, tree, out, tex
    material, tree, out, tex = tile_material("BakeTileNormal")
    bump = tree.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value, bump.inputs["Distance"].default_value, bump.inputs["Filter Width"].default_value = .9, .008, .1
    tree.links.new(tex(height).outputs["Color"], bump.inputs["Height"])
    diffuse = tree.nodes.new("ShaderNodeBsdfDiffuse")
    tree.links.new(bump.outputs[0], diffuse.inputs["Normal"])
    tree.links.new(diffuse.outputs[0], out.inputs["Surface"])
    pixels, _ = run_bake(plane, material, "NORMAL", 8, "tile_normal", normal_space="TANGENT")
    normal = pixels[..., :3]
    def value_of(image, mean_name):
        return image_mean(image.name)
    m_height, m_cavity, m_albedo = image_mean(height.name), image_mean(cavity.name), image_mean(albedo.name)
    # The file's two grain pictures, each on its own channel, because its glow formula reads them at different places: height at (3u, v), cavity at (u, v + across * .004).
    material, tree, out, tex = tile_material("BakeTileDetail")
    join = tree.nodes.new("ShaderNodeCombineColor")
    tree.links.new(tex(source["Image Texture.010"].image).outputs["Color"], join.inputs[0])
    tree.links.new(tex(source["Image Texture.009"].image).outputs["Color"], join.inputs[1])
    emit = tree.nodes.new("ShaderNodeEmission")
    tree.links.new(join.outputs[0], emit.inputs["Color"]); tree.links.new(emit.outputs[0], out.inputs["Surface"])
    pixels, _ = run_bake(plane, material, "EMIT", 8, "tile_detail")
    detail = np.clip(pixels[..., :2], 0, 1)
    # Base and roughness were baked with the grain at its average, so the page divides by these.
    report = {"tile_world_size": [width_world, height_world], "normal_mean": normal.astype(np.float64).mean((0, 1)).round(4).tolist(), "normal_flat_share": round(float((normal[..., 2] > .98).mean()), 4), "height_mean": m_height, "cavity_mean": m_cavity, "detail_mean": detail.astype(np.float64).mean((0, 1)).round(4).tolist(), "missed": int((pixels[..., 3] < .5).sum())}
    log("check", json.dumps(report))
    plane.hide_render = True
    return np.clip(normal, 0, 1), detail, report


def bake_cores():
    """The rope bodies' own UVs stack many times over, so a sheet cannot hold them. They are one flat dark colour anyway; their light and shading are baked per corner of the mesh."""
    proxy()
    setup_cycles(int(os.environ.get("LIGHT_SAMPLES", 64)))
    scene.render.bake.target = "VERTEX_COLORS"
    light_sum = {}
    for mode in ("DIFFUSE", "AO"):
        for ob in cores:
            mesh = ob.data
            if mode in mesh.color_attributes:
                mesh.color_attributes.remove(mesh.color_attributes[mode])
            mesh.color_attributes.new(mode, "FLOAT_COLOR", "POINT")
            mesh.color_attributes.active_color = mesh.color_attributes[mode]
        for other in bpy.context.selected_objects:
            other.select_set(False)
        for ob in cores:
            ob.select_set(True)
        bpy.context.view_layer.objects.active = cores[0]
        started = time.time()
        if mode == "AO":
            scene.cycles.samples = 256
            bpy.ops.object.bake(type="AO")
        else:
            bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"})
        log("baked core", mode, round(time.time() - started), "seconds")
    store = {}
    for ob in cores:
        mesh = ob.data
        for mode in ("DIFFUSE", "AO"):
            values = np.empty(len(mesh.vertices) * 4, np.float32)
            mesh.color_attributes[mode].data.foreach_get("color", values)
            store[f"{ob.name}:{mode}"] = values.reshape(-1, 4)[:, :3 if mode == "DIFFUSE" else 1]
    np.savez(os.path.join(OUT, "core_bake.npz"), **store)
    log("check", json.dumps({"core_light_mean": float(np.mean([v.mean() for k, v in store.items() if k.endswith("DIFFUSE")])), "core_ao_mean": float(np.mean([v.mean() for k, v in store.items() if k.endswith("AO")]))}))


def pack_for_web():
    """Only the repeating grain tile is a picture on the page. Every other baked value goes onto the thread points in scripts/export-rope-model.py."""
    out = os.path.join(os.environ["PUBLIC_DIR"])
    os.makedirs(out, exist_ok=True)
    for old in os.listdir(out):
        os.remove(os.path.join(out, old))
    # Height in red, cavity in green. The grain barely changes along a thread, so 1024 x 3072 shows the same picture as the 6K tile at under a tenth of the memory.
    detail = np.load(os.path.join(OUT, "tile_detail.npy")).astype(np.float32)
    small = detail.reshape(3072, 2, 1024, 6, 2).mean(axis=(1, 3))
    write_png(os.path.join(out, "grain.png"), np.dstack((small, np.zeros((3072, 1024), np.float32))))
    log("pack sizes", {f: round(os.path.getsize(os.path.join(out, f)) / 1e6, 1) for f in os.listdir(out)})


DETAIL_RANGE = 4.0
for stage in STAGES:
    log("stage", stage)
    if stage == "layout":
        make_layout()
    elif stage == "base":
        data, report = flat_stage("base_color", ("DARK_COLOUR", "Result"))
        # The file's real thread colours are very dark. They are stored stretched by a recorded factor, so 8 bits are not wasted and there is no banding.
        rgb = np.maximum(data[..., :3], 0)
        report["peak"] = float(rgb.max())
        np.save(os.path.join(OUT, "base_linear.npy"), np.clip(rgb / report["peak"], 0, 1).astype(np.float16))
        write_png(os.path.join(OUT, "rope_base_color_6k.png"), encode(rgb / report["peak"]))
        material = bake_material()
        tree = material.node_tree
        opacity = tree.nodes.new("ShaderNodeMath"); opacity.operation = "SUBTRACT"; opacity.inputs[0].default_value = 1
        tree.links.new(tree.nodes["Math.017"].outputs[0], opacity.inputs[1])
        show(material, opacity.outputs[0])
        pixels, _ = run_bake(proxy(), material, "EMIT", 4, "opacity")
        alpha, _ = fill_and_check(pixels, "opacity")
        np.save(os.path.join(OUT, "opacity_linear.npy"), np.clip(alpha[..., 0], 0, 1).astype(np.float16))
        write_png(os.path.join(OUT, "rope_opacity_6k.png"), np.clip(alpha[..., :1], 0, 1))
        save_note("base_color", report)
    elif stage == "emission":
        # A thread's glow depends on the angle it is seen at, so that part cannot be frozen on a sheet. These are the parts of the file's formula that never change; the page runs the rest live.
        material = bake_material()
        tree = material.node_tree
        show(material, tree.nodes["Color Ramp.003"].outputs["Color"])
        pixels, _ = run_bake(proxy(), material, "EMIT", 8, "emission_colour")
        data, report = fill_and_check(pixels, "emission_colour")
        colour = np.clip(data[..., :3], 0, 1)
        np.save(os.path.join(OUT, "emission_linear.npy"), colour.astype(np.float16))
        write_png(os.path.join(OUT, "rope_emission_colour_6k.png"), encode(colour))
        material = bake_material()
        tree = material.node_tree
        strength = tree.nodes.new("ShaderNodeMath"); strength.operation = "MULTIPLY"
        tree.links.new(tree.nodes["Math.011"].outputs[0], strength.inputs[0])
        tree.links.new(tree.nodes["Math.023"].outputs[0], strength.inputs[1])
        show(material, strength.outputs[0])
        pixels, _ = run_bake(proxy(), material, "EMIT", 8, "emission_strength")
        data, strength_report = fill_and_check(pixels, "emission_strength")
        values = np.maximum(data[..., 0], 0)
        peak = float(values.max())
        report = {"colour": report, "strength": strength_report, "strength_peak": peak}
        # The square root keeps fine steps where the file's dark threshold sits.
        stored = np.sqrt(values / peak)
        np.save(os.path.join(OUT, "strength_linear.npy"), stored.astype(np.float16))
        write_png(os.path.join(OUT, "rope_emission_strength_6k.png"), stored[..., None])
        save_note("emission", report)
    elif stage == "roughness":
        data, report = flat_stage("roughness", ("Math.021", "Value"))
        np.save(os.path.join(OUT, "roughness_linear.npy"), np.clip(data[..., 0], 0, 1).astype(np.float16))
        write_png(os.path.join(OUT, "rope_roughness_6k.png"), np.clip(data[..., :1], 0, 1))
        save_note("roughness", report)
    elif stage == "metallic":
        # The file has a metal shader, but nothing connects it to the output. Walk the real graph to prove what reaches the surface.
        tree = bpy.data.materials["Rope_Fibre"].node_tree
        seen, stack = set(), [tree.nodes["Material Output"]]
        while stack:
            node = stack.pop()
            if node.name not in seen:
                seen.add(node.name)
                stack += [link.from_node for socket in node.inputs for link in socket.links]
        reaches = "Principled BSDF" in seen
        write_png(os.path.join(OUT, "rope_metallic_6k.png"), np.zeros((SIZE, SIZE, 1), np.float32))
        report = {"principled_metal_reaches_surface": reaches, "surface_shaders": sorted(n for n in seen if "BSDF" in n or n == "Emission"), "metallic_value": 0}
        log("check", json.dumps(report))
        save_note("metallic", report)
    elif stage == "ao":
        material = bake_material()
        show(material, material.node_tree.nodes["Ambient Occlusion"].outputs["AO"])
        pixels, _ = run_bake(proxy(), material, "EMIT", 128, "ao")
        data, report = fill_and_check(pixels, "ao")
        ao = smooth_lines(np.clip(data[..., :1], 0, 1), 5)
        np.save(os.path.join(OUT, "ao_linear.npy"), ao[..., 0].astype(np.float16))
        write_png(os.path.join(OUT, "rope_ao_6k.png"), ao)
        save_note("ao", report)
    elif stage == "light":
        material = bake_material()
        tree = material.node_tree
        tree.nodes["Mix Shader"].inputs[0].default_value = 1  # a hair shader means nothing on a flat strip; its share goes to the file's own Diffuse
        # Cycles counts Translucent and Sheen inside the Diffuse pass (its Transmission pass came back all zero), so this one bake holds all the light, with the colour divided out.
        pixels, _ = run_bake(proxy(), material, "DIFFUSE", int(os.environ.get("LIGHT_SAMPLES", 64)), "light_DIFFUSE", pass_filter={"DIRECT", "INDIRECT"})
        data, report = fill_and_check(pixels, "light_DIFFUSE")
        total = smooth_lines(np.maximum(data[..., :3], 0), 7)
        peak = float(np.quantile(total.max(axis=2)[::4, ::4], .9999))
        report = {"peak": peak, "mean": total.astype(np.float64).mean((0, 1)).round(5).tolist()}
        log("check", json.dumps(report))
        np.save(os.path.join(OUT, "light_linear.npy"), np.clip(total / peak, 0, 1).astype(np.float16))
        write_png(os.path.join(OUT, "rope_light_6k.png"), encode(total / peak))
        save_note("light", report)
    elif stage == "through":
        # In the file, whatever is seen through a thread is tinted by it. The page draws gaps in threads, not see-through ones, so each thread carries the tint of the threads between it and the camera's path.
        # Lit from lights on the tunnel's centre line through threads that only filter colour, divided by the same bake with nothing blocking. The file's own world and lights are off for this.
        for light in [o for o in scene.objects if o.type == "LIGHT"]:
            light.hide_render = True
        scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0
        for y in np.arange(-3, 33, 1.5):
            data = bpy.data.lights.new(f"Axis_{y}", "POINT"); data.energy = 100; data.shadow_soft_size = .05
            light = bpy.data.objects.new(data.name, data); light.location = (0, float(y), 0)
            scene.collection.objects.link(light)
        scene.cycles.transparent_max_bounces = 64
        material = bpy.data.materials.new("BakeThrough")
        material.use_nodes = True
        tree = material.node_tree
        tree.nodes.clear()
        out = tree.nodes.new("ShaderNodeOutputMaterial"); out.name = "Material Output"
        add = tree.nodes.new("ShaderNodeAddShader")
        diffuse = tree.nodes.new("ShaderNodeBsdfDiffuse"); diffuse.inputs["Color"].default_value = (1, 1, 1, 1)
        clear = tree.nodes.new("ShaderNodeBsdfTransparent"); clear.inputs["Color"].default_value = list(bpy.data.materials["Rope_Fibre"].node_tree.nodes["Transparent BSDF"].inputs["Color"].default_value)
        tree.links.new(diffuse.outputs[0], add.inputs[0]); tree.links.new(clear.outputs[0], add.inputs[1]); tree.links.new(add.outputs[0], out.inputs["Surface"])
        samples = int(os.environ.get("THROUGH_SAMPLES", 64))
        ob = proxy()
        pixels, _ = run_bake(ob, material, "DIFFUSE", samples, "through_blocked", pass_filter={"DIRECT"})
        blocked, _ = fill_and_check(pixels, "through_blocked")
        ob.visible_shadow = False
        for core in cores:
            core.visible_shadow = False
        pixels, _ = run_bake(ob, material, "DIFFUSE", samples, "through_open", pass_filter={"DIRECT"})
        opened, _ = fill_and_check(pixels, "through_open")
        total = smooth_lines(np.clip(blocked[..., :3], 0, None), 15) / np.maximum(smooth_lines(np.clip(opened[..., :3], 0, None), 15), 1e-6)
        total = np.clip(total, 0, 1)
        report = {"mean": total.astype(np.float64).mean((0, 1)).round(4).tolist(), "percentiles_green": np.percentile(total[::4, ::4, 1], [10, 50, 90]).round(4).tolist(), "percentiles_red": np.percentile(total[::4, ::4, 0], [10, 50, 90]).round(4).tolist()}
        log("check", json.dumps(report))
        # The square root keeps fine steps near zero, where green and blue live. Blue follows green closely, so two channels carry the map.
        stored = np.sqrt(total)
        np.save(os.path.join(OUT, "through_linear.npy"), stored.astype(np.float16))
        write_png(os.path.join(OUT, "rope_through_6k.png"), stored)
        save_note("through", report)
    elif stage == "normal":
        data, detail, report = bake_tile()
        np.save(os.path.join(OUT, "tile_normal.npy"), data.astype(np.float16))
        np.save(os.path.join(OUT, "tile_detail.npy"), detail.astype(np.float16))
        write_png(os.path.join(OUT, "rope_normal_6k.png"), data)
        write_png(os.path.join(OUT, "rope_detail_6k.png"), np.concatenate((detail, np.zeros_like(detail[..., :1])), axis=2))
        save_note("normal", report)
    elif stage == "core":
        bake_cores()
    elif stage == "pack":
        pack_for_web()
    else:
        raise SystemExit(f"unknown stage {stage}")
log("done")
