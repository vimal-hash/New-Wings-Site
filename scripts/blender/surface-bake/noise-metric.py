"""Per-texel high-frequency residual of display-referred bakes (convergence check).

For each image: residual = pixel - mean of its 4 neighbours, on texels whose 3x3 neighbourhood is inside the baked
area (gutters are black). Reports a robust sigma (1.4826 * median absolute residual) in 8-bit display units.
Sampling noise and genuine fine material detail both contribute, so a lower value at a finer texel size means the
bake is no noisier than the one it replaces; it is not a pure noise measurement.
Usage: blender -b --python noise-metric.py -- <display.png> [...]
"""
import sys, json, numpy as np, OpenImageIO as oiio
for p in sys.argv[sys.argv.index('--') + 1:]:
    a = oiio.ImageBuf(p).get_pixels(oiio.FLOAT)[..., :3] @ np.array([.2126, .7152, .0722], np.float32)
    inside = a > .002
    for ax in (0, 1):
        for s in (1, -1): inside &= np.roll(inside, s, ax)
    r = a - (np.roll(a, 1, 0) + np.roll(a, -1, 0) + np.roll(a, 1, 1) + np.roll(a, -1, 1)) / 4
    v = r[inside] * 255
    print('NOISE', json.dumps({'image': p, 'size': list(a.shape[::-1]), 'texels': int(inside.sum()),
          'robustSigma8bit': round(float(1.4826 * np.median(np.abs(v))), 3), 'meanLuma8bit': round(float(a[inside].mean() * 255), 2)}), flush=True)
