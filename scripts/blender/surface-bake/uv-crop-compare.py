"""Side-by-side crop of the same normalized UV rectangle from two bakes (any resolutions), for noise/detail inspection.
Usage: blender -b --python uv-crop-compare.py -- old.png new.png out.png u0 v0 u1 v1 [gain]   (v measured from the image top)"""
import sys, numpy as np, OpenImageIO as oiio
a = sys.argv[sys.argv.index('--') + 1:]; old, new, out = a[:3]; u0, v0, u1, v1 = map(float, a[3:7]); gain = float(a[7]) if len(a) > 7 else 1
def crop(p, H=600):
    b = oiio.ImageBuf(p); s = b.spec(); x0, x1, y0, y1 = int(u0 * s.width), int(u1 * s.width), int(v0 * s.height), int(v1 * s.height)
    c = oiio.ImageBufAlgo.cut(b, oiio.ROI(x0, x1, y0, y1)); w = round(H * (x1 - x0) / (y1 - y0))
    return oiio.ImageBufAlgo.resize(c, roi=oiio.ROI(0, w, 0, H, 0, 1, 0, 3), filtername='box').get_pixels(oiio.FLOAT)[..., :3] * gain, (x1 - x0, y1 - y0)
A, sa = crop(old); B, sb = crop(new)
img = np.clip(np.concatenate([A, np.ones((A.shape[0], 8, 3), np.float32), B], 1), 0, 1)
o = oiio.ImageBuf(oiio.ImageSpec(img.shape[1], img.shape[0], 3, oiio.UINT8)); o.set_pixels(oiio.ROI(0, img.shape[1], 0, img.shape[0], 0, 1, 0, 3), np.ascontiguousarray(img)); o.write(out)
print('CROP old px', sa, 'new px', sb)
