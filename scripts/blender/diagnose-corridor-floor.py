import bpy,json,numpy as np
from pathlib import Path
rows=[]
for f in ['D:/CodexOutputs/Corridor_Optimization_20261018/Blue_Centre_Placement/Final_Geometry_Audit/Corridor_Logo_final_optimized_4K.blend','D:/CodexOutputs/Corridor_Bake_Preparation_20261024/Corridor_Runtime_Material_Prepared.blend']:
 bpy.ops.wm.open_mainfile(filepath=f,load_ui=False);ob=bpy.data.objects['Plain floor • red to connecting plane'];m=ob.data;mat=m.materials[0];m.calc_loop_triangles();nm=ob.matrix_world.to_3x3().inverted().transposed();normals=np.array([(nm@p.normal).normalized()[:] for p in m.polygons]);nmap=[{'uv':n.uv_map,'strength':n.inputs['Strength'].default_value} for n in mat.node_tree.nodes if n.type=='NORMAL_MAP'];lights=[]
 for l in bpy.context.scene.objects:
  if l.type!='LIGHT':continue
  if 'wash' not in l.name and 'overhead' not in l.name:continue
  rec=l.light_linking.receiver_collection
  lights.append({'name':l.name,'matrix':[list(r) for r in l.matrix_world],'power':l.data.energy,'size':l.data.size,'size_y':l.data.size_y,'hide':l.hide_render,'diffuse':l.data.diffuse_factor,'specular':l.data.specular_factor,'receivers':[(x.name,rec.collection_objects[i].light_linking.link_state) for i,x in enumerate(rec.objects)] if rec else None})
 rows.append({'file':f,'normalMean':normals.mean(0).tolist(),'floorBounds':[[min((ob.matrix_world@v.co)[a] for v in m.vertices),max((ob.matrix_world@v.co)[a] for v in m.vertices)] for a in range(3)],'normalMap':nmap,'floorUVs':[(u.name,len(u.data)) for u in m.uv_layers],'lights':lights})
Path('docs/corridor-preparation/floor-diagnostic.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows),flush=True)

