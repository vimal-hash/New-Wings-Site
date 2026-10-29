"""Direct COMBINED surface bake of one restoration item, in a disposable copy (never saved).

Source materials, lights, light linking, occluders and display transform stay as authored. The evaluated
target meshes are frozen (modifiers applied, triangulated) and get one extra UV layer whose charts come from
prepare-uv.mjs, matched triangle-by-triangle to the runtime geometry. The material's own coordinate
inputs keep using their original (active-render) UV layers.
Usage: blender -b --python bake-item.py -- <item> [samples]
"""
import bpy, bmesh, json, math, os, sys, time, hashlib
import numpy as np
from mathutils import Vector, geometry
from pathlib import Path

REPO = Path('D:/New folio/new site code/new_site_three')
args = sys.argv[sys.argv.index('--') + 1:]
ITEM = args[0]
CFG = json.loads((REPO / 'scripts/surface-bake/items.json').read_text())
SPEC = CFG['items'][ITEM]; SRC = dict(CFG['sources'][SPEC['source']]); SRC.update(SPEC.get('sourceOverride', {}))  # item-only offline source
OUT = Path(CFG['authoringRoot']) / ITEM; OUT.mkdir(parents=True, exist_ok=True)
LAYOUT = json.loads((OUT / 'uv-layout.json').read_text())
flag = lambda k: args[args.index(k) + 1] if k in args else None
pos = [a for i, a in enumerate(args) if not a.startswith('--') and (i == 0 or not args[i - 1].startswith('--'))]
SAMPLES = int(pos[1]) if len(pos) > 1 else SPEC.get('samples', 512)
REPLAY = flag('--replay')                          # validation render instead of a bake
TAG = '-' + flag('--tag') if flag('--tag') else ''  # test variants write bake-<tag>.exr
VIEW_FROM = flag('--view-from') or SPEC.get('viewFrom', 'ACTIVE_CAMERA')
IMG_W, IMG_H = map(int, flag('--size').split('x')) if flag('--size') else (None, None)  # bake resolution; UVs keep layout normalisation
W, H = LAYOUT['atlas']; PLANE = [(1, 2), (0, 2), (0, 1)]
IMG_W, IMG_H = IMG_W or W, IMG_H or H

def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 24), b''): h.update(b)
    return h.hexdigest()

def chart_uv(c, p):
    label, su, sv, ou, ov = LAYOUT['charts'][c]; label = int(label)
    a1, a2 = PLANE[(label % 6) >> 1]
    if label >= 6: a1, a2 = a2, a1
    return ((p[a1] * su + ou) / W, (p[a2] * sv + ov) / H)

master_hash = sha(SRC['master'])
bpy.ops.wm.open_mainfile(filepath=SRC['blend'], load_ui=False)
assert Path(bpy.data.filepath).resolve() == Path(SRC['blend']).resolve(), bpy.data.filepath
s = bpy.context.scene; s.frame_set(SRC.get('frame', 1))

