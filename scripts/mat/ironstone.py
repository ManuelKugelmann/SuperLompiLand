# Procedural 'ironstone' material for the terrain shader (game/level/materials.js): grey rock near
# wrecks and harbour walls, stained by iron: rust streaks running down from small rusty spots and
# cracks, crusts in the hollows. Replaces the photo 'rust' (a steel plate: the rock read as metal).
# Seamless 512 tile, colour relative to its mean + height:
#   public/img/mat/ironstone.jpg (colour), public/img/mat/ironstone_h.jpg (height)
# usage: python -I scripts/mat/ironstone.py <repo root>
import sys, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

ROOT = sys.argv[1]
S = 512
rng = np.random.default_rng(53)
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

# --- Height: blocky weathered rock (ridged noise), a few cracks.
r1 = 1 - np.abs(noise(20)); r2 = 1 - np.abs(noise(8))
h = 0.35 * r1 ** 2 + 0.35 * r2 ** 2 + 0.08 * noise(2.5)       # no feature larger than ~40 px: nothing to spot repeating
def cracks(d):
    for _ in range(30):
        x, y = rng.uniform(S, 2 * S), rng.uniform(S, 2 * S); a = rng.uniform(0, 2 * np.pi); pts = [(x, y)]
        for _ in range(int(rng.uniform(3, 7))):
            a += rng.normal(0, 0.5); x += np.cos(a) * 8; y += np.sin(a) * 8; pts.append((x, y))
        d.line(pts, fill=255, width=1)
crack = nd.gaussian_filter(wrapped(cracks), 0.8, mode='wrap')
h = h - crack * 0.25
h = (h - h.min()) / (h.max() - h.min())
cav = h - nd.gaussian_filter(h, 6, mode='wrap')
cav = np.clip(cav / (np.abs(cav).max() + 1e-6), -1, 1)

# --- Rust: small spots, each bleeding a streak downward (the tile wraps, so streaks wrap too).
spots = np.zeros((S, S), np.float32)
for _ in range(70):
    x, y, r = rng.uniform(0, S), rng.uniform(0, S), rng.uniform(1.5, 4)
    dx = np.abs(xs - x); dx = np.minimum(dx, S - dx); dy = np.abs(ys - y); dy = np.minimum(dy, S - dy)
    spots = np.maximum(spots, np.clip(1 - np.hypot(dx, dy) / r, 0, 1))
spots = np.maximum(spots, crack * 0.4)
streak = spots.copy()
for k in range(1, 60):                       # run down, fading and spreading a little
    streak = np.maximum(streak, np.roll(nd.uniform_filter1d(spots, 3, axis=1, mode='wrap'), k, axis=0) * (1 - k / 60) ** 1.5)
streak *= np.clip(noise(6) * 0.4 + 0.8, 0, 1)
crust = np.clip(-cav * 1.4 - 0.2, 0, 1) * np.clip(noise(9) + 0.3, 0, 1)

col = np.ones((S, S, 3), np.float32) * np.array([150, 148, 142], np.float32)
fine = h - nd.gaussian_filter(h, 24, mode='wrap')            # the relief without its large swells (they showed as repeating blotches)
col *= (0.9 + 0.8 * fine + 0.25 * cav)[..., None]
col = col * (1 + 0.05 * noise(1.2))[..., None]
rust = np.array([156, 84, 44], np.float32)
col = col * (1 - streak[..., None] * 0.55) + rust * streak[..., None] * 0.55
col = col * (1 - crust[..., None] * 0.4) + np.array([120, 70, 40], np.float32) * crust[..., None] * 0.4
col *= (1 - crack * 0.25)[..., None]
# No tone change larger than a few dozen px (it repeats every 512: big blotches showed as a pattern).
col = col - nd.gaussian_filter(col, (30, 30, 0), mode='wrap') + col.reshape(-1, 3).mean(0)
h = np.clip(nd.gaussian_filter(h, 0.5, mode='wrap'), 0, 1)
m = col.reshape(-1, 3).mean(0)
col = m + (col - m) * 1.6

out = os.path.join(ROOT, 'public', 'img', 'mat')
Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).save(os.path.join(out, 'ironstone.jpg'), quality=90)
Image.fromarray((h * 255).astype(np.uint8)).convert('RGB').save(os.path.join(out, 'ironstone_h.jpg'), quality=92)
print('ok')
