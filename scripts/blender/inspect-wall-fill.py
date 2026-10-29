import bpy,json
from pathlib import Path
c=json.loads(Path('scripts/surface-bake/items.json').read_text());bpy.ops.wm.open_mainfile(filepath=c['sources']['corridor']['blend'],load_ui=False);o=bpy.data.objects[c['items']['corridor-wall-red']['objects'][0]]
for n in o.data.materials[0].node_tree.nodes:
 if n.type in {'EMISSION','MAP_RANGE','MATH'}:
  print(n.name,'op',getattr(n,'operation',''),[(i,x.name, None if x.is_linked else (x.default_value if isinstance(x.default_value,(int,float)) else list(x.default_value))) for i,x in enumerate(n.inputs) if hasattr(x,'default_value') and x.enabled])