# Runtime triangles indexed on a coarse grid for centroid lookup.
tris = [(int(t[0]), [Vector(t[1:4]), Vector(t[4:7]), Vector(t[7:10])]) for t in LAYOUT['tris']]
span = max(max(v[k] for _, ps in tris for v in ps) - min(v[k] for _, ps in tris for v in ps) for k in range(3))
cell = max(span / 256, 1e-6); grid = {}
for i, (_, ps) in enumerate(tris):
    lo = [min(v[k] for v in ps) for k in range(3)]; hi = [max(v[k] for v in ps) for k in range(3)]
    for x in range(int(lo[0] // cell), int(hi[0] // cell) + 1):
        for y in range(int(lo[1] // cell), int(hi[1] // cell) + 1):
            for z in range(int(lo[2] // cell), int(hi[2] // cell) + 1): grid.setdefault((x, y, z), []).append(i)

dg = bpy.context.evaluated_depsgraph_get()
objects, report, worst, unmatched, loose = [], {}, 0.0, 0, 0
for name in SPEC['objects']:
    ob = bpy.data.objects[name]
    if name in SPEC.get('unhideForBake', []): ob.hide_render = False  # disposable copy only; documented per item
    mesh = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    if ob.type == 'MESH':
        ob.modifiers.clear(); ob.data = mesh
    else:
        # Curves/text: a mesh twin in the same collections (light-link receivers) with the same ray visibility.
        twin = bpy.data.objects.new(ob.name + ' | SB mesh', mesh); twin.matrix_world = ob.matrix_world.copy()
        for col in ob.users_collection: col.objects.link(twin)
        for attr in ('visible_camera', 'visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter', 'visible_shadow', 'is_holdout', 'is_shadow_catcher'):
            setattr(twin, attr, getattr(ob, attr))
        twin.light_linking.receiver_collection = ob.light_linking.receiver_collection
        twin.light_linking.blocker_collection = ob.light_linking.blocker_collection
        links = {l.light_linking.receiver_collection for l in bpy.data.objects} | {l.light_linking.blocker_collection for l in bpy.data.objects}
        for col in links - {None}:
            if ob.name in col.objects and twin.name not in col.objects:
                col.objects.link(twin)
                entry = dict(zip(col.objects, col.collection_objects))  # parallel by index
                entry[twin].light_linking.link_state = entry[ob].light_linking.link_state
        ob.hide_render = True; ob = twin
    render_uv = next((u.name for u in mesh.uv_layers if u.active_render), None)
    custom = mesh.has_custom_normals
    bm = bmesh.new(); bm.from_mesh(mesh); bmesh.ops.triangulate(bm, faces=bm.faces[:]); bm.to_mesh(mesh); bm.free()
    assert mesh.has_custom_normals == custom, f'{name}: custom normals lost by triangulation'
    if render_uv: mesh.uv_layers[render_uv].active_render = True
    layer = mesh.uv_layers.new(name='SurfaceBake'); mesh.uv_layers.active = layer
    if render_uv: mesh.uv_layers[render_uv].active_render = True
    mw = ob.matrix_world
    for poly in mesh.polygons:
        pts = [mw @ mesh.vertices[v].co for v in poly.vertices]
        c = (pts[0] + pts[1] + pts[2]) / 3
        key = tuple(int(c[k] // cell) for k in range(3)); best, dist = None, 1e9
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    for i in grid.get((key[0] + dx, key[1] + dy, key[2] + dz), ()):
                        q = geometry.closest_point_on_tri(c, *tris[i][1]); dd = (q - c).length
                        if dd < dist: best, dist = i, dd
        degenerate = poly.area * mw.median_scale ** 2 < (span * 1e-6) ** 2
        if best is not None and span * 1e-4 < dist <= span * 2e-3 and not degenerate: loose += 1  # differently triangulated non-planar polygon
        elif best is None or (dist > span * 1e-4 and not degenerate):
            unmatched += 1; print('SB_UNMATCHED', name, poly.index, [tuple(round(x, 4) for x in p) for p in pts], poly.area, dist, flush=True); continue
        if not degenerate and dist <= span * 1e-4: worst = max(worst, dist)
        chart = tris[best][0]
        for li in poly.loop_indices:
            layer.data[li].uv = chart_uv(chart, mw @ mesh.vertices[mesh.loops[li].vertex_index].co)
    report[name] = {'tris': len(mesh.polygons), 'renderUV': render_uv}
    objects.append(ob)
assert unmatched == 0, f'{unmatched} bake triangles have no runtime counterpart'
assert loose <= len(tris) * .01, f'{loose} loosely matched triangles'

# Selection needs viewport-visible, selectable objects; this does not affect rendering.
for ob in objects: ob.hide_select = False; ob.hide_viewport = False; ob.hide_set(False)
# Cycles bakes each selected object as a separate full pass. Join objects only when the join cannot change shading:
# same collections, light-link membership, ray visibility and UV layers, and no material reads per-object data.
def per_object_inputs(m):
    for n in m.node_tree.nodes:
        if n.bl_idname == 'ShaderNodeObjectInfo' and any(o.is_linked for o in n.outputs): return True
        if n.bl_idname == 'ShaderNodeTexCoord' and any(n.outputs[k].is_linked for k in ('Generated', 'Object')): return True
        if n.bl_idname == 'ShaderNodeAttribute' and n.attribute_type in ('OBJECT', 'INSTANCER'): return True
    return False
links = {l.light_linking.receiver_collection for l in bpy.data.objects} | {l.light_linking.blocker_collection for l in bpy.data.objects}
links.discard(None)
def signature(ob):
    return (tuple(sorted(c.name for c in ob.users_collection)), ob.light_linking.receiver_collection, ob.light_linking.blocker_collection,
            tuple(sorted((c.name, next(co.light_linking.link_state for o2, co in zip(c.objects, c.collection_objects) if o2 == ob)) for c in links if ob.name in c.objects)),
            tuple(getattr(ob, a) for a in ('visible_camera', 'visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_shadow', 'is_holdout')),
            tuple(u.name for u in ob.data.uv_layers), next((u.name for u in ob.data.uv_layers if u.active_render), None),
            any(per_object_inputs(sl.material) for sl in ob.material_slots if sl.material))
groups = {}
for ob in objects: groups.setdefault(signature(ob), []).append(ob)
joined = []
for sig, members in groups.items():
    if len(members) == 1 or sig[-1]: joined += members; continue
    for ob in members:
        for sl in ob.material_slots:
            if sl.link == 'OBJECT': m = sl.material; sl.link = 'DATA'; sl.material = m
    bpy.ops.object.select_all(action='DESELECT')
    for ob in members: ob.select_set(True)
    bpy.context.view_layer.objects.active = members[0]
    bpy.ops.object.join(); joined.append(members[0])
    members[0].data.uv_layers.active = members[0].data.uv_layers['SurfaceBake']
    if sig[6]: members[0].data.uv_layers[sig[6]].active_render = True
print('SB_JOIN', len(objects), '->', len(joined), flush=True)
objects = joined

prefs = bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type = 'OPTIX'; prefs.get_devices()
for d in prefs.devices: d.use = d.type == 'OPTIX'
s.render.engine = 'CYCLES'; s.cycles.device = 'GPU'; s.cycles.samples = SAMPLES; s.render.use_persistent_data = True
b = s.render.bake; b.margin = max(1, int(LAYOUT['pad'] * min(IMG_W / W, IMG_H / H))); b.margin_type = 'EXTEND'; b.use_selected_to_active = False; b.view_from = VIEW_FROM; b.use_clear = True
for key in ('use_pass_direct', 'use_pass_indirect', 'use_pass_color', 'use_pass_diffuse', 'use_pass_glossy', 'use_pass_transmission', 'use_pass_emit'):
    setattr(b, key, True)
cd = bpy.data.cameras.new('SB bake view'); cd.sensor_fit = 'VERTICAL'; cd.sensor_height = 24; cd.lens = 12 / math.tan(math.radians(20))
cam = bpy.data.objects.new('SB bake view', cd); s.collection.objects.link(cam); s.camera = cam
EYE = tuple(map(float, flag('--eye').split(','))) if flag('--eye') else SRC['bakeEye']  # test candidates only
cam.location = EYE; cam.rotation_euler = (Vector(SRC['bakeTarget']) - cam.location).to_track_quat('-Z', 'Y').to_euler()

if REPLAY:
    # Validation only: the baked radiance as pure emission on the same UVs, rendered at a reference pose.
    # If the bake missed a camera-visible branch (e.g. Light Path > Is Camera Ray), this render differs from the source render.
    eye, target, fov, w, h = SPEC['poses'][REPLAY]
    m = bpy.data.materials.new('SB | replay'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(str(OUT / f'bake{TAG}.exr')); tex.image.colorspace_settings.name = 'Linear Rec.709'; tex.interpolation = 'Linear'
    uv = nt.nodes.new('ShaderNodeUVMap'); uv.uv_map = 'SurfaceBake'; nt.links.new(uv.outputs['UV'], tex.inputs['Vector'])
    em = nt.nodes.new('ShaderNodeEmission'); nt.links.new(tex.outputs['Color'], em.inputs['Color'])
    out = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    for ob in objects:
        ob.visible_diffuse = ob.visible_glossy = ob.visible_transmission = ob.visible_shadow = False  # seen only by the camera
        for sl in ob.material_slots: sl.link = 'OBJECT'; sl.material = m
    cd.lens = 12 / math.tan(math.radians(fov / 2)); cam.location = eye; cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    s.render.resolution_x, s.render.resolution_y, s.render.resolution_percentage = w, h, 100; s.cycles.samples = 128; s.cycles.use_denoising = True; s.render.use_compositing = False
    st = s.render.image_settings; st.file_format = 'PNG'; st.color_mode = 'RGB'; st.color_depth = '8'
    (OUT / 'reference').mkdir(exist_ok=True); s.render.filepath = str(OUT / 'reference' / f'{REPLAY}-replay{TAG}.png'); bpy.ops.render.render(write_still=True)
    print('SB_REPLAY_DONE', REPLAY, flush=True); sys.exit(0)

image = bpy.data.images.new(f'{ITEM} surface', width=IMG_W, height=IMG_H, alpha=False, float_buffer=True)
image.colorspace_settings.name = 'Linear Rec.709'
# Empty slots render with Blender's default surface; give them that surface so the bake does not skip the object.
default = None
for ob in objects:
    for sl in ob.material_slots:
        if sl.material is None:
            default = default or bpy.data.materials.new('SB | default surface for empty slot'); sl.material = default
materials = {sl.material for ob in objects for sl in ob.material_slots if sl.material}
for m in materials:
    node = m.node_tree.nodes.new('ShaderNodeTexImage'); node.image = image; m.node_tree.nodes.active = node
bpy.ops.object.select_all(action='DESELECT')
for ob in objects: ob.select_set(True)
assert all(ob.select_get() for ob in objects), 'a bake object could not be selected'
bpy.context.view_layer.objects.active = objects[0]
t = time.time(); print('SB_BAKE_START', ITEM, W, H, SAMPLES, flush=True)
bpy.ops.object.bake(type='COMBINED')
elapsed = time.time() - t
px = np.empty(IMG_W * IMG_H * 4, np.float32); image.pixels.foreach_get(px)
assert px.reshape(-1, 4)[:, :3].max() > 0, 'bake produced an empty image'
st = s.render.image_settings
st.file_format = 'OPEN_EXR'; st.color_depth = '32'; st.color_mode = 'RGB'; st.exr_codec = 'ZIP'
image.save_render(str(OUT / f'bake{TAG}.exr'), scene=s)
st.file_format = 'PNG'; st.color_depth = '16'
image.save_render(str(OUT / f'bake-display{TAG}.png'), scene=s)  # source view transform, look and exposure applied once
assert sha(SRC['master']) == master_hash
info = {'item': ITEM, 'atlas': [W, H], 'imageSize': [IMG_W, IMG_H], 'margin': b.margin, 'samples': SAMPLES, 'seconds': round(elapsed, 1), 'maxMatchDistance': worst, 'looseMatches': loose, 'objects': report,
        'materials': sorted(m.name for m in materials), 'view': [s.view_settings.view_transform, s.view_settings.look, s.view_settings.exposure],
        'eye': list(EYE), 'viewFrom': VIEW_FROM, 'blend': bpy.data.filepath, 'masterSha256': master_hash}
(OUT / f'bake{TAG}.json').write_text(json.dumps(info, indent=1)); print('SB_BAKE_DONE', json.dumps(info), flush=True)
