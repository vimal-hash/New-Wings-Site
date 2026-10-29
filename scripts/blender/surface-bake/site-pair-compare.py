"""Compare two sets of same-pose website captures that differ only in one texture (e.g. current vs candidate ceiling).

Per pose: share of pixels changed by > 2 / > 4 / > 8 levels (max channel), RMSE over changed pixels (> 1 level), max error, and
mean colour of changed pixels in each set; writes <out>/<pose>.png = A | B | |A-B| x 8.
Usage: blender -b --python site-pair-compare.py -- <dirA> <dirB> <out-dir>
"""
import sys, os, json, numpy as np, OpenImageIO as oiio
a_dir, b_dir, out = sys.argv[sys.argv.index('--') + 1:][:3]
os.makedirs(out, exist_ok=True)
for name in sorted(set(f for f in os.listdir(a_dir) if f.endswith('.png')) & set(os.listdir(b_dir))):
    a = oiio.ImageBuf(os.path.join(a_dir, name)).get_pixels(oiio.FLOAT)[..., :3]; b = oiio.ImageBuf(os.path.join(b_dir, name)).get_pixels(oiio.FLOAT)[..., :3]
    d = (b - a) * 255; e = np.abs(d).max(2); ch = e > 1
    rep = {'pose': name[:-4], 'over2': round(float((e > 2).mean()), 4), 'over4': round(float((e > 4).mean()), 4), 'over8': round(float((e > 8).mean()), 4),
           'maxErr8bit': round(float(e.max()), 1), 'rmseChanged8bit': round(float(np.sqrt((d[ch] ** 2).mean())), 2) if ch.any() else 0,
           'meanA_changed': np.round(a[ch].mean(0) * 255, 1).tolist() if ch.any() else None, 'meanB_changed': np.round(b[ch].mean(0) * 255, 1).tolist() if ch.any() else None}
    gap = np.ones((a.shape[0], 6, 3), np.float32)
    v = np.concatenate([a, gap, b, gap, np.clip(np.abs(b - a) * 8, 0, 1)], 1)
    o = oiio.ImageBuf(oiio.ImageSpec(v.shape[1], v.shape[0], 3, oiio.UINT8)); o.set_pixels(oiio.ROI(0, v.shape[1], 0, v.shape[0], 0, 1, 0, 3), np.ascontiguousarray(v)); o.write(os.path.join(out, name))
    print('SITEPAIR', json.dumps(rep), flush=True)
