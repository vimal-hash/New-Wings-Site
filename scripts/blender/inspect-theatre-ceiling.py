"""Inspect the approved ceiling without saving or changing a source blend."""
import bpy, json
from pathlib import Path
from mathutils import Vector
OUT=Path('D:/New folio/new site code/new_site_three/docs/theatre-ceiling-audit')
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath='D:/CodexOutputs/Theatre_Optimization_20261017/Theatre_Moon_Projector_optimized.blend',load_ui=False)
dg=bpy.context.evaluated_depsgraph_get()
def serial(v):
    try:return list(v)
    except TypeError:return v
objects=[];materials={}
for obj in bpy.context.scene.objects:
    if obj.type not in ('MESH','CURVE'):continue
    if not (obj.name.startswith('HALO') and not obj.hide_render):continue
    mesh=bpy.data.meshes.new_from_object(obj.evaluated_get(dg),preserve_all_data_layers=True,depsgraph=dg)
    mesh.calc_loop_triangles()
    corners=[obj.matrix_world@Vector(p) for p in obj.bound_box]
    objects.append({'name':obj.name,'type':obj.type,'hidden':obj.hide_render,'triangles':len(mesh.loop_triangles),'uvs':[u.name for u in mesh.uv_layers], 'bounds':[[min(p[i] for p in corners),max(p[i] for p in corners)] for i in range(3)],'materials':[m.name if m else None for m in mesh.materials]})
    for mat in mesh.materials:
        if not mat or mat.name in materials:continue
        materials[mat.name]={'nodes':[{'name':n.name,'type':n.type,'uv_map':getattr(n,'uv_map',None),'image':getattr(getattr(n,'image',None),'name',None),'inputs':{s.name:(s.links[0].from_node.name+':'+s.links[0].from_socket.name) if s.is_linked else serial(s.default_value) for s in n.inputs if hasattr(s,'default_value')}} for n in mat.node_tree.nodes] if mat.use_nodes else [],'diffuse':list(mat.diffuse_color)}
    bpy.data.meshes.remove(mesh)
settings=bpy.context.scene.view_settings
report={'objects':objects,'materials':materials,'view':{'transform':settings.view_transform,'look':settings.look,'exposure':settings.exposure,'gamma':settings.gamma}}
(OUT/'source-inventory.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'objects':objects,'materials':list(materials)},indent=2),flush=True)
