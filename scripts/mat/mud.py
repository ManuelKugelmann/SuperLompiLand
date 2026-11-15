# Procedural 'mud' material for the terrain shader (game/level/materials.js): firm mangrove mud and
# silt-rock. Fine silt layers, soft lumps, crab burrows, thin rootlets and a few shell bits; no large
# light or dark shapes (it repeats every 512 px, and the photo mudstone's pale patches showed).
# Seamless 512 tile, colour relative to its mean + height:
#   public/img/mat/mud.jpg (colour), public/img/mat/mud_h.jpg (height)
# usage: python -I scripts/mat/mud.py <repo root>
import sys, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

ROOT = sys.argv[1]
S = 512
rng = np.random.default_rng(41)
ys, xs = np.mgrid[0:S, 0:S].astype(np.float32)

def noise(size):
    """Seamless smooth noise, features about `size` px."""
    n = rng.standard_normal((S, S))
    f = np.fft.fftfreq(S)
    k = np.exp(-(f[:, None] ** 2 + f[None, :] ** 2) * size ** 2 * 2)
    n = np.real(np.fft.ifft2(np.fft.fft2(n) * k))
    return (n - n.mean()) / (n.std() + 1e-9)

def wrapped(fn):
    """Draw on a 3x3 canvas and fold it back, so shapes crossing the edge wrap round."""
    big = Image.new('L', (S * 3, S * 3), 0)
    fn(ImageDraw.Draw(big))
    a = np.asarray(big).astype(np.float32) / 255
    return np.max(a.reshape(3, S, 3, S), axis=(0, 2))

# --- Height: soft lumps, fine silt layering (whole number of layers: seamless), grain.
layers = np.sin(2 * np.pi * 14 * ys / S + 1.2 * noise(60)) * 0.5 + 0.5
h = 0.45 * (noise(40) * 0.5 + 0.5) + 0.18 * layers + 0.1 * noise(5) + 0.05 * noise(1.3)
# Crab burrows: small round holes with a raised rim.
burrow = np.zeros((S, S), np.float32); rim = np.zeros((S, S), np.float32)
for _ in range(26):
    x, y, r = rng.uniform(0, S), rng.uniform(0, S), rng.uniform(3, 7)
    dx = np.abs(xs - x); dx = np.minimum(dx, S - dx); dy = np.abs(ys - y); dy = np.minimum(dy, S - dy)
    d = np.hypot(dx, dy * 1.2)
    burrow = np.maximum(burrow, np.clip(1 - d / r, 0, 1))
    rim = np.maximum(rim, np.clip(1 - np.abs(d - r * 1.35) / 2.2, 0, 1))
# Rootlets: thin, wandering dark fibres.
def roots(d):
    for _ in range(40):
        x, y = rng.uniform(S, 2 * S), rng.uniform(S, 2 * S)
        a = rng.uniform(0, 2 * np.pi); pts = [(x, y)]
        for _ in range(int(rng.uniform(6, 16))):
            a += rng.normal(0, 0.45); x += np.cos(a) * 6; y += np.sin(a) * 6; pts.append((x, y))
        d.line(pts, fill=255, width=int(rng.integers(1, 3)))
root = wrapped(roots)
h = h - burrow * 0.4 + rim * 0.12 - root * 0.06
h = (h - h.min()) / (h.max() - h.min())
cav = h - nd.gaussian_filter(h, 6, mode='wrap')
cav = np.clip(cav / (np.abs(cav).max() + 1e-6), -1, 1)

# --- Colour: brown-olive mud, lighter silt bands, darker wet hollows, rootlets, a few shell bits.
col = np.ones((S, S, 3), np.float32) * np.array([118, 98, 70], np.float32)
col *= (0.8 + 0.3 * h + 0.25 * cav)[..., None]
col = col * (1 - layers[..., None] * 0.12) + np.array([150, 132, 98], np.float32) * layers[..., None] * 0.12
col = col * (1 + 0.06 * noise(2))[..., None]
col *= (1 - burrow * 0.65)[..., None]
col = col * (1 - root[..., None] * 0.45) + np.array([62, 44, 30], np.float32) * root[..., None] * 0.45
olive = np.clip(noise(18) * 0.6, 0, 1) * 0.25                       # a film of green algae here and there
col = col * (1 - olive[..., None]) + np.array([96, 104, 62], np.float32) * olive[..., None]
for _ in range(16):
    x, y, r = rng.uniform(0, S), rng.uniform(0, S), rng.uniform(1.8, 3.5)
    dx = np.abs(xs - x); dx = np.minimum(dx, S - dx); dy = np.abs(ys - y); dy = np.minimum(dy, S - dy)
    m = np.clip(1 - np.hypot(dx, dy) / r, 0, 1)
    col = col * (1 - m[..., None] * 0.7) + np.array([226, 214, 196], np.float32) * m[..., None] * 0.7
h = np.clip(nd.gaussian_filter(h, 0.5, mode='wrap'), 0, 1)
m = col.reshape(-1, 3).mean(0)
col = m + (col - m) * 1.6

out = os.path.join(ROOT, 'public', 'img', 'mat')
Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).save(os.path.join(out, 'mud.jpg'), quality=90)
Image.fromarray((h * 255).astype(np.uint8)).convert('RGB').save(os.path.join(out, 'mud_h.jpg'), quality=92)
print('ok')
