"""Render original Blender theatre from the settled web camera. Never save source."""
import bpy,math
from mathutils import Vector
from pathlib import Path
out=Path('D:/New folio/new site code/new_site_three/docs/theatre-ceiling-audit')
bpy.ops.wm.open_mainfile(filepath='D:/CodexOutputs/Theatre_Optimization_20261017/Theatre_Moon_Projector_optimized.blend',load_ui=False)
s=bpy.context.scene;s.frame_set(1)
data=bpy.data.cameras.new('Temporary matched web comparison');data.sensor_fit='VERTICAL';data.sensor_height=24;data.lens=12/math.tan(math.radians(82.5))
cam=bpy.data.objects.new('Temporary matched web comparison',data);s.collection.objects.link(cam);cam.location=(0,22.2,3.22);cam.rotation_euler=(Vector((0,.802,3.22))-cam.location).to_track_quat('-Z','Y').to_euler();s.camera=cam
s.render.resolution_x=3072;s.render.resolution_y=3072;s.render.resolution_percentage=100
s.render.engine='CYCLES';s.cycles.samples=256;s.cycles.use_denoising=True;s.render.use_compositing=False
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='OPTIX'
s.cycles.device='GPU';s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGB';s.render.image_settings.color_depth='8'
s.render.filepath=str(out/'blender-ceiling-extended.png');bpy.ops.render.render(write_still=True)
print('MATCHED_BLENDER_RENDER_SAVED',s.render.filepath,flush=True)


