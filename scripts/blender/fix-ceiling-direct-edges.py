"""Rebake only the room-facing crown closure; preserve runtime geometry and other charts."""
import bpy,bmesh,json,numpy as np
from pathlib import Path
P=Path('D:/CodexOutputs/Theatre_Ceiling_PBR_20261023')
bpy.ops.wm.open_mainfile(filepath=str(P/'Ceiling_PBR_prepared.blend'),load_ui=False)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=256;s.render.use_persistent_data=True
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='OPTIX'
s.cycles.device='GPU'
ob=bpy.data.objects['Ceiling PBR | HALO II | Wall crown closure.001']
bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.reverse_faces(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free();ob.data.update()
ob.data.uv_layers.active=ob.data.uv_layers['CeilingLightmap'];ob.data.uv_layers['CeilingLightmap'].active_render=True
image=bpy.data.images.load(str(P/'ceiling-direct-surface.exr'),check_existing=False);image.colorspace_settings.name='Linear Rec.709'
for mat in ob.data.materials:
 node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;mat.node_tree.nodes.active=node
bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
s.render.bake.use_clear=False;s.render.bake.use_selected_to_active=False;s.render.bake.view_from='ACTIVE_CAMERA';s.render.bake.margin=24;s.render.bake.margin_type='ADJACENT_FACES'
for key in ('use_pass_direct','use_pass_indirect','use_pass_color','use_pass_diffuse','use_pass_glossy','use_pass_transmission','use_pass_emit'):setattr(s.render.bake,key,True)
print('ROOM_FACING_CLOSURE_BAKE_START',flush=True);bpy.ops.object.bake(type='COMBINED')
s.render.image_settings.file_format='OPEN_EXR';s.render.image_settings.color_depth='16';s.render.image_settings.color_mode='RGB';s.render.image_settings.exr_codec='ZIP';image.save_render(str(P/'ceiling-edge-source.exr'),scene=s)
print('ROOM_FACING_CLOSURE_BAKE_COMPLETE',flush=True)
