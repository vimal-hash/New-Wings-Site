import bpy,json
from pathlib import Path
P=Path('D:/CodexOutputs/Corridor_Bake_Preparation_20261024');bpy.ops.wm.open_mainfile(filepath=str(P/'Corridor_Runtime_Material_Prepared.blend'),load_ui=False)
for ob in bpy.context.scene.objects:
 if ob.name.startswith('Slide '):ob['bake_scope']='PENDING_USER_SCOPE'
 if ob.name.startswith('Emblem'):ob.hide_render=True;ob['preparation_note']='Absent from current runtime corridor; excluded from bake and reference visibility.'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(P/'Corridor_Runtime_Material_Prepared.blend'),compress=True)
print('PREP_SCOPE_SAVED',flush=True)
