"""Small preview strip of several items' display bakes (authoring check only)."""
import sys, numpy as np, OpenImageIO as oiio
from pathlib import Path
a = sys.argv[sys.argv.index('--') + 1:]; root = Path('D:/CodexOutputs/Restoration_20261024'); out = a[0]; tiles = []
for item in a[1:]:
    b = oiio.ImageBuf(str(root / item / 'bake-display-8.png')); s = b.spec(); h = 400; w = max(1, round(s.width * h / s.height))
    r = oiio.ImageBufAlgo.resize(b, roi=oiio.ROI(0, w, 0, h, 0, 1, 0, 3)).get_pixels(oiio.FLOAT)[..., :3]
    tiles.append(r); tiles.append(np.ones((h, 8, 3), np.float32) * .3)
img = np.concatenate(tiles, 1) ** (1 / 1.6)  # brightened for inspection only
o = oiio.ImageBuf(oiio.ImageSpec(img.shape[1], img.shape[0], 3, oiio.UINT8)); o.set_pixels(oiio.ROI(0, img.shape[1], 0, img.shape[0], 0, 1, 0, 3), np.ascontiguousarray(img, dtype=np.float32)); o.write(out)
