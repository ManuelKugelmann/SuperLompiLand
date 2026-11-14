# usage: python -I scripts/fx/ship.py <repo root> [<cut-out painting>]   (source: _ref/props-src/ship_cut.png)
# Ghost ship for the wreck sea: the front layer (whole ship, a jagged swim-through hole in the
# bow hull, the carved figurehead removed) and the inside seen through the hole (dark planking,
# ribs, a shaft of light), 2x up from the painting, plus where things are (ship.json).
import sys, json, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
D = sys.argv[1]
K = 2
src = Image.open(sys.argv[2] if len(sys.argv) > 2 else f'{D}/_ref/props-src/ship_cut.png').convert('RGBA')
src = src.resize((src.width * K, src.height * K), Image.LANCZOS).filter(ImageFilter.UnsharpMask(2, 60, 2))
W, H = src.size
rng = np.random.default_rng(4)
a = np.asarray(src).astype(np.float32)

def poly_mask(pts, feather=1.5):
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon([(x * K, y * K) for x, y in pts], fill=255)
    return np.asarray(m.filter(ImageFilter.GaussianBlur(feather))).astype(np.float32) / 255

# figurehead under the bowsprit: gone
fig = poly_mask([(872, 598), (952, 572), (958, 672), (884, 676)])
a[..., 3] *= 1 - fig
# the hole: jagged broken planks in the bow hull
cx, cy, rx, ry = 742, 748, 78, 50
pts = []
for i in range(36):
    t = i / 36 * 2 * math.pi
    r = 1 + 0.18 * math.sin(t * 7 + 1) + rng.uniform(-0.12, 0.2)
    pts.append((cx + math.cos(t) * rx * r, cy + math.sin(t) * ry * r))
hole = poly_mask(pts, 1.2)
# splintered rim: a darker, lighter-edged ring around the hole
ring = np.clip(poly_mask([(cx + (x - cx) * 1.12, cy + (y - cy) * 1.15) for x, y in pts], 2) - hole, 0, 1)
a[..., :3] = a[..., :3] * (1 - 0.7 * ring[..., None]) + np.array([150, 118, 86]) * 0.7 * ring[..., None]   # splintered raw wood
a[..., 3] *= 1 - hole
front = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
bb = front.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
front = front.crop(bb)
front.save(f'{D}/public/img/ship/ship_front.webp', quality=88, method=6)
# the inside: dark planking with ribs, lit a little from above through the deck
hx0, hy0, hx1, hy1 = (cx - rx * 1.4) * K, (cy - ry * 1.5) * K, (cx + rx * 1.4) * K, (cy + ry * 1.5) * K
w, h = int(hx1 - hx0), int(hy1 - hy0)
ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
col = np.ones((h, w, 3), np.float32) * np.array([12, 17, 24])
planks = (np.sin(ys / 9.5) > 0.86).astype(np.float32)
col *= (1 - 0.25 * planks)[..., None]
ribs = np.clip(1 - np.abs(((xs + 20) % 70) - 35) / 7, 0, 1)
col = col * (1 - ribs[..., None]) + np.array([36, 32, 28]) * ribs[..., None]
shaft = np.clip(1 - np.abs(xs - w * 0.6 - (ys - h) * 0.25) / 40, 0, 1) * np.clip(1 - ys / h, 0, 1)
col += shaft[..., None] * np.array([26, 44, 54])
col *= (0.7 + 0.3 * (ys / h))[..., None]               # darker at the top, under the deck
inside = Image.fromarray(np.dstack([np.clip(col, 0, 255), np.full((h, w), 255)]).astype(np.uint8), 'RGBA')
inside.save(f'{D}/public/img/ship/ship_inside.webp', quality=88, method=6)
lanterns = [(299, 672), (357, 676), (420, 680), (481, 681), (540, 680), (598, 674), (659, 669), (725, 662)]
info = {
    'front': [front.width, front.height],
    'hole': [round(cx * K - bb[0]), round(cy * K - bb[1]), round(rx * K), round(ry * K)],      # centre and radii in front px
    'inside': [round(hx0 - bb[0]), round(hy0 - bb[1]), w, h],                                    # where the inside patch lies (front px)
    'lanterns': [[round(x * K - bb[0]), round(y * K - bb[1])] for x, y in lanterns],
    'keel': [round(230 * K - bb[0]), round(820 * K - bb[1]), round(830 * K - bb[0]), round(835 * K - bb[1])]   # where it rests on the seabed
}
json.dump(info, open(f'{D}/public/img/ship/ship.json', 'w'))
print(info)
