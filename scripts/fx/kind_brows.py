# Kind brows (img/friend_starfish.png, img/urchin.png): the painted brows slanted down toward the
# middle read as angry (playtest: "starfish and urchin look mean; friends must look kind"). Each brow
# is painted over with the skin around it and replaced by a soft arc raised at the inner end.
# Reads the untouched originals (kept outside public/).
# usage: python -I scripts/fx/kind_brows.py <originals dir> <repo root>
import sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC, ROOT = sys.argv[1], sys.argv[2]
# Per picture: brow boxes to clear (x0, y0, x1, y1), and the new arcs (box of the ellipse, start and end angle, width).
BROWS = {
    'friend_starfish': {'clear': [(152, 104, 200, 142), (262, 82, 312, 110)],
                        'arcs': [((160, 112, 218, 150), 200, 290, 7), ((266, 88, 324, 126), 250, 340, 7)],
                        'ink': (122, 42, 18)},
    'urchin': {'clear': [(158, 120, 216, 170), (294, 118, 352, 168)],
               'arcs': [((166, 132, 226, 176), 200, 290, 8), ((286, 132, 346, 176), 250, 340, 8)],
               'ink': (70, 30, 92)},
}

def ring_colour(a, box, pad=10):
    """The skin right around a box (median of a frame of pixels), so the patch matches."""
    x0, y0, x1, y1 = box
    X0, Y0, X1, Y1 = max(0, x0 - pad), max(0, y0 - pad), min(a.shape[1], x1 + pad), min(a.shape[0], y1 + pad)
    m = np.zeros(a.shape[:2], bool); m[Y0:Y1, X0:X1] = True; m[y0:y1, x0:x1] = False
    return np.median(a[m][:, :3], axis=0)

for name, spec in BROWS.items():
    img = Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')
    a = np.asarray(img).astype(np.float32)
    for box in spec['clear']:
        col = ring_colour(a, box)
        x0, y0, x1, y1 = box
        patch = Image.new('L', img.size, 0)
        ImageDraw.Draw(patch).ellipse(box, fill=255)
        m = np.asarray(patch.filter(ImageFilter.GaussianBlur(4))).astype(np.float32)[..., None] / 255
        # The skin colour with a little of the original's shading kept, so the patch is not flat.
        lum = a[..., :3].mean(-1, keepdims=True)
        shade = np.clip(lum / max(lum[y0:y1, x0:x1].mean(), 1), 0.85, 1.1)
        a[..., :3] = a[..., :3] * (1 - m) + (col * (0.9 + 0.1 * shade)) * m
    out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
    d = ImageDraw.Draw(out)
    for box, s, e, w in spec['arcs']:
        d.arc(box, s, e, fill=spec['ink'] + (235,), width=w)
    out.save(os.path.join(ROOT, 'public', 'img', name + '.png'), optimize=True)
    print(name, out.size)
