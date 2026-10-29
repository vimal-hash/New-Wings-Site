"""Decoded-texture quality of KTX2 candidates against the 16-bit display master (no display transform applied).

Inputs are level-0 decodes (e.g. basisu -unpack BC7/ASTC PNGs). On baked texels (gutters excluded) it reports:
- rmse / psnr / max error / share of texels off by > 2 and > 4 levels (8-bit units);
- darkBanding: RMS of the 7x7-box-filtered error in dark (luma < 40/255), smooth (master gradient < 0.5 level) texels.
  Dither noise averages out under the filter; contour steps from quantisation do not, so this tracks visible banding;
- detailRatio: high-frequency energy (pixel minus 3x3 mean) of the candidate / master on textured texels
  (master high-frequency > 0.5 level). Below 1 means fine detail was smoothed away.
Usage: blender -b --python decoded-quality.py -- <master16.png> <decoded.png> [...]
"""
import sys, json, numpy as np, OpenImageIO as oiio
args = sys.argv[sys.argv.index('--') + 1:]
load = lambda p: oiio.ImageBuf(p).get_pixels(oiio.FLOAT)[..., :3]
lum = lambda x: x @ np.array([.2126, .7152, .0722], np.float32)
def box(x, r):
    c = np.cumsum(np.cumsum(np.pad(x, ((r + 1, r), (r + 1, r))), 0), 1)
    n = 2 * r + 1
    return (c[n:, n:] - c[:-n, n:] - c[n:, :-n] + c[:-n, :-n]) / n ** 2
m = load(args[0]); ml = lum(m)
inside = ml > .002
for ax in (0, 1):
    for s in (1, -1): inside &= np.roll(inside, s, ax)
grad = np.abs(np.roll(ml, -1, 1) - ml) + np.abs(np.roll(ml, -1, 0) - ml)
hf_m = np.abs(ml - box(ml, 1))
dark = inside & (ml < 40 / 255) & (grad * 255 < .5)
textured = inside & (hf_m * 255 > .5)
for p in args[1:]:
    c = load(p); cl = lum(c); d = (c - m)[inside] * 255; e = np.abs(d).max(1); rmse = float(np.sqrt((d ** 2).mean()))
    band = box(cl - ml, 3)[dark] * 255
    hf_c = np.abs(cl - box(cl, 1))
    print('DECODED', json.dumps({'image': p.replace('\\', '/').split('/')[-1], 'rmse8bit': round(rmse, 3), 'psnr_dB': round(20 * np.log10(255 / max(rmse, 1e-9)), 2),
          'maxErr8bit': round(float(e.max()), 1), 'over2': round(float((e > 2).mean()), 4), 'over4': round(float((e > 4).mean()), 4),
          'darkTexels': int(dark.sum()), 'darkBanding8bit': round(float(np.sqrt((band ** 2).mean())), 3) if dark.any() else None,
          'texturedTexels': int(textured.sum()), 'detailRatio': round(float(hf_c[textured].mean() / max(hf_m[textured].mean(), 1e-9)), 3) if textured.any() else None}), flush=True)
