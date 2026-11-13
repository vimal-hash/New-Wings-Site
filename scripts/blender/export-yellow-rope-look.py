"""Read the existing optimized yellow source; export only no-glow palettes and matched references.
No geometry export and no Blender file is saved. Usage: blender -b --python this.py -- <repo> <evidence>.
"""
import bpy, json, math, os, struct, sys, zlib
import numpy as np
from mathutils import Matrix

ROOT, OUT = sys.argv[sys.argv.index('--') + 1:][:2]
BASE = 'D:/CodexOutputs/Loki_Rope_20261103/r3f/'
YELLOW = BASE + 'Rope_Yellow_r3f.blend'
GREEN = BASE + 'Rope_Green_80_Amber_r3f.blend'
red = json.load(open(BASE + 'Rope_Red_r3f_look.json'))
yellow = json.load(open(BASE + 'Rope_Yellow_r3f_look.json'))
green = json.load(open(BASE + 'Rope_Green_80_Amber_r3f_look.json'))
reports = [json.load(open(BASE+n+'_r3f_report.json')) for n in ['Rope_Red','Rope_Yellow','Rope_Green_80_Amber']]
assert len({r['geometry_hash'] for r in reports}) == 1
os.makedirs(OUT, exist_ok=True)

def png(path, values):
    values = np.clip(values, 0, 1)
    enc = np.where(values <= .0031308, values * 12.92, 1.055 * values ** (1/2.4) - .055)
    data = np.round(enc * 255).astype(np.uint8)
    if data.ndim == 2: data = data[None, ...]
    h, w = data.shape[:2]
    def chunk(kind, b): return struct.pack('>I',len(b))+kind+b+struct.pack('>I',zlib.crc32(kind+b)&0xffffffff)
    with open(path,'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(b'\0'+row.tobytes() for row in data),9))+chunk(b'IEND',b''))

bpy.ops.wm.open_mainfile(filepath=YELLOW)
scene=bpy.data.scenes['Rope_Macro']; bpy.context.window.scene=scene
nodes=bpy.data.materials['Rope_Fibre'].node_tree.nodes
elements=nodes['Color Ramp.003'].color_ramp.elements
positions=np.array([e.position for e in elements]); colours=np.array([e.color[:3] for e in elements])
assert np.max(np.abs(colours-np.array(yellow['fibre']['hue_ramp'][1])))<1e-6
red_ramp=np.array(red['fibre']['hue_ramp'][1]); assert np.all(np.diff(red_ramp[:,0])>0)
dest=os.path.join(ROOT,'public/rope-model/yellow'); os.makedirs(dest,exist_ok=True)
files={}
for name,n in [('palette-desktop.png',1024),('palette-laptop.png',256)]:
    hue=np.interp(np.linspace(0,1,n),red_ramp[:,0],red['fibre']['hue_ramp'][0])
    rgb=np.stack([np.interp(hue,positions,colours[:,i]) for i in range(3)],1)
    path=os.path.join(dest,name); png(path,rgb); files[name]={'width':n,'height':1,'bytes':os.path.getsize(path)}
core=bpy.data.materials['Rope_Core'].node_tree.nodes
def rgb(socket): return list(socket.default_value[:3])
def grade(look): return [list(map(list,zip(*channel))) for channel in look['grade']['curves_on_linear_rgb']]
manifest={'source':YELLOW,'greenSource':GREEN,'geometryHash':reports[0]['geometry_hash'],'method':'Actual source emission palette, no glow, no geometry export',
 'side':rgb(nodes['Mix.004'].inputs[7]),'face':rgb(nodes['Mix.005'].inputs[7]),'core':rgb(core['Diffuse BSDF'].inputs['Color']),
 'transparent':rgb(next(n for n in nodes if n.type=='BSDF_TRANSPARENT').inputs['Color']),
 'exposure':scene.cycles.film_exposure,'grade':grade(yellow),'toe':yellow['grade']['toe_after_encode'],
 'redHue':red['fibre']['hue_ramp'],'yellowHue':[positions.tolist(),colours.tolist()],
 'green':{'side':green['fibre']['tint_side'],'face':green['fibre']['tint_face'],'core':green['core_colour'],'grade':grade(green)},'files':files}
json.dump(manifest,open(os.path.join(ROOT,'components/rope-model/yellow-look.json'),'w'),indent=2)
json.dump({'manifest':manifest,'camera':yellow['camera'],'bloom':yellow['bloom'],'reports':reports},open(os.path.join(OUT,'source-inventory.json'),'w'),indent=2)
print('YELLOW_SOURCE_EXPORTED',json.dumps(files),flush=True)

for key,path,look,depth,roll in [('yellow',YELLOW,yellow,12,-.62),('green',GREEN,green,9,0)]:
    if key=='green': bpy.ops.wm.open_mainfile(filepath=path)
    scene=bpy.data.scenes['Rope_Macro'];bpy.context.window.scene=scene
    camera=scene.camera
    pose=camera.matrix_world @ Matrix.Rotation(roll,4,'Z')
    pose.translation.y=depth
    camera.matrix_world=pose
    bpy.context.view_layer.update()
    assert abs(camera.matrix_world.translation.y-depth)<1e-5
    json.dump({'depth':depth,'roll':roll,'matrix':[list(row) for row in camera.matrix_world]},open(os.path.join(OUT,'blender-'+key+'-camera.json'),'w'),indent=2)
    camera.data.sensor_fit='HORIZONTAL'
    scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage=1920,1080,100
    scene.cycles.samples=64;scene.cycles.use_denoising=True
    try:
        prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
        for d in prefs.devices: d.use=d.type=='OPTIX'
        scene.cycles.device='GPU'
    except Exception: scene.cycles.device='CPU'
    scene.render.image_settings.file_format='OPEN_EXR';scene.render.image_settings.color_depth='32'
    scene.render.filepath=os.path.join(OUT,'blender-'+key+'-linear.exr')
    bpy.ops.render.render(write_still=True)
    image=bpy.data.images.load(scene.render.filepath);data=np.empty(1920*1080*4,np.float32);image.pixels.foreach_get(data)
    raw=data.reshape(1080,1920,4)[::-1,:,:3]
    linear=np.stack([np.interp(raw[...,i],*channel) for i,channel in enumerate(look['grade']['curves_on_linear_rgb'])],2)
    if look['grade']['toe_after_encode']:
        enc=np.where(linear<=.0031308,linear*12.92,1.055*np.maximum(linear,0)**(1/2.4)-.055)
        knee,power=look['grade']['toe_after_encode']; enc*=np.clip(enc.mean(axis=2)/knee,0,1)[...,None]**power
        linear=np.where(enc<=.04045,enc/12.92,((enc+.055)/1.055)**2.4)
    png(os.path.join(OUT,'blender-'+key+'-reference.png'),linear)
    print('REFERENCE_COMPLETE',key,flush=True)
