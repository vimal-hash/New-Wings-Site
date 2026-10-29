"""Convergence check for a 6K rebake against the accepted bake of the same item.

The 6K display image is box-filtered down to the accepted image's size; at that common scale genuine material detail
matches, so any extra high-frequency residual would be sampling noise. Reports, on texels baked in both images:
the residual of the accepted image and of the downsampled 6K image (as noise-metric.py), and the RMSE between them.
Usage: blender -b --python convergence-check.py -- <accepted-display.png> <6k-display.png>
"""
import sys, json, numpy as np, OpenImageIO as oiio
old_path, new_path = sys.argv[sys.argv.index('--') + 1:][:2]
old = oiio.ImageBuf(old_path); h, w = old.spec().height, old.spec().width
small = oiio.ImageBufAlgo.resize(oiio.ImageBuf(new_path), filtername='box', roi=oiio.ROI(0, w, 0, h, 0, 1, 0, 3))
a = old.get_pixels(oiio.FLOAT)[..., :3]; b = small.get_pixels(oiio.FLOAT)[..., :3]
lum = lambda x: x @ np.array([.2126, .7152, .0722], np.float32)
inside = (lum(a) > .002) & (lum(b) > .002)
for ax in (0, 1):
    for s in (1, -1): inside &= np.roll(inside, s, ax)
def resid(x):
    l = lum(x); r = l - (np.roll(l, 1, 0) + np.roll(l, -1, 0) + np.roll(l, 1, 1) + np.roll(l, -1, 1)) / 4
    return round(float(1.4826 * np.median(np.abs(r[inside] * 255))), 3)
d = (a - b)[inside] * 255
print('CONVERGENCE', json.dumps({'accepted': old_path, 'size': [w, h], 'texels': int(inside.sum()), 'residualAccepted8bit': resid(a),
      'residual6kDownsampled8bit': resid(b), 'rmseAcceptedVs6kDownsampled8bit': round(float(np.sqrt((d ** 2).mean())), 3),
      'meanDiff8bit': np.round(d.mean(0), 3).tolist()}), flush=True)
