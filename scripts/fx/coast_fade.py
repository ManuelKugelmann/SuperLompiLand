# Near coasts (img/coast/<id>.webp on the sky layer) never end in a cut: where a picture is still
# solid at its left or right border, its outer share fades out (a soft end, like the haze).
# Reads the untouched originals from _ref/art-src/coast_old.
# usage: python -I scripts/fx/coast_fade.py <repo root> <originals dir>
import sys, os
import numpy as np
from PIL import Image

ROOT, SRC = sys.argv[1], sys.argv[2]
SHARE = 0.07          # share of the width over which a solid end fades out
for name in ('harbour', 'reef', 'kelp', 'shore'):
    a = np.asarray(Image.open(os.path.join(SRC, name + '.webp')).convert('RGBA')).astype(np.float32)
    W = a.shape[1]; n = max(1, int(W * SHARE)); x = np.arange(W, dtype=np.float32)
    ramp = np.ones(W, np.float32)
    if a[:, 0, 3].max() > 32: ramp = np.minimum(ramp, np.clip(x / n, 0, 1) ** 1.5)
    if a[:, -1, 3].max() > 32: ramp = np.minimum(ramp, np.clip((W - 1 - x) / n, 0, 1) ** 1.5)
    a[..., 3] *= ramp[None, :]
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA').save(os.path.join(ROOT, 'public', 'img', 'coast', name + '.webp'), quality=90, method=6)
    print(name, 'faded' if ramp.min() < 1 else 'unchanged')
