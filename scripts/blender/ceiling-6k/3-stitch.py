# 6K variant of the accepted ceiling chain (same prepared .blend, same repaired CeilingLightmap UVs).
# Env: CEIL_N (default 6144), CEIL_SAMPLES (1024). Reads/writes only D:/CodexOutputs/Restoration_6K_20261024/theatre-ceiling.
import os
N6=int(os.environ.get('CEIL_N','6144'));F=N6/4096
"""Correct only discontinuities across smooth-surface UV cuts, not whole fields."""
import bpy,numpy as np,json
import OpenImageIO as o
from pathlib import Path
P=Path('D:/CodexOutputs/Theatre_Ceiling_PBR_20261023');O=Path('D:/CodexOutputs/Restoration_6K_20261024/theatre-ceiling');bpy.ops.wm.open_mainfile(filepath=str(P/'Ceiling_PBR_prepared.blend'),load_ui=False)
ref=json.loads((P/'cove-uv-refinement.json').read_text());bpy.data.objects[ref['object']].data.uv_layers['CeilingLightmap'].data.foreach_set('uv',np.array(ref['new']).ravel())
src=o.ImageBuf(str(O/'ceiling-edge-source.exr')).get_pixels(o.FLOAT)[...,:3];N=len(src);delta=np.zeros_like(src);weights=np.zeros((N,N,1),np.float32);count=0
def sample(p):
 p=np.clip(p-.5,0,N-1.001);a=np.floor(p).astype(int);f=p-a
 return src[a[:,1],a[:,0]]*(1-f[:,0,None])*(1-f[:,1,None])+src[a[:,1],a[:,0]+1]*f[:,0,None]*(1-f[:,1,None])+src[a[:,1]+1,a[:,0]]*(1-f[:,0,None])*f[:,1,None]+src[a[:,1]+1,a[:,0]+1]*f[:,0,None]*f[:,1,None]
for obj in bpy.context.scene.objects:
 if obj.name not in ['Ceiling PBR | HALO II | Slim floating soffit','Ceiling PBR | HALO II | Continuous rolled plaster cove']:continue
 m=obj.data;uv=m.uv_layers['CeilingLightmap'].data;edges={}
 for face in m.polygons:
  loops=list(face.loop_indices);centre=np.mean([uv[i].uv[:] for i in loops],0)*N;centre[1]=N-centre[1]
  for i,j in zip(loops,loops[1:]+loops[:1]):
   ids=[m.loops[i].vertex_index,m.loops[j].vertex_index];ls=[i,j]
   if ids[0]>ids[1]:ids.reverse();ls.reverse()
   p=np.array([uv[k].uv[:] for k in ls])*N;p[:,1]=N-p[:,1]
   normals=np.array([m.corner_normals[k].vector[:] for k in ls]);edges.setdefault(tuple(ids),[]).append((p,centre,normals))
 for pair in edges.values():
  if len(pair)!=2:continue
  a,b=pair
  if np.max(np.abs(a[0]-b[0]))<.01 or np.min(np.sum(a[2]*b[2],axis=1))<.98:continue
  if min(np.linalg.norm(a[0][1]-a[0][0]),np.linalg.norm(b[0][1]-b[0][0]))<3*F:continue
  count+=1
  for own,other in [(a,b),(b,a)]:
   p,c,_=own;q,d,_=other;v=p[1]-p[0];length=np.dot(v,v)
   lo=np.maximum(np.floor(p.min(0)-4*F).astype(int),0);hi=np.minimum(np.ceil(p.max(0)+4*F).astype(int),N-1)
   x,y=np.meshgrid(np.arange(lo[0],hi[0]+1)+.5,np.arange(lo[1],hi[1]+1)+.5);xy=np.stack([x,y],-1);t=np.clip(np.sum((xy-p[0])*v,-1)/length,0,1);near=p[0]+t[...,None]*v;dist=np.linalg.norm(xy-near,axis=-1)
   normal=c-p.mean(0);normal/=max(np.linalg.norm(normal),1e-8);othernormal=d-q.mean(0);othernormal/=max(np.linalg.norm(othernormal),1e-8)
   t=t.ravel();first=sample(p[0]+t[:,None]*v+normal*1.5*F);second=sample(q[0]+t[:,None]*(q[1]-q[0])+othernormal*1.5*F)
   correction=(second-first)*.5;w=np.maximum(0,1-dist/(4*F))[...,None];ys=slice(lo[1],hi[1]+1);xs=slice(lo[0],hi[0]+1)
   delta[ys,xs]+=correction.reshape(*x.shape,3)*w;weights[ys,xs]+=w
out=np.maximum(src+delta/np.maximum(weights,1),0);sp=o.ImageSpec(N,N,3,o.HALF);sp.attribute('compression','zip');im=o.ImageBuf(sp);im.set_pixels(o.ROI(0,N,0,N,0,1,0,3),np.ascontiguousarray(out));im.write(str(O/'ceiling-edge-stitched.exr'));print('UV_SEAMS_STITCHED',count,flush=True)

report={'smoothUvCutsStitched':count,'maximumLinearRadianceAdjustment':float(np.max(np.abs(out-src))),'method':'paired geometric edges with matching corner normals; four texel seam correction only'}
(O/'edge-seam-repair-6k.json').write_text(json.dumps(report,indent=2))
