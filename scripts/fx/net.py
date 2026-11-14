# Ghost-net drape for the whale (key whale_net, game/Whale.js): a band of old fishing net laid
# over her, its torn end trailing below, a few floats. Procedural and deterministic.
#   public/img/whale_net.webp   200x560 (mesh band to y 410, torn strands below; the same layout as the fallback)
# usage: python -I scripts/fx/net.py <repo root>
import sys, os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = sys.argv[1]
W, H, BAND, SS = 200, 560, 410, 4          # size, where the mesh band ends, supersampling
rng = np.random.default_rng(11)
img = Image.new('RGBA', (W * SS, H * SS), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

def col(shade=1.0, a=235):
    """Green-grey twine with a little variation (algae, sun-bleaching)."""
    base = np.array([118, 132, 104]) * (0.8 + 0.35 * rng.uniform()) * shade
    base = base + rng.normal(0, 6, 3)
    return tuple(int(v) for v in np.clip(base, 0, 255)) + (a,)

def sag(p, q, droop, n=8):
    """Points along a twine between knots p and q that hangs a little (parabola)."""
    out = []
    for i in range(n + 1):
        t = i / n
        out.append(((p[0] + (q[0] - p[0]) * t) * SS, (p[1] + (q[1] - p[1]) * t + droop * 4 * t * (1 - t)) * SS))
    return out

# Knots on a skewed diamond lattice, jittered; the net hangs a little narrower toward the bottom.
cols, rows, cw, rh = 7, 18, 30, 24
knots = {}
for r in range(rows):
    for c in range(cols + 1):
        x = 12 + c * cw + (cw / 2 if r % 2 else 0) + rng.normal(0, 2.5)
        y = 14 + r * rh + rng.normal(0, 2)
        squeeze = 1 - 0.12 * (y / BAND)
        knots[(r, c)] = ((x - W / 2) * squeeze + W / 2, y)
broken = {k for k in knots if rng.uniform() < 0.07}           # missing twines: holes in the mesh
for (r, c), p in knots.items():
    if p[1] > BAND: continue
    for dc in (0, 1) if r % 2 else (-1, 0):
        q = knots.get((r + 1, c + dc))
        if q is None or q[1] > BAND or (r, c) in broken: continue
        w = int(rng.uniform(2.2, 3.4) * SS)
        d.line(sag(p, q, rng.uniform(1, 4)), fill=col(), width=w, joint='curve')
for p in knots.values():
    if p[1] <= BAND:
        r = rng.uniform(2.6, 3.6) * SS
        d.ellipse([p[0] * SS - r, p[1] * SS - r, p[0] * SS + r, p[1] * SS + r], fill=col(0.8, 245))

# Headrope across the top, a little twisted.
pts = [((x) * SS, (8 + 3 * math.sin(x / 17)) * SS) for x in range(4, W - 3, 4)]
d.line(pts, fill=(96, 104, 82, 255), width=8 * SS, joint='curve')
for x in range(6, W - 4, 9):
    d.line([(x * SS, 5 * SS), ((x + 5) * SS, 11 * SS)], fill=(70, 78, 60, 200), width=2 * SS)

# The torn end: loose strands that hang and curl, some with a knot or a scrap of mesh.
for i in range(9):
    x0 = 18 + i * 20 + rng.normal(0, 4)
    length = rng.uniform(40, H - BAND - 12)
    bend = rng.normal(0, 14)
    pts = []
    for k in range(12):
        t = k / 11
        pts.append(((x0 + bend * t * t + 3 * math.sin(t * 6 + i)) * SS, (BAND - 4 + length * t) * SS))
    d.line(pts, fill=col(0.95, 225), width=int(rng.uniform(2, 3.2) * SS), joint='curve')
    if rng.uniform() < 0.5:
        e = pts[-1]; r = 3 * SS
        d.ellipse([e[0] - r, e[1] - r, e[0] + r, e[1] + r], fill=col(0.8, 240))

# Floats on the headrope: worn orange and white, shaded as little spheres.
for fx, fc in [(34, (226, 120, 46)), (104, (232, 226, 210)), (168, (214, 104, 40))]:
    cx, cy, R = fx * SS, 11 * SS, 11 * SS
    for k in range(R, 0, -SS):
        t = k / R
        shade = 0.62 + 0.38 * (1 - t) ** 0.6
        c = tuple(int(v * shade) for v in fc) + (255,)
        off = (1 - t) * R * 0.35
        d.ellipse([cx - k - off, cy - k - off, cx + k - off, cy + k - off], fill=c)
    d.ellipse([cx - R * 0.55, cy - R * 0.62, cx - R * 0.2, cy - R * 0.3], fill=(255, 255, 255, 150))   # highlight

out = img.resize((W, H), Image.LANCZOS)
# a faint dark edge so the twine reads on the whale's pale belly
a = np.asarray(out).astype(np.float32)
alpha = a[..., 3] / 255
halo = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.4))).astype(np.float32) / 255
rgb = a[..., :3] * alpha[..., None] + np.array([30, 36, 28]) * (1 - alpha[..., None])
alpha2 = np.maximum(alpha, halo * 0.35)
res = np.dstack([np.clip(rgb, 0, 255), np.clip(alpha2 * 255, 0, 255)]).astype(np.uint8)
Image.fromarray(res, 'RGBA').save(os.path.join(ROOT, 'public', 'img', 'whale_net.webp'), quality=92, method=6)
print('ok')
