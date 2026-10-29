"""Before | after | Blender side-by-side for one item pose (same camera, same size), written for the reports.
Usage: blender -b --python triptych.py -- <reference-dir> <pose> <out.png>
"""
import sys, numpy as np, OpenImageIO as oiio
ref, pose, out = sys.argv[sys.argv.index('--') + 1:][:3]
imgs = [oiio.ImageBuf(f'{ref}/{pose}-{n}.png').get_pixels(oiio.FLOAT)[..., :3] for n in ('before', 'r3f', 'blender')]
gap = np.ones((imgs[0].shape[0], 6, 3), np.float32)
v = np.concatenate([imgs[0], gap, imgs[1], gap, imgs[2]], 1)
o = oiio.ImageBuf(oiio.ImageSpec(v.shape[1], v.shape[0], 3, oiio.UINT8)); o.set_pixels(oiio.ROI(0, v.shape[1], 0, v.shape[0], 0, 1, 0, 3), np.ascontiguousarray(v)); o.write(out)
print('TRIPTYCH', out, flush=True)
