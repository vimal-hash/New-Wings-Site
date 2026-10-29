"""Reference captures only. Never save source or export/change scene assets."""
import bpy,math,json
from mathutils import Vector
from pathlib import Path
P=Path('D:/New folio/new site code/new_site_three/docs/left-wall-handoff')
bpy.ops.wm.open_mainfile(filepath='D:/CodexOutputs/Theatre_Optimization_20261017/Theatre_Moon_Projector_optimized.blend',load_ui=False)
s=bpy.context.scene;s.frame_set(1);s.render.engine='CYCLES';s.cycles.samples=128;s.cycles.use_denoising=True;s.render.use_compositing=False
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='OPTIX'
s.cycles.device='GPU';s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGB';s.render.image_settings.color_depth='8';s.render.resolution_percentage=100
cd=bpy.data.cameras.new('Temporary handoff reference');cd.sensor_fit='VERTICAL';cd.sensor_height=24
cam=bpy.data.objects.new('Temporary handoff reference',cd);s.collection.objects.link(cam);s.camera=cam
captures=[]
for name,target,fov,width,height in [('blender-opening.png',(0,.802,3.22),40,1600,788),('blender-left-wall.png',(6,10,3.45),48,1600,900)]:
 cam.location=(0,22.2,3.22);cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cd.lens=12/math.tan(math.radians(fov/2));s.render.resolution_x=width;s.render.resolution_y=height;s.render.filepath=str(P/name)
 bpy.ops.render.render(write_still=True);captures.append({'file':name,'position':list(cam.location),'target':target,'verticalFov':fov,'resolution':[width,height]})
(P/'camera-reference.json').write_text(json.dumps(captures,indent=2));print('HANDOFF_REFERENCES_DONE',flush=True)
