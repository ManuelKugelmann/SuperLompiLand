# The tide mark on a mangrove root (img/mangrove_wetline.webp): a band of the same bark as
# mangrove_bark_1, darker and glossier where the water laps it, its barnacles and oysters kept, with
# soft top and bottom edges, so the coder can lay it along the waterline over the root (no cut).
# usage: python -I scripts/fx/wet_line.py <repo root>
import sys, os
import numpy as np
from PIL import Image

ROOT = sys.argv[1]
IMG = os.path.join(ROOT, 'public', 'img')
H = 160                                      # px tall band (bark strips are 512)
bark = np.asarray(Image.open(os.path.join(IMG, 'mangrove_bark_1.webp')).convert('RGBA')).astype(np.float32)
W = bark.shape[1]
band = bark[120:120 + H].copy()              # the bark's middle: wood and oysters, no algae beard
rgb = band[..., :3]
lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
wood = (rgb[..., 0] > rgb[..., 2] + 20)[..., None]
wet = rgb * 0.58                              # wet bark is darker ...
wet = wet + (wet - lum[..., None] * 0.58) * 0.25      # ... and a little richer in colour
y = np.linspace(0, 1, H)[:, None, None]
gloss = np.exp(-((y - 0.32) / 0.05) ** 2) * 70        # a thin wet sheen just under the top of the band
band[..., :3] = np.where(wood, wet + gloss, rgb * 0.8 + gloss * 0.5)
edge = np.clip(np.minimum(y, 1 - y) / 0.22, 0, 1)[..., 0]
band[..., 3] = band[..., 3] * edge * edge * (3 - 2 * edge)
Image.fromarray(np.clip(band, 0, 255).astype(np.uint8), 'RGBA').save(os.path.join(IMG, 'mangrove_wetline.webp'), quality=90, method=6)
print('mangrove_wetline', W, H)
