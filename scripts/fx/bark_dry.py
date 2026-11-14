# The dry variant of a mangrove bark strip (img/mangrove_bark_<n>_dry.webp), for the part of a root
# above the water: the same strip with the algae beard and the wet dark underside cut away along the
# wood's lower edge, so the two strips line up pixel for pixel (same size, same UV) and a rope can
# swap one for the other at the wave line.
# usage: python -I scripts/fx/bark_dry.py <bark strip webp> <out webp>
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import uniform_filter1d, maximum_filter1d

SRC, OUT = sys.argv[1], sys.argv[2]
FEATHER, SPAN, SMOOTH = 8, 161, 121   # px of soft edge under the wood; px the edge follows the lowest wood over (no notches); px it is smoothed over
SHADE = (48, 0.4)                    # px above the cut and how much darker: the round underside turning away from the light

a = np.asarray(Image.open(SRC).convert('RGBA')).astype(np.float32)
H, W = a.shape[:2]
r, g, b = a[..., 0], a[..., 1], a[..., 2]
wood = (r > g + 12) & (g > b) & (r > 110) & (a[..., 3] > 200)           # the warm brown bark, not moss, shells or the beard
rows = np.arange(H)[:, None]
low = np.where(wood, rows, -1)
edge = low.max(0).astype(np.float32)                                     # lowest wood row per column
edge = np.where(edge < 0, np.median(edge[edge >= 0]), edge)
edge = uniform_filter1d(maximum_filter1d(edge, SPAN, mode='wrap'), SMOOTH, mode='wrap')   # an envelope under the wood, smooth; the strip repeats: wrap
keep = np.clip((edge[None, :] + FEATHER - rows) / FEATHER, 0, 1)
a[..., 3] *= keep
shade = np.clip(1 - (edge[None, :] - rows) / SHADE[0], 0, 1) ** 1.5
a[..., :3] *= (1 - SHADE[1] * shade)[..., None]
Image.fromarray(a.astype(np.uint8), 'RGBA').save(OUT, quality=90, method=6)
print(OUT, (W, H), 'edge', int(edge.min()), int(edge.max()))
