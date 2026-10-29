"""Read the approved source in a background Blender; never save it."""
import bpy, json
from pathlib import Path

root = Path('D:/New folio/new site code/new_site_three/docs/theatre-floor-audit')
bpy.ops.wm.open_mainfile(filepath='D:/CodexOutputs/Theatre_Optimization_20261017/Theatre_Moon_Projector_optimized.blend', load_ui=False)
scene = bpy.context.scene
def serial(v):
    try: return list(v)
    except TypeError: return v
rows = []
for name in ['ET | Aisle -7.4 row 2 tread 1', 'ET | Foundation slab']:
    obj = bpy.data.objects[name]
    for mat in obj.data.materials:
        rows.append({'object': name, 'material': mat.name,
                     'active_uv': obj.data.uv_layers.active.name,
                     'render_uv': [u.name for u in obj.data.uv_layers if u.active_render],
                     'nodes': [{'name': n.name, 'type': n.type, 'uv_map': getattr(n, 'uv_map', None),
                                'image': getattr(getattr(n, 'image', None), 'name', None),
                                'inputs': {s.name: (s.links[0].from_node.name + ':' + s.links[0].from_socket.name) if s.is_linked else serial(s.default_value) for s in n.inputs if hasattr(s, 'default_value')}} for n in mat.node_tree.nodes],
                     'links': [[l.from_node.name, l.from_socket.name, l.to_node.name, l.to_socket.name] for l in mat.node_tree.links]})
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.get_devices()
report = {'materials': rows, 'devices': [(d.name, d.type) for d in prefs.devices],
          'scene': scene.name, 'frame': scene.frame_current,
          'camera': scene.camera.name if scene.camera else None,
          'view_transform': scene.view_settings.view_transform,
          'look': scene.view_settings.look, 'exposure': scene.view_settings.exposure,
          'gamma': scene.view_settings.gamma,
          'lights': [(o.name, o.data.energy) for o in scene.objects if o.type == 'LIGHT' and not o.hide_render]}
(root / 'approved-material-graph.json').write_text(json.dumps(report, indent=2))
print('MATERIAL_AUDIT_DONE', report['devices'], report['camera'], flush=True)
