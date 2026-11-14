# The tutorial's ghost finger (key ghost_finger, 90x170, fingertip at (29, 10), pointing up, a
# hand below) and its tap ring (ghost_ring, 128x128): a soft, friendly, slightly translucent
# white hand with a light outline and a soft shadow, readable on bright lagoon water and on dark
# deep water alike. Procedural and deterministic.
#   public/img/ui/ghost_finger.webp, public/img/ui/ghost_ring.webp
# usage: python -I scripts/fx/ghost_finger.py <repo root>
import sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = sys.argv[1]
OUT = os.path.join(ROOT, 'public', 'img', 'ui')
os.makedirs(OUT, exist_ok=True)
W, H, SS = 90, 170, 4

def shape():
    """The hand's silhouette (supersampled): an index finger up, the other fingers curled, a thumb."""
    m = Image.new('L', (W * SS, H * SS), 0); d = ImageDraw.Draw(m)
    s = lambda *p: [v * SS for v in p]
    d.rounded_rectangle(s(19, 4, 40, 92), radius=10.5 * SS, fill=255)        # index finger, tip at (29, ~8)
    d.rounded_rectangle(s(14, 70, 78, 150), radius=22 * SS, fill=255)        # palm and curled fingers
    for x, y in ((40, 76), (54, 80), (66, 88)):                              # knuckles of the curled fingers
        d.ellipse(s(x - 2, y - 6, x + 16, y + 18), fill=255)
    d.rounded_rectangle(s(2, 96, 30, 122), radius=12 * SS, fill=255)         # thumb, tucked across
    d.rounded_rectangle(s(22, 140, 70, 168), radius=10 * SS, fill=255)       # wrist
    return m

m = shape()
a = np.asarray(m.resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
# soft shading: lit from the upper left, a touch of cool blue in the shadow side
edge = np.asarray(m.filter(ImageFilter.GaussianBlur(5 * SS)).resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
shade = np.clip(edge * 1.25, 0, 1)
col = np.stack([238 + 17 * shade, 244 + 11 * shade, 252 + 3 * shade], -1)
col = col * (0.92 + 0.08 * np.clip(1 - (xs - 20) / 70, 0, 1))[..., None]
# finger creases on the curled fingers
for x0, x1, y in ((38, 72, 96), (40, 74, 108)):
    band = np.clip(1 - np.abs(ys - y) / 1.2, 0, 1) * ((xs > x0) & (xs < x1))
    col = col * (1 - 0.18 * band[..., None])
# outline: a darker soft line for light water, a light glow outside it for dark water
ring_out = np.clip(np.asarray(m.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(3)).resize((W, H), Image.LANCZOS)).astype(np.float32) / 255 - a, 0, 1)
glow = np.clip(np.asarray(m.filter(ImageFilter.GaussianBlur(5 * SS)).resize((W, H), Image.LANCZOS)).astype(np.float32) / 255 * 1.4 - a, 0, 1)
shadow = np.zeros((H, W), np.float32)
sh = np.asarray(m.filter(ImageFilter.GaussianBlur(4 * SS)).resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
shadow[4:, 3:] = sh[:-4, :-3]
rgb = np.zeros((H, W, 3), np.float32); alpha = np.zeros((H, W), np.float32)
def over(c, al):
    global rgb, alpha
    rgb = rgb * (1 - al[..., None]) + np.array(c, np.float32) * al[..., None] if np.ndim(c) == 1 else rgb * (1 - al[..., None]) + c * al[..., None]
    alpha = al + alpha * (1 - al)
over(np.array([10, 30, 50]), shadow * 0.35)          # soft shadow, down-right
over(np.array([210, 240, 255]), glow * 0.45)         # light glow (reads on dark water)
over(np.array([60, 96, 128]), ring_out * 0.55)       # soft darker outline (reads on bright water)
over(col, a * 0.9)                                   # the hand, slightly translucent
rgb = rgb / np.maximum(alpha, 1e-4)[..., None]
# nothing reaches the picture's edge (no cut lines); the wrist fades out below
border = np.clip(np.minimum(np.minimum(xs, W - 1 - xs), ys) / 5, 0, 1) * np.clip((H - 1 - ys) / 26, 0, 1)
alpha = alpha * border
Image.fromarray(np.dstack([np.clip(rgb, 0, 255), np.clip(alpha * 255, 0, 255)]).astype(np.uint8), 'RGBA').save(os.path.join(OUT, 'ghost_finger.webp'), quality=92, method=6)

# tap ring: a soft white ring with a faint dark edge
S = 128
r = np.hypot(np.mgrid[0:S, 0:S][1] - S / 2 + 0.5, np.mgrid[0:S, 0:S][0] - S / 2 + 0.5)
ring = np.clip(1 - np.abs(r - 48) / 5, 0, 1)
dark = np.clip(1 - np.abs(r - 54) / 3, 0, 1) * 0.35
al = np.maximum(ring * 0.9, dark)
c = np.where(ring[..., None] >= dark[..., None], np.array([240, 250, 255]), np.array([40, 70, 96]))
Image.fromarray(np.dstack([c, al * 255]).astype(np.uint8), 'RGBA').save(os.path.join(OUT, 'ghost_ring.webp'), quality=92, method=6)
print('ok')
