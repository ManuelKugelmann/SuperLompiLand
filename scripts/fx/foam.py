# Whitewater art, procedural and deterministic:
#   public/img/fx/foam_line.webp   1024x128, tiles horizontally: the shoreward foam line / breaker crest
#   public/img/fx/foam_puffs.webp  4 frames of 256x256 side by side: breaker foam clouds
# usage: python -I scripts/fx/foam.py <repo root>
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = sys.argv[1]
OUT = os.path.join(ROOT, 'public', 'img', 'fx')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

def noise(h, w, size):
    """Smooth noise with features about `size` px across; periodic in x and y."""
    n = rng.standard_normal((h, w))
    fy = np.fft.fftfreq(h)[:, None]; fx = np.fft.fftfreq(w)[None, :]
    k = np.exp(-(fx ** 2 + fy ** 2) * (size ** 2) * 2)
    n = np.real(np.fft.ifft2(np.fft.fft2(n) * k))
    return (n - n.mean()) / (n.std() + 1e-9)

def billows(h, w, centres, wrap_x):
    """Union of soft round blobs (cauliflower foam) with a little shading toward their lower side."""
    a = np.zeros((h, w)); shade = np.zeros((h, w)); ys, xs = np.mgrid[0:h, 0:w]
    for x, y, r in centres:
        dx = ((xs - x + w / 2) % w - w / 2) if wrap_x else xs - x
        d = np.hypot(dx, ys - y) / r
        blob = np.clip((1 - d) / 0.35, 0, 1)
        a = np.maximum(a, blob)
        shade = np.maximum(shade, blob * np.clip((ys - y) / r, 0, 1))
    return a, shade

def bubbles(h, w, count, rmin, rmax, weight):
    """Rings of small bubbles, more where `weight` is high; wraps in x."""
    a = np.zeros((h, w)); ys, xs = np.mgrid[0:h, 0:w]
    for _ in range(count):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        if rng.uniform() > np.broadcast_to(weight, (h, w))[int(y) % h, int(x) % w]: continue
        r = rng.uniform(rmin, rmax)
        dx = (xs - x + w / 2) % w - w / 2
        d = np.hypot(dx, ys - y)
        a = np.maximum(a, np.clip(1 - np.abs(d - r) / 1.2, 0, 1) * 0.9 + np.clip(1 - d / r, 0, 1) * 0.15)
    return a

def save(a, rgb_tint, path, shade):
    h, w = a.shape
    col = np.ones((h, w, 3)) * np.array(rgb_tint)[None, None, :]
    # slightly blue in the thin, see-through parts and on the billows' lower sides, white on top
    col = col * (0.84 + 0.16 * a[..., None]) - shade[..., None] * np.array([46, 26, 10])
    img = np.dstack([np.clip(col, 0, 255), np.clip(a * 255, 0, 255)]).astype(np.uint8)
    Image.fromarray(img, 'RGBA').save(path, quality=92, method=6)

# Foam line: billows along the middle band, lace and bubbles toward its edges.
H, W = 128, 1024
cs = []
for i in range(150):
    x = rng.uniform(0, W); y = H / 2 + rng.normal(0, 13); r = rng.uniform(9, 24) * (1 - abs(y - H / 2) / 70)
    cs.append((x, y, max(5, r)))
a, shade = billows(H, W, cs, True)
lace = (noise(H, W, 7) * 0.6 + noise(H, W, 18) * 0.4)
yy = np.abs(np.linspace(-1, 1, H))[:, None]
a = np.maximum(a * (0.85 + 0.15 * noise(H, W, 5)), np.clip(lace - 0.6, 0, 1) * 1.6 * np.clip(1 - yy, 0, 1))
a = np.maximum(a, bubbles(H, W, 700, 1.5, 4, np.clip(1 - yy * 1.1, 0, 1)) * 0.75)
a = np.clip(a, 0, 1)
save(a, (255, 255, 255), os.path.join(OUT, 'foam_line.webp'), shade)

# Foam puffs: round billowing clouds, each its own shape.
S = 256
frames = []
for f in range(4):
    cs = [(S / 2, S / 2 + 10, 62)]
    for i in range(26):
        ang = rng.uniform(0, 2 * np.pi); rr = rng.uniform(20, 70)
        cs.append((S / 2 + np.cos(ang) * rr, S / 2 + 10 + np.sin(ang) * rr * 0.75, rng.uniform(18, 40)))
    a, shade = billows(S, S, cs, False)
    a = a * (0.85 + 0.15 * noise(S, S, 5))
    ys, xs = np.mgrid[0:S, 0:S]
    a = np.maximum(a, bubbles(S, S, 220, 1.5, 4.5, np.clip(1 - np.hypot(xs - S / 2, ys - S / 2) / 125, 0, 1)) * 0.7)
    frames.append((np.clip(a, 0, 1), shade))
save(np.concatenate([f[0] for f in frames], axis=1), (255, 255, 255), os.path.join(OUT, 'foam_puffs.webp'), np.concatenate([f[1] for f in frames], axis=1))
print('ok')
