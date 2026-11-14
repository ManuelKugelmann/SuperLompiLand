# Mangroves as seen from the water (img/root_top_1..2): the canopy sits low on the prop roots, its
# lowest leaves just above the waterline, so near the surface the top of the view shows leaves and
# the tree reads as going on up (tester: "the top of the tree is just missing"). Built from the tall
# painted trees (originals in _ref/art-src/mangrove/orig): the trunk between canopy and roots is cut
# out and the canopy lowered onto the root arches, with a soft seam.
# usage: python -I scripts/fx/mangrove_squat.py <repo root> <originals dir>
import sys, os
import numpy as np
from PIL import Image

ROOT, SRC = sys.argv[1], sys.argv[2]
CANOPY, ROOTS, OVERLAP = 0.62, 0.92, 0.05   # canopy: rows above this share of the height; roots: rows below; the canopy's foot overlaps the roots by this share

for n in (1, 2):
    im = np.asarray(Image.open(os.path.join(SRC, f'root_top_{n}.webp')).convert('RGBA')).astype(np.float32)
    H = im.shape[0]
    canopy, roots = im[:int(H * CANOPY)], im[int(H * ROOTS):]
    ov = int(H * OVERLAP)
    out = np.zeros((canopy.shape[0] + roots.shape[0] - ov, im.shape[1], 4), np.float32)
    out[out.shape[0] - roots.shape[0]:] = roots
    # The canopy over the roots, its last rows fading so the seam is soft leaves, not a cut.
    a = canopy[..., 3:4] / 255
    fade = np.ones((canopy.shape[0], 1, 1), np.float32)
    fade[-ov:, 0, 0] = np.linspace(1, 0.0, ov) ** 0.7
    a = a * fade
    top = out[:canopy.shape[0]]
    top[..., :3] = canopy[..., :3] * a + top[..., :3] * (1 - a)
    top[..., 3:4] = 255 * (a + top[..., 3:4] / 255 * (1 - a))
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA').save(os.path.join(ROOT, 'public', 'img', f'root_top_{n}.webp'), quality=90, method=6)
    print(n, im.shape[:2], '->', out.shape[:2])
