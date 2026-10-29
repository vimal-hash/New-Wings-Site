"""Correct room-facing illumination of the existing one-sided crown closure.
Only a background bake copy is flipped; runtime geometry and source stay intact.
"""
import bpy,bmesh
from pathlib import Path
P=Path('D:/CodexOutputs/Theatre_Ceiling_PBR_20261023')
bpy.ops.wm.open_mainfile(filepath=str(P/'Ceiling_PBR_prepared.blend'),load_ui=False)
s=bpy.context.scene;s.render.use_persistent_data=True
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='OPTIX'
s.cycles.device='GPU';s.cycles.samples=256
obj=bpy.data.objects['Ceiling PBR | HALO II | Wall crown closure.001'];bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.reverse_faces(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free();obj.data.update()
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
s.render.bake.view_from='ACTIVE_CAMERA';s.render.bake.margin=8;s.render.bake.margin_type='ADJACENT_FACES';s.render.bake.use_clear=False
s.render.bake.use_pass_direct=True;s.render.bake.use_pass_indirect=True
for label,source,kind in [('irradiance-final','irradiance-stitched.exr','DIFFUSE'),('specular-final','specular-polished.exr','GLOSSY')]:
 image=bpy.data.images.load(str(P/source),check_existing=False);image.colorspace_settings.name='Linear Rec.709'
 for mat in obj.data.materials:
  nt=mat.node_tree;node=nt.nodes.new('ShaderNodeTexImage');node.image=image;nt.nodes.active=node
 s.render.bake.use_pass_color=kind!='DIFFUSE';bpy.ops.object.bake(type=kind)
 s.render.image_settings.file_format='OPEN_EXR';s.render.image_settings.color_depth='16';s.render.image_settings.color_mode='RGB';s.render.image_settings.exr_codec='ZIP';image.save_render(str(P/(label+'.exr')),scene=s)
 print('CROWN_EDGE_BAKED',label,flush=True)
