# The foam a splash leaves on the water (img/fx/splash_foam.webp, the coder's splash: drawn flattened
# to about 0.22 of its width, riding the wave line): a wide, flat patch of churned white water, thick
# in the middle and breaking up toward its soft ends, with lacy holes, streaks along the water and a
# few small bubbles. Transparent, procedural.
# usage: python -I scripts/fx/splash_foam.py <repo root>
import sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as nd

ROOT = sys.argv[1]
W, H = 512, 128
rng = np.random.default_rng(7)
ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)

def noise(sx, sy):
    """Smooth noise with features about sx by sy px (stretched along the water)."""
    n = rng.standard_normal((H, W))
    return nd.gaussian_filter(n, (sy, sx), mode='wrap') / (nd.gaussian_filter(n, (sy, sx), mode='wrap').std() + 1e-9)

u, v = xs / W * 2 - 1, ys / H * 2 - 1
# Patch outline: an ellipse whose edge wanders, thinning toward the ends.
edge = 1 - (u ** 2) ** 0.9 - (v / (0.75 - 0.35 * np.abs(u))) ** 2
edge = edge + 0.25 * noise(26, 6)
body = np.clip(edge * 2.2, 0, 1)
# Lace: holes and streaks of open water inside the foam, more toward the ends.
lace = np.clip(noise(9, 3) * 0.6 + noise(22, 4) * 0.5 + 0.75 - np.abs(u) * 0.6, 0, 1)
streak = np.clip(np.sin(ys / H * np.pi * 9 + noise(60, 8) * 1.5) * 0.5 + 0.5, 0, 1) ** 3
alpha = body * np.clip(lace * 1.4, 0, 1) * (0.75 + 0.25 * streak)
alpha = nd.gaussian_filter(alpha, 0.8)
# Colour: white foam, a little blue-grey in its thin parts and shadowed underside.
shade = 0.86 + 0.14 * np.clip(alpha * 1.3, 0, 1) - 0.08 * np.clip(v, 0, 1)
col = np.dstack([235 * shade, 246 * shade, 252 * shade])
img = Image.fromarray(np.dstack([np.clip(col, 0, 255), np.clip(alpha, 0, 1) * 255]).astype(np.uint8), 'RGBA')
# Small bubbles: light rims, clear inside.
d = ImageDraw.Draw(img)
for _ in range(26):
    x, y = rng.uniform(0.12, 0.88) * W, rng.uniform(0.25, 0.75) * H
    r = rng.uniform(1.5, 4)
    if body[int(y), int(x)] < 0.3: continue
    d.ellipse([x - r, y - r, x + r, y + r], outline=(255, 255, 255, 210), width=1)
out = os.path.join(ROOT, 'public', 'img', 'fx', 'splash_foam.webp')
img.save(out, quality=90, method=6)
print(out, img.size)
