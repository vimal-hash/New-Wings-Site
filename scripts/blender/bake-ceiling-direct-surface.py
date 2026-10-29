"""Bake source Blender materials directly to repaired surface UVs, without render projection."""
import bpy,bmesh,numpy as np,json
from pathlib import Path
P=Path('D:/CodexOutputs/Theatre_Ceiling_PBR_20261023')
bpy.ops.wm.open_mainfile(filepath=str(P/'Ceiling_PBR_prepared.blend'),load_ui=False)
ref=json.loads((P/'cove-uv-refinement.json').read_text());bpy.data.objects[ref['object']].data.uv_layers['CeilingLightmap'].data.foreach_set('uv',np.array(ref['new']).ravel())
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=256;s.cycles.use_denoising=True
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='OPTIX'
s.cycles.device='GPU';s.render.use_persistent_data=True
s.render.bake.margin=24;s.render.bake.margin_type='ADJACENT_FACES';s.render.bake.use_selected_to_active=False;s.render.bake.view_from='ACTIVE_CAMERA'
for key in ('use_pass_direct','use_pass_indirect','use_pass_color','use_pass_diffuse','use_pass_glossy','use_pass_transmission','use_pass_emit'):setattr(s.render.bake,key,True)
objects=sorted([ob for ob in s.objects if ob.name.startswith('Ceiling PBR | ')],key=lambda ob:ob.name)
# This source closure faces outwards; bake its visible room-facing side only.
closure=bpy.data.objects['Ceiling PBR | HALO II | Wall crown closure.001'];bm=bmesh.new();bm.from_mesh(closure.data);bmesh.ops.reverse_faces(bm,faces=list(bm.faces));bm.to_mesh(closure.data);bm.free();closure.data.update()
image=bpy.data.images.new('Ceiling direct surface combined',width=4096,height=4096,alpha=False,float_buffer=True);image.colorspace_settings.name='Linear Rec.709'
for ob in objects:
 ob.data.uv_layers.active=ob.data.uv_layers['CeilingLightmap'];ob.data.uv_layers['CeilingLightmap'].active_render=True
 for mat in ob.data.materials:
  node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;mat.node_tree.nodes.active=node
for i,ob in enumerate(objects):
 bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob;s.render.bake.use_clear=i==0
 print('DIRECT_SURFACE_BAKE',i+1,len(objects),ob.name,flush=True);bpy.ops.object.bake(type='COMBINED')
s.render.image_settings.file_format='OPEN_EXR';s.render.image_settings.color_depth='16';s.render.image_settings.color_mode='RGB';s.render.image_settings.exr_codec='ZIP';image.save_render(str(P/'ceiling-direct-surface.exr'),scene=s)
s.render.image_settings.file_format='PNG';s.render.image_settings.color_depth='8';image.save_render(str(P/'ceiling-direct-surface.png'),scene=s)
print('DIRECT_SURFACE_COMPLETE',flush=True)
