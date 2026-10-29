"""Export approved revision 16 as original compact, spatially balanced point tiers."""
import numpy as np, json, gzip, struct, hashlib, math, subprocess
from PIL import Image
from pathlib import Path

PROJECT=Path(__file__).resolve().parents[1]
AUTHOR=Path('D:/CodexOutputs/Logo_Eye_Studio_20261027/revision-16')
OUT=Path('D:/CodexOutputs/Logo_Eye_Web_20261027'); OUT.mkdir(exist_ok=True)
PUBLIC=PROJECT/'public'; TARGET=PUBLIC/'models/logo-eye'; TARGET.mkdir(parents=True,exist_ok=True)
baseline=OUT/'protected-before.json'
if not baseline.exists():
    baseline.write_text(json.dumps({str(p.relative_to(PROJECT)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest()
        for p in PUBLIC.rglob('*') if p.is_file()},indent=2))
d=np.load(AUTHOR/'eye-authored-points.npz'); p=d['positions'].copy(); n=len(p)
# Include the exact frame-1 Geometry Nodes displacement from the approved image.
p[:,2]+=.055*np.sin(p[:,0]*.61+1/24)
lo=p.min(axis=0); extent=p.max(axis=0)-lo
quant=np.rint((p-lo)/extent*65535).clip(0,65535).astype(np.uint16)
restored=lo+quant.astype(float)/65535*extent
error=np.linalg.norm(restored-p,axis=1)
# Project each original rotated ellipsoid onto the authored front plane.
rx,ry,rz=d['rotation'].T; a,b,c=np.cos(rx),np.cos(ry),np.cos(rz); u,v,w=np.sin(rx),np.sin(ry),np.sin(rz)
r0=np.column_stack([c*b,c*v*u-w*a,c*v*a+w*u])
r1=np.column_stack([w*b,w*v*u+c*a,w*v*a-c*u])
variance=d['scale']**2
xx=(r0*r0*variance).sum(axis=1); yy=(r1*r1*variance).sum(axis=1); xy=(r0*r1*variance).sum(axis=1)
disc=np.sqrt((xx-yy)**2+4*xy**2)
major=np.sqrt(np.maximum((xx+yy+disc)*.5,1e-12)); minor=np.sqrt(np.maximum((xx+yy-disc)*.5,1e-12))
angle=(.5*np.arctan2(2*xy,xx-yy))%(2*np.pi)
radius_max=math.ceil(float(major.max())*10000)/10000
size=np.rint(major/radius_max*255).clip(1,255).astype(np.uint8)
shape=(np.rint(np.clip(minor/major,0,1)*15).astype(np.uint8)*16 + (np.rint(angle/(2*np.pi)*16).astype(np.uint8)%16))
orientation=np.floor((np.sin(np.arange(n)*12.9898)*43758.5453)%1*8).astype(np.uint8)
appearance=(d['tone'].astype(np.uint8)+8*orientation)
meta=np.column_stack([size,shape,appearance]).astype(np.uint8)
# Stratify across position AND density region. Prefix samples keep proportional
# occupancy in every populated cell instead of dropping the sparse outer halo.
cellxy=np.floor((p[:,:2]-lo[:2])/extent[:2]*[64,40]).clip([0,0],[63,39]).astype(int)
cell=cellxy[:,0]+64*cellxy[:,1]+64*40*d['region'].astype(int)
rng=np.random.default_rng(27162026); keys=np.empty(n)
for key in np.unique(cell):
    group=np.flatnonzero(cell==key); rng.shuffle(group)
    keys[group]=(np.arange(len(group))+.5)/len(group)
progressive=np.argsort(keys+rng.random(n)*1e-8,kind='stable')
def morton(q):
    code=np.zeros(len(q),dtype=np.uint64)
    for bit in range(16):
        code|=((q[:,0].astype(np.uint64)>>bit)&1)<<(2*bit)
        code|=((q[:,1].astype(np.uint64)>>bit)&1)<<(2*bit+1)
    return code
tiers={}; previous=set()
for tier,count in [('mobile',49152),('laptop',98304),('desktop',n)]:
    selected=progressive[:count]; assert previous.issubset(set(selected.tolist())); previous=set(selected.tolist())
    ids=selected[np.argsort(morton(quant[selected]),kind='stable')]
    q=quant[ids]; m=meta[ids]
    payload=bytearray(struct.pack('<4sHHI7fII',b'EYE1',1,9,count,*lo.tolist(),*extent.tolist(),radius_max,n,0))
    for axis in range(3):
        stream=q[:,axis].astype(np.int32)
        delta=np.diff(stream,prepend=0)%65536
        payload.extend(delta.astype('<u2').tobytes())
    for axis in range(3): payload.extend(m[:,axis].tobytes())
    blob=gzip.compress(bytes(payload),compresslevel=9,mtime=0)
    filename=f'eye-r16-{tier}.bin.gz'; (TARGET/filename).write_bytes(blob)
    tiers[tier]={'url':'/models/logo-eye/'+filename,'count':count,'bytes':len(blob),'decodedBytes':len(payload),
        'gpuAttributeBytes':count*9,'sha256':hashlib.sha256(blob).hexdigest(),
        'regions':{str(int(v)):int((d['region'][ids]==v).sum()) for v in np.unique(d['region'])}}
atlas_source=OUT/'steel-grain-atlas.png'
Image.open(atlas_source).resize((512,512),Image.Resampling.LANCZOS).save(OUT/'steel-grains-512.png')
subprocess.run(['D:/New folio/new site code/_tools/basisu/bin/basisu.exe','-ktx2','-uastc','-uastc_level','3',
    '-ktx2_zstandard_level','19','-mipmap','-mip_filter','box','-file',str(OUT/'steel-grains-512.png'),
    '-output_file',str(OUT/'steel-grains-512.ktx2')],check=True,stdout=subprocess.DEVNULL)
atlas=(OUT/'steel-grains-512.ktx2').read_bytes(); atlas_hash=hashlib.sha256(atlas).hexdigest()[:12]
atlas_name=f'steel-grains-{atlas_hash}.ktx2'; atlas_target=PUBLIC/'textures/logo-eye'/atlas_name
atlas_target.parent.mkdir(parents=True,exist_ok=True); atlas_target.write_bytes(atlas)
manifest={'revision':16,'authoringCount':n,'sourceLogoDiameter':3.5,'bounds':{'min':lo.tolist(),'max':p.max(axis=0).tolist()},
 'positionMaxError':float(error.max()),'radiusMax':radius_max,'tiers':tiers,
 'atlas':{'url':f'/textures/logo-eye/{atlas_name}?v={atlas_hash}','bytes':len(atlas),'width':512,'height':512,
     'columns':8,'rows':8,'quadPadding':.11/.075,'description':'Original Blender worn-steel grains under the approved study lighting'},
 'worker':'/models/logo-eye/decode-worker.js','source':'Approved original Blender revision 16; no third-party artwork'}
(PROJECT/'components/corridor/logo-particle-eye/assets.json').write_text(json.dumps(manifest,indent=2)+'\n')
(OUT/'export-report.json').write_text(json.dumps(manifest,indent=2))
assert float(error.max())<.0004
print(json.dumps({'tiers':tiers,'atlasBytes':len(atlas),'maxPositionError':float(error.max())}))
