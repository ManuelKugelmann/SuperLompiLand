# Cut every playable picture into part cards (scripts/parts/spec.json) and pack them into one
# atlas per picture: public/img/parts/<key>.webp + public/img/parts/rig.json (frames, pivots,
# roles, depth and the body's bulge map, read by game/rig/cards.js). Deterministic; re-run
# after changing the spec or the art.
# usage: python -I scripts/parts/bake.py <repo root> [<preview dir>]
import sys, os, json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

ROOT = sys.argv[1]
PREVIEW = sys.argv[2] if len(sys.argv) > 2 else None
IMG = os.path.join(ROOT, 'public', 'img')
OUT = os.path.join(IMG, 'parts')
spec = json.load(open(os.path.join(ROOT, 'scripts', 'parts', 'spec.json'), encoding='utf-8'))
HEIGHT_COLS = 32         # bulge map resolution (columns; rows follow the aspect)
FEATHER = 3              # px across a root line where body and part blend
SLIVER = 3               # px: body slivers thinner than about twice this inside a part's band go to the part
BAND = 14                # px either side of a part's polygon where segmentation decides (spec `band` overrides)
ATLAS_W = 1024
PAD = 2

def load(key):
    path = os.path.join(IMG, key + '.png')
    if not os.path.exists(path): path = os.path.join(IMG, key + '.webp')
    return np.asarray(Image.open(path).convert('RGBA')).astype(np.float32) / 255

def poly_mask(poly, W, H, ss=4):
    m = Image.new('L', (W * ss, H * ss), 0)
    ImageDraw.Draw(m).polygon([(x * ss, y * ss) for x, y in poly], fill=255)
    return np.asarray(m.resize((W, H), Image.BOX)).astype(np.float32) / 255

def refine(src, hint, band=BAND):
    """The part's own pixels: its polygon is only a hint. Deep inside it is the part, far outside
    it is not; in the band between, a seeded watershed over the picture's edges (colour steps and
    the dark painted outlines) decides, so the cut runs along the art's own boundaries. Pixels
    outside the picture take the label of the nearest painted pixel (the outline keeps its
    anti-aliasing). Returns a soft 0..1 mask."""
    a = src[..., 3] > 0.5
    hard = hint > 0.5
    inner = nd.binary_erosion(hard, iterations=band) & a
    if not inner.any(): return hint
    outer = ~nd.binary_dilation(hard, iterations=band) & a
    rgb = src[..., :3]
    g = np.max([np.hypot(nd.sobel(rgb[..., c], 0), nd.sobel(rgb[..., c], 1)) for c in range(3)], 0)
    lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    dark = np.clip((0.35 - lum) / 0.35, 0, 1)
    cost = (np.clip(g * 1.5 + dark * 0.5, 0, 1) * 254 + 1).astype(np.uint8)
    cost[~a] = 255
    markers = np.zeros(a.shape, np.int16)
    markers[outer] = 2; markers[inner] = 1; markers[~a] = 3
    lab = nd.watershed_ift(cost, markers)
    # Painted pixels the background flood took: the nearer of part and body gets them.
    own = (lab == 1) | (lab == 2)
    _, (iy, ix) = nd.distance_transform_edt(~own, return_indices=True)
    lab = np.where(own, lab, lab[iy, ix])
    # A part's outline is a thin dark line: where the body got a sliver of it inside the band
    # (not connected thickly to the body), it goes to the part.
    zone = nd.binary_dilation(hard, iterations=band) & ~inner
    body = (lab == 2) & zone
    sliver = body & ~nd.binary_opening(body, iterations=SLIVER)
    lab[sliver & nd.binary_dilation(lab == 1, iterations=SLIVER + 1)] = 1
    _, (iy, ix) = nd.distance_transform_edt(~a, return_indices=True)
    lab = np.where(a, lab, lab[iy, ix])
    return np.clip(nd.gaussian_filter((lab == 1).astype(np.float32), 0.7), 0, 1)

def beyond(root, centre, W, H):
    """0 on the body side of the root line, 1 beyond it (soft over FEATHER px)."""
    (x1, y1), (x2, y2) = root
    nx, ny = y2 - y1, -(x2 - x1)
    L = np.hypot(nx, ny); nx, ny = nx / L, ny / L
    ys, xs = np.mgrid[0:H, 0:W]
    d = (xs - x1) * nx + (ys - y1) * ny
    if (centre[0] - x1) * nx + (centre[1] - y1) * ny > 0: d = -d
    return np.clip(d / FEATHER + 0.5, 0, 1)

