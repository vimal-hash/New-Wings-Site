import bpy,json
from pathlib import Path
c=json.loads(Path('scripts/surface-bake/items.json').read_text());src=c['sources']['corridor'];name=c['items']['corridor-wall-red']['objects'][0];bpy.ops.wm.open_mainfile(filepath=src['blend'],load_ui=False);ob=bpy.data.objects[name];print('WALL_BOUNDS',[[min((ob.matrix_world@v.co)[a] for v in ob.data.vertices),max((ob.matrix_world@v.co)[a] for v in ob.data.vertices)] for a in range(3)])
for m in ob.data.materials:
 for n in m.node_tree.nodes:
  if n.type in {'EMISSION','BSDF_PRINCIPLED','MATH','MAP_RANGE','TEX_COORD'}:
   vals={}
   for x in n.inputs:
    if not x.is_linked and hasattr(x,'default_value'):
     v=x.default_value
     try:v=list(v)
     except:pass
     vals[x.name]=v
   print(n.name,n.type,vals)
