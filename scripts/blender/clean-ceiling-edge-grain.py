"""Denoise only the newly rebaked closure chart and its bake padding."""
import bpy,numpy as np
import OpenImageIO as o
from pathlib import Path
P=Path('D:/CodexOutputs/Theatre_Ceiling_PBR_20261023');bpy.ops.wm.open_mainfile(filepath=str(P/'Ceiling_PBR_prepared.blend'),load_ui=False)
mesh=bpy.data.objects['Ceiling PBR | HALO II | Wall crown closure.001'].data
uv=np.array([p.uv[:] for p in mesh.uv_layers['CeilingLightmap'].data])
for label in ['irradiance-final','specular-final']:
 im=o.ImageBuf(str(P/(label+'.exr')));a=im.get_pixels(o.FLOAT)[...,:3];n=len(a);p=uv*n;p[:,1]=n-p[:,1];lo=np.maximum(np.floor(p.min(0)).astype(int)-6,0);hi=np.minimum(np.ceil(p.max(0)).astype(int)+6,n)
 filtered=o.ImageBufAlgo.convolve(o.ImageBufAlgo.median_filter(im,3,3),o.ImageBufAlgo.make_kernel('gaussian',3,3)).get_pixels(o.FLOAT)[...,:3]
 x0,y0=lo;x1,y1=hi;a[y0:y1,x0:x1]=filtered[y0:y1,x0:x1]
 sp=o.ImageSpec(n,n,3,o.HALF);sp.attribute('compression','zip');out=o.ImageBuf(sp);out.set_pixels(o.ROI(0,n,0,n,0,1,0,3),np.ascontiguousarray(a));out.write(str(P/(label+'.exr')))
 print('CLOSURE_GRAIN_CLEANED',label,lo.tolist(),hi.tolist(),flush=True)