def fill(rgb, known, region):
    """Fill `region` from the `known` pixels around it (push-pull pyramid)."""
    levels = [(rgb * known[..., None], known)]
    while min(levels[-1][1].shape) > 2:
        c, w = levels[-1]
        H, W = w.shape; H2, W2 = (H + 1) // 2, (W + 1) // 2
        cp = np.zeros((H2 * 2, W2 * 2, 3), np.float32); wp = np.zeros((H2 * 2, W2 * 2), np.float32)
        cp[:H, :W] = c; wp[:H, :W] = w
        c2 = cp.reshape(H2, 2, W2, 2, 3).sum((1, 3)); w2 = wp.reshape(H2, 2, W2, 2).sum((1, 3))
        levels.append((c2, w2))
    c, w = levels[-1]
    est = c / np.maximum(w, 1e-6)[..., None]
    for c, w in reversed(levels[:-1]):
        H, W = w.shape
        up = np.repeat(np.repeat(est, 2, 0), 2, 1)[:H, :W]
        up = nd.uniform_filter(up, size=(3, 3, 1))
        k = np.clip(w, 0, 1)[..., None]
        est = (c / np.maximum(w, 1e-6)[..., None]) * k + up * (1 - k)
    return rgb * (1 - region[..., None]) + est * region[..., None]

def synth(rgb, known, region, reach=110, win=4, tries=160, seed=3):
    """Fill `region` with the body's own texture: pixel by pixel from its edge inward, each takes
    the pixel whose neighbourhood best matches (the known pixels within `reach`, plus the
    continuations of its filled neighbours), so shell plates and patterns carry on."""
    rng = np.random.default_rng(seed)
    H, W = known.shape
    todo = (region > 0.5) & ~(known > 0.5)
    if not todo.any(): return rgb
    out = rgb.copy(); have = known > 0.5
    src = np.zeros((H, W, 2), np.int32) - 1                      # where each filled pixel came from
    ys, xs = np.nonzero(todo)
    y0, y1 = max(win, ys.min() - reach), min(H - win - 1, ys.max() + reach)
    x0, x1 = max(win, xs.min() - reach), min(W - win - 1, xs.max() + reach)
    full = nd.minimum_filter(have.astype(np.uint8), size=2 * win + 1) > 0   # whole window known
    cy, cx = np.nonzero(full[y0:y1, x0:x1]); cy += y0; cx += x0
    if len(cy) == 0: return rgb
    dist = nd.distance_transform_edt(~have)
    order = np.argsort(dist[ys, xs], kind='stable')
    off = np.arange(-win, win + 1)
    for k in order:
        y, x = ys[k], xs[k]
        if y < win or x < win or y >= H - win or x >= W - win:
            continue
        mask = have[y - win:y + win + 1, x - win:x + win + 1]
        patch = out[y - win:y + win + 1, x - win:x + win + 1]
        pick = rng.integers(0, len(cy), tries)
        cands = list(zip(cy[pick], cx[pick]))
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                sy, sx = src[y + dy, x + dx]
                if sy >= 0:
                    ty, tx = sy - dy, sx - dx
                    if win <= ty < H - win and win <= tx < W - win and full[ty, tx]: cands.append((ty, tx))
        cand = np.array(cands)
        wy = cand[:, 0, None, None] + off[None, :, None]; wx = cand[:, 1, None, None] + off[None, None, :]
        diff = ((rgb[wy, wx] - patch[None]) ** 2).sum(-1) * mask[None]
        best = cand[np.argmin(diff.sum((1, 2)))]
        out[y, x] = rgb[best[0], best[1]]; have[y, x] = True; src[y, x] = best
    return out

def crop(a):
    ys, xs = np.nonzero(a[..., 3] > 0.01)
    x0, y0 = max(0, xs.min() - PAD), max(0, ys.min() - PAD)
    x1, y1 = min(a.shape[1], xs.max() + 1 + PAD), min(a.shape[0], ys.max() + 1 + PAD)
    return a[y0:y1, x0:x1], (int(x0), int(y0))

def pack(items):
    """Shelf packing; returns positions and the atlas height."""
    x = y = shelf = 0; pos = []
    width = max([ATLAS_W] + [a.shape[1] for a in items])
    for a in items:
        h, w = a.shape[:2]
        if x + w > width: x, y, shelf = 0, y + shelf + PAD, 0
        pos.append((x, y)); x += w + PAD; shelf = max(shelf, h)
    return pos, y + shelf

