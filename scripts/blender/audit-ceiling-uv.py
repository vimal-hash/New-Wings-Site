"""Raster-check atlas overlap at the actual lightmap resolution."""
import bpy, numpy as np, json
from pathlib import Path
P=Path('D:/CodexOutputs/Theatre_Ceiling_PBR_20261023')
bpy.ops.wm.open_mainfile(filepath=str(P/'Ceiling_PBR_prepared.blend'),load_ui=False)
N=2048;hits=np.zeros((N,N),np.uint16);tiny=0;triangles=0
for obj in bpy.context.scene.objects:
    if not obj.name.startswith('Ceiling PBR | '):continue
    mesh=obj.data;mesh.calc_loop_triangles();uv=mesh.uv_layers['CeilingLightmap'].data
    for tri in mesh.loop_triangles:
        p=np.array([uv[i].uv[:] for i in tri.loops])*N
        a,b,c=p;det=np.cross(b-a,c-a).item();triangles+=1
        if abs(det)<1e-9:tiny+=1;continue
        lo=np.maximum(np.floor(p.min(axis=0)).astype(int),0);hi=np.minimum(np.ceil(p.max(axis=0)).astype(int),N-1)
        if np.any(hi<lo):continue
        x,y=np.meshgrid(np.arange(lo[0],hi[0]+1)+.5,np.arange(lo[1],hi[1]+1)+.5)
        v=np.stack([x-a[0],y-a[1]],axis=-1)
        u=(v[...,0]*(c-a)[1]-v[...,1]*(c-a)[0])/det
        w=((b-a)[0]*v[...,1]-(b-a)[1]*v[...,0])/det
        mask=(u>1e-6)&(w>1e-6)&(u+w<1-1e-6)
        hits[lo[1]:hi[1]+1,lo[0]:hi[0]+1]+=mask
result={'resolution':N,'triangles':triangles,'uvZeroAreaTriangles':tiny,'coveredPixelCentres':int((hits>0).sum()),'overlappingPixelCentres':int((hits>1).sum()),'occupancy':float((hits>0).mean()),'limit':'Pixel-centre raster audit at the actual 2K bake size; not an analytic subpixel overlap proof.'}
Path('D:/New folio/new site code/new_site_three/docs/theatre-ceiling-audit/uv-verification.json').write_text(json.dumps(result,indent=2))
assert result['overlappingPixelCentres']==0,result
assert tiny==0,result
print('CEILING_UV_CHECK',json.dumps(result),flush=True)
