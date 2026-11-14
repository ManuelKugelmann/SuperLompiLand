# usage: python -I scripts/fx/coast_ends.py <in> <out> <end reach px (0 = only clean the edges)>
# Give a coast piece real ends: the rock steps down to the water in a rough silhouette (no straight
# picture edge), and soft edge pixels take the colour of the rock next to them (no pale fringe).
import sys, numpy as np
from PIL import Image
from scipy import ndimage as nd
src, out, reach = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src).convert('RGBA'); a = np.asarray(im).astype(np.float32); H, W = a.shape[:2]
alpha = a[..., 3] / 255
# the top of the rock in each column (first fairly solid row)
top = np.array([np.argmax(alpha[:, x] > 0.6) if (alpha[:, x] > 0.6).any() else H for x in range(W)])
rng = np.random.default_rng(3)
from scipy.ndimage import gaussian_filter1d
ys = np.arange(H)
for side in (0, 1):
    n = reach
    hi = top[reach] if side == 0 else top[W - 1 - reach]
    t = np.linspace(0, 1, n)
    shoulder = (t * t * (3 - 2 * t)) ** 0.7                                  # a rounded rock shoulder down to the water
    bumps = gaussian_filter1d(rng.normal(0, 1, n), 14) * 60                   # a few broad knobs, no jitter
    for i in range(n):
        x = i if side == 0 else W - 1 - i
        limit_y = H - (H - hi) * shoulder[i] + bumps[i]
        alpha[:, x] *= np.clip((ys - limit_y) / 3, 0, 1)
# fill the colour of soft and empty pixels from the nearest solid rock, so blending never shows a fringe
solid = alpha > 0.85
idx = nd.distance_transform_edt(~solid, return_distances=False, return_indices=True)
rgb = a[..., :3][idx[0], idx[1]]
res = np.dstack([rgb, np.clip(alpha, 0, 1) * 255]).astype(np.uint8)
Image.fromarray(res, 'RGBA').save(out, quality=88, method=6)
print('ok')
