# The lagoon's sandbar (img/sandbar.webp, 1500x300 as SandbarLayer draws it): a long low bar of
# pale sand seen from the side, its crown just above the water (the top 40 px: dry, bright), a
# darker wet band at the waterline, rippled sand fading into the water below, a few shells and
# a tuft of seagrass on the crown. Procedural (sand grain, ripples, shading) plus the game's own
# micro shells and seagrass pictures. Deterministic.
# usage: python -I scripts/fx/sandbar.py <repo root>
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = sys.argv[1]
IMG = os.path.join(ROOT, 'public', 'img')
W, H, CROWN = 1500, 300, 40          # SANDBAR.width / height / crown (level/sandbar.js)
rng = np.random.default_rng(21)
ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
u = xs / (W - 1)

# Outline: a long low mound, its top a little lumpy; below the waterline it fades into the water.
top = 6 + (1 - np.clip(np.sin(np.pi * u), 0, 1) ** 0.55) * (H * 0.62) + nd.gaussian_filter1d(rng.normal(0, 1, W), 25)[None, :] * 3
body = np.clip((ys - top) / 2.5, 0, 1)
fade = np.clip((H - ys) / (H * 0.45), 0, 1) ** 1.3
ends = np.clip(np.minimum(u, 1 - u) / 0.12, 0, 1) ** 1.5                # both ends thin out into the water: no cut at the picture's edge
alpha = body * fade * ends

# Sand: pale, fine grain, gentle ripples running along the bar, darker lower down (seen through water).
grain = nd.gaussian_filter(rng.normal(0, 1, (H, W)), 0.7) * 0.05 + nd.gaussian_filter(rng.normal(0, 1, (H, W)), 4) * 0.06
ripples = np.sin(xs * 0.045 + np.sin(ys * 0.05) * 2 + ys * 0.35) * 0.035 * np.clip((ys - CROWN) / 60, 0, 1)
dry = np.array([0.96, 0.89, 0.72]); wet = np.array([0.66, 0.57, 0.40]); under = np.array([0.55, 0.62, 0.55])
light = 1 + grain + ripples - (ys - top) / H * 0.25                   # lit from above
wl = CROWN + 2 * np.sin(xs * 0.02)                                     # the waterline
k_wet = np.exp(-((ys - wl) / 11) ** 2)                                  # the dark wet band at the waterline
k_under = np.clip((ys - wl) / 90, 0, 1)                                # under water: cooler, greener
col = dry[None, None, :] * (1 - k_under[..., None]) + under[None, None, :] * k_under[..., None]
col = col * (1 - 0.8 * k_wet[..., None]) + wet[None, None, :] * 0.8 * k_wet[..., None]
col = np.clip(col * light[..., None], 0, 1)
# A glint of wet sand just above the waterline.
col += (np.exp(-((ys - (wl - 6)) / 3) ** 2) * 0.18)[..., None] * (body > 0.5)[..., None]
img = Image.fromarray((np.dstack([np.clip(col, 0, 1), alpha]) * 255).astype(np.uint8), 'RGBA')

def put(name, x, base, height, flip=False):
    """Paste a game picture standing on the sand at x (its foot at `base` px)."""
    p = os.path.join(IMG, name)
    if not os.path.exists(p): return
    a = Image.open(p).convert('RGBA')
    a = a.resize((max(1, round(a.width * height / a.height)), height), Image.LANCZOS)
    if flip: a = a.transpose(Image.FLIP_LEFT_RIGHT)
    img.alpha_composite(a, (int(x - a.width / 2), int(base - a.height)))

crown_y = lambda x: int(top[0, int(x)]) + 6
# Seagrass tufts low enough to fit above the crown (the picture's top is only a few px above it).
put(os.path.join('props', 'seagrass_1.webp'), W * 0.56, crown_y(W * 0.56) + 22, 30)
put(os.path.join('props', 'seagrass_1.webp'), W * 0.59, crown_y(W * 0.59) + 24, 26, flip=True)
for i, (x, h) in enumerate([(0.38, 30), (0.47, 24), (0.66, 28), (0.72, 22)]):
    put(os.path.join('micro', f'micro_shells_{i % 3}.webp'), W * x, crown_y(W * x) + 10, h)
img.save(os.path.join(IMG, 'sandbar.webp'), quality=88, method=6)
print('ok', img.size)