rig = {}
os.makedirs(OUT, exist_ok=True)
for key, s in spec.items():
    if key.startswith('_'): continue
    src = load(key); H, W = src.shape[:2]
    body = load(s.get('body', key)).copy()
    centre = np.array(nd.center_of_mass(body[..., 3]))[::-1]
    core = 1 - poly_mask(s['core'], W, H) if 'core' in s else None
    cards, meta = [], []
    for p in s['parts']:
        if 'image' in p:
            img = load(p['image']); ax, ay = p['at']
            cards.append(img); pivot = p['pivot']
            meta.append({'rect': [ax, ay, img.shape[1], img.shape[0]], 'pivot': pivot})
        else:
            hint = poly_mask(p['poly'], W, H)
            if core is not None: hint *= core
            # The part's own pixels (segmented), plus the hint's overlap on the body side of the
            # root: hidden under the body, so the card has no straight cut where it swings.
            m = refine(src, hint, p.get('band', BAND))
            on_body = hint * (1 - beyond(p['root'], centre, W, H))
            part = src.copy(); part[..., 3] *= np.maximum(m, on_body)
            c, (x0, y0) = crop(part)
            cards.append(c)
            (a, b) = p['root']; pivot = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
            meta.append({'rect': [x0, y0, c.shape[1], c.shape[0]], 'pivot': pivot, 'root': p['root']})
            # A front part leaves the body entirely (what lies under it is filled below); a part
            # behind the body only loses what reaches beyond its root line.
            rm = m if p.get('front') or core is not None else m * beyond(p['root'], centre, W, H)
            if p.get('front') and 'under' in p:
                region = poly_mask(p['under'], W, H) * (src[..., 3] > 0.5)
                known = (body[..., 3] > 0.95) * (1 - np.clip(m * 4, 0, 1))
                body[..., :3] = synth(fill(body[..., :3], known.astype(np.float32), region * m), known, region * m)
                body[..., 3] = np.maximum(body[..., 3] * (1 - rm), region * m * src[..., 3])
            else:
                body[..., 3] *= 1 - rm
        meta[-1].update({k: p[k] for k in ('name', 'role') if k in p})
        meta[-1].update({'pair': bool(p.get('pair')), 'front': bool(p.get('front')), 'z': p.get('z', 0), 'amp': p.get('amp', 1), 'phase': p.get('phase', 0)})
    # Bulge: thick in the middle of the body, thin at its outline.
    solid = body[..., 3] > 0.5
    d = nd.distance_transform_edt(solid)
    h = np.sqrt(np.clip(d / max(d.max(), 1), 0, 1))
    rows = max(2, round(HEIGHT_COLS * H / W))
    hs = np.asarray(Image.fromarray((h * 255).astype(np.uint8)).resize((HEIGHT_COLS, rows), Image.BILINEAR)).astype(np.float32) / 255
    bc, (bx, by) = crop(body)
    items = [bc] + cards
    pos, AH = pack(items)
    atlas = np.zeros((AH, max([ATLAS_W] + [a.shape[1] for a in items]), 4), np.float32)
    for (x, y), a in zip(pos, items): atlas[y:y + a.shape[0], x:x + a.shape[1]] = a
    used = max(x + a.shape[1] for (x, y), a in zip(pos, items))
    atlas = atlas[:, :used]
    Image.fromarray((atlas * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, key + '.webp'), quality=92, method=6)
    frames = [[x, y, a.shape[1], a.shape[0]] for (x, y), a in zip(pos, items)]
    rig[key] = {
        'size': [W, H],
        'body': {'frame': frames[0], 'rect': [bx, by, bc.shape[1], bc.shape[0]]},
        'height': {'cols': HEIGHT_COLS, 'rows': rows, 'data': [round(float(v), 2) for v in hs.ravel()]},
        'parts': [dict(m, frame=f) for m, f in zip(meta, frames[1:])]
    }
    if PREVIEW:
        # Reassembled at rest (should look like the picture) and the body alone.
        comp = Image.new('RGBA', (W * 2 + 20, H), (30, 70, 110, 255))
        def put(a, x, y): comp.alpha_composite(Image.fromarray((a * 255).astype(np.uint8)), (int(x), int(y)))
        for m, c in zip(meta, cards):
            if not m['front']: put(c, m['rect'][0], m['rect'][1])
        put(bc, bx, by)
        for m, c in zip(meta, cards):
            if m['front']: put(c, m['rect'][0], m['rect'][1])
        put(bc, W + 20 + bx, by)
        comp.convert('RGB').save(os.path.join(PREVIEW, f'baked_{key}.png'))
    print(key, 'parts', len(cards), 'atlas', atlas.shape[1], 'x', AH)
json.dump(rig, open(os.path.join(OUT, 'rig.json'), 'w'), separators=(',', ':'))
