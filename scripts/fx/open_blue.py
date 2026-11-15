# The reef book's picture of the open blue (img/open_blue.webp): the only place without a floor, so
# no single prop says it. Composed from the game's own painted art: deep blue fading down, light
# shafts from the surface, a far whale as a hazy silhouette and a school of sardines turning
# close by; a soft oval edge like the other pictures' cutouts. Procedural around the painted fish.
# usage: python -I scripts/fx/open_blue.py <repo root>
import sys, os, math
import numpy as np
from PIL import Image, ImageFilter

ROOT = sys.argv[1]
W, H = 640, 448
TOP, BOTTOM = np.array([110, 214, 238], np.float32), np.array([12, 58, 120], np.float32)
rng = np.random.default_rng(3)

y = np.linspace(0, 1, H)[:, None, None]
img = TOP * (1 - y ** 0.8) + BOTTOM * y ** 0.8
img = np.repeat(img, W, axis=1)
# Light shafts from the surface, slanted, soft.
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
for k in range(6):
    x0, wdt, slant = rng.uniform(-0.1, 1.0) * W, rng.uniform(18, 50), 0.32
    d = np.abs(xx - (x0 + yy * slant)) / wdt
    a = np.clip(1 - d, 0, 1) ** 2 * np.clip(1 - yy / (H * 0.85), 0, 1) * rng.uniform(0.12, 0.22)
    img = img + (np.array([230, 250, 255], np.float32) - img) * a[..., None]
base = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')

def paste(pic, x, y, w, alpha=1.0, flip=False, haze=0.0, blur=0.0):
    p = pic.copy()
    if flip: p = p.transpose(Image.FLIP_LEFT_RIGHT)
    p = p.resize((int(w), int(p.height * w / p.width)), Image.LANCZOS)
    a = np.asarray(p).astype(np.float32)
    if haze:                                   # far things take on the water's colour
        water = TOP * 0.45 + BOTTOM * 0.55
        a[..., :3] = a[..., :3] * (1 - haze) + water * haze
    a[..., 3] *= alpha
    p = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
    if blur: p = p.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(p, (int(x - p.width / 2), int(y - p.height / 2)))

whale = Image.open(os.path.join(ROOT, 'public', 'img', 'whale.webp')).convert('RGBA')
paste(whale, W * 0.36, H * 0.62, W * 0.62, alpha=0.85, haze=0.78, blur=2.5)
fish = Image.open(os.path.join(ROOT, 'public', 'img', 'school', 'sardine.webp')).convert('RGBA')
# A school turning in an arc: nearer fish larger and clearer.
for i in range(46):
    t = i / 46
    a = 0.6 + t * 2.4 + rng.normal(0, 0.12)
    r = 120 + rng.normal(0, 22)
    cx, cy = W * 0.58 + math.cos(a) * r * 1.25, H * 0.42 + math.sin(a) * r * 0.85
    near = rng.uniform(0, 1)
    paste(fish, cx, cy, 40 + near * 38, alpha=0.9, flip=math.sin(a) > 0, haze=0.4 * (1 - near))
# Soft oval edge.
m = np.clip((1 - np.hypot((xx - W / 2) / (W * 0.5), (yy - H / 2) / (H * 0.5))) / 0.16, 0, 1)
a = np.asarray(base).astype(np.float32); a[..., 3] *= m
Image.fromarray(a.astype(np.uint8), 'RGBA').save(os.path.join(ROOT, 'public', 'img', 'open_blue.webp'), quality=88, method=6)
print('open_blue', (W, H))
