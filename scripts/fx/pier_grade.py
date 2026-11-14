# The harbour pier in the lookdev's warm wood (img/props/pier_deck, pier_pile_mid, pier_band,
# pier_foot): grey photo wood is remapped by its brightness onto a warm honey-wood ramp, while the
# growth on it (barnacles, mussels, moss, the tyre, rope) keeps its own colour; the pile strip gets
# a round shading across so it reads as a post. Per pixel only, so the pile strip stays seamless
# top to bottom. Reads the untouched originals from _ref/art-src/pier_old.
# usage: python -I scripts/fx/pier_grade.py <repo root> <originals dir>
import sys, os
import numpy as np
from PIL import Image

ROOT, SRC = sys.argv[1], sys.argv[2]
OUT = os.path.join(ROOT, 'public', 'img', 'props')
# Warm wood from its darkest grain to its sunlit top (the crate's and the wrecks' wood).
RAMP = np.array([[52, 28, 14], [112, 64, 30], [176, 110, 52], [222, 158, 84], [246, 204, 130]], np.float32) / 255

def ramp(l):
    t = np.clip(l, 0, 1) * (len(RAMP) - 1)
    i = np.minimum(np.floor(t).astype(int), len(RAMP) - 2)
    f = (t - i)[..., None]
    return RAMP[i] * (1 - f) + RAMP[i + 1] * f

def grade(name, round_across=False):
    a = np.asarray(Image.open(os.path.join(SRC, name + '.webp')).convert('RGBA')).astype(np.float32) / 255
    rgb = a[..., :3]
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1e-4)
    lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    # Wood: low saturation, neither near-white (barnacles) nor bluish (mussels) nor clearly green (moss).
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    wood = np.clip((0.42 - sat) / 0.2, 0, 1) * np.clip((0.8 - lum) / 0.15, 0, 1) * (b <= r + 0.04) * (g <= r + 0.06)
    l = np.clip((lum - 0.12) / 0.62, 0, 1) ** 0.9
    if round_across:                       # a post: light from the upper left, round across its width
        u = np.linspace(-1, 1, a.shape[1])[None, :]
        l = np.clip(l * (0.72 + 0.4 * np.cos(u * 1.35 + 0.35)), 0, 1)
    out = rgb * (1 - wood[..., None]) + ramp(l) * wood[..., None]
    Image.fromarray((np.dstack([np.clip(out, 0, 1), a[..., 3]]) * 255 + 0.5).astype(np.uint8), 'RGBA').save(os.path.join(OUT, name + '.webp'), quality=90, method=6)
    print(name, a.shape[1::-1])

grade('pier_deck')
grade('pier_pile_mid', round_across=True)
grade('pier_band', round_across=True)
grade('pier_foot', round_across=True)
