import bpy,json,numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
P=Path('D:/CodexOutputs/Corridor_Bake_Preparation_20261024');runtime=json.loads((P/'runtime-meshes.json').read_text());reports=[]
for label,file in [('layout','D:/CodexOutputs/Approved_Theatre_Corridor_20261020/Logo_balanced_ribbon_gaps.blend'),('source','D:/CodexOutputs/Corridor_Optimization_20261018/Blue_Centre_Placement/Final_Geometry_Audit/Corridor_Logo_final_optimized_4K.blend')]:
 bpy.ops.wm.open_mainfile(filepath=file,load_ui=False);s=bpy.context.scene;dg=bpy.context.evaluated_depsgraph_get();rows=[]
 if label=='layout':
  for o in runtime:
   name=o['material'][5:] if o['material'].startswith('ID | ') else o['name'];src=bpy.data.objects.get(name)
   if not src:rows.append({'name':name,'missing':True});continue
   m=src.evaluated_get(dg).to_mesh();m.calc_loop_triangles();pts=[src.matrix_world@v.co for v in m.vertices];tree=KDTree(len(pts))
   for i,p in enumerate(pts):tree.insert(p,i)
   tree.balance();err=max(tree.find(Vector(p))[2] for p in o['positions'])
   rows.append({'runtimeName':o['name'],'name':name,'runtimeTriangles':len(o['indices'])//3,'layoutTriangles':len(m.loop_triangles),'maxVertexError':err,'materials':[m.name for m in src.data.materials],'uvLayers':[u.name for u in m.uv_layers]});src.evaluated_get(dg).to_mesh_clear()
 lights=[]
 for ob in s.objects:
  if ob.type!='LIGHT':continue
  rec=ob.light_linking.receiver_collection
  lights.append({'name':ob.name,'type':ob.data.type,'energy':ob.data.energy,'size':getattr(ob.data,'size',None),'location':list(ob.matrix_world.translation),'receivers':None if not rec else [x.name for x in rec.all_objects]})
 mats=[{'object':ob.name,'materials':[m.name if m else None for m in ob.data.materials]} for ob in s.objects if ob.type=='MESH' and not ob.hide_render]
 reports.append({'label':label,'file':file,'scene':s.name,'world':s.world.name if s.world else None,'view':[s.view_settings.view_transform,s.view_settings.look,s.view_settings.exposure],'meshMatches':rows,'lights':lights,'materials':mats})
(P/'inspection.json').write_text(json.dumps(reports,indent=2));Path('docs/corridor-preparation/inspection-summary.json').write_text(json.dumps({'matchingObjects':len(reports[0]['meshMatches']),'mismatches':[r for r in reports[0]['meshMatches'] if r.get('missing') or r['runtimeTriangles']!=r['layoutTriangles'] or r['maxVertexError']>.001],'maximumError':max(r.get('maxVertexError',0) for r in reports[0]['meshMatches']),'sourceLights':reports[1]['lights'],'layoutWorld':reports[0]['world'],'sourceView':reports[1]['view']},indent=2));print('CORRIDOR_INSPECTION_DONE',flush=True)
