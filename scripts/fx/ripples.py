# Sand ripples for the lagoon and beach floors: a strip that tiles sideways, laid along the
# seabed's top edge. Wavy ripple crests (lit on their up-current side, shaded behind), a few
# scattered shell grits, fading out downward into the sand and at the top edge.
#   public/img/fx/sand_ripples.webp  512x72 (RGBA; the crests run across it)
# usage: python -I scripts/fx/ripples.py <repo root>
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = sys.argv[1]
W, H = 512, 72
rng = np.random.default_rng(31)
ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)

def noise(size, h=H, w=W):
    n = rng.standard_normal((h, w))
    fy, fx = np.fft.fftfreq(h)[:, None], np.fft.fftfreq(w)[None, :]
    n = np.real(np.fft.ifft2(np.fft.fft2(n) * np.exp(-(fx ** 2 + fy ** 2) * size ** 2 * 2)))
    return (n - n.mean()) / (n.std() + 1e-9)

# Ripple phase: crests every ~22 px, bending and forking a little (whole number of crests per tile).
crests = 23
phase = xs / W * crests * 2 * np.pi + noise(40) * 1.6 + (ys / H) * 1.2
h = np.sin(phase)
h = np.sign(h) * np.abs(h) ** 0.7                     # sharper crests, flatter troughs
slope = np.cos(phase)                                 # lit side / shaded side
light = 0.5 + 0.5 * slope
col = np.ones((H, W, 3), np.float32) * np.array([238, 222, 180], np.float32)
col *= (0.82 + 0.26 * light)[..., None]
col = col * (1 - 0.1 * np.clip(-h, 0, 1)[..., None]) + np.array([20, 16, 6]) * 0     # troughs a touch darker
col *= (1 + 0.04 * noise(2))[..., None]               # sand grain
# shell grit and a few darker grains in the troughs
for _ in range(90):
    x, y, r = rng.uniform(0, W), rng.uniform(8, H - 8), rng.uniform(0.8, 1.8)
    d = np.hypot(np.minimum(np.abs(xs - x), W - np.abs(xs - x)), ys - y)
    m = np.clip(r - d + 0.5, 0, 1)
    c = np.array([250, 244, 230]) if rng.uniform() < 0.6 else np.array([150, 132, 104])
    col = col * (1 - m[..., None]) + c * m[..., None]
# alpha: soft at the top edge, fading out into the sand below
alpha = np.clip(ys / 6, 0, 1) * np.clip((H - ys) / 40, 0, 1) * 0.85
out = np.dstack([np.clip(col, 0, 255), alpha * 255]).astype(np.uint8)
os.makedirs(os.path.join(ROOT, 'public', 'img', 'fx'), exist_ok=True)
Image.fromarray(out, 'RGBA').save(os.path.join(ROOT, 'public', 'img', 'fx', 'sand_ripples.webp'), quality=90, method=6)
print('ok')
