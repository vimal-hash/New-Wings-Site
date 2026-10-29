"""Masked comparison of an R3F capture against the matched Blender reference (same pose and resolution).

Mask: the Blender target-object mask, eroded by 2 px so antialiased silhouettes and neighbours are excluded.
Errors are per-channel absolute differences of 8-bit display values inside the mask:
RMSE over all masked channels (and excluding pixels with any channel error > 20, usually silhouettes next to
still-diagnostic neighbours), p95 of the per-pixel max channel error, and mean colour of each image.
Usage: blender -b --python compare.py -- <item> <pose>
"""
import sys, json, numpy as np, OpenImageIO as oiio
from pathlib import Path
item, pose = sys.argv[sys.argv.index('--') + 1:][:2]
REPO = Path('D:/New folio/new site code/new_site_three')
cfg = json.loads((REPO / 'scripts/surface-bake/items.json').read_text())
ref = Path(cfg['authoringRoot']) / item / 'reference'
load = lambda p: oiio.ImageBuf(str(p)).get_pixels(oiio.FLOAT)[..., :3]
cand = sys.argv[sys.argv.index('--') + 1:][2] if len(sys.argv[sys.argv.index('--') + 1:]) > 2 else 'r3f'
r, b, m = load(ref / f'{pose}-{cand}.png'), load(ref / f'{pose}-blender.png'), load(ref / f'{pose}-mask.png')[..., 0] > .5
assert r.shape == b.shape, (r.shape, b.shape)
for _ in range(cfg['items'][item].get('maskErode', 2)): m = m & np.roll(m, 1, 0) & np.roll(m, -1, 0) & np.roll(m, 1, 1) & np.roll(m, -1, 1)
d = (r - b)[m] * 255
rep = {'item': item, 'pose': pose, 'maskedPixels': int(m.sum()), 'meanR3F': np.round(r[m].mean(0) * 255, 1).tolist() if m.any() else None,
       'meanBlender': np.round(b[m].mean(0) * 255, 1).tolist() if m.any() else None, 'rmse8bit': round(float(np.sqrt((d ** 2).mean())), 2) if m.any() else None,
       'outlierPixelsOver20': int((np.abs(d).max(1) > 20).sum()) if m.any() else None,
       'rmseExcludingOutliers8bit': round(float(np.sqrt((d[np.abs(d).max(1) <= 20] ** 2).mean())), 2) if m.any() else None,
       'p95MaxChannelErr8bit': round(float(np.percentile(np.abs(d).max(1), 95)), 1) if m.any() else None}
viz = np.concatenate([r, b, np.clip(np.abs(r - b) * 4, 0, 1) * m[..., None]], 1)
o = oiio.ImageBuf(oiio.ImageSpec(viz.shape[1], viz.shape[0], 3, oiio.UINT8)); o.set_pixels(oiio.ROI(0, viz.shape[1], 0, viz.shape[0], 0, 1, 0, 3), np.ascontiguousarray(viz, dtype=np.float32))
o.write(str(ref / (f'{pose}-compare.png' if cand == 'r3f' else f'{pose}-{cand}-compare.png')))
(ref / (f'{pose}-compare.json' if cand == 'r3f' else f'{pose}-{cand}-compare.json')).write_text(json.dumps(rep, indent=1)); print('COMPARE', json.dumps(rep))
