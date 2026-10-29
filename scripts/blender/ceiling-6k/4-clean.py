# 6K variant of the accepted ceiling chain (same prepared .blend, same repaired CeilingLightmap UVs).
# Env: CEIL_N (default 6144), CEIL_SAMPLES (1024). Reads/writes only D:/CodexOutputs/Restoration_6K_20261024/theatre-ceiling.
import os
N6=int(os.environ.get('CEIL_N','6144'));F=N6/4096
"""Ceiling-only lighting refinement with isolated UV sections and safe gutters.

Never smooth across atlas neighbours: unrelated surfaces have unrelated lighting.
The source blend and all geometry/material detail remain unchanged.
"""
import bpy, numpy as np, json
import OpenImageIO as oiio
from pathlib import Path
P=Path('D:/CodexOutputs/Theatre_Ceiling_PBR_20261023');O=Path('D:/CodexOutputs/Restoration_6K_20261024/theatre-ceiling')
bpy.ops.wm.open_mainfile(filepath=str(P/'Ceiling_PBR_prepared.blend'),load_ui=False)
ref=json.loads((P/'cove-uv-refinement.json').read_text());bpy.data.objects[ref['object']].data.uv_layers['CeilingLightmap'].data.foreach_set('uv',np.array(ref['new']).ravel())
sections=[]
for obj in bpy.context.scene.objects:
    if not obj.name.startswith('Ceiling PBR | '): continue
    mesh=obj.data; mesh.calc_loop_triangles(); uv=mesh.uv_layers['CeilingLightmap'].data
    triangles=[np.array([uv[i].uv[:] for i in t.loops]) for t in mesh.loop_triangles]
    parent=list(range(len(triangles))); edges={}
    def root(i):
        while parent[i]!=i: parent[i]=parent[parent[i]]; i=parent[i]
        return i
    for i,t in enumerate(triangles):
        pts=[tuple(np.round(v,6)) for v in t]
        for a,b in [(0,1),(1,2),(2,0)]:
            key=tuple(sorted([pts[a],pts[b]]))
            if key in edges: parent[root(i)]=root(edges[key])
            else: edges[key]=i
    islands={}
    for i,t in enumerate(triangles): islands.setdefault(root(i),[]).append(t)
    for ts in islands.values(): sections.append((obj.name,np.array(ts)))

def convolve(a,width):
    h,w,c=a.shape
    image=oiio.ImageBuf(oiio.ImageSpec(w,h,c,oiio.FLOAT))
    image.set_pixels(oiio.ROI(0,w,0,h,0,1,0,c),np.ascontiguousarray(a,dtype=np.float32))
    return oiio.ImageBufAlgo.convolve(image,oiio.ImageBufAlgo.make_kernel('gaussian',width,width)).get_pixels(oiio.FLOAT)

report=[]
for label in ['ceiling-edge-stitched']:
    source=oiio.ImageBuf(str(O/(label+'.exr'))).get_pixels(oiio.FLOAT)[...,:3]
    n=source.shape[0]; output=source.copy(); best=np.zeros((n,n),np.float32)
    for name,triangles in sections:
        # Cropping makes the per-island operation small and deterministic.
        points=triangles.reshape(-1,2)*n; points[:,1]=n-points[:,1]
        lo=np.maximum(np.floor(points.min(0)).astype(int)-round(48*F),0)
        hi=np.minimum(np.ceil(points.max(0)).astype(int)+round(48*F),n)
        x0,y0=lo; x1,y1=hi; mask=np.zeros((y1-y0,x1-x0),np.float32)
        for tri in triangles:
            t=tri*n; t[:,1]=n-t[:,1]; t-=lo
            a,b,c=t; det=np.linalg.det(np.stack([b-a,c-a]))
            if abs(det)<1e-8: continue
            low=np.maximum(np.floor(t.min(0)).astype(int),0); high=np.minimum(np.ceil(t.max(0)).astype(int),[x1-x0-1,y1-y0-1])
            xx,yy=np.meshgrid(np.arange(low[0],high[0]+1)+.5,np.arange(low[1],high[1]+1)+.5)
            u=((xx-a[0])*(c-a)[1]-(yy-a[1])*(c-a)[0])/det
            v=((b-a)[0]*(yy-a[1])-(b-a)[1]*(xx-a[0]))/det
            mask[low[1]:high[1]+1,low[0]:high[0]+1]=np.maximum(mask[low[1]:high[1]+1,low[0]:high[0]+1],((u>=-1e-6)&(v>=-1e-6)&(u+v<=1+1e-6)).astype(np.float32))
        if not mask.any(): continue
        broad=any(s in name for s in ['Slim floating soffit','Floating acoustic inset','Backing above'])
        width=9 if broad else 7
        weights=convolve(mask[...,None],width)[...,0]
        filtered=convolve(source[y0:y1,x0:x1]*mask[...,None],width)/np.maximum(weights[...,None],1e-8)
        # Extend filtered island colours into a gutter without borrowing neighbours.
        # Push/pull expects premultiplied RGB. Empty texels must contain zero,
        # otherwise repeated unpremultiplication invents enormous HDR values.
        rgba=np.concatenate([filtered*mask[...,None],mask[...,None]],-1)
        h,w=mask.shape; im=oiio.ImageBuf(oiio.ImageSpec(w,h,4,oiio.FLOAT))
        im.set_pixels(oiio.ROI(0,w,0,h,0,1,0,4),np.ascontiguousarray(rgba,dtype=np.float32))
        filled=oiio.ImageBufAlgo.fillholes_pushpull(im).get_pixels(oiio.FLOAT)[...,:3]
        median_width=13 if 'Continuous rolled plaster cove' in name else (5 if broad else 3)
        median_image=oiio.ImageBuf(oiio.ImageSpec(w,h,3,oiio.FLOAT))
        median_image.set_pixels(oiio.ROI(0,w,0,h,0,1,0,3),np.ascontiguousarray(filled,dtype=np.float32))
        filled=oiio.ImageBufAlgo.median_filter(median_image,median_width,median_width).get_pixels(oiio.FLOAT)
        assert np.isfinite(filled).all() and filled.max()<=source.max()*1.01, name
        # Gaussian distance confidence chooses the closest island in shared gutters.
        confidence=convolve(mask[...,None],65 if n==2048 else (33 if n==4096 else int(33*F)//2*2+1))[...,0]
        confidence=np.where(mask>0,2,confidence)
        current=best[y0:y1,x0:x1]; choose=confidence>current
        output[y0:y1,x0:x1][choose]=filled[choose]; current[choose]=confidence[choose]
    spec=oiio.ImageSpec(n,n,3,oiio.HALF); spec.attribute('compression','zip')
    image=oiio.ImageBuf(spec); image.set_pixels(oiio.ROI(0,n,0,n,0,1,0,3),np.ascontiguousarray(np.maximum(output,0)))
    assert np.isfinite(output).all()
    image.write(str(O/(label+'-clean.exr')))
    report.append({'map':label,'sections':len(sections),'resolution':n,'method':'normalised per-UV-island filtering and isolated gutter extension'})
(O/'third-refinement-6k.json').write_text(json.dumps(report,indent=2))
print('CEILING_ISLAND_REFINEMENT',json.dumps(report),flush=True)

im=bpy.data.images.load(str(O/'ceiling-edge-stitched-clean.exr'),check_existing=False)
bpy.context.scene.render.image_settings.file_format='PNG';bpy.context.scene.render.image_settings.color_mode='RGB';bpy.context.scene.render.image_settings.color_depth='16';im.save_render(str(O/'ceiling-edge-stitched-clean-display.png'),scene=bpy.context.scene)
