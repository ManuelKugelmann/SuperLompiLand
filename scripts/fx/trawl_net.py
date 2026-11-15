# The trawl net (img/trawl_net.webp, 1600x600; the coder's trawl event): side view, the mouth at the
# right (MOUTH px from the right edge), headrope with orange floats along the top, footrope with dark
# bobbins along the bottom, a diamond mesh tapering left to the cod end bag with fish in it, and the
# otter board at the right edge on the seabed. Procedural, around the game's painted sardines. The
# coder stretches it vertically (600 -> about 600-900 px): round things are drawn squashed by STRETCH
# so they come out round, and the mesh is lines (it stays a mesh at any stretch).
# usage: python -I scripts/fx/trawl_net.py <repo root>
import sys, os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = sys.argv[1]
W, H, S = 1600, 600, 2               # picture, and supersampling
MOUTH = 110                          # px from the right edge
STRETCH = 1.25                       # the vertical stretch round things are drawn for
rng = np.random.default_rng(5)
w, h = W * S, H * S
img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

mx = (W - MOUTH) * S                 # the mouth's x
cod0, cod1 = 300 * S, 70 * S         # the cod end bag: from x cod0 left to cod1
def top(x):                          # top edge of the net: from the headrope at the mouth down to the bag
    t = np.clip((mx - x) / (mx - cod0), 0, 1)
    return (40 + 250 * t ** 0.8) * S
def bot(x):
    t = np.clip((mx - x) / (mx - cod0), 0, 1)
    return (565 - 95 * t ** 0.9) * S
def bag(x):                          # the bag's half height round its middle line, rounded at its end
    t = np.clip((cod0 - x) / (cod0 - cod1), 0, 1)
    return 105 * S * math.sqrt(max(0.0, 1 - t ** 2.2))
bagY = (top(cod0) + bot(cod0)) / 2

# --- The fish in the cod end (drawn first: the mesh lies over them).
fish = Image.open(os.path.join(ROOT, 'public', 'img', 'school', 'sardine.webp')).convert('RGBA')
for _ in range(22):
    x = rng.uniform(cod1 + 20 * S, cod0 + 60 * S); hh = bag(min(x, cod0)) * 0.8
    y = bagY + rng.uniform(-hh, hh)
    fw = int(rng.uniform(60, 95) * S)
    f = fish.resize((fw, int(fish.height * fw / fish.width / STRETCH)), Image.LANCZOS).rotate(rng.uniform(-35, 35), expand=True, resample=Image.BICUBIC)
    if rng.random() < 0.5: f = f.transpose(Image.FLIP_LEFT_RIGHT)
    img.alpha_composite(f, (int(x - f.width / 2), int(y - f.height / 2)))

# --- A faint body of netting (it reads as a volume of mesh, not only lines).
body = Image.new('L', (w, h), 0); bd = ImageDraw.Draw(body)
xs = np.linspace(cod1, mx, 120)
outline = [(x, top(x) if x >= cod0 else bagY - bag(x)) for x in xs] + [(x, bot(x) if x >= cod0 else bagY + bag(x)) for x in xs[::-1]]
bd.polygon(outline, fill=38)
img.alpha_composite(Image.merge('RGBA', [Image.new('L', (w, h), 70), Image.new('L', (w, h), 92), Image.new('L', (w, h), 84), body]))

# --- Diamond mesh: two families of lines across the net's own coordinates (u along, v across);
# the cells shrink toward the cod end, as on a real trawl.
def at(u, v):
    x = cod1 + (mx - cod1) * u
    if x >= cod0: y0, y1 = top(x), bot(x)
    else: y0, y1 = bagY - bag(x), bagY + bag(x)
    return x, y0 + (y1 - y0) * v
CELLS = 26
def u_of(k):                          # cell spacing along the net: tighter toward the cod end
    t = k / CELLS
    return math.copysign(abs(t) ** 1.25, t)
mesh = (58, 74, 66, 220)
for k in range(-CELLS, CELLS * 2):
    for sign in (1, -1):
        pts = []
        for j in range(0, 41):
            v = j / 40
            u = u_of(k + sign * v * 6)
            if 0 <= u <= 1: pts.append(at(u, v))
        if len(pts) > 1: d.line(pts, fill=mesh, width=int(1.6 * S))
# Edges of the net: heavier ropes.
d.line([at(u, 0) for u in np.linspace(0, 1, 80)], fill=(46, 58, 52, 255), width=int(2.6 * S))
d.line([at(u, 1) for u in np.linspace(0, 1, 80)], fill=(46, 58, 52, 255), width=int(2.6 * S))
# Cod end tie at the far left.
d.line([(cod1 + 6 * S, bagY - 30 * S), (cod1 - 18 * S, bagY + 34 * S)], fill=(150, 120, 70, 255), width=int(5 * S))

# --- Headrope with orange floats; footrope with dark bobbins (drawn squashed: they get stretched).
d.line([at(u, 0) for u in np.linspace(0.62, 1, 40)], fill=(170, 140, 90, 255), width=int(5 * S))
d.line([at(u, 1) for u in np.linspace(0.55, 1, 40)], fill=(40, 40, 40, 255), width=int(7 * S))
def ball(x, y, r, colour, rim, shine):
    ry = r / STRETCH
    d.ellipse([x - r, y - ry, x + r, y + ry], fill=rim)
    d.ellipse([x - r * 0.88, y - ry * 0.88, x + r * 0.88, y + ry * 0.88], fill=colour)
    d.ellipse([x - r * 0.55, y - ry * 0.7, x - r * 0.1, y - ry * 0.3], fill=shine)
for u in np.linspace(0.66, 0.99, 9):
    x, y = at(u, 0)
    ball(x, y - 4 * S, 15 * S, (240, 120, 36, 255), (150, 64, 20, 255), (255, 210, 160, 255))
for u in np.linspace(0.58, 0.99, 11):
    x, y = at(u, 1)
    ball(x, y + 4 * S, 17 * S, (44, 44, 48, 255), (16, 16, 18, 255), (110, 110, 118, 255))

# --- Otter board at the right edge on the seabed, with its bridles to the mouth's corners.
ox, oy = (W - 52) * S, (H - 70) * S
board = [(ox - 40 * S, oy - 120 * S / STRETCH), (ox + 44 * S, oy - 104 * S / STRETCH), (ox + 44 * S, oy + 64 * S / STRETCH), (ox - 40 * S, oy + 52 * S / STRETCH)]
d.polygon(board, fill=(96, 70, 52, 255), outline=(40, 30, 24, 255))
for k in range(1, 4):                 # planks and a steel shoe
    yy = oy - 120 * S / STRETCH + k * 46 * S / STRETCH
    d.line([(ox - 40 * S, yy), (ox + 44 * S, yy + 4 * S)], fill=(60, 44, 32, 255), width=int(2 * S))
d.line([(ox - 40 * S, oy + 52 * S / STRETCH), (ox + 44 * S, oy + 64 * S / STRETCH)], fill=(90, 92, 98, 255), width=int(6 * S))
for corner in (at(1, 0), at(1, 1)):
    d.line([(ox - 30 * S, oy - 40 * S / STRETCH), corner], fill=(50, 50, 50, 255), width=int(2.4 * S))

img = img.filter(ImageFilter.GaussianBlur(0.5 * S)).resize((W, H), Image.LANCZOS)
out = os.path.join(ROOT, 'public', 'img', 'trawl_net.webp')
img.save(out, quality=88, method=6)
print(out, img.size)
