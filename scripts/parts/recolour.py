# Iridescent pastel accents on the playables (user: "rainbow colors on protagonists", lookdev1):
# multicolour glitter spots on the puffer, blue-violet scutes on the turtle's shell, rainbow fins
# and fin rays. Procedural and luminance-preserving: every pixel keeps its brightness, outline
# and place; only hue and saturation move, so the part layout (spec.json) and the bake stay valid.
# Reads the untouched originals from _ref/art-src/playables (local), writes public/img/<key>.png.
# Re-run bake.py afterwards.
# usage: python -I scripts/parts/recolour.py <repo root> <originals dir>
import sys, os, json, colorsys
sys.dont_write_bytecode = True
import numpy as np
from PIL import Image
from scipy import ndimage as nd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from seg import poly_mask, refine

ROOT, SRC = sys.argv[1], sys.argv[2]
IMG = os.path.join(ROOT, 'public', 'img')
spec = json.load(open(os.path.join(ROOT, 'scripts', 'parts', 'spec.json'), encoding='utf-8'))
LUMA = np.array([0.299, 0.587, 0.114], np.float32)
SPOT_HUES = [330, 200, 275, 150, 185, 95, 45]     # pink, sky, violet, mint, turquoise, lime, gold

def hue_rgb(h, s):
    """RGB (0..1) of hue h (degrees, array) at saturation s, full value."""
    h = (np.asarray(h, np.float32) % 360) / 60
    c = np.float32(s); x = c * (1 - np.abs(h % 2 - 1)); z = np.zeros_like(h)
    i = np.floor(h).astype(int) % 6
    r = np.choose(i, [c + z, x, z, z, x, c + z]); g = np.choose(i, [x, c + z, c + z, x, z, z]); b = np.choose(i, [z, z, x, c + z, c + z, x])
    return np.stack([r, g, b], -1) + (1 - c)

def tint(rgb, hue, sat, amount):
    """Move rgb toward `hue` at `sat`, keeping each pixel's luminance; amount 0..1 per pixel."""
    want = hue_rgb(hue, sat)
    l0 = rgb @ LUMA; l1 = np.maximum(want @ LUMA, 1e-4)
    target = np.clip(want * (l0 / l1)[..., None], 0, 1)
    return rgb + (target - rgb) * amount[..., None]

def part_mask(src, key, name):
    p = next(q for q in spec[key]['parts'] if q['name'] == name)
    H, W = src.shape[:2]
    return refine(src, poly_mask(p['poly'], W, H)), p['root']

def rainbow_part(src, key, name, amount, span=260, start=None, sat=0.55, tips=0):
    """A part's colours run through the rainbow from its root to its tip (fin rays)."""
    m, ((x1, y1), (x2, y2)) = part_mask(src, key, name)
    rainbow(src, m, ((x1 + x2) / 2, (y1 + y2) / 2), amount, span, start, sat, tips)

def rainbow(src, m, at, amount, span=260, start=None, sat=0.55, tips=0):
    """Colours under mask m run through the rainbow with the distance from point `at`; with
    `tips` (0..1) only that outer share of the way to the far end is coloured (ray tips)."""
    H, W = m.shape
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.hypot(xs - at[0], ys - at[1])
    far = max(1.0, float(d[m > 0.5].max())) if (m > 0.5).any() else 1.0
    h0 = start if start is not None else 0
    u = np.clip(d / far, 0, 1)
    hue = h0 + span * u
    ramp = 1 if not tips else np.clip((u - (1 - tips)) / (tips * 0.5), 0, 1)
    src[..., :3] = tint(src[..., :3], hue, sat, m * amount * ramp)

