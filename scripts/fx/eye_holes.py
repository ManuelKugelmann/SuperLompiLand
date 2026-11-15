# The eye holes of the hero creatures (user: "rim around eyes, eye shape, not goggly; cut out eyes and
# render eyeballs behind eye rims, only hero creatures"). For each painted eye listed below (picture
# px, as in game/rig/faces.js), finds the eye's own outline inside its painted lid/rim: the painted
# white and the pupil, their convex hull (that takes in the iris between them), pulled in a little so
# the painted rim stays. Prints one polygon per eye (picture px), for faces.js `hole`.
# usage: python -I scripts/fx/eye_holes.py <repo root>
import sys, os, glob, json
import numpy as np
from PIL import Image
from scipy import ndimage as nd
from scipy.spatial import ConvexHull

ROOT = sys.argv[1]
EYES = {
    'puffer_normal': [(372, 117, 50, 52), (482, 118, 21, 32)],      # the far eye at the picture's edge too (user: "both eyes need to look")
    'puffer_inflated': [(232, 182, 52, 56), (405, 152, 38, 48)],
    'player_shark': [(350, 175, 33, 31)],
    'player_flyingfish': [(432, 128, 30, 27), (497, 122, 8, 16)],
    'player_firefish': [(402, 233, 41, 41), (491, 224, 17, 28)],
    'friend_turtle': [(390, 63, 38, 38), (490, 115, 17, 25)],
    'friend_jellyfish': [(70, 158, 21, 23), (151, 117, 25, 27)],
    'friend_seahorse': [(192, 138, 30, 32), (257, 121, 10, 18)],
    'friend_parrotfish': [(404, 131, 38, 40)],
}
SEARCH = 1.3      # look this much beyond the listed half sizes
SKIN_DIST = 70    # colour distance from the surrounding skin from which a texel counts as eye
RIM = 3           # px the hole stays inside the eye's painted outline (its rim line)
POINTS = 18       # polygon points kept

def pupil_centre(a, x, y, rx, ry):
    """The painted pupil nearest the listed centre: the eye is centred on it (listed centres are rough)."""
    H, W = a.shape[:2]
    x0, x1, y0, y1 = int(max(0, x - rx * 1.6)), int(min(W, x + rx * 1.6)), int(max(0, y - ry * 1.6)), int(min(H, y + ry * 1.6))
    dark = (a[y0:y1, x0:x1, :3].max(-1) < 55) & (a[y0:y1, x0:x1, 3] > 200)
    lab, n = nd.label(dark)
    best = None
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        if len(ys) < 25: continue
        cx, cy = xs.mean() + x0, ys.mean() + y0
        d = np.hypot(cx - x, cy - y)
        if best is None or d < best[0]: best = (d, cx, cy)
    return (best[1], best[2]) if best and best[0] < max(rx, ry) * 1.2 else (x, y)

def hole(img, x, y, rx, ry):
    """Everything around the pupil that is clearly not skin (white, iris, pupil, and the painted rim
    line), filled, smoothed, then pulled in by the rim's width so the painted rim stays whole."""
    a = np.asarray(img.convert('RGBA')).astype(np.float32)
    H, W = a.shape[:2]
    px, py = pupil_centre(a, x, y, rx, ry)
    R = max(rx, ry)
    x0, x1 = int(max(0, x - R * 2)), int(min(W, x + R * 2))
    y0, y1 = int(max(0, y - R * 2)), int(min(H, y + R * 2))
    p = a[y0:y1, x0:x1]
    yy, xx = np.mgrid[y0:y1, x0:x1]
    d = np.hypot((xx - x) / rx, (yy - y) / ry)
    ring = (d > 1.35) & (d < 1.75) & (p[..., 3] > 200)
    skin = np.median(p[ring][:, :3], axis=0)
    far = np.linalg.norm(p[..., :3] - skin, axis=-1)
    eye = (far > SKIN_DIST) & (d < 1.3) & (p[..., 3] > 200)
    eye = nd.binary_closing(eye, iterations=2)
    lab, n = nd.label(eye)
    seed = lab[int(round(py)) - y0, int(round(px)) - x0]
    if seed == 0: return None
    m = nd.binary_fill_holes(lab == seed)
    m = nd.binary_opening(m, iterations=2)
    m = nd.binary_erosion(m, iterations=RIM)                      # keep the painted rim line
    lab, n = nd.label(m)
    if n == 0: return None
    m = lab == (np.argmax(np.bincount(lab.ravel())[1:]) + 1)
    pts = np.argwhere(m)
    hull = ConvexHull(pts[:, ::-1].astype(np.float64))
    poly = pts[:, ::-1][hull.vertices].astype(np.float64) + [x0, y0]
    # Resample to POINTS points evenly along the outline.
    seg = np.r_[0, np.cumsum(np.hypot(*np.diff(np.vstack([poly, poly[:1]]), axis=0).T))]
    t = np.linspace(0, seg[-1], POINTS, endpoint=False)
    closed = np.vstack([poly, poly[:1]])
    out = np.c_[np.interp(t, seg, closed[:, 0]), np.interp(t, seg, closed[:, 1])]
    return [[round(float(u)), round(float(v))] for u, v in out]

res = {}
for key, eyes in EYES.items():
    f = glob.glob(os.path.join(ROOT, 'public', 'img', key + '.*'))[0]
    img = Image.open(f)
    res[key] = [hole(img, *e) for e in eyes]
print(json.dumps(res))
