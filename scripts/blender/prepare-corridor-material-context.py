"""Prepare a runtime-matching corridor authoring scene; NO baking/export/site edits."""
import bpy,json,math,numpy as np
from pathlib import Path
from mathutils import Matrix,Vector
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree
P=Path('D:/CodexOutputs/Corridor_Bake_Preparation_20261024');R=Path('D:/New folio/new site code/new_site_three');A=Path('D:/CodexOutputs/Approved_Theatre_Corridor_20261020')
SOURCE='D:/CodexOutputs/Corridor_Optimization_20261018/Blue_Centre_Placement/Final_Geometry_Audit/Corridor_Logo_final_optimized_4K.blend'
layout=A/'Logo_balanced_ribbon_gaps.blend';runtime=json.loads((P/'runtime-meshes.json').read_text());inspection=json.loads((P/'inspection.json').read_text());a=json.loads(Path('D:/CodexOutputs/Theatre_Optimization_20261017/Web_Export_20261019/upgraded-coordinate-map.json').read_text())['blenderMatrix'];B=Matrix([[a[c*4+r] for c in range(4)] for r in range(4)]);scale=sum(B.to_scale())/3
bpy.ops.wm.open_mainfile(filepath=SOURCE,load_ui=False);bpy.context.view_layer.update();source_matrices={ob.name:ob.matrix_world.copy() for ob in bpy.data.objects}
bpy.ops.wm.open_mainfile(filepath=str(layout),load_ui=False);scene=bpy.context.scene
# Keep the full placed layout as shadow/reflection context. Only work on this new file.
original_layout={ob.name:ob for ob in scene.objects};source_meta={r['name']:r for r in inspection[1]['lights']}
with bpy.data.libraries.load(SOURCE,link=False) as (src,dst):
 names=tuple(src.objects);dst.objects=list(names);dst.worlds=[inspection[1]['world']]
source_by_name=dict(zip(names,dst.objects));world=dst.worlds[0]
for name,ob in source_by_name.items():
 if ob:ob.name='SOURCE ONLY | '+name
