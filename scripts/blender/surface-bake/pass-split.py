"""Diagnosis: split an item's appearance at one pose into Cycles light passes (wall mask only).

Shows how much of the target's brightness at that pose is view-dependent (glossy) versus emission/diffuse, i.e. what a
single-viewpoint bake can and cannot carry to other views. Opens the item's disposable source copy; never saves.
Usage: blender -b --python pass-split.py -- <item> <pose>
"""
import bpy, json, math, sys, numpy as np, OpenImageIO as oiio
from mathutils import Vector
from pathlib import Path
item, pose = sys.argv[sys.argv.index('--') + 1:][:2]
REPO = Path('D:/New folio/new site code/new_site_three')
cfg = json.loads((REPO / 'scripts/surface-bake/items.json').read_text()); spec = cfg['items'][item]
src = dict(cfg['sources'][spec['source']]); src.update(spec.get('sourceOverride', {}))
ref = Path(cfg['authoringRoot']) / item / 'reference'
bpy.ops.wm.open_mainfile(filepath=src['blend'], load_ui=False)
s = bpy.context.scene; s.frame_set(src.get('frame', 1)); s.render.use_compositing = False
eye, tgt, fov, w, h = spec['poses'][pose]
cd = bpy.data.cameras.new('split'); cd.sensor_fit = 'VERTICAL'; cd.sensor_height = 24; cd.lens = 12 / math.tan(math.radians(fov / 2))
c = bpy.data.objects.new('split', cd); s.collection.objects.link(c); s.camera = c
c.location = eye; c.rotation_euler = (Vector(tgt) - c.location).to_track_quat('-Z', 'Y').to_euler()
s.render.resolution_x, s.render.resolution_y, s.render.resolution_percentage = w, h, 100
s.render.engine = 'CYCLES'; s.cycles.samples = 128; s.cycles.use_denoising = False
p = bpy.context.preferences.addons['cycles'].preferences; p.compute_device_type = 'OPTIX'; p.get_devices()
for d in p.devices: d.use = d.type == 'OPTIX'
s.cycles.device = 'GPU'
vl = next(v for v in s.view_layers if v.use)
for k in ('use_pass_combined', 'use_pass_diffuse_direct', 'use_pass_diffuse_indirect', 'use_pass_diffuse_color', 'use_pass_glossy_direct',
          'use_pass_glossy_indirect', 'use_pass_glossy_color', 'use_pass_emit'): setattr(vl, k, True)
st = s.render.image_settings; st.media_type = 'MULTI_LAYER_IMAGE'; st.file_format = 'OPEN_EXR_MULTILAYER'; st.color_depth = '32'
out = ref / f'{pose}-passes.exr'; s.render.filepath = str(out); bpy.ops.render.render(write_still=True)
mask = oiio.ImageBuf(str(ref / f'{pose}-mask.png')).get_pixels(oiio.FLOAT)[..., 0] > .5
buf = oiio.ImageBuf(str(out)); names = buf.spec().channelnames; px = buf.get_pixels(oiio.FLOAT)
def layer(n):
    idx = [names.index(f'{vl.name}.{n}.{ch}') for ch in 'RGB']; return px[..., idx]
dif = layer('DiffDir') * layer('DiffCol') + layer('DiffInd') * layer('DiffCol')
glo = layer('GlossDir') * layer('GlossCol') + layer('GlossInd') * layer('GlossCol')
emi = layer('Emit'); comb = layer('Combined')
lum = lambda a: float((a[mask] @ np.array([.2126, .7152, .0722])).mean())
rep = {'item': item, 'pose': pose, 'maskPixels': int(mask.sum()), 'linearLuminance': {'combined': lum(comb), 'diffuse': lum(dif), 'glossy': lum(glo), 'emission': lum(emi)}}
rep['glossyShare'] = round(rep['linearLuminance']['glossy'] / max(rep['linearLuminance']['combined'], 1e-9), 3)
(ref / f'{pose}-passes.json').write_text(json.dumps(rep, indent=1)); print('PASSES', json.dumps(rep), flush=True)
