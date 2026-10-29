import bpy,json,math
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
P=Path('D:/CodexOutputs/Corridor_Bake_Preparation_20261024');R=Path('D:/New folio/new site code/new_site_three/docs/corridor-preparation');bpy.ops.wm.open_mainfile(filepath=str(P/'Corridor_Runtime_Material_Prepared.blend'),load_ui=False)
rows=[];dg=bpy.context.evaluated_depsgraph_get()
for item in json.loads((P/'runtime-meshes.json').read_text()):
 name=item['material'][5:] if item['material'].startswith('ID | ') else item['name'].removesuffix('.001');ob=bpy.data.objects[name];ev=ob.evaluated_get(dg);m=ev.to_mesh();m.calc_loop_triangles();nm=ob.matrix_world.to_3x3().inverted().transposed();tris=list(m.loop_triangles);tree=KDTree(len(tris))
 for i,t in enumerate(tris):tree.insert(sum((ob.matrix_world@m.vertices[k].co for k in t.vertices),Vector())/3,i)
 tree.balance();maxpos=maxnormal=0;idx=item['indices'];pts=item['positions'];norm=item['normals']
 for j in range(0,len(idx),3):
  ids=idx[j:j+3];center=sum((Vector(pts[k]) for k in ids),Vector())/3;_,ti,_=tree.find(center);t=tris[ti]
  for k in ids:
   loop=min(t.loops,key=lambda li:(ob.matrix_world@m.vertices[m.loops[li].vertex_index].co-Vector(pts[k])).length_squared);q=ob.matrix_world@m.vertices[m.loops[loop].vertex_index].co;maxpos=max(maxpos,(q-Vector(pts[k])).length);n=(nm@m.corner_normals[loop].vector).normalized();v=Vector(norm[k]).normalized();maxnormal=max(maxnormal,math.degrees(n.angle(v)))
 rows.append({'name':name,'triangles':len(idx)//3,'maxCornerPositionErrorMetres':maxpos,'maxNormalErrorDegrees':maxnormal});ev.to_mesh_clear()
assert max(x['maxCornerPositionErrorMetres'] for x in rows)<.001
report={'objects':len(rows),'triangles':sum(x['triangles'] for x in rows),'maximumPositionErrorMetres':max(x['maxCornerPositionErrorMetres'] for x in rows),'maximumNormalErrorDegrees':max(x['maxNormalErrorDegrees'] for x in rows),'details':rows,'noGLBExport':True,'noBakeStarted':True}
(R/'saved-file-verification.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='details'}),flush=True)
