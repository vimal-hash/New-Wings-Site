"""Ceiling-only PBR export copy: source meshes/materials are never saved over."""
import bpy, json, math, struct, hashlib, sys
import numpy as np
from pathlib import Path
from mathutils import Matrix, Vector

ROOT=Path('D:/New folio/new site code/new_site_three')
OUT=Path('D:/CodexOutputs/Theatre_Ceiling_PBR_20261023');OUT.mkdir(parents=True,exist_ok=True)
AUDIT=ROOT/'docs/theatre-ceiling-audit'
SOURCE='D:/CodexOutputs/Theatre_Optimization_20261017/Theatre_Moon_Projector_optimized.blend'
T=Matrix.Translation((.010995,-26,.02))
bpy.ops.wm.open_mainfile(filepath=SOURCE,load_ui=False)
s=bpy.context.scene;s.frame_set(1)
dg=bpy.context.evaluated_depsgraph_get()
inventory=json.loads((AUDIT/'source-inventory.json').read_text())
names=[o['name'] for o in inventory['objects'] if o['bounds'][2][0]>6]
assert len(names)==10
def signature(obj):
    mesh=bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()),preserve_all_data_layers=True,depsgraph=bpy.context.evaluated_depsgraph_get())
    mesh.transform(obj.matrix_world);mesh.calc_loop_triangles()
    h=hashlib.sha256()
    for v in mesh.vertices:h.update(struct.pack('<3f',*v.co))
    for p in mesh.polygons:h.update(struct.pack('<'+'I'*len(p.vertices),*p.vertices))
    result={'sha256':h.hexdigest(),'triangles':len(mesh.loop_triangles)}
    bpy.data.meshes.remove(mesh);return result
before={name:signature(bpy.data.objects[name]) for name in names}
others={o.name:{'matrix':list(v for row in o.matrix_world for v in row),'hide':o.hide_render,'materials':[m.name if m else None for m in o.data.materials]} for o in s.objects if o.name not in names and o.type in ('MESH','CURVE')}
copies=[]
for name in names:
    src=bpy.data.objects[name]
    mesh=bpy.data.meshes.new_from_object(src.evaluated_get(dg),preserve_all_data_layers=True,depsgraph=dg)
    obj=bpy.data.objects.new('Ceiling PBR | '+name,mesh)
    # Ceiling softboxes use receiver-collection light linking. A root-only copy
    # would lose that illumination even with identical material properties.
    for collection in src.users_collection:collection.objects.link(obj)
    for flag in ('visible_camera','visible_diffuse','visible_glossy','visible_transmission','visible_volume_scatter','visible_shadow'):setattr(obj,flag,getattr(src,flag))
    obj.matrix_world=src.matrix_world.copy();obj['source_object']=name
    original_uv=next((u.name for u in mesh.uv_layers if u.active_render),None)
    for i,mat in enumerate(list(mesh.materials)):
        mat=mat.copy();mesh.materials[i]=mat;nt=mat.node_tree
        # Preserve native material coordinates before changing the active UV.
        targets=[l.to_socket for l in nt.links if l.from_node.type=='TEX_COORD' and l.from_socket.name=='UV']
        targets += [n.inputs['Vector'] for n in nt.nodes if n.type=='TEX_IMAGE' and not n.inputs['Vector'].is_linked]
        if original_uv:
            for socket in targets:
                uv=nt.nodes.new('ShaderNodeUVMap');uv.uv_map=original_uv;nt.links.new(uv.outputs['UV'],socket)
        for node in nt.nodes:
            if node.type=='NORMAL_MAP' and node.space=='TANGENT' and not node.uv_map:node.uv_map=original_uv or ''
    src.hide_render=True
    mesh.uv_layers.new(name='CeilingLightmap');mesh.uv_layers.active=mesh.uv_layers['CeilingLightmap'];mesh.uv_layers['CeilingLightmap'].active_render=True
    copies.append(obj)

# Multi-object projection + packing shares one atlas, with a 12px gutter at 2K.
bpy.ops.object.select_all(action='DESELECT')
for obj in copies:obj.select_set(True)
bpy.context.view_layer.objects.active=copies[0]
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.006,area_weight=1,correct_aspect=True,scale_to_bounds=False)
bpy.ops.uv.pack_islands(rotate=True,margin_method='FRACTION',margin=.006,scale=True)
bpy.ops.object.mode_set(mode='OBJECT')
report=[]
for obj in copies:
    name=obj['source_object'];assert signature(obj)==before[name],'Ceiling geometry changed during unwrap'
    uv=np.empty(len(obj.data.loops)*2,np.float32);obj.data.uv_layers['CeilingLightmap'].data.foreach_get('uv',uv)
    report.append({'source':name,**before[name],'uvMin':float(uv.min()),'uvMax':float(uv.max()),'uvFaces':len(obj.data.polygons)})
    assert uv.min()>=-1e-6 and uv.max()<=1+1e-6
after={o.name:{'matrix':list(v for row in o.matrix_world for v in row),'hide':o.hide_render,'materials':[m.name if m else None for m in o.data.materials]} for o in s.objects if o.name in others}
assert after==others,'Non-ceiling object state changed'
data=bpy.data.cameras.new('Ceiling matched reference');data.sensor_fit='VERTICAL';data.sensor_height=24;data.lens=12/math.tan(math.radians(20))
cam=bpy.data.objects.new('Ceiling matched reference',data);s.collection.objects.link(cam);cam.location=(0,22.2,3.22);cam.rotation_euler=(Vector((0,.802,3.22))-cam.location).to_track_quat('-Z','Y').to_euler();s.camera=cam
s.render.resolution_x=1920;s.render.resolution_y=1080;s.render.resolution_percentage=100
s.render.engine='CYCLES';s.cycles.samples=128;s.cycles.use_denoising=True;s.render.use_compositing=False
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='OPTIX'
s.cycles.device='GPU';s.render.bake.margin=12;s.render.bake.margin_type='EXTEND';s.render.bake.use_selected_to_active=False
s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGB';s.render.image_settings.color_depth='8'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Ceiling_PBR_prepared.blend'),compress=True)
result={'source':SOURCE,'ceilingObjects':report,'triangles':sum(v['triangles'] for v in before.values()),'unchangedNonCeilingObjects':len(others),'view':{'transform':s.view_settings.view_transform,'look':s.view_settings.look,'exposure':s.view_settings.exposure},'atlas':2048,'gutterPixels':12}
(AUDIT/'preparation.json').write_text(json.dumps(result,indent=2))
print('CEILING_UV_PREPARED',result['triangles'],result['unchangedNonCeilingObjects'],flush=True)