receivers={};coordinate_helpers=bpy.data.collections.new('PREP | Source-coordinate helpers');scene.collection.children.link(coordinate_helpers)
light_collection=bpy.data.collections.new('PREP | Restored corridor lights');scene.collection.children.link(light_collection)
materials=[];uv_reports=[];warnings=[];match=[];excluded=[]
for item in runtime:
 name=item['material'][5:] if item['material'].startswith('ID | ') else item['name'].removesuffix('.001')
 ob=original_layout.get(name)
 if not ob:raise RuntimeError('Missing layout object '+name)
 ob['runtime_node']=item['name'];ob['runtime_material']=item['material'];ob['bake_scope']='EXCLUDED' if name.startswith(('Swoosh','Slide ')) else 'INCLUDED'
 if ob['bake_scope']=='EXCLUDED':excluded.append(name)
 receivers[name]=ob
 # All geometric positions stay as in the approved authoring layout.
 evaluated=ob.evaluated_get(bpy.context.evaluated_depsgraph_get());verified=evaluated.to_mesh();verified.calc_loop_triangles();tree=KDTree(len(verified.loop_triangles))
 for i,t in enumerate(verified.loop_triangles):tree.insert(sum((ob.matrix_world@verified.vertices[k].co for k in t.vertices),Vector())/3,i)
 tree.balance();idx=item['indices'];pts=item['positions'];err=max(tree.find(sum((Vector(pts[k]) for k in idx[j:j+3]),Vector())/3)[2] for j in range(0,len(idx),3))
 if len(idx)//3!=len(verified.loop_triangles) or err>.001:raise RuntimeError('Runtime mismatch '+name+' '+str(err))
 match.append({'name':name,'runtimeTriangles':len(idx)//3,'layoutTriangles':len(verified.loop_triangles),'maxTriangleCentroidErrorMetres':err})
 evaluated.to_mesh_clear()
 if name.startswith(('Swoosh','Slide ')):continue
 owner=name
 if name.startswith('FIX | Capped '):owner=name[len('FIX | Capped '):]
 src=source_by_name.get(owner)
 if not src:raise RuntimeError('No source material owner '+name)
 # Explicit local-coordinate reference survives the flattened layout transforms.
 helper=bpy.data.objects.new('COORD | '+name,None);helper.matrix_world=B@source_matrices[owner];coordinate_helpers.objects.link(helper);helper.hide_render=True
 mats=[]
 for original in src.data.materials:
  mat=original.copy();mat.name='PREP | '+name+' | '+original.name
  if mat.use_nodes:
   for node in mat.node_tree.nodes:
    if node.type=='TEX_COORD':
     if node.object:
      ref=bpy.data.objects.new('COORD REF | '+name,None);ref.matrix_world=B@source_matrices[node.object.name.removeprefix('SOURCE ONLY | ')];coordinate_helpers.objects.link(ref);ref.hide_render=True;node.object=ref
     else:node.object=helper
    if node.type=='BUMP':node.inputs['Distance'].default_value*=scale
    if node.type=='NEW_GEOMETRY' and node.outputs['Position'].is_linked:warnings.append(name+': world Position shader requires review before bake')
    if node.type=='LIGHT_PATH':warnings.append(name+': preserve camera-ray material branch for reference; COMBINED bake needs explicit camera-response validation')
  mats.append(mat)
 ob.data.materials.clear()
 for mat in mats:ob.data.materials.append(mat)
 # Missing source shading UVs on generated caps are interpolated from their parent layout wall.
 required={node.uv_map for mat in mats if mat.use_nodes for node in mat.node_tree.nodes if node.type in {'UVMAP','NORMAL_MAP','TANGENT'} and getattr(node,'uv_map','')}
 for uvname in required:
  if ob.data.uv_layers.get(uvname):continue
  parent=original_layout.get(owner);parent_uv=parent.data.uv_layers.get(uvname) if parent else None
  if not parent_uv:raise RuntimeError('Missing material UV '+name+' '+uvname)
  m=parent.data;m.calc_loop_triangles();tris=list(m.loop_triangles);verts=[parent.matrix_world@v.co for v in m.vertices];bvh=BVHTree.FromPolygons(verts,[tuple(t.vertices) for t in tris],all_triangles=True);uv=ob.data.uv_layers.new(name=uvname);maxdist=0
  for loop in ob.data.loops:
   p=ob.matrix_world@ob.data.vertices[loop.vertex_index].co;hit,normal,ti,dist=bvh.find_nearest(p);maxdist=max(maxdist,dist);t=tris[ti];v0,v1,v2=[verts[k] for k in t.vertices];E=np.stack([np.array(v1-v0),np.array(v2-v0)],axis=1);w=np.linalg.lstsq(E,np.array(hit-v0),rcond=None)[0];u=[Vector(parent_uv.data[k].uv) for k in t.loops];uv.data[loop.index].uv=u[0]+float(w[0])*(u[1]-u[0])+float(w[1])*(u[2]-u[0])
  uv_reports.append({'object':name,'source':owner,'layer':uvname,'maxSurfaceDistanceMetres':maxdist,'purpose':'source shading only; NOT runtime bake UV'})
 materials.append({'object':name,'sourceObject':owner,'materials':[m.name for m in mats],'shadingUVs':[u.name for u in ob.data.uv_layers]})
# Restore original light positions, orientation, angular size and illuminance under uniform frame scaling.
lights=[]
for name,meta in source_meta.items():
 src=source_by_name[name];valid=[x for x in meta['receivers'] or [] if x in receivers]
 if meta['receivers'] is not None and not valid:continue
 ob=src.copy();ob.data=src.data.copy();ob.name='PREP LIGHT | '+name;ob.parent=None;mw=B@source_matrices[name];loc,rot,_=mw.decompose();ob.matrix_world=Matrix.LocRotScale(loc,rot,source_matrices[name].to_scale());ob.data.energy*=scale*scale if ob.data.type!='SUN' else 1
 for prop in ['size','size_y','shadow_soft_size']:
  if hasattr(ob.data,prop):setattr(ob.data,prop,getattr(ob.data,prop)*scale)
 light_collection.objects.link(ob)
 if meta['receivers'] is not None:
  col=bpy.data.collections.new('LINK | '+name)
  for n in valid:
   col.objects.link(receivers[n])
   cap=receivers.get('FIX | Capped '+n)
   if cap and cap.name not in col.objects:col.objects.link(cap)
  ob.light_linking.receiver_collection=col
 lights.append({'name':name,'position':list(ob.matrix_world.translation),'sourceEnergy':src.data.energy,'layoutEnergy':ob.data.energy,'receivers':valid,'mapping':'authored global similarity transform; no arbitrary new fill lights'})
scene.world=world;scene.view_settings.view_transform=inspection[1]['view'][0];scene.view_settings.look=inspection[1]['view'][1];scene.view_settings.exposure=inspection[1]['view'][2]
# Keep environmental directions aligned when the source world uses an environment texture.
if world and world.use_nodes:
 for node in list(world.node_tree.nodes):
  if node.type!='TEX_ENVIRONMENT':continue
  sock=node.inputs['Vector'];mapping=world.node_tree.nodes.new('ShaderNodeMapping');mapping.vector_type='VECTOR';mapping.inputs['Rotation'].default_value=B.to_quaternion().inverted().to_euler()
  if sock.is_linked:
   link=sock.links[0];up=link.from_socket;world.node_tree.links.remove(link)
  else:
   tex=world.node_tree.nodes.new('ShaderNodeTexCoord');up=tex.outputs['Generated']
  world.node_tree.links.new(up,mapping.inputs['Vector']);world.node_tree.links.new(mapping.outputs['Vector'],sock)
scene.render.engine='CYCLES';scene.cycles.samples=128;scene.cycles.use_denoising=True;scene.render.use_compositing=False;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.image_settings.color_depth='8'
# Cameras sampled from the existing runtime route, converted back to Blender Z-up.
route=json.loads((R/'components/corridor/scene-route.json').read_text())['samples'];captures=[]
for label,i in [('entry',160),('bend',340),('exit',540)]:
 p=route[i]['position'];q=route[min(i+30,len(route)-1)]['position'];pos=Vector((p[0],-p[2],p[1]));target=Vector((q[0],-q[2],q[1]));cd=bpy.data.cameras.new('PREP CAMERA | '+label);cd.sensor_fit='VERTICAL';cd.sensor_height=24;cd.lens=12/math.tan(math.radians(20));cd.clip_end=3000;cd.clip_start=.05;cam=bpy.data.objects.new(cd.name,cd);scene.collection.objects.link(cam);cam.location=pos;cam.rotation_euler=(target-pos).to_track_quat('-Z','Y').to_euler();captures.append({'label':label,'camera':cam.name,'position':list(pos),'target':list(target),'fov':40,'resolution':[1600,900]})
scene.camera=bpy.data.objects[captures[1]['camera']];scene.render.resolution_x=1600;scene.render.resolution_y=900
scene['preparation_only']='NO texture bake, NO GLB export, NO site changes. Layout geometry verified against runtime.';scene['source_file']=SOURCE;scene['runtime_geometry']='public/models/corridor-ribbons-balanced.glb'
report={'preparedFile':str(P/'Corridor_Runtime_Material_Prepared.blend'),'layoutSource':str(layout),'materialSource':SOURCE,'coordinateScale':scale,'geometry':match,'materialAssignments':materials,'sourceShadingUVRepairs':uv_reports,'lights':lights,'captures':captures,'warnings':sorted(set(warnings)),'excluded':excluded,'limitation':'Layout differs from original source. This is a source-material reference on the approved runtime layout, not pixel-identical original-corridor lighting. Source light rig transferred by the documented authored similarity transform; geometry changes naturally alter shadows/reflections.'}
(P/'preparation-report.json').write_text(json.dumps(report,indent=2));(R/'docs/corridor-preparation/preparation-report.json').write_text(json.dumps(report,indent=2));bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=report['preparedFile'],compress=True);print('CORRIDOR_PREPARED',report['preparedFile'],flush=True)
