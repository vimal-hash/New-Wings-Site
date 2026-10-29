"""16-bit display-referred bake -> 8-bit PNG with triangular dither (no display transform applied here)."""
import sys, numpy as np, OpenImageIO as oiio
src, dst = sys.argv[sys.argv.index('--') + 1:]
a = oiio.ImageBuf(src).get_pixels(oiio.FLOAT)[..., :3]
h, w, _ = a.shape
rng = np.random.default_rng(7); d = (rng.random((h, w, 1)) - rng.random((h, w, 1))) / 255.0
q = np.clip(np.round((a + d) * 255), 0, 255).astype(np.uint8)
out = oiio.ImageBuf(oiio.ImageSpec(w, h, 3, oiio.UINT8)); out.set_pixels(oiio.ROI(0, w, 0, h, 0, 1, 0, 3), q); out.write(dst)
