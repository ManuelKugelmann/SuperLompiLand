# The sand collar where a mangrove root plunges into the seabed (img/mangrove_collar.webp): a low
# mound of pale sand, drawn in front of the root, so the root goes on down behind it with no end
# showing (user: "roots extend into sand, not just touch it"). Lit from above, a pale lip on top,
# darker mud toward its foot, a few pebbles and shells, short algae tufts; its foot fades into the
# ground. Procedural (no art file needed).
# usage: python -I scripts/fx/root_collar.py <repo root>
import sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = sys.argv[1]
W, H, S = 640, 240, 3                      # px, and supersampling
rng = np.random.default_rng(11)

w, h = W * S, H * S
x = np.linspace(-1, 1, w)
top = h * (0.34 + 0.5 * (x ** 2) ** 1.4 + 0.03 * np.sin(x * 9) + 0.02 * np.sin(x * 23 + 1) + 0.06 * np.exp(-(x / 0.16) ** 2))   # the mound's top edge, with a dip where the root goes in
yy = np.arange(h)[:, None]
inside = yy >= top[None, :]
depth = np.clip((yy - top[None, :]) / (h - top[None, :] + 1), 0, 1)       # 0 at the top edge .. 1 at the bottom
sand, mud, lip = np.array([232, 214, 168], np.float32), np.array([132, 104, 72], np.float32), np.array([250, 240, 212], np.float32)
col = sand * (1 - depth[..., None] ** 1.4) + mud * depth[..., None] ** 1.4
col = col + (lip - col) * np.clip(1 - (yy - top[None, :]) / (6 * S), 0, 1)[..., None] * inside[..., None]
# Round across: lit from above, the flanks turning away darker (a mound, not a flat band).
slope = np.gradient(top)[None, :] / S
col = col * np.clip(1 - 0.35 * np.abs(slope) - 0.12 * depth, 0.55, 1)[..., None]
grain = rng.normal(0, 7, (h, w))[..., None]
col = np.clip(col + grain, 0, 255)
alpha = inside * np.clip((h - yy) / (h * 0.22), 0, 1)                        # the foot fades into the ground
img = Image.fromarray(np.dstack([col, alpha * 255]).astype(np.uint8), 'RGBA')
d = ImageDraw.Draw(img)
for _ in range(9):                                                           # pebbles and shells on the slope
    cx = rng.uniform(0.15, 0.85) * w
    cy = top[int(cx)] + rng.uniform(0.15, 0.45) * (h - top[int(cx)])
    r = rng.uniform(7, 14) * S
    c = tuple(int(v) for v in rng.choice([[226, 214, 196], [196, 182, 170], [238, 196, 178], [150, 140, 132]]))
    for k in range(6, 0, -1):          # shaded: darker rim, lighter toward the upper left
        f = k / 6
        cc = tuple(int(v * (0.7 + 0.3 * (1 - f))) for v in c)
        d.ellipse([cx - r * 1.3 * f - (1 - f) * r * 0.4, cy - r * 0.8 * f - (1 - f) * r * 0.3, cx + r * 1.3 * f - (1 - f) * r * 0.4, cy + r * 0.8 * f - (1 - f) * r * 0.3], fill=cc + (255,))
for _ in range(14):                                                          # algae tufts along the top
    cx = rng.uniform(0.12, 0.88) * w
    base = top[int(cx)] + 4 * S
    for k in range(4):
        bend = rng.uniform(-14, 14) * S
        d.line([(cx + k * 3 * S, base), (cx + k * 3 * S + bend * 0.5, base - 18 * S), (cx + k * 3 * S + bend, base - rng.uniform(26, 44) * S)],
               fill=(64 + 20 * k, 138 + 10 * k, 60, 255), width=3 * S, joint='curve')
img = img.filter(ImageFilter.GaussianBlur(0.6 * S)).resize((W, H), Image.LANCZOS)
img.save(os.path.join(ROOT, 'public', 'img', 'mangrove_collar.webp'), quality=90, method=6)
print('mangrove_collar', img.size)
