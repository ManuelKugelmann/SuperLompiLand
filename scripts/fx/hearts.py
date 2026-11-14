# The HUD's life hearts in the lookdev style (img/ui/heart_full, heart_half, heart_empty): a
# glossy, rounded heart with soft 3D shading and a highlight, warm red-coral, no outline; the
# empty one a dark translucent glass heart; the half one full on the left, glass on the right.
# Procedural (a signed distance field shaded as a dome), so the three always match.
# usage: python -I scripts/fx/hearts.py <repo root>
import sys, os
import numpy as np
from PIL import Image

ROOT = sys.argv[1]
OUT = os.path.join(ROOT, 'public', 'img', 'ui')
N, SS = 128, 4                        # output px, supersampling
CORAL = np.array([[255, 122, 104], [240, 70, 72], [176, 30, 52]], np.float32) / 255   # light, mid, deep
GLASS = np.array([30, 44, 70], np.float32) / 255

def heart_field(n):
    """Signed distance (in units of the picture's half width, negative inside) of a plump heart:
    the classic implicit heart (x^2 + y^2 - 1)^3 - x^2 y^3 <= 0, measured with a distance transform."""
    from scipy import ndimage as nd
    s = np.linspace(-1.42, 1.42, n)
    x, y = np.meshgrid(s, -s)
    y = y * 1.08 + 0.1
    inside = (x * x + y * y - 1) ** 3 - x * x * y ** 3 <= 0
    px = 2.84 / n
    return (nd.distance_transform_edt(~inside) - nd.distance_transform_edt(inside)) * px

def shade(d, glass=False):
    inside = np.clip(-d / 0.035, 0, 1)                         # soft anti-aliased edge
    depth = np.clip(-d / 0.6, 0, 1)
    height = np.sqrt(1 - (1 - depth) ** 2)                     # a dome: steep at the rim, flat in the middle
    from scipy import ndimage as nd
    height = nd.gaussian_filter(height, d.shape[0] / 60)       # no crease along the distance field's ridge
    gy, gx = np.gradient(height)
    k = d.shape[0] / 8.0
    nx, ny = -gx * k, gy * k                                   # y up in the field
    nz = np.ones_like(nx)
    l = np.sqrt(nx * nx + ny * ny + nz * nz); nx, ny, nz = nx / l, ny / l, nz / l
    L = np.array([-0.45, 0.6, 0.66]); L /= np.linalg.norm(L)
    lam = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
    hv = np.array([L[0], L[1], L[2] + 1]); hv /= np.linalg.norm(hv)
    spec = np.clip(nx * hv[0] + ny * hv[1] + nz * hv[2], 0, 1) ** 40
    if glass:
        rgb = GLASS[None, None, :] * (0.7 + 0.5 * lam[..., None])
        rim = np.clip(1 - depth * 4, 0, 1) ** 2                 # glass shows its edge as a faint light rim
        rgb = rgb + 0.35 * rim[..., None] + 0.9 * spec[..., None]
        alpha = inside * np.clip(0.42 + 0.35 * rim + 0.6 * spec, 0, 1)
    else:
        t = lam[..., None]
        rgb = CORAL[2] * (1 - t) ** 2 + CORAL[1] * 2 * t * (1 - t) + CORAL[0] * t ** 2
        rgb = rgb * (0.82 + 0.18 * height[..., None]) + 0.95 * spec[..., None]
        bounce = np.clip((-ny) * (1 - depth), 0, 1) ** 2        # warm light from below on the lower rim
        rgb = rgb + np.array([0.25, 0.08, 0.05]) * bounce[..., None]
        alpha = inside
    return np.clip(rgb, 0, 1), alpha

d = heart_field(N * SS)
full_rgb, full_a = shade(d)
glass_rgb, glass_a = shade(d, glass=True)
half = np.linspace(0, 1, N * SS)[None, :] < 0.5
half_rgb = np.where(half[..., None], full_rgb, glass_rgb)
half_a = np.where(half, full_a, glass_a)

os.makedirs(OUT, exist_ok=True)
for name, rgb, a in [('heart_full', full_rgb, full_a), ('heart_half', half_rgb, half_a), ('heart_empty', glass_rgb, glass_a)]:
    img = Image.fromarray((np.dstack([rgb, a]) * 255 + 0.5).astype(np.uint8), 'RGBA').resize((N, N), Image.LANCZOS)
    img.save(os.path.join(OUT, name + '.png'), optimize=True)
    print(name, img.size)
