import bpy,json
from pathlib import Path
P=Path('D:/CodexOutputs/Corridor_Bake_Preparation_20261024');R=Path('D:/New folio/new site code/new_site_three/docs/corridor-preparation')
bpy.ops.wm.open_mainfile(filepath=str(P/'Corridor_Runtime_Material_Prepared.blend'),load_ui=False);s=bpy.context.scene
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='OPTIX'
s.cycles.device='GPU';s.render.use_persistent_data=True
for shot in json.loads((P/'preparation-report.json').read_text())['captures']:
 s.camera=bpy.data.objects[shot['camera']];s.render.filepath=str(R/('prepared-'+shot['label']+'.png'));bpy.ops.render.render(write_still=True);print('REFERENCE_SAVED',s.render.filepath,flush=True)
