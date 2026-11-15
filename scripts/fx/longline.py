# The longline's pictures (realistic, inanimate hazard; spec 7.1), painted procedurally at twice the
# coder's canvas size: a steel J hook with its eye at the top and a bit of bait on the point
# (img/longline_hook.webp, 104x184) and a round orange float with a rope loop on top
# (img/longline_float.webp, 192x144). Lit from the upper left, as the game's art.
# usage: python -I scripts/fx/longline.py <repo root>
import sys, os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = sys.argv[1]
S = 4                                   # supersampling

def save(img, w, h, name):
    img = img.resize((w, h), Image.LANCZOS)
    img.save(os.path.join(ROOT, 'public', 'img', name), quality=92, method=6)
    print(name, img.size)

# --- Hook: an eye ring, a straight shank, a J bend, a barbed point; steel with a bright edge.
W, H = 104 * S, 184 * S
hook = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(hook)
cx, th = W * 0.58, 7 * S                 # shank x, wire thickness
def stroke(points, width, colour):
    d.line(points, fill=colour, width=width, joint='curve')
    for p in (points[0], points[-1]): d.ellipse([p[0] - width / 2, p[1] - width / 2, p[0] + width / 2, p[1] + width / 2], fill=colour)
# The J: the shank comes down, bends round under a centre to its left, and rises to the point.
R = 24 * S
bend = [(cx - R + R * math.cos(a), H * 0.66 + R * math.sin(a)) for a in np.linspace(0, math.pi, 24)]
path = [(cx, H * 0.14), (cx, H * 0.66)] + bend + [(cx - 2 * R, H * 0.66 - 22 * S)]
for width, colour in [(th + 3 * S, (40, 46, 54, 255)), (th, (128, 136, 146, 255)), (th // 2, (206, 214, 222, 255))]:
    stroke(path, width, colour)
# Eye ring at the top.
for width, colour in [(th + 3 * S, (40, 46, 54, 255)), (th, (128, 136, 146, 255))]:
    d.ellipse([cx - 13 * S, H * 0.05, cx + 13 * S, H * 0.05 + 26 * S], outline=colour, width=width)
# Barb at the point.
px, py = path[-1]
d.polygon([(px - 3 * S, py - 4 * S), (px + 12 * S, py + 10 * S), (px + 2 * S, py + 12 * S)], fill=(60, 66, 74, 255))      # the barb points back in, toward the shank
# Bait: a small piece of squid on the bend, soft pink-white.
bx, by = bend[12]
d.ellipse([bx - 16 * S, by - 12 * S, bx + 16 * S, by + 12 * S], fill=(236, 206, 196, 255))
d.ellipse([bx - 10 * S, by - 8 * S, bx + 2 * S, by], fill=(250, 236, 230, 255))
hook = hook.filter(ImageFilter.GaussianBlur(0.6 * S))
save(hook, 104, 184, 'longline_hook.webp')

# --- Float: a round orange buoy, shaded as a sphere, a white band, a rope loop on top.
W, H = 192 * S, 144 * S
y, x = np.mgrid[0:H, 0:W].astype(np.float32)
cx, cy, R = W / 2, H * 0.58, H * 0.4
dx, dy = (x - cx) / R, (y - cy) / R
r2 = dx * dx + dy * dy * 1.15
inside = r2 < 1
nz = np.sqrt(np.clip(1 - r2, 0, 1))
light = np.clip(-0.45 * dx - 0.6 * dy + 0.65 * nz, 0, 1)
base = np.array([236, 104, 32], np.float32)
col = base[None, None, :] * (0.45 + 0.75 * light[..., None])
band = (np.abs(dy) < 0.12) & inside
col[band] = col[band] * 0.2 + np.array([240, 236, 226]) * 0.8 * (0.6 + 0.5 * light[band][..., None])
spec = np.clip((light - 0.86) / 0.14, 0, 1) ** 2
col = col + (255 - col) * spec[..., None]
alpha = np.clip((1 - r2) * R / 2, 0, 1) * 255
flo = Image.fromarray(np.dstack([np.clip(col, 0, 255), alpha]).astype(np.uint8), 'RGBA')
d = ImageDraw.Draw(flo)
d.arc([cx - 18 * S, cy - R / 1.072 - 22 * S, cx + 18 * S, cy - R / 1.072 + 14 * S], 180, 360, fill=(120, 100, 70, 255), width=5 * S)      # its foot sits on the float's top
save(flo, 192, 144, 'longline_float.webp')
