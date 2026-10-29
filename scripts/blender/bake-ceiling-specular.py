"""One active-camera glossy pass for the approved grazing ceiling view."""
import bpy,numpy as np,sys
from pathlib import Path
P=Path('D:/CodexOutputs/Theatre_Ceiling_PBR_20261023')
bpy.ops.wm.open_mainfile(filepath=str(P/'Ceiling_PBR_prepared.blend'),load_ui=False)
s=bpy.context.scene
s.render.use_persistent_data=True
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='OPTIX'
diffuse='--diffuse' in sys.argv
flat='--flat' in sys.argv
label=('irradiance-flat' if flat else 'irradiance-camera') if diffuse else ('specular-flat' if flat else 'specular')
s.cycles.device='GPU';s.cycles.samples=512 if diffuse else 384;s.render.bake.view_from='ACTIVE_CAMERA'
s.render.bake.use_pass_direct=True;s.render.bake.use_pass_indirect=True;s.render.bake.use_pass_color=not diffuse
objects=sorted([o for o in s.objects if o.name.startswith('Ceiling PBR | ')],key=lambda o:o.name)
image=bpy.data.images.new('Ceiling approved-camera '+label,width=2048 if diffuse else 1024,height=2048 if diffuse else 1024,alpha=False,float_buffer=True);image.colorspace_settings.name='Linear Rec.709'
for obj in objects:
    for mat in obj.data.materials:
        if flat:
            bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
            for link in list(bs.inputs['Normal'].links):mat.node_tree.links.remove(link)
        nt=mat.node_tree;node=nt.nodes.new('ShaderNodeTexImage');node.image=image;nt.nodes.active=node
for i,obj in enumerate(objects):
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    s.render.bake.use_clear=i==0;s.render.bake.margin=8
    print('CEILING_CAMERA_GLOSSY',i+1,obj['source_object'],flush=True)
    bpy.ops.object.bake(type='DIFFUSE' if diffuse else 'GLOSSY')
s.render.image_settings.file_format='OPEN_EXR';s.render.image_settings.color_depth='16';s.render.image_settings.color_mode='RGB';s.render.image_settings.exr_codec='ZIP'
image.save_render(str(P/(label+'.exr')),scene=s)
print('CEILING_CAMERA_GLOSSY_COMPLETE',flush=True)
