# A whole mangrove tree in one picture (img/mangrove_tree_<n>.webp + .json): canopy, trunk and prop
# roots painted together, so the roots above and below the water match exactly (user: "1 asset for
# whole tree, not split"). From a painted tree on white (upscaled) and its cutout:
#  - keeps only the tree itself (loose seedlings and specks the cutout left are dropped),
#  - bakes the underwater look into everything below the waterline row (the game tints nothing),
#    changing softly over BLEND px since the wave moves about +-20 px there,
#  - writes the anchors the placement needs: waterline row, trunk x at the waterline, the root tips
#    and the mud row (the lowest tip: where the painted roots meet the seabed).
# usage: python -I scripts/fx/mangrove_tree.py <painted png> <cutout png> <waterline 0..1> <out stem>
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage

SRC, CUT, WL, OUT = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4]
WIDTH, MARGIN = 2048, 24            # px of the picture; px kept free around the tree
BLEND = 30                          # px over which the look changes at the waterline (at WIDTH)
WATER = np.array([0.76, 0.9, 0.84], np.float32)     # what the water's colour multiplies in (the mangrove's green water)
HAZE = (np.array([58, 128, 104], np.float32), 0.06, 0.3)   # haze colour, its share just under the surface and at the mud
TIP_BAND = 0.12                     # share of the height above the mud where a root's lowest point counts as a tip

img = Image.open(SRC).convert('RGB')
a = Image.open(CUT).getchannel('A').resize(img.size, Image.LANCZOS)
rgba = np.dstack([np.asarray(img), np.asarray(a)]).astype(np.float32)
mask = rgba[..., 3] > 40
lab, _ = ndimage.label(mask)
main = lab == np.argmax(np.bincount(lab.ravel())[1:]) + 1
rgba[..., 3] *= ndimage.binary_dilation(main, iterations=3)          # the tree only, with its soft edge
ys, xs = np.where(rgba[..., 3] > 40)
y0, y1, x0, x1 = max(ys.min() - MARGIN, 0), ys.max() + MARGIN, max(xs.min() - MARGIN, 0), xs.max() + MARGIN
wl_src = WL * img.height - y0
rgba = rgba[y0:y1, x0:x1]
k = WIDTH / rgba.shape[1]
pic = Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), 'RGBA')
pic = pic.resize((WIDTH, round(pic.height * k)), Image.LANCZOS)
p = np.asarray(pic).astype(np.float32)
H = p.shape[0]
wl = round(wl_src * k)

alpha = p[..., 3] > 40
low = np.where(alpha, np.arange(H)[:, None], -1).max(0)              # each column's lowest painted row
mud = int(low.max())
rows = np.arange(H)[:, None, None]
under = np.clip((rows - wl + BLEND / 2) / BLEND, 0, 1)               # 0 above .. 1 below, soft at the waterline
depth = np.clip((rows - wl) / max(mud - wl, 1), 0, 1)
haze = HAZE[1] + (HAZE[2] - HAZE[1]) * depth
wet = p[..., :3] * WATER
wet = wet * (1 - haze) + HAZE[0] * haze
p[..., :3] = p[..., :3] * (1 - under) + wet * under

feet = alpha & (np.arange(H)[:, None] > mud - TIP_BAND * (mud - wl))
flab, n = ndimage.label(feet)
tips = []
for i in range(1, n + 1):
    fy, fx = np.where(flab == i)
    if len(fy) < 30: continue
    b = fy.max(); tips.append([int(round(fx[fy == b].mean())), int(b)])
band = alpha[max(wl - 40, 0):wl]
trunk = int(round(np.average(np.arange(WIDTH), weights=band.sum(0) + 1e-6)))

Image.fromarray(np.clip(p, 0, 255).astype(np.uint8), 'RGBA').save(OUT + '.webp', quality=88, method=6)
meta = {'size': [WIDTH, H], 'waterline': wl, 'trunk': trunk, 'mud': mud, 'tips': sorted(tips)}
json.dump(meta, open(OUT + '.json', 'w'), separators=(',', ':'))
print(OUT, meta['size'], 'waterline', wl, 'mud', mud, 'trunk', trunk, 'tips', len(tips))
