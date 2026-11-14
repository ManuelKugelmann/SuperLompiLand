# Procedural 'reef' rock material for the terrain shader (game/level/materials.js): coral-
# encrusted limestone. Knobbly coral heads at several sizes, pink coralline algae crusts,
# small sponges and tube holes. Seamless 512 tile:
#   public/img/mat/reef.jpg (colour), public/img/mat/reef_h.jpg (height)
# usage: python -I scripts/mat/reef.py <repo root>
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = sys.argv[1]
S = 512
rng = np.random.default_rng(23)
ys, xs = np.mgrid[0:S, 0:S].astype(np.float32)

def noise(size):
    """Seamless smooth noise, features about `size` px."""
    n = rng.standard_normal((S, S))
    f = np.fft.fftfreq(S)
    k = np.exp(-(f[:, None] ** 2 + f[None, :] ** 2) * size ** 2 * 2)
    n = np.real(np.fft.ifft2(np.fft.fft2(n) * k))
    return (n - n.mean()) / (n.std() + 1e-9)

def worley(count):
    """Seamless distance to the nearest of `count` random points (F1) and to the second (F2)."""
    px, py = rng.uniform(0, S, count), rng.uniform(0, S, count)
    f1 = np.full((S, S), 1e9, np.float32); f2 = np.full((S, S), 1e9, np.float32)
    for x, y in zip(px, py):
        dx = np.abs(xs - x); dx = np.minimum(dx, S - dx)
        dy = np.abs(ys - y); dy = np.minimum(dy, S - dy)
        d = np.hypot(dx, dy)
        f2 = np.where(d < f1, f1, np.minimum(f2, d)); f1 = np.minimum(f1, d)
    return f1, f2

def domes(count, rmin, rmax):
    """Seamless field of rounded lumps (coral heads), overlapping into cauliflower clusters."""
    h = np.zeros((S, S), np.float32)
    for _ in range(count):
        x, y, r = rng.uniform(0, S), rng.uniform(0, S), rng.uniform(rmin, rmax)
        dx = np.abs(xs - x); dx = np.minimum(dx, S - dx); dy = np.abs(ys - y); dy = np.minimum(dy, S - dy)
        d2 = (dx * dx + dy * dy) / (r * r)
        h = np.maximum(h, np.sqrt(np.clip(1 - d2, 0, 1)) * rng.uniform(0.7, 1))
    return h

# --- Height: big rounded coral heads, smaller knobs on and between them, polyp grain.
h = 0.55 * domes(70, 30, 70) + 0.3 * domes(420, 6, 16) + 0.1 * np.clip(noise(1.6), -2, 2) / 2 + 0.06 * noise(10)
# Tube holes: a few small dark pits.
holes = np.zeros((S, S), np.float32)
for _ in range(60):
    x, y, r = rng.uniform(0, S), rng.uniform(0, S), rng.uniform(1.6, 3.6)
    dx = np.abs(xs - x); dx = np.minimum(dx, S - dx); dy = np.abs(ys - y); dy = np.minimum(dy, S - dy)
    holes = np.maximum(holes, np.clip(1 - np.hypot(dx, dy) / r, 0, 1))
h = h - holes * 0.35
h = (h - h.min()) / (h.max() - h.min())
# Cavity: how sunk a spot is against its surroundings (dark crevices, light knob tops).
cav = h - nd.gaussian_filter(h, 7, mode='wrap')
cav = np.clip(cav / (np.abs(cav).max() + 1e-6), -1, 1)

# --- Colour: limestone, shaded by the relief; coralline crusts; turf in the crevices.
speck = noise(1.2)
col = np.ones((S, S, 3), np.float32) * np.array([190, 180, 158], np.float32)
col *= (0.7 + 0.35 * h + 0.25 * cav + 0.04 * speck)[..., None]
col *= (1 + 0.07 * noise(60))[..., None]
crust = np.clip((noise(22) * 0.7 + noise(6) * 0.45 + 0.25 * cav - 0.5) * 1.6, 0, 1) * (0.7 + 0.3 * np.clip(speck, 0, 1))
col = col * (1 - crust[..., None] * 0.55) + (col * np.array([1.12, 0.78, 0.88])) * crust[..., None] * 0.55
turf = np.clip(-cav * 1.6 - 0.2, 0, 1) * np.clip(noise(7) + 0.6, 0, 1)
col = col * (1 - turf[..., None] * 0.45) + np.array([96, 104, 70]) * turf[..., None] * 0.45
# A few small sponges: soft lumps in muted yellow, orange or violet.
for _ in range(14):
    x, y, r = rng.uniform(0, S), rng.uniform(0, S), rng.uniform(3, 7)
    c = np.array([[200, 176, 84], [196, 122, 72], [128, 96, 146]][rng.integers(3)], np.float32)
    dx = np.abs(xs - x); dx = np.minimum(dx, S - dx); dy = np.abs(ys - y); dy = np.minimum(dy, S - dy)
    d = np.hypot(dx, dy)
    m = np.clip((r - d) / 2.0, 0, 1) * 0.8
    col = col * (1 - m[..., None]) + c[None, None, :] * (0.8 + 0.3 * np.clip(1 - d / r, 0, 1))[..., None] * m[..., None]
    h = np.maximum(h, m * 0.85)
col *= (1 - holes * 0.7)[..., None]
h = np.clip(nd.gaussian_filter(h, 0.5, mode='wrap'), 0, 1)
# The shader shows a tile's colour relative to its mean (the biome palette sets the tone), and the
# water grade flattens it a lot: carry the relief and the crusts with a strong contrast.
m = col.reshape(-1, 3).mean(0)
col = m + (col - m) * 1.8

out = os.path.join(ROOT, 'public', 'img', 'mat')
Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).save(os.path.join(out, 'reef.jpg'), quality=90)
Image.fromarray((h * 255).astype(np.uint8)).convert('RGB').save(os.path.join(out, 'reef_h.jpg'), quality=92)
print('ok')
