"""Freeze the approved opening into a single UV atlas, with no runtime projection."""
import bpy,numpy as np,json,math
import OpenImageIO as o
from pathlib import Path
P=Path('D:/CodexOutputs/Theatre_Ceiling_PBR_20261023');R=Path('D:/New folio/new site code/new_site_three')
bpy.ops.wm.open_mainfile(filepath=str(P/'Ceiling_PBR_prepared.blend'),load_ui=False)
ref=json.loads((P/'cove-uv-refinement.json').read_text());cove=bpy.data.objects[ref['object']];cove.data.uv_layers['CeilingLightmap'].data.foreach_set('uv',np.array(ref['new']).ravel())
objects=[ob for ob in bpy.context.scene.objects if ob.name.startswith('Ceiling PBR | ')]
for ob in objects:
 ob.data.calc_loop_triangles()
def read(path):return o.ImageBuf(str(path)).get_pixels(o.FLOAT)[...,:3]
capture=read(P/'approved-opening-source.webp')
extended=read(R/'docs/theatre-ceiling-audit/blender-ceiling-extended.png')
def sample(im,uv):
 h,w=im.shape[:2];p=np.clip(uv*[w,h]-.5,[0,0],[w-1.001,h-1.001]);a=np.floor(p).astype(int);f=p-a;x,y=a[...,0],a[...,1]
 return im[y,x]*(1-f[...,0,None])*(1-f[...,1,None])+im[y,x+1]*f[...,0,None]*(1-f[...,1,None])+im[y+1,x]*(1-f[...,0,None])*f[...,1,None]+im[y+1,x+1]*f[...,0,None]*f[...,1,None]
def smooth(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
N=4096;out=np.zeros((N,N,3),np.float32);mask=np.zeros((N,N),np.float32);projected=0
for ob in objects:
 m=ob.data;uv=np.array([v.uv[:] for v in m.uv_layers['CeilingLightmap'].data]);world=np.array([(ob.matrix_world@v.co)[:] for v in m.vertices])
 for t in m.loop_triangles:
  q=uv[list(t.loops)];p=q*N;p[:,1]=N-p[:,1];a,b,c=p;det=np.linalg.det(np.stack((b-a,c-a)))
  if abs(det)<1e-9:continue
  lo=np.maximum(np.floor(p.min(0)).astype(int),0);hi=np.minimum(np.ceil(p.max(0)).astype(int),N-1);x,y=np.meshgrid(np.arange(lo[0],hi[0]+1)+.5,np.arange(lo[1],hi[1]+1)+.5)
  u=((x-a[0])*(c-a)[1]-(y-a[1])*(c-a)[0])/det;v=((b-a)[0]*(y-a[1])-(b-a)[1]*(x-a[0]))/det;valid=(u>=0)&(v>=0)&(u+v<=1)
  if not valid.any():continue
  wp=world[list(t.vertices)]
  if True:
   point=wp[0]+u[...,None]*(wp[1]-wp[0])+v[...,None]*(wp[2]-wp[0]);depth=22.2-point[...,1];px=.5+point[...,0]/(2*np.maximum(depth,.001)*math.tan(math.radians(20))*(3072/1080));py=.5+(point[...,2]-3.22)/(2*np.maximum(depth,.001)*math.tan(math.radians(20)))
   # Entire ceiling is covered by the same-eye extended render. No per-face
   # visibility switch, top-crop cutoff or unmatched old shading region.
   ex=.5+point[...,0]/(2*np.maximum(depth,.001)*math.tan(math.radians(82.5)))
   ey=.5-(point[...,2]-3.22)/(2*np.maximum(depth,.001)*math.tan(math.radians(82.5)))
   colour=sample(extended,np.stack((ex,ey),-1))
   coverage=smooth(0,.08,px)*(1-smooth(.92,1,px))*smooth(2/3,.70,py)*(1-smooth(.93,1.,py))*(depth>0)
   image=sample(capture,np.stack((px,(1-py)*3),-1));colour=colour*(1-coverage[...,None])+image*coverage[...,None];projected+=int((valid&(coverage>.99)).sum())
  linear=np.where(colour<=.04045,colour/12.92,((colour+.055)/1.055)**2.4);luma=linear@np.array([.2126,.7152,.0722]);h=smooth(.32,.72,luma);peak=linear.max(-1);linear=(linear*(1-h[...,None]*.2)+peak[...,None]*h[...,None]*.2)*(1+h[...,None]*.03);colour=np.where(linear<=.0031308,linear*12.92,1.055*np.maximum(linear,0)**(1/2.4)-.055)
  region=out[lo[1]:hi[1]+1,lo[0]:hi[0]+1];region[valid]=colour[valid];mask[lo[1]:hi[1]+1,lo[0]:hi[0]+1][valid]=1
 print('ATLAS_OBJECT',ob.name,flush=True)
rgba=np.concatenate((out*mask[...,None],mask[...,None]),-1);im=o.ImageBuf(o.ImageSpec(N,N,4,o.FLOAT));im.set_pixels(o.ROI(0,N,0,N,0,1,0,4),np.ascontiguousarray(rgba));filled=o.ImageBufAlgo.fillholes_pushpull(im).get_pixels(o.FLOAT)[...,:3];filled[mask>0]=out[mask>0]
mi=o.ImageBuf(o.ImageSpec(N,N,1,o.FLOAT));mi.set_pixels(o.ROI(0,N,0,N,0,1,0,1),mask[...,None]);gutter=o.ImageBufAlgo.dilate(mi,33,33).get_pixels(o.FLOAT)[...,0]>.01
filled[~gutter]=.14
image=o.ImageBuf(o.ImageSpec(N,N,3,o.UINT8));image.set_pixels(o.ROI(0,N,0,N,0,1,0,3),np.round(np.clip(filled,0,1)*255).astype(np.uint8));image.write(str(P/'approved-ceiling-atlas-complete.png'))
print('APPROVED_UV_ATLAS',json.dumps({'resolution':N,'coveredTexels':int(mask.sum()),'referenceTexels':projected,'runtimeCameraDependence':False}),flush=True)
