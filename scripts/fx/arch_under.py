# The sea arch's legs under the water (img/coast/sea_arch_under.webp): they go on down from the
# feet of sea_arch.webp (same width and x layout), flaring a little toward the seabed, wet basalt
# crusted with mussels, barnacles and weed, kelp at their base, the opening between them open
# water, fading into the water's hue with depth. A backdrop behind the fish.
# usage: python -I scripts/fx/arch_under.py <repo root> <rock texture png>
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT, TEX = sys.argv[1], sys.argv[2]
H = 1300
WATER = np.array([0x22, 0x63, 0x70], np.float32)       # the water's hue at depth (the legs fade into it)
rng = np.random.default_rng(12)

top = np.asarray(Image.open(os.path.join(ROOT, 'public', 'img', 'coast', 'sea_arch.webp')).convert('RGBA')).astype(np.float32)
Ht, W = top.shape[:2]
feet = top[Ht - 6:Ht - 1, :, 3].mean(0) > 100                # which columns the legs stand on
# the rock's own colour just above the surf (the feet themselves are white with foam)
band = top[Ht - 70:Ht - 30]
foot_rgb = (band[..., :3] * band[..., 3:] / 255).sum(0) / np.maximum(band[..., 3].sum(0) / 255, 1)[:, None]

# Legs: runs of foot columns; each widens a little toward the seabed, with a knobbly outline.
runs, x = [], 0
while x < W:
    if feet[x]:
        s = x
        while x < W and feet[x]: x += 1
        if x - s > 60: runs.append((s, x))
    x += 1
# gaps in the surf are not gaps in the rock: runs closer than 120 px are one leg
merged = []
for r in runs:
    if merged and r[0] - merged[-1][1] < 120: merged[-1] = (merged[-1][0], r[1])
    else: merged.append(r)
runs = merged
ys = np.arange(H)[:, None].astype(np.float32); xs = np.arange(W)[None, :].astype(np.float32)
t = ys / H
leg = np.zeros((H, W), np.float32)
dist_in = np.zeros((H, W), np.float32)
for (x0, x1) in runs:
    flare = 140 * t ** 1.4
    wob = lambda seed: nd.gaussian_filter1d(rng.normal(0, 1, H), 30)[:, None] * 26
    left = x0 - flare - wob(1) * (x0 > 5)
    right = x1 + flare + wob(2) * (x1 < W - 5)
    m = np.clip(np.minimum(xs - left, right - xs) / 3, 0, 1)
    leg = np.maximum(leg, m)
    dist_in = np.maximum(dist_in, np.clip(np.minimum(xs - left, right - xs), 0, None) * (m > 0))

# Fill: the crusted rock texture, darkened toward basalt; round shading toward each leg's sides.
tex = Image.open(TEX).convert('RGB').resize((512, 512), Image.LANCZOS)
tile = np.asarray(tex).astype(np.float32)
rock = np.tile(tile, (H // 512 + 1, W // 512 + 1, 1))[:H, :W]
grey = rock.mean(2, keepdims=True)
rock = (rock * 0.55 + grey * 0.45) * 0.62
rock *= (0.55 + 0.45 * np.clip(dist_in / 160, 0, 1))[..., None]
# Continuity at the waterline: the first rows take the colour of the feet above.
blend = np.clip(1 - ys / 70, 0, 1)[..., None]
rock = rock * (1 - blend) + (foot_rgb[None, :, :] * 0.9) * blend
# Distance: toward the seabed the legs sink into the water's hue and finally into it.
fog = np.clip(t * 1.05, 0, 0.88)[..., None]
rock = rock * (1 - fog) + WATER * fog
alpha = leg * np.clip((H - ys) / (H * 0.12), 0, 1)

# Kelp at the legs' base, in front of them, fogged like them.
img = Image.fromarray(np.dstack([np.clip(rock, 0, 255), alpha * 255]).astype(np.uint8), 'RGBA')
kelps = [Image.open(os.path.join(ROOT, 'public', 'img', 'plants', f'kelp_stalk_{k}.webp')).convert('RGBA') for k in (1, 2, 3)]
for (x0, x1) in runs:
    for k in range(3):
        kx = int(rng.uniform(x0 - 60, x1 + 60)); kelp = kelps[rng.integers(3)]
        h = int(rng.uniform(420, 640)); kelp = kelp.resize((int(kelp.width * h / kelp.height), h), Image.LANCZOS)
        ka = np.asarray(kelp).astype(np.float32)
        kt = np.linspace(H - h, H, h)[:, None] / H
        kf = np.clip(kt * 1.05, 0, 0.88)[..., None]
        ka[..., :3] = ka[..., :3] * (1 - kf) + WATER * kf
        ka[..., 3] *= np.clip((H - np.linspace(H - h, H, h)) / (H * 0.12), 0, 1)[:, None]
        img.alpha_composite(Image.fromarray(ka.astype(np.uint8), 'RGBA'), (max(0, kx - kelp.width // 2), H - h))
img.save(os.path.join(ROOT, 'public', 'img', 'coast', 'sea_arch_under.webp'), quality=86, method=6)
print('ok', img.size, 'legs', runs)
