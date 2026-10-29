"""Matched Blender reference for one item and pose: Cycles beauty plus a target-object mask.

Opens the disposable copy (never saved). Pose: Blender eye, target, vertical FOV, resolution.
Mask: Workbench flat render, target objects white and everything else black, so occlusion matches the beauty.
Usage: blender -b --python render-reference.py -- <item> <pose> ex ey ez tx ty tz fov w h [samples]
"""
import bpy, json, math, sys
from mathutils import Vector
from pathlib import Path
a = sys.argv[sys.argv.index('--') + 1:]
item, pose = a[0], a[1]; eye = tuple(map(float, a[2:5])); tgt = tuple(map(float, a[5:8])); fov = float(a[8]); w, h = int(a[9]), int(a[10])
samples = int(a[11]) if len(a) > 11 else 128
REPO = Path('D:/New folio/new site code/new_site_three')
cfg = json.loads((REPO / 'scripts/surface-bake/items.json').read_text()); spec = cfg['items'][item]; src = dict(cfg['sources'][spec['source']]); src.update(spec.get('sourceOverride', {}))
out = Path(cfg['authoringRoot']) / item / 'reference'; out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=src['blend'], load_ui=False)
s = bpy.context.scene; s.frame_set(src.get('frame', 1)); s.render.use_compositing = False
cd = bpy.data.cameras.new('ref'); cd.sensor_fit = 'VERTICAL'; cd.sensor_height = 24; cd.lens = 12 / math.tan(math.radians(fov / 2))
c = bpy.data.objects.new('ref', cd); s.collection.objects.link(c); s.camera = c
c.location = eye; c.rotation_euler = (Vector(tgt) - c.location).to_track_quat('-Z', 'Y').to_euler()
s.render.resolution_x = w; s.render.resolution_y = h; s.render.resolution_percentage = 100
for name in spec.get('unhideForBake', []): bpy.data.objects[name].hide_render = False  # same as the bake (disposable copy)
st = s.render.image_settings; st.file_format = 'PNG'; st.color_mode = 'RGB'; st.color_depth = '8'
s.render.engine = 'CYCLES'; s.cycles.samples = samples; s.cycles.use_denoising = True
p = bpy.context.preferences.addons['cycles'].preferences; p.compute_device_type = 'OPTIX'; p.get_devices()
for d in p.devices: d.use = d.type == 'OPTIX'
s.cycles.device = 'GPU'
# The beauty render depends only on the scene and pose, so items sharing a pose reuse one render.
import hashlib, shutil
shared = Path(cfg['authoringRoot']) / '_shared' / (hashlib.sha1(json.dumps([src['blend'], eye, tgt, fov, w, h, samples]).encode()).hexdigest()[:16] + '.png')
if not shared.exists():
    shared.parent.mkdir(exist_ok=True); s.render.filepath = str(shared); bpy.ops.render.render(write_still=True)
shutil.copyfile(shared, out / f'{pose}-blender.png')
targets = set(spec['objects'])
# Mask only: render-hidden objects inside maskOccluderRegion (e.g. the projector standing on its floor at runtime) occlude the target.
if spec.get('maskOccluderRegion'):
    lo, hi = spec['maskOccluderRegion']
    for o in s.objects:
        if o.type != 'MESH': continue
        t = sum((o.matrix_world @ Vector(c) for c in o.bound_box), Vector()) / 8
        if o.type == 'MESH' and o.hide_render and o.name not in targets and all(lo[k] <= t[k] <= hi[k] for k in range(3)): o.hide_render = False
for o in s.objects: o.color = (1, 1, 1, 1) if o.name in targets else (0, 0, 0, 1)
s.render.engine = 'BLENDER_WORKBENCH'; sh = s.display.shading
sh.light = 'FLAT'; sh.color_type = 'OBJECT'; sh.background_type = 'VIEWPORT'; sh.background_color = (0, 0, 0)
sh.show_shadows = False; sh.show_cavity = False; sh.show_object_outline = False; sh.show_specular_highlight = False
s.view_settings.view_transform = 'Standard'; s.view_settings.look = 'None'; s.view_settings.exposure = 0; s.render.film_transparent = False
s.render.filepath = str(out / f'{pose}-mask.png'); bpy.ops.render.render(write_still=True)
print('REF_DONE', item, pose, flush=True)
