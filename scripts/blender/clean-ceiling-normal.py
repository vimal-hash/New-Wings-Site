"""Neutral, mip-safe atlas background and footprint-appropriate normal detail."""
import bpy,numpy as np,json
import OpenImageIO as oiio
from pathlib import Path
P=Path('D:/CodexOutputs/Theatre_Ceiling_PBR_20261023')
image=oiio.ImageBuf(str(P/'normal.png'));pixels=image.get_pixels(oiio.FLOAT)[...,:3];h,w=pixels.shape[:2]
valid=np.any(pixels>.01,axis=-1)
rgba=np.concatenate([pixels,valid[...,None].astype(np.float32)],axis=-1)
source=oiio.ImageBuf(oiio.ImageSpec(w,h,4,oiio.FLOAT));source.set_pixels(oiio.ROI(0,w,0,h,0,1,0,4),np.ascontiguousarray(rgba))
filled=oiio.ImageBufAlgo.fillholes_pushpull(source).get_pixels(oiio.FLOAT)[...,:3]
# Filter unit vectors, not encoded RGB with a black background. The original
# 0.3mm plaster grain is subpixel at the approved theatre distance.
vector=filled*2-1
vector=vector.reshape(h//2,2,w//2,2,3).mean(axis=(1,3))
vector/=np.maximum(np.linalg.norm(vector,axis=-1,keepdims=True),1e-8)
result=np.round(np.clip(vector*.5+.5,0,1)*255).astype(np.uint8)
out=oiio.ImageBuf(oiio.ImageSpec(w//2,h//2,3,oiio.UINT8));out.set_pixels(oiio.ROI(0,w//2,0,h//2,0,1,0,3),result);out.write(str(P/'normal-clean.png'))
print('CEILING_NORMAL_FILTERED',json.dumps({'source':[w,h],'output':[w//2,h//2],'originalBumpDistance':.0003,'unchangedGeometry':True}),flush=True)
