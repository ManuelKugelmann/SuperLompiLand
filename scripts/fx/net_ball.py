# The ghost net a friend is caught in (key beat_net, game/StoryBeats.js): old green-grey rope
# mesh wrapped round into a ball (the mesh squeezes toward its rim, as on a sphere), gathered in
# a knot at the top with a float, a few broken meshes, a tangle of weed, torn strands below.
#   public/img/beat_net.webp  512x512 (RGBA)
# usage: python -I scripts/fx/net_ball.py <repo root>
import sys, os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = sys.argv[1]
S, SS = 512, 3
R = S * 0.4                      # the ball's radius
CX, CY = S / 2, S * 0.56
rng = np.random.default_rng(17)
img = Image.new('RGBA', (S * SS, S * SS), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

def twine(shade=1.0, a=230):
    base = np.array([116, 132, 100]) * (0.78 + 0.35 * rng.uniform()) * shade + rng.normal(0, 6, 3)
    return tuple(int(v) for v in np.clip(base, 0, 255)) + (a,)

def sphere(u, v):
    """Mesh coordinates (u around, v down; both -1..1) onto the ball's disc, squeezed toward the rim."""
    lon, lat = u * math.pi * 0.5, v * math.pi * 0.5
    x = math.cos(lat) * math.sin(lon)
    y = math.sin(lat)
    return CX + x * R, CY + y * R * 0.96

# Back half first (darker, seen through the front), then the front half.
for side, shade, alpha in ((-1, 0.62, 150), (1, 1.0, 235)):
    n = 11
    knots = {}
    for i in range(-n, n + 1):
        for j in range(-n, n + 1):
            if (i + j) % 2: continue
            u, v = i / n, j / n
            if u * u + v * v > 1.25: continue
            off = 0.5 / n if side < 0 else 0
            knots[(i, j)] = sphere(max(-1, min(1, u + off + rng.normal(0, 0.012))), max(-1, min(1, v + rng.normal(0, 0.012))))
    broken = {k for k in knots if rng.uniform() < (0.08 if side > 0 else 0.03)}
    for (i, j), p in knots.items():
        for di, dj in ((1, 1), (-1, 1)):
            q = knots.get((i + di, j + dj))
            if q is None or (i, j) in broken: continue
            sag = rng.uniform(0.5, 2.5)
            pts = [((p[0] + (q[0] - p[0]) * t) * SS, (p[1] + (q[1] - p[1]) * t + sag * 4 * t * (1 - t)) * SS) for t in np.linspace(0, 1, 6)]
            d.line(pts, fill=twine(shade, alpha), width=int(rng.uniform(2.4, 3.6) * SS * (1 if side > 0 else 0.8)), joint='curve')
    if side > 0:
        for p in knots.values():
            r = rng.uniform(2.6, 3.8) * SS
            d.ellipse([p[0] * SS - r, p[1] * SS - r, p[0] * SS + r, p[1] * SS + r], fill=twine(0.75, 245))

# The rim rope round the ball and the knot where it is gathered at the top.
rim = [((CX + math.cos(a) * R * 1.0) * SS, (CY + math.sin(a) * R * 0.96) * SS) for a in np.linspace(0, 2 * math.pi, 120)]
d.line(rim, fill=(92, 102, 80, 200), width=5 * SS, joint='curve')
top = (CX, CY - R * 0.96)
for k in range(9):
    a = -math.pi / 2 + (k - 4) * 0.22
    d.line([(top[0] * SS, (top[1] - 8) * SS), ((CX + math.cos(a) * R * 0.5) * SS, (CY + math.sin(a) * R * 0.75) * SS)], fill=twine(0.85, 230), width=4 * SS)
d.ellipse([(top[0] - 16) * SS, (top[1] - 22) * SS, (top[0] + 16) * SS, (top[1] + 4) * SS], fill=(88, 96, 74, 255))
d.line([(top[0] * SS, (top[1] - 18) * SS), ((top[0] + 10) * SS, (top[1] - 52) * SS)], fill=(96, 104, 82, 255), width=6 * SS)
fx, fy, fr = top[0] + 12, top[1] - 66, 15                         # a worn orange float
for k in range(fr * SS, 0, -SS):
    t = k / (fr * SS); c = tuple(int(v * (0.6 + 0.4 * (1 - t) ** 0.6)) for v in (226, 120, 46)) + (255,)
    o = (1 - t) * fr * 0.35 * SS
    d.ellipse([fx * SS - k - o, fy * SS - k - o, fx * SS + k - o, fy * SS + k - o], fill=c)
d.ellipse([(fx - 8) * SS, (fy - 9) * SS, (fx - 3) * SS, (fy - 4) * SS], fill=(255, 255, 255, 140))

# Weed tangled in it and torn strands hanging below.
for _ in range(7):
    a = rng.uniform(0, 2 * math.pi); r0 = R * rng.uniform(0.75, 1.0)
    x0, y0 = CX + math.cos(a) * r0, CY + math.sin(a) * r0 * 0.96
    for k in range(5):
        b = a + rng.normal(0, 0.6); L = rng.uniform(14, 30)
        d.line([(x0 * SS, y0 * SS), ((x0 + math.cos(b) * L) * SS, (y0 + math.sin(b) * L * 0.7 + 6) * SS)], fill=(72 + int(rng.uniform(0, 40)), 108, 52, 230), width=int(rng.uniform(3, 6) * SS))
for i in range(6):
    x0 = CX + rng.uniform(-0.6, 0.6) * R; y0 = CY + math.sqrt(max(0, 1 - ((x0 - CX) / R) ** 2)) * R * 0.94
    L = rng.uniform(20, 46); bend = rng.normal(0, 8)
    pts = [((x0 + bend * t * t) * SS, (y0 + L * t) * SS) for t in np.linspace(0, 1, 8)]
    d.line(pts, fill=twine(0.9, 220), width=int(2.6 * SS), joint='curve')

out = img.resize((S, S), Image.LANCZOS)
a = np.asarray(out).astype(np.float32)
alpha = a[..., 3] / 255
halo = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.4))).astype(np.float32) / 255
rgb = a[..., :3] * alpha[..., None] + np.array([28, 34, 26]) * (1 - alpha[..., None])
res = np.dstack([np.clip(rgb, 0, 255), np.clip(np.maximum(alpha, halo * 0.35) * 255, 0, 255)]).astype(np.uint8)
Image.fromarray(res, 'RGBA').save(os.path.join(ROOT, 'public', 'img', 'beat_net.webp'), quality=92, method=6)
print('ok')
