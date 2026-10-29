import bpy,json,numpy as np
from pathlib import Path
P=Path('D:/CodexOutputs/Theatre_Ceiling_PBR_20261023')
bpy.ops.wm.open_mainfile(filepath=str(P/'Ceiling_PBR_prepared.blend'),load_ui=False)
rows=[]
for ob in bpy.context.scene.objects:
 if not ob.name.startswith('Ceiling PBR | '):continue
 mesh=ob.data;mesh.calc_loop_triangles();uv=np.array([v.uv[:] for v in mesh.uv_layers['CeilingLightmap'].data]);v=np.array([(ob.matrix_world@x.co)[:] for x in mesh.vertices]);normals=np.array([(ob.matrix_world.to_3x3()@f.normal)[:] for f in mesh.polygons]);rows.append({'name':ob.name,'bounds':[v.min(0).tolist(),v.max(0).tolist()],'meanNormal':normals.mean(0).tolist(),'uvBounds':[uv.min(0).tolist(),uv.max(0).tolist()],'triangles':len(mesh.loop_triangles)})
print(json.dumps(rows),flush=True)
Path('docs/theatre-ceiling-audit/edge-source-audit.json').write_text(json.dumps(rows,indent=2))
