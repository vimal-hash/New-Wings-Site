import bpy,json
from pathlib import Path
P=Path('D:/CodexOutputs/Corridor_Bake_Preparation_20261024')
bpy.ops.wm.open_mainfile(filepath='D:/CodexOutputs/Approved_Theatre_Corridor_20261020/Logo_balanced_ribbon_gaps.blend',load_ui=False)
names=['Red corridor wall • separate from logo','Connecting plane • joins yellow tip','Plain floor • red to connecting plane','Pathway • 01 • bronze face','Pathway • 01 • warm diffuser']
rows=[]
for name in names:
 ob=bpy.data.objects.get(name)
 if not ob:continue
 for mat in ob.data.materials:
  if not mat.use_nodes:continue
  nodes=[]
  for n in mat.node_tree.nodes:
   nodes.append({'name':n.name,'type':n.bl_idname,'uv':getattr(n,'uv_map',None),'object':getattr(getattr(n,'object',None),'name',None),'image':getattr(getattr(n,'image',None),'filepath',None),'inputs':{x.name:str(x.default_value) for x in n.inputs if not x.is_linked and hasattr(x,'default_value')}})
  rows.append({'object':name,'material':mat.name,'nodes':nodes,'links':[(l.from_node.name,l.from_socket.name,l.to_node.name,l.to_socket.name) for l in mat.node_tree.links]})
(P/'material-nodes.json').write_text(json.dumps(rows,indent=2));print('MATERIAL_NODE_AUDIT_DONE',flush=True)
