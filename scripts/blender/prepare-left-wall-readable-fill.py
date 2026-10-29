"""Lighting preparation and reference renders ONLY. Claude performs the texture bake."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector
R=Path('D:/New folio/new site code/new_site_three');D=R/'docs/corridor-wall-red-refinement';P=Path('D:/CodexOutputs/Corridor_Left_Wall_Lighting_20261024');P.mkdir(exist_ok=True)
cfg=json.loads((R/'scripts/surface-bake/items.json').read_text());name=cfg['items']['corridor-wall-red']['objects'][0];source=cfg['sources']['corridor']['blend'];bpy.ops.wm.open_mainfile(filepath=source,load_ui=False);s=bpy.context.scene;ob=bpy.data.objects[name]
pose=json.loads((D/'page-pose.json').read_text());cd=bpy.data.cameras.new('REVIEW | Left wall page pose');cd.sensor_fit='VERTICAL';cd.sensor_height=24;cd.lens=12/math.tan(math.radians(20));cd.clip_start=.05;cd.clip_end=3000;cam=bpy.data.objects.new(cd.name,cd);s.collection.objects.link(cam);cam.location=pose['eye'];cam.rotation_euler=(Vector(pose['target'])-cam.location).to_track_quat('-Z','Y').to_euler();s.camera=cam;s.render.resolution_x=1280;s.render.resolution_y=630;s.render.resolution_percentage=100;s.render.engine='CYCLES';s.cycles.samples=128;s.cycles.use_denoising=True;s.render.use_compositing=False;s.render.use_persistent_data=True;s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGB';s.render.image_settings.color_depth='8'
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='OPTIX'
s.cycles.device='GPU';s.render.filepath=str(D/'blender-before.png');bpy.ops.render.render(write_still=True)
# Change ONLY this object's material copy. Source file and neighbouring wall/caps keep their materials.
original=ob.material_slots[0].material;mat=original.copy();mat.name='LEFT WALL | Soft readable charcoal fill';ob.material_slots[0].material=mat;nt=mat.node_tree
fade=next(n for n in nt.nodes if n.type=='MAP_RANGE' and 'dark bottom fade' in n.name);old_link=[(l.from_node.name,l.from_socket.name) for l in fade.inputs[0].links]
tex=nt.nodes.new('ShaderNodeTexCoord');tex.name='Refinement | wall-relative height';split=nt.nodes.new('ShaderNodeSeparateXYZ');split.name='Refinement | normalized wall height';nt.links.new(tex.outputs['Generated'],split.inputs[0]);nt.links.new(split.outputs['Z'],fade.inputs[0]);fade.inputs[1].default_value=.008;fade.inputs[2].default_value=.26;fade.inputs[3].default_value=0;fade.inputs[4].default_value=1;fade.interpolation_type='SMOOTHERSTEP'
# A restrained camera-visible ambient fill reveals the existing steel albedo without lighting other surfaces.
output=next(n for n in nt.nodes if n.type=='OUTPUT_MATERIAL');previous=output.inputs['Surface'].links[0].from_socket
bsdf=next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED');em=nt.nodes.new('ShaderNodeEmission');em.name='Refinement | textured neutral ambient fill'
if bsdf.inputs['Base Color'].is_linked:nt.links.new(bsdf.inputs['Base Color'].links[0].from_socket,em.inputs['Color'])
else:em.inputs['Color'].default_value=bsdf.inputs['Base Color'].default_value
path=nt.nodes.new('ShaderNodeLightPath');mul=nt.nodes.new('ShaderNodeMath');mul.operation='MULTIPLY';nt.links.new(fade.outputs['Result'],mul.inputs[0]);nt.links.new(path.outputs['Is Camera Ray'],mul.inputs[1]);strength=nt.nodes.new('ShaderNodeMath');strength.operation='MULTIPLY';strength.inputs[1].default_value=.18;nt.links.new(mul.outputs[0],strength.inputs[0]);nt.links.new(strength.outputs[0],em.inputs['Strength']);add=nt.nodes.new('ShaderNodeAddShader');nt.links.new(previous,add.inputs[0]);nt.links.new(em.outputs[0],add.inputs[1]);nt.links.new(add.outputs[0],output.inputs['Surface'])
# Retain the original textured neutral colour and all physical steel response. No global exposure change.
s.render.filepath=str(D/'blender-after.png');bpy.ops.render.render(write_still=True)
s['left_wall_refinement']='Preparation only. Corrected neutral fill height fade for left corridor wall; no bake or web edits.'
bpy.context.preferences.filepaths.save_version=0;out=P/'Left_Wall_Lighting_Prepared.blend';bpy.ops.wm.save_as_mainfile(filepath=str(out),compress=True)
report={'preparedFile':str(out),'source':source,'targetObject':name,'materialOriginal':original.name,'materialPrepared':mat.name,'change':'Wall-only camera-visible textured ambient fill, peak strength0.18; normalized height smootherstep0.008 to0.26; original physical shader preserved','previousHeightInput':old_link,'floorJunction':'zero fill at base, smooth transition across lower26percent of wall height','camera':pose,'bakeStarted':False,'runtimeChanged':False,'instruction':'Claude must bake corridor-wall-red only from this prepared copy, retaining existing runtime UV sidecar and single bake viewpoint. Do not replace global corridor source for other items.'};(D/'preparation.json').write_text(json.dumps(report,indent=2));print('LEFT_WALL_LIGHTING_PREPARED',str(out),flush=True)
