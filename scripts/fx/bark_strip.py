# A mangrove root bark strip for the play-plane roots (img/mangrove_bark_<n>.webp): a painted root
# running left to right, cut out, cropped to its band (bark plus the algae beard below), made
# seamless along its length (its last share cross-fades into its start) and freed of the pale haze
# the cutout leaves. 512 px tall, so a root about 250-320 px thick keeps its detail.
# usage: python -I scripts/fx/bark_strip.py <cutout png> <out webp> [warmth]
import sys
import numpy as np
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
WARM = float(sys.argv[3]) if len(sys.argv) > 3 else 0      # 0..1: pull a pale bark toward the warm red-brown of the first strip
H, FADE = 512, 0.18

a = np.asarray(Image.open(SRC).convert('RGBA')).astype(np.float32)
rows = np.where((a[..., 3] > 40).mean(1) > 0.5)[0]
a = a[max(0, rows.min() - 30):min(a.shape[0], rows.max() + 90)]
W = a.shape[1]; F = int(W * FADE)
core = a[:, :W - F].copy()
t = np.linspace(0, 1, F)[None, :, None]
core[:, :F] = a[:, W - F:] * (1 - t) + a[:, :F] * t
rgb = core[..., :3]
mx, mn = rgb.max(-1), rgb.min(-1)
core[..., 3] = np.where((mn > 170) & ((mx - mn) / np.maximum(mx, 1) < 0.18) & (core[..., 3] < 230), 0, core[..., 3])     # the cutout's pale haze (semi-transparent; pale oysters are opaque and stay)
if WARM:
    lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    warm = lum[..., None] * np.array([1.18, 0.78, 0.55], np.float32)
    wood = ((rgb[..., 0] > rgb[..., 1]) & (rgb[..., 1] > rgb[..., 2]))[..., None]       # only the brown wood, not the moss or sponges
    core[..., :3] = np.where(wood, rgb * (1 - WARM) + warm * WARM, rgb)
out = Image.fromarray(np.clip(core, 0, 255).astype(np.uint8), 'RGBA')
out = out.resize((round(out.width * H / out.height), H), Image.LANCZOS)
out.save(OUT, quality=90, method=6)
print(OUT, out.size)
