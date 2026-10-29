import bpy,json
from pathlib import Path
P=Path('D:/CodexOutputs/Theatre_Ceiling_PBR_20261023')
bpy.ops.wm.open_mainfile(filepath=str(P/'Ceiling_PBR_baked.blend'),load_ui=False)
rows=[]
for o in bpy.context.scene.objects:
    if not ((o.name.startswith('HALO II') and o.type=='MESH' and max((o.matrix_world@v.co).z for v in o.data.vertices)>6) or o.name.startswith('Ceiling PBR | ') or (o.type=='LIGHT' and not o.hide_render)):continue
    rows.append({'name':o.name,'collections':[c.name for c in o.users_collection],'linkedReceivers':getattr(getattr(o.light_linking,'receiver_collection',None),'name',None),'linkedBlockers':getattr(getattr(o.light_linking,'blocker_collection',None),'name',None),'hidden':o.hide_render,'camera':o.visible_camera,'diffuse':o.visible_diffuse,'glossy':o.visible_glossy,'shadow':o.visible_shadow})
Path('D:/New folio/new site code/new_site_three/docs/theatre-ceiling-audit/linking.json').write_text(json.dumps(rows,indent=2))
print(json.dumps(rows),flush=True)
