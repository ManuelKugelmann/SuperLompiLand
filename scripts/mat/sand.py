# Procedural 'sand' material for the terrain shader's sand skin (game/level/materials.js): rippled
# seafloor sand. Wave ripples with a gentle up-current flank and a steeper lee, wandering and
# forking a little; darker detritus settles in the troughs; fine grain, a scatter of darker and
# lighter grains, and a few small shell bits on the crests. Seamless 512 tile (whole ripples per
# tile, wrapped noise), colour relative to its mean (the biome palette sets the tone) + height:
#   public/img/mat/sand.jpg (colour), public/img/mat/sand_h.jpg (height)
# usage: python -I scripts/mat/sand.py <repo root>
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = sys.argv[1]
S = 512
RIPPLES = 9            # ripple crests across the tile (whole number: seamless)
rng = np.random.default_rng(31)
ys, xs = np.mgrid[0:S, 0:S].astype(np.float32)

def noise(size):
    """Seamless smooth noise, features about `size` px."""
    n = rng.standard_normal((S, S))
    f = np.fft.fftfreq(S)
    k = np.exp(-(f[:, None] ** 2 + f[None, :] ** 2) * size ** 2 * 2)
    n = np.real(np.fft.ifft2(np.fft.fft2(n) * k))
    return (n - n.mean()) / (n.std() + 1e-9)

# --- Ripples: crests run up and down the tile, wandering (a warp of the phase), with an asymmetric
# profile (a long gentle flank, a short steep lee) and a slowly varying height.
phase = 2 * np.pi * RIPPLES * xs / S + 1.1 * noise(70) + 0.35 * noise(22)
u = (phase / (2 * np.pi)) % 1.0
profile = np.where(u < 0.72, u / 0.72, (1 - u) / 0.28)          # 0 trough .. 1 crest .. 0
profile = profile ** 1.3
h = profile * (0.75 + 0.25 * noise(90)) + 0.08 * noise(3) + 0.05 * noise(1.2)
# Shell bits: small bright curls on the crests, a little raised.
shell = np.zeros((S, S), np.float32)
for _ in range(38):
    x, y = rng.uniform(0, S), rng.uniform(0, S)
    if profile[int(y), int(x)] < 0.45: continue
    r = rng.uniform(2.0, 4.5)
    dx = np.abs(xs - x); dx = np.minimum(dx, S - dx); dy = np.abs(ys - y); dy = np.minimum(dy, S - dy)
    shell = np.maximum(shell, np.clip(1 - np.hypot(dx, dy * 1.4) / r, 0, 1))
h = h + shell * 0.25
h = (h - h.min()) / (h.max() - h.min())

# --- Colour: sand lit by its relief (the lee darker), detritus in the troughs, grains, shells.
grad = np.gradient(nd.gaussian_filter(h, 1.2, mode='wrap'), axis=1)
light = np.clip(1 - grad * 9, 0.7, 1.2)                         # light from the left: lee faces darker
col = np.ones((S, S, 3), np.float32) * np.array([214, 196, 160], np.float32)
col *= (light * (0.86 + 0.22 * h))[..., None]
trough = np.clip(1 - profile * 2.6, 0, 1) * np.clip(noise(16) * 0.6 + 0.7, 0, 1)
col = col * (1 - trough[..., None] * 0.28) + np.array([150, 132, 104], np.float32) * trough[..., None] * 0.28
grains = rng.random((S, S))
dark, bright = grains < 0.035, grains > 0.975
col[dark] *= 0.62
col[bright] = col[bright] * 0.4 + np.array([250, 244, 228]) * 0.6
col *= (1 + 0.05 * noise(1.0))[..., None]
col = col * (1 - shell[..., None] * 0.7) + np.array([246, 236, 222], np.float32) * shell[..., None] * 0.7
col *= (1 + 0.05 * noise(80))[..., None]                          # large, slow tone change (breaks repeats)
# Relative to its mean, with contrast to survive the water grade (as reef.py).
m = col.reshape(-1, 3).mean(0)
col = m + (col - m) * 1.5

out = os.path.join(ROOT, 'public', 'img', 'mat')
Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).save(os.path.join(out, 'sand.jpg'), quality=90)
Image.fromarray((h * 255).astype(np.uint8)).convert('RGB').save(os.path.join(out, 'sand_h.jpg'), quality=92)
print('ok')
