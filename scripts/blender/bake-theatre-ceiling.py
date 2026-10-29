"""Standard PBR normal/material export + one diffuse lightmap, not angular captures."""
import bpy, json, math
import numpy as np
from pathlib import Path
from mathutils import Matrix

ROOT=Path('D:/New folio/new site code/new_site_three')
P=Path('D:/CodexOutputs/Theatre_Ceiling_PBR_20261023')
bpy.ops.wm.open_mainfile(filepath=str(P/'Ceiling_PBR_prepared.blend'),load_ui=False)
s=bpy.context.scene;objects=sorted([o for o in s.objects if o.name.startswith('Ceiling PBR | ')],key=lambda o:o.name)
assert len(objects)==10
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='OPTIX'
s.cycles.device='GPU';s.cycles.samples=192;s.cycles.use_denoising=True
def save(image,path,hdr=False):
    image.filepath_raw=str(path);image.file_format='OPEN_EXR' if hdr else 'PNG'
    if hdr:
        s.render.image_settings.file_format='OPEN_EXR';s.render.image_settings.color_depth='16';s.render.image_settings.color_mode='RGB';s.render.image_settings.exr_codec='ZIP'
        image.save_render(str(path),scene=s)
    else:image.save()
def bake(label,kind,size,**args):
    path=P/(label+('.exr' if label=='irradiance' else '.png'))
    if path.exists():print('CEILING_BAKE_CACHED',label,flush=True);return
    image=bpy.data.images.new('CEILING '+label,width=size,height=size,alpha=False,float_buffer=True)
    image.colorspace_settings.name='Linear Rec.709' if label=='irradiance' else 'Non-Color'
    for obj in objects:
        for mat in obj.data.materials:
            nt=mat.node_tree;node=nt.nodes.get('CEILING_BAKE_TARGET') or nt.nodes.new('ShaderNodeTexImage');node.name='CEILING_BAKE_TARGET';node.image=image;nt.nodes.active=node
    for i,obj in enumerate(objects):
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
        s.render.bake.use_clear=i==0
        print('CEILING_BAKE',label,i+1,obj['source_object'],flush=True)
        bpy.ops.object.bake(type=kind,**args)
    pixels=np.empty(len(image.pixels),np.float32);image.pixels.foreach_get(pixels)
    assert np.any(pixels.reshape(-1,4)[:,:3]>1e-5),'Empty ceiling bake'
    save(image,path,label=='irradiance')
    print('CEILING_BAKE_COMPLETE',label,flush=True)

# Source-room direct and bounced diffuse illumination, without base colour.
s.render.bake.use_pass_direct=True;s.render.bake.use_pass_indirect=True;s.render.bake.use_pass_color=False
bake('irradiance','DIFFUSE',2048)
bake('normal','NORMAL',2048,normal_space='TANGENT',normal_r='POS_X',normal_g='POS_Y',normal_b='POS_Z')

# Render the original ceiling in the full original room from the web camera.
s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGB';s.render.image_settings.color_depth='8'
s.render.resolution_x=1920;s.render.resolution_y=1080
if not (P/'blender-reference.png').exists():
    s.render.filepath=str(P/'blender-reference.png');bpy.ops.render.render(write_still=True)

# One small local environment for broad matte-plaster specular response.
original_camera=s.camera
data=bpy.data.cameras.new('Ceiling local reflection environment');data.type='PANO';data.panorama_type='EQUIRECTANGULAR';data.clip_start=.01
probe=bpy.data.objects.new('Ceiling local reflection environment',data);s.collection.objects.link(probe)
probe.location=(0,10.75,6.2);probe.rotation_euler=(math.radians(90),0,math.radians(-90));s.camera=probe
s.render.resolution_x=1024;s.render.resolution_y=512;s.cycles.samples=128
s.render.image_settings.file_format='OPEN_EXR';s.render.image_settings.color_depth='16';s.render.image_settings.color_mode='RGB';s.render.image_settings.exr_codec='ZIP'
if not (P/'environment.exr').exists():
    s.render.filepath=str(P/'environment.exr');bpy.ops.render.render(write_still=True)
s.camera=original_camera;bpy.data.objects.remove(probe,do_unlink=True)

# Reviewable copy retains the original room. Only ceiling copies have new UVs.
for obj in objects:
    for mat in obj.data.materials:
        node=mat.node_tree.nodes.get('CEILING_BAKE_TARGET')
        if node:mat.node_tree.nodes.remove(node)
bpy.ops.wm.save_as_mainfile(filepath=str(P/'Ceiling_PBR_baked.blend'),compress=True)

# Export geometry and material constants. Maps stay separately addressable.
export=bpy.data.scenes.new('Ceiling ONLY export');bpy.context.window.scene=export
materials={};items=[]
for src in objects:
    mesh=src.data.copy()
    uv=np.empty(len(mesh.loops)*2,np.float32);mesh.uv_layers['CeilingLightmap'].data.foreach_get('uv',uv)
    for layer in list(mesh.uv_layers):mesh.uv_layers.remove(layer)
    mesh.uv_layers.new(name='CeilingSurfaceUV').data.foreach_set('uv',uv)
    mesh.uv_layers.new(name='CeilingLightmapUV').data.foreach_set('uv',uv)
    mesh.uv_layers.active=mesh.uv_layers['CeilingSurfaceUV'];mesh.uv_layers['CeilingSurfaceUV'].active_render=True
    original_materials=list(mesh.materials);mesh.materials.clear()
    for mat in original_materials:
        bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        key=mat.name.split('.00')[0]
        if key not in materials:
            m=bpy.data.materials.new(key+' | Web PBR');m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
            for name in ('Base Color','Metallic','Roughness','IOR','Emission Color','Emission Strength'):
                assert not bs.inputs[name].is_linked,'Unexpected procedural PBR input '+name
                p.inputs[name].default_value=bs.inputs[name].default_value
            materials[key]=m
        mesh.materials.append(materials[key])
    item=bpy.data.objects.new(src['source_object'],mesh);export.collection.objects.link(item);item.matrix_world=Matrix.Translation((.010995,-26,.02))@src.matrix_world;items.append(item)
bpy.ops.object.select_all(action='DESELECT')
for obj in items:obj.select_set(True)
bpy.context.view_layer.objects.active=items[0]
bpy.ops.object.join()
bpy.context.object.name='THEATRE | Ceiling PBR';bpy.context.object['scope']='ceiling-only'
bpy.ops.export_scene.gltf(filepath=str(P/'ceiling.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_animations=False,export_cameras=False,export_lights=False,export_extras=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=10,export_draco_position_quantization=24,export_draco_normal_quantization=12,export_draco_texcoord_quantization=20)
print('CEILING_PBR_EXPORT_COMPLETE',flush=True)
