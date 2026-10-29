"""Left wall only: direct COMBINED surface bake of the source material, in a disposable copy.

Never saves any .blend. The wall keeps its source material, light linking, occluders and display
transform. A deterministic planar UV (shared with the runtime, see left-wall-uv.json) is added
to the evaluated wall mesh because the runtime GLB carries no UVs.
Env: LW_W, LW_H (atlas size), LW_SAMPLES, LW_TAG (output suffix).
"""
import bpy, json, math, os, hashlib, time
import numpy as np
from mathutils import Vector
from pathlib import Path

W_DIR = Path('D:/CodexOutputs/Theatre_LeftWall_Bake_20261023')
REPO = Path('D:/New folio/new site code/new_site_three')
SOURCE = Path('D:/CodexOutputs/Theatre_Optimization_20261017/Theatre_Moon_Projector_optimized.blend')
LAYOUT = json.loads((REPO / 'components/corridor/left-wall-uv.json').read_text())
WIDTH = int(os.environ.get('LW_W', LAYOUT['atlas'][0])); HEIGHT = int(os.environ.get('LW_H', LAYOUT['atlas'][1]))
SAMPLES = int(os.environ.get('LW_SAMPLES', 1024)); TAG = os.environ.get('LW_TAG', 'final')

def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 24), b''): h.update(b)
    return h.hexdigest()

def wall_uv(p, n):
    """Same rule as components/corridor/left-wall-uv.ts. p, n in Blender world space."""
    axis = max(range(3), key=lambda i: abs(n[i]))
    key = ('+' if n[axis] > 0 else '-') + 'XYZ'[axis]
    r = LAYOUT['regions'][key]; b = LAYOUT['bounds']
    s = [(p[i] - b[0][i]) / (b[1][i] - b[0][i]) for i in range(3)]
    a, c = r['axes']
    u = r['box'][0] + s[a] * (r['box'][2] - r['box'][0])
    v = r['box'][1] + s[c] * (r['box'][3] - r['box'][1])
    return u / LAYOUT['atlas'][0], v / LAYOUT['atlas'][1], key

source_hash = sha(SOURCE)
bpy.ops.wm.open_mainfile(filepath=str(W_DIR / 'LeftWall_work_copy.blend'), load_ui=False)
s = bpy.context.scene; s.frame_set(1)
wall = bpy.data.objects[LAYOUT['blenderObject']]

# Freeze the evaluated wall (bevel + weighted normals) so bake geometry equals runtime geometry.
dg = bpy.context.evaluated_depsgraph_get()
mesh = bpy.data.meshes.new_from_object(wall.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
old = wall.data; wall.modifiers.clear(); wall.data = mesh
mesh.calc_loop_triangles()
assert len(mesh.loop_triangles) == LAYOUT['triangles'], len(mesh.loop_triangles)
mw = wall.matrix_world; nm = mw.to_3x3().inverted().transposed()
render_uv = next(u for u in mesh.uv_layers if u.active_render).name
bake = mesh.uv_layers.new(name='LeftWallBake')
mesh.uv_layers[render_uv].active_render = True; mesh.uv_layers.active = bake
counts = {}
for poly in mesh.polygons:
    n = (nm @ poly.normal).normalized()
    for li in poly.loop_indices:
        p = mw @ mesh.vertices[mesh.loops[li].vertex_index].co
        u, v, key = wall_uv(p, n); bake.data[li].uv = (u, v)
    counts[key] = counts.get(key, 0) + len(poly.vertices) - 2
room = [p for p in mesh.polygons if (nm @ p.normal).normalized().x < -0.99]
assert len(room) == 1 and room[0].area > 129, 'room-facing face must face -X (into the room)'

prefs = bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type = 'OPTIX'; prefs.get_devices()
for d in prefs.devices: d.use = d.type == 'OPTIX'
s.render.engine = 'CYCLES'; s.cycles.device = 'GPU'; s.cycles.samples = SAMPLES; s.render.use_persistent_data = True
s.render.bake.margin = 24; s.render.bake.margin_type = 'ADJACENT_FACES'; s.render.bake.use_selected_to_active = False
s.render.bake.view_from = 'ACTIVE_CAMERA'; s.render.bake.use_clear = True
for key in ('use_pass_direct', 'use_pass_indirect', 'use_pass_color', 'use_pass_diffuse', 'use_pass_glossy', 'use_pass_transmission', 'use_pass_emit'):
    setattr(s.render.bake, key, True)

# Glossy/sheen direction: the opening camera (same pose as the matched captures).
cd = bpy.data.cameras.new('LW bake view'); cd.sensor_fit = 'VERTICAL'; cd.sensor_height = 24; cd.lens = 12 / math.tan(math.radians(20))
cam = bpy.data.objects.new('LW bake view', cd); s.collection.objects.link(cam); s.camera = cam
cam.location = (0, 22.2, 3.22); cam.rotation_euler = (Vector((0, .802, 3.22)) - cam.location).to_track_quat('-Z', 'Y').to_euler()

image = bpy.data.images.new('Left wall direct', width=WIDTH, height=HEIGHT, alpha=False, float_buffer=True)
image.colorspace_settings.name = 'Linear Rec.709'
missing = []
for slot in wall.material_slots:
    tree = slot.material.node_tree
    for n in tree.nodes:
        if n.bl_idname == 'ShaderNodeTexImage' and n.image and not n.image.has_data and n.image.size[0] == 0: missing.append(n.image.name)
    node = tree.nodes.new('ShaderNodeTexImage'); node.image = image; tree.nodes.active = node
assert not missing, missing
bpy.ops.object.select_all(action='DESELECT'); wall.select_set(True); bpy.context.view_layer.objects.active = wall
t = time.time(); print('LW_BAKE_START', WIDTH, HEIGHT, SAMPLES, flush=True)
bpy.ops.object.bake(type='COMBINED')
elapsed = time.time() - t
s.render.image_settings.file_format = 'OPEN_EXR'; s.render.image_settings.color_depth = '32'; s.render.image_settings.color_mode = 'RGB'; s.render.image_settings.exr_codec = 'ZIP'
image.save_render(str(W_DIR / f'left-wall-{TAG}.exr'), scene=s)
s.render.image_settings.file_format = 'PNG'; s.render.image_settings.color_depth = '16'
image.save_render(str(W_DIR / f'left-wall-{TAG}-display.png'), scene=s)  # source AgX look + exposure, once
assert sha(SOURCE) == source_hash
report = {'tag': TAG, 'size': [WIDTH, HEIGHT], 'samples': SAMPLES, 'seconds': round(elapsed, 1), 'triangles': len(mesh.loop_triangles),
          'trianglesPerRegion': counts, 'renderUV': render_uv, 'view': [s.view_settings.view_transform, s.view_settings.look, s.view_settings.exposure],
          'roomFaceNormal': list((nm @ room[0].normal).normalized()), 'sourceSha256': source_hash}
(W_DIR / f'bake-{TAG}.json').write_text(json.dumps(report, indent=2)); print('LW_BAKE_DONE', json.dumps(report), flush=True)
