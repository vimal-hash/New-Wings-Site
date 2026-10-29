"""Transfer existing ceiling lighting to repaired cove UVs; rebake cove normals only."""
import bpy,numpy as np,json
import OpenImageIO as o
from pathlib import Path
P=Path('D:/CodexOutputs/Theatre_Ceiling_PBR_20261023');A=Path('D:/New folio/new site code/new_site_three/docs/theatre-ceiling-audit')
bpy.ops.wm.open_mainfile(filepath=str(P/'Ceiling_PBR_prepared.blend'),load_ui=False)
data=json.loads((P/'cove-uv-refinement.json').read_text());obj=bpy.data.objects[data['object']];m=obj.data
new=np.array(data['new']);old=np.array(data['old']);m.uv_layers['CeilingLightmap'].data.foreach_set('uv',new.ravel())
def raster(points,N):
 p=points*N;p[:,1]=N-p[:,1];a,b,c=p;det=np.linalg.det(np.stack((b-a,c-a)))
 if abs(det)<1e-10:return None
 lo=np.maximum(np.floor(p.min(0)).astype(int),0);hi=np.minimum(np.ceil(p.max(0)).astype(int),N-1)
 x,y=np.meshgrid(np.arange(lo[0],hi[0]+1)+.5,np.arange(lo[1],hi[1]+1)+.5)
 u=((x-a[0])*(c-a)[1]-(y-a[1])*(c-a)[0])/det;v=((b-a)[0]*(y-a[1])-(b-a)[1]*(x-a[0]))/det
 mask=(u>1e-6)&(v>1e-6)&(u+v<1-1e-6)
 return lo,hi,u,v,mask
def masks(N):
 own=np.zeros((N,N),bool);other=np.zeros_like(own);hits=np.zeros((N,N),np.uint8)
 for ob in bpy.context.scene.objects:
  if not ob.name.startswith('Ceiling PBR | '):continue
  ob.data.calc_loop_triangles();uv=np.array([v.uv[:] for v in ob.data.uv_layers['CeilingLightmap'].data])
  for t in ob.data.loop_triangles:
   r=raster(uv[list(t.loops)].copy(),N)
   if r is None:raise RuntimeError('Collapsed UV')
   lo,hi,u,v,mask=r;s=(slice(lo[1],hi[1]+1),slice(lo[0],hi[0]+1));hits[s]+=mask
   (own if ob==obj else other)[s]|=mask
 assert not np.any(hits>1),'Repaired atlas has overlap'
 return own,other
def image(array):
 h,w,c=array.shape;im=o.ImageBuf(o.ImageSpec(w,h,c,o.FLOAT));im.set_pixels(o.ROI(0,w,0,h,0,1,0,c),np.ascontiguousarray(array,dtype=np.float32));return im
def pad(values,mask,other):
 rgba=np.concatenate((values*mask[...,None],mask[...,None]),axis=-1)
 filled=o.ImageBufAlgo.fillholes_pushpull(image(rgba)).get_pixels(o.FLOAT)[...,:3]
 expanded=o.ImageBufAlgo.dilate(image(mask[...,None].astype(np.float32)),9,9).get_pixels(o.FLOAT)[...,0]>.01
 assert not np.any(expanded&other),'Cove gutter reaches unrelated chart'
 return filled,expanded
report=[]
for source,label in [('irradiance-final.exr','irradiance-uv-fixed.exr'),('specular-final.exr','specular-uv-fixed.exr')]:
 pixels=o.ImageBuf(str(P/source)).get_pixels(o.FLOAT)[...,:3];N=len(pixels);target=np.zeros_like(pixels);own,other=masks(N)
 for t in data['triangles']:
  ls=t['loops'];r=raster(new[ls].copy(),N)
  if r is None:continue
  lo,hi,u,v,valid=r;uv=old[ls];sample=uv[0]+u[...,None]*(uv[1]-uv[0])+v[...,None]*(uv[2]-uv[0]);sample*=N;sample[...,1]=N-sample[...,1];sample=np.clip(sample-.5,0,N-1.001)
  xy=np.floor(sample).astype(int);f=sample-xy;x,y=xy[...,0],xy[...,1]
  colour=pixels[y,x]*(1-f[...,0,None])*(1-f[...,1,None])+pixels[y,x+1]*f[...,0,None]*(1-f[...,1,None])+pixels[y+1,x]*(1-f[...,0,None])*f[...,1,None]+pixels[y+1,x+1]*f[...,0,None]*f[...,1,None]
  region=target[lo[1]:hi[1]+1,lo[0]:hi[0]+1];region[valid]=colour[valid]
 filled,replace=pad(target,own,other);output=pixels.copy();output[replace]=filled[replace]
 out=image(output);out.specmod().attribute('compression','zip');out.write(str(P/label));report.append({'map':label,'nonCoveSurfaceMaxChange':float(np.max(np.abs(output[other]-pixels[other]))),'resolution':N})
 print('COVE_LIGHTING_TRANSFERRED',label,flush=True)
# A tangent normal map must be rebaked after its UV directions change.
s=bpy.context.scene;bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='OPTIX'
s.cycles.device='GPU';s.cycles.samples=32;s.render.bake.use_clear=True;s.render.bake.margin=8
normal=bpy.data.images.new('Cove repaired tangent normals',width=2048,height=2048,alpha=False,float_buffer=True);normal.colorspace_settings.name='Non-Color'
for mat in obj.data.materials:
 node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=normal;mat.node_tree.nodes.active=node
bpy.ops.object.bake(type='NORMAL',normal_space='TANGENT',normal_r='POS_X',normal_g='POS_Y',normal_b='POS_Z')
raw=np.array(normal.pixels[:],np.float32).reshape(2048,2048,4)[::-1,:,:3]
own2,_=masks(2048);filled,_=pad(raw,own2,np.zeros_like(own2))
vector=filled*2-1;vector=vector.reshape(1024,2,1024,2,3).mean(axis=(1,3));vector/=np.maximum(np.linalg.norm(vector,axis=-1,keepdims=True),1e-8)
base=o.ImageBuf(str(P/'normal-clean.png')).get_pixels(o.FLOAT)[...,:3];own,other=masks(1024);filled,replace=pad(vector*.5+.5,own,other);output=base.copy();output[replace]=filled[replace]
out=image(np.clip(output,0,1));out.set_write_format(o.UINT8);out.write(str(P/'normal-uv-fixed.png'))
report.append({'map':'normal-uv-fixed.png','nonCoveSurfaceMaxChange':float(np.max(np.abs(output[other]-base[other]))),'resolution':1024})
(A/'cove-texture-transfer.json').write_text(json.dumps(report,indent=2));print('COVE_TRANSFER_COMPLETE',json.dumps(report),flush=True)
