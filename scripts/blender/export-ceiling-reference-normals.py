"""Read evaluated original Blender corner normals; do not save any scene."""
import bpy,json
from pathlib import Path
from mathutils import Vector
P=Path('D:/CodexOutputs/Theatre_Ceiling_PBR_20261023')
bpy.ops.wm.open_mainfile(filepath=str(P/'Ceiling_PBR_prepared.blend'),load_ui=False)
dg=bpy.context.evaluated_depsgraph_get();rows=[]
for copy in bpy.context.scene.objects:
    if not copy.name.startswith('Ceiling PBR | '):continue
    obj=bpy.data.objects[copy['source_object']];e=obj.evaluated_get(dg);mesh=e.to_mesh(preserve_all_data_layers=True,depsgraph=dg)
    mesh.calc_loop_triangles();nm=obj.matrix_world.to_3x3().inverted().transposed()
    for tri in mesh.loop_triangles:
        vertices=[]
        for loop in tri.loops:
            p=obj.matrix_world@mesh.vertices[mesh.loops[loop].vertex_index].co;n=(nm@mesh.corner_normals[loop].vector).normalized()
            vertices.append({'p':[p.x+.010995,p.z+.02,26-p.y],'n':[n.x,n.z,-n.y]})
        rows.append({'object':obj.name,'vertices':vertices})
    e.to_mesh_clear()
(P/'reference-normals.json').write_text(json.dumps(rows))
print('ORIGINAL_CEILING_NORMALS',len(rows),flush=True)