def spine_tips(src, hues=(320, 285), reach=10, amount=0.65, sat=0.6):
    """Light spines standing out of the silhouette get pink and violet tips (by angle round the
    middle). A spine is what an opening of the silhouette removes; the outline itself is left alone."""
    rgb = src[..., :3]; a = src[..., 3] > 0.5
    lum = rgb @ LUMA; mx, mn = rgb.max(-1), rgb.min(-1); s = (mx - mn) / np.maximum(mx, 1e-4)
    spines = a & ~nd.binary_opening(a, structure=np.ones((3, 3)), iterations=reach // 2)
    on = spines & (lum > 0.55) & (s < 0.4)
    H, W = a.shape; cy, cx = nd.center_of_mass(a)
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    k = (np.floor((np.arctan2(ys - cy, xs - cx) + np.pi) / (2 * np.pi) * 14) % 2).astype(np.float32)
    hue = hues[0] + (hues[1] - hues[0]) * k
    src[..., :3] = tint(rgb, hue, sat, nd.gaussian_filter(on.astype(np.float32), 0.8) * amount)

def glitter_spots(src, exclude, amount=0.85, sat=0.7):
    """Darker coloured spots on a light body get one pastel hue each (glitter)."""
    rgb = src[..., :3]; a = src[..., 3] > 0.5
    lum = rgb @ LUMA
    mx, mn = rgb.max(-1), rgb.min(-1); s = (mx - mn) / np.maximum(mx, 1e-4)
    spot = a & ~exclude & ((nd.gaussian_filter(lum, 6) - lum) > 0.05) & (s > 0.3) & (lum > 0.2)
    spot = nd.binary_opening(spot, iterations=1)
    lab, n = nd.label(spot)
    if n == 0: return
    sizes = nd.sum(spot, lab, range(1, n + 1)); cy = nd.center_of_mass(spot, lab, range(1, n + 1))
    hue = np.zeros(lab.shape, np.float32); amt = np.zeros(lab.shape, np.float32)
    for i, (size, (y, x)) in enumerate(zip(sizes, cy)):
        if not 12 <= size <= 2500: continue
        k = int(x * 7.31 + y * 3.17) % len(SPOT_HUES)
        sel = lab == i + 1
        hue[sel] = SPOT_HUES[k]; amt[sel] = amount
    amt = nd.gaussian_filter(nd.grey_dilation(amt, size=3), 0.8) * a
    hue = nd.grey_dilation(hue, size=5)
    src[..., :3] = tint(rgb, hue, sat, amt)

def iridescent_region(src, poly, hues, amount=0.8, sat=0.6, keep_hue=(60, 175)):
    """Pixels of `keep_hue` (e.g. green scutes) inside the polygon shimmer from hues[0] to hues[1]
    across it (left to right), each scute slightly different."""
    H, W = src.shape[:2]
    m = refine(src, poly_mask(poly, W, H))
    rgb = src[..., :3]
    hsv_h = np.vectorize(lambda r, g, b: colorsys.rgb_to_hsv(r, g, b)[0], otypes=[np.float32])
    h = np.zeros((H, W), np.float32); sel = m > 0.05
    h[sel] = hsv_h(rgb[sel][:, 0], rgb[sel][:, 1], rgb[sel][:, 2]) * 360
    on = sel & (h >= keep_hue[0]) & (h <= keep_hue[1])
    xs = np.mgrid[0:H, 0:W][1].astype(np.float32)
    x0, x1 = xs[sel].min(), xs[sel].max()
    hue = hues[0] + (hues[1] - hues[0]) * (xs - x0) / max(1, x1 - x0)
    hue += (nd.gaussian_filter(np.random.default_rng(5).normal(0, 1, (H, W)).astype(np.float32), 9) * 260)   # per-scute drift
    amt = nd.gaussian_filter(on.astype(np.float32), 0.8) * m * amount
    src[..., :3] = tint(rgb, hue, sat, amt)

def load(name):
    return np.asarray(Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')).astype(np.float32) / 255

def save(name, a):
    Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)).save(os.path.join(IMG, name + '.png'), optimize=True)
    print('wrote', name)

def eyes(src):
    """The eyes (dark pupils and white sclera, and around them): left alone."""
    lum = src[..., :3] @ LUMA
    e = (lum < 0.15) | (lum > 0.93)
    return nd.binary_dilation(e, iterations=4)

# Lompi: glitter spots on the body, rainbow fins.
for key, pics in (('puffer_normal', ('puffer_normal', 'puffer_normal_body')), ('puffer_inflated', ('puffer_inflated', 'puffer_inflated_body'))):
    for pic in pics:
        a = load(pic)
        cut = [q for q in spec[key]['parts'] if 'poly' in q]
        fins = np.zeros(a.shape[:2], bool)
        for q in cut:
            fins |= part_mask(a, key, q['name'])[0] > 0.5
        glitter_spots(a, fins | eyes(a), amount=0.95, sat=0.85)
        spine_tips(a)
        for i, q in enumerate(cut):
            rainbow_part(a, key, q['name'], 0.5, start=300 + 40 * i)
        save(pic, a)
    for i, q in enumerate(p for p in spec[key]['parts'] if 'image' in p):   # fins painted as their own picture
        a = load(q['image'])
        rainbow(a, a[..., 3], (q['pivot'][0] - q['at'][0], q['pivot'][1] - q['at'][1]), 0.5, start=60 + 40 * i)
        save(q['image'], a)

# Turtle: blue-violet iridescent scutes.
a = load('friend_turtle')
iridescent_region(a, [[70,160],[100,110],[150,60],[210,35],[270,35],[320,45],[330,80],[300,95],[260,120],[230,150],[190,160],[140,165]], (205, 285))
save('friend_turtle', a)

# Seahorse: rainbow-tinted fin.
a = load('friend_seahorse'); rainbow_part(a, 'friend_seahorse', 'fin', 0.6, start=170); save('friend_seahorse', a)

# Firefish: rainbow fin rays (its fan).
a = load('player_firefish'); rainbow_part(a, 'player_firefish', 'fan', 0.6, span=320, start=10, sat=0.6, tips=0.3); save('player_firefish', a)

# Flitzie: a soft rainbow along the wing and tail.
a = load('player_flyingfish')
rainbow_part(a, 'player_flyingfish', 'wing', 0.55, start=170)
rainbow_part(a, 'player_flyingfish', 'tail', 0.35, start=280)
save('player_flyingfish', a)
