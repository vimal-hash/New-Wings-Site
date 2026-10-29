"""Read floor data in a separate Blender process. Never save a blend or render."""
import bpy
import json
import os
import sys
from pathlib import Path

out = Path(__file__).parent
sources = [
    Path('D:/CodexOutputs/Theatre_Optimization_20261017/Theatre_Moon_Projector_optimized.blend'),
    Path('D:/CodexOutputs/Approved_Theatre_Corridor_20261020/Theatre_Corridor_Logo_marked_layout.blend'),
]
report = []
for source in sources:
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    matches = [o for o in bpy.data.objects if o.type == 'MESH' and (
        o.name.endswith('ET | Aisle -7.4 row 2 tread 1') or
        o.name.endswith('ET | Foundation slab'))]
    objects = []
    material_names = set()
    for obj in matches:
        obj.data.calc_loop_triangles()
        evaluated_mesh = obj.evaluated_get(depsgraph).data
        evaluated_mesh.calc_loop_triangles()
        materials = [m.name if m else None for m in obj.data.materials]
        material_names.update(m for m in materials if m)
        objects.append({
            'name': obj.name, 'vertices': len(obj.data.vertices),
            'triangles': len(obj.data.loop_triangles),
            'evaluated_triangles': len(evaluated_mesh.loop_triangles),
            'uv_layers': [u.name for u in obj.data.uv_layers],
            'materials': materials,
            'material_face_counts': {str(i): sum(p.material_index == i for p in obj.data.polygons) for i in range(len(materials))},
            'world_matrix': [list(row) for row in obj.matrix_world],
        })
    materials = []
    for name in sorted(material_names):
        mat = bpy.data.materials[name]
        images = []
        if mat.use_nodes:
            for node in mat.node_tree.nodes:
                if node.type == 'TEX_IMAGE' and node.image:
                    img = node.image
                    images.append({'name': img.name, 'size': list(img.size),
                                   'packed': bool(img.packed_file),
                                   'external_exists': os.path.isfile(bpy.path.abspath(img.filepath)),
                                   'colour_space': img.colorspace_settings.name})
        materials.append({'name': name, 'node_count': len(mat.node_tree.nodes) if mat.use_nodes else 0, 'images': images})
    row = {'source': str(source), 'objects': objects, 'materials': materials}
    report.append(row)
    print('FLOOR_AUDIT', json.dumps(row), flush=True)
(out / 'blend-inspection.json').write_text(json.dumps(report, indent=2), encoding='utf8')
print('AUDIT_COMPLETE_NO_BLEND_SAVED', flush=True)
