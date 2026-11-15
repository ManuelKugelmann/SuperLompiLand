# Natural ends instead of straight cuts (user: "get rid of all cut assets: end with natural contours,
# not straight cuts / asset image end"). Pictures whose art runs into the picture's edge get that edge
# eaten away along a soft, wandering contour: the coral rubble of a wreck thins out, a horizon town
# fades into haze, a plume or a wing tip ends softly. Found by scanning every picture for opaque runs
# along its borders. Reads the untouched originals (kept outside public/) and writes into public/img.
# usage: python -I scripts/fx/edge_fade.py <originals dir> <repo root>
import sys, os, zlib
import numpy as np
from PIL import Image
from scipy import ndimage as nd

SRC, ROOT = sys.argv[1], sys.argv[2]
# picture (under public/img) -> {edge: share of the picture's width (left/right) or height (top/bottom) that fades}
EDGES = {
    'props/wreck_2.webp': {'left': 0.12, 'right': 0.06},       # coral rubble cut off at the picture's sides
    'sky/port.webp': {'left': 0.16, 'right': 0.1},             # the horizon town ends in haze
    'sky/volcano.webp': {'top': 0.14, 'right': 0.08},          # the plume thins out upward, the cloud bank to the side
    'siphon_card.webp': {'top': 0.1},                          # its soft glow touched the top
    'gannet_glide.webp': {'top': 0.05, 'left': 0.05},          # the raised wing tip touched the top, the tail the side
    'gull_glide.webp': {'top': 0.06},                          # a wing tip ran into the top
    'props/wreck_3.webp': {'top': 0.06},                       # the broken mast cut by the top
    'whale_net.webp': {'right': 0.08},                         # the net's mesh cut at the side
    'tube_worms.webp': {'bottom': 0.1},                        # the stone they sit on ended in a straight line
    'finale/grand_garden.webp': {'left': 0.08, 'right': 0.08}, # the garden's dark foot ran to the sides
}
WANDER = 0.45     # how far the contour wanders, share of the fade width

def fade(a, edge, share, rng):
    h, w = a.shape[:2]
    along, across = (h, w) if edge in ('left', 'right') else (w, h)
    width = max(4, share * across)
    # A wandering contour along the edge: smooth noise, so it reads as a natural end.
    n = nd.gaussian_filter1d(rng.standard_normal(along), along / 40)
    n = n / (np.abs(n).max() + 1e-9)
    limit = width * (1 - WANDER * (0.5 + 0.5 * n))                   # per row/column: how deep the fade reaches
    d = np.arange(across, dtype=np.float32)[None, :] if edge in ('left', 'top') else (across - 1 - np.arange(across, dtype=np.float32))[None, :]
    k = np.clip(d / limit[:, None], 0, 1)
    k = k * k * (3 - 2 * k)
    if edge in ('top', 'bottom'): k = k.T
    a[..., 3] *= k

for rel, edges in EDGES.items():
    rng = np.random.default_rng(zlib.crc32(rel.encode()))      # each picture its own contour, whatever else is listed
    src = os.path.join(SRC, rel)
    a = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32)
    for edge, share in edges.items(): fade(a, edge, share, rng)
    out = os.path.join(ROOT, 'public', 'img', rel)
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA').save(out, quality=90, method=6)
    print(rel, a.shape[1::-1])
