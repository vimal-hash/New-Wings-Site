"""Decoded-pixel comparison of a re-compressed display PNG against its 16-bit master (no display transform applied).

Reports, on baked texels (gutters excluded): unique colours, RMSE/PSNR/max error in 8-bit units, mean per-channel shift,
the share of texels off by more than 2 / 4 / 8 levels, and a banding measure: in smooth regions of the master (local
gradient below 0.5 level) the candidate's local-gradient energy, where quantisation steps or dither noise show up.
Usage: blender -b --python png-candidate-compare.py -- <master16.png> <candidate.png> [<reference8.png>]
"""
import sys, json, numpy as np, OpenImageIO as oiio
paths = sys.argv[sys.argv.index('--') + 1:]
load = lambda p: oiio.ImageBuf(p).get_pixels(oiio.FLOAT)[..., :3]
m = load(paths[0])
lum = lambda x: x @ np.array([.2126, .7152, .0722], np.float32)
inside = lum(m) > .002
for ax in (0, 1):
    for s in (1, -1): inside &= np.roll(inside, s, ax)
grad = lambda x: np.abs(np.roll(lum(x), -1, 1) - lum(x)) + np.abs(np.roll(lum(x), -1, 0) - lum(x))
smooth = inside & (grad(m) * 255 < .5)
for p in paths[1:]:
    c = load(p); d = (c - m)[inside] * 255; e = np.abs(d).max(1)
    q = np.round(c[inside] * 255).astype(np.uint32); uniq = len(np.unique(q[:, 0] << 16 | q[:, 1] << 8 | q[:, 2]))
    rmse = float(np.sqrt((d ** 2).mean()))
    print('PNGCMP', json.dumps({'image': p.split('/')[-1], 'texels': int(inside.sum()), 'uniqueColours': uniq,
          'rmse8bit': round(rmse, 3), 'psnr_dB': round(20 * np.log10(255 / max(rmse, 1e-9)), 2), 'maxErr8bit': round(float(e.max()), 1),
          'meanShiftRGB8bit': np.round(d.mean(0), 3).tolist(), 'over2': round(float((e > 2).mean()), 4), 'over4': round(float((e > 4).mean()), 4),
          'over8': round(float((e > 8).mean()), 4), 'smoothTexels': int(smooth.sum()),
          'smoothGradMaster8bit': round(float(grad(m)[smooth].mean() * 255), 3), 'smoothGradCandidate8bit': round(float(grad(c)[smooth].mean() * 255), 3)}), flush=True)
