# The near coasts as seen on the horizon (img/coast/<id>.webp): the painted coast pieces hazed by the
# air between, so they read as far off without a tint (a tint only multiplies: the near-black rock
# stayed black). Darks are lifted toward the sky's colour more than the lights, contrast drops, the
# detail softens; the alpha is kept. Run on the untouched originals (kept outside public/).
# usage: python -I scripts/fx/coast_haze.py <originals dir> <repo root>   (the near coasts only: <biome id>.webp; the sea arch is close by and stays crisp)
import sys, os
import numpy as np
from PIL import Image, ImageFilter

SRC, ROOT = sys.argv[1], sys.argv[2]
FOG = np.array([186, 220, 230], np.float32)   # the sky low over the sea
HAZE = (0.28, 0.62)                           # share of fog over the lightest .. the darkest values
SOFT = 1.2                                    # px of blur: far detail is out of focus

for f in [os.path.join(SRC, f'{b}.webp') for b in ('reef', 'kelp', 'harbour', 'shore')]:
    img = Image.open(f).convert('RGBA')
    a = np.asarray(img.filter(ImageFilter.GaussianBlur(SOFT))).astype(np.float32)
    a[..., 3] = np.asarray(img)[..., 3]       # the outline stays crisp enough to read
    rgb = a[..., :3]
    lum = (rgb @ np.array([0.299, 0.587, 0.114], np.float32) / 255)[..., None]
    h = HAZE[0] + (HAZE[1] - HAZE[0]) * (1 - lum)
    a[..., :3] = rgb * (1 - h) + FOG * h
    out = os.path.join(ROOT, 'public', 'img', 'coast', os.path.basename(f))
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA').save(out, quality=88, method=6)
    print(out, img.size)
