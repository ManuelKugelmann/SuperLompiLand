"""Pack the biome atlases (user: "Art in atlases always a good idea. Limited, reused tileset. Biome tiles and
assets in one file"): one Phaser multiatlas per biome plus atlas_common, read by game/art.js.

Each picture is packed at the size the game shows it at most (its largest display size x HEADROOM, never
larger than its file), trimmed to its alpha box (except swaying ropes: Phaser's Rope maps only the frame, so a
trimmed one would move its root), with PAD px between frames and EXTRUDE px of its edge pixels repeated
around it so filtering never bleeds a neighbour in. Pages are POT up to PAGE px. A half-size twin
(<name>@half) holds the same frames at half the size for the slow quality tiers.

    python -I scripts/atlas/pack.py [atlas ...]      (default: all in ATLASES)
Output: public/img/atlas/<name>[@half].json, <name>[@half]-<page>.webp and index.json (the atlases there)
"""
import glob
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
IMG = os.path.join(ROOT, 'public', 'img')
OUT = os.path.join(IMG, 'atlas')
PAGE = 2048
PAD, EXTRUDE = 2, 2
HEADROOM = 1.25          # over the largest display size: camera zoom and a little sharper than needed
ROPES = {'seagrass_1', 'seafan_1', 'anemone_1', 'kelp_2', 'kelp_stalk_1', 'kelp_stalk_2', 'kelp_stalk_3'}

# The largest size (game px) each picture is shown at, from the tables that place them:
#   ('long', px) its longer side, ('w', px) its width, ('h', px) its height.
CORALS = {k: ('long', 3.2 * 170) for k in ['coral_1', 'coral_2', 'coral_3', 'coral_4', 'coral_5', 'coral_table', 'coral_brain', 'coral_fan', 'coral_staghorn']}  # coralSizes.js: large class, 3.2 fish lengths
MICRO = {f'micro_{k}_{v}': ('w', 260) for k in ['pebbles', 'shells', 'mussels', 'tufts', 'rubble'] for v in range(3)}  # microScatter.js MICRO.width
PROPS = {  # LevelGenerator PROPS widths (and WALL_LIFE where larger)
    'seafan_1': ('w', 330), 'anemone_1': ('w', 210), 'seagrass_1': ('w', 340), 'kelp_2': ('w', 260),
    **{f'boulder_{i}': ('w', 460) for i in range(1, 7)},
}
KELP = {k: ('h', 680) for k in ['kelp_stalk_1', 'kelp_stalk_2', 'kelp_stalk_3']}      # addKelp: up to 680 px tall

ATLASES = {
    'atlas_common': {'coin': ('long', 256), 'bubble': ('long', 256), **MICRO},
    'atlas_reef': {**CORALS, **{k: PROPS[k] for k in ['seafan_1', 'anemone_1', 'seagrass_1']},
                   **{f'boulder_{i}': PROPS[f'boulder_{i}'] for i in range(1, 7)}, **KELP},
}


def source(key):
    """The picture file for a texture key (its own name, anywhere under public/img but the atlases)."""
    found = [f for f in glob.glob(os.path.join(IMG, '**', key + '.*'), recursive=True)
             if f.lower().endswith(('.png', '.webp')) and os.sep + 'atlas' + os.sep not in f and os.sep + 'far' + os.sep not in f]
    if not found:
        raise SystemExit(f'no picture for {key}')
    return sorted(found, key=len)[0]


def scaled(key, spec, half):
    im = Image.open(source(key)).convert('RGBA')
    kind, px = spec
    side = {'long': max(im.size), 'w': im.width, 'h': im.height}[kind]
    s = min(1.0, px * HEADROOM / side) * (0.5 if half else 1.0)
    w, h = max(1, round(im.width * s)), max(1, round(im.height * s))
    if (w, h) != im.size:
        im = im.resize((w, h), Image.LANCZOS)
    box = (0, 0, w, h) if key in ROPES else (im.getchannel('A').point(lambda a: 255 if a > 2 else 0).getbbox() or (0, 0, w, h))
    return im.crop(box), (w, h), box


def extrude(page, img, x, y):
    """Paste img at (x, y) and repeat its border pixels EXTRUDE px outward."""
    w, h = img.size
    page.paste(img, (x, y))
    for e in range(1, EXTRUDE + 1):
        page.paste(img.crop((0, 0, w, 1)), (x, y - e)); page.paste(img.crop((0, h - 1, w, h)), (x, y + h - 1 + e))
        page.paste(img.crop((0, 0, 1, h)), (x - e, y)); page.paste(img.crop((w - 1, 0, w, h)), (x + w - 1 + e, y))
        for cx, cy, dx, dy in ((0, 0, -e, -e), (w - 1, 0, e, -e), (0, h - 1, -e, e), (w - 1, h - 1, e, e)):
            page.paste(img.crop((cx, cy, cx + 1, cy + 1)), (x + cx + dx, y + cy + dy))


def skyline_pack(items):
    """Skyline bottom-left packing, largest first: [(key, w, h)] -> pages [[(key, x, y)]] (x, y = where the frame starts)."""
    left = sorted(items, key=lambda t: -(t[1] * t[2]))
    pages = []
    while left:
        sky, placed, rest = [(0, 0, PAGE)], [], []      # skyline segments (x, y, width)
        for key, w, h in left:
            cw, ch = w + 2 * EXTRUDE + PAD, h + 2 * EXTRUDE + PAD
            if cw > PAGE or ch > PAGE:
                raise SystemExit(f'{key} ({w}x{h}) does not fit a {PAGE} page')
            best = None
            for i in range(len(sky)):
                x, j, top, room = sky[i][0], i, 0, 0
                while room < cw and j < len(sky):
                    top = max(top, sky[j][1]); room += sky[j][2]; j += 1
                if room >= cw and top + ch <= PAGE and (best is None or (top + ch, x) < (best[0] + ch, best[1])):
                    best = (top, x)
            if best is None:
                rest.append((key, w, h)); continue
            y, x = best
            placed.append((key, x + EXTRUDE, y + EXTRUDE))
            # Raise the skyline over [x, x + cw).
            new, end = [], x + cw
            for sx, sy, sw in sky:
                if sx + sw <= x or sx >= end:
                    new.append((sx, sy, sw)); continue
                if sx < x: new.append((sx, sy, x - sx))
                if sx + sw > end: new.append((end, sy, sx + sw - end))
            new.append((x, y + ch, cw))
            new.sort()
            sky = []
            for seg in new:      # merge neighbours at the same height
                if sky and sky[-1][1] == seg[1] and sky[-1][0] + sky[-1][2] == seg[0]:
                    sky[-1] = (sky[-1][0], seg[1], sky[-1][2] + seg[2])
                else:
                    sky.append(seg)
        if not placed:
            raise SystemExit('nothing fits')
        pages.append(placed); left = rest
    return pages


def pot(n):
    p = 64
    while p < n:
        p *= 2
    return p


def build(name, table, half):
    tag = name + ('@half' if half else '')
    frames = {k: scaled(k, spec, half) for k, spec in table.items()}
    pages = skyline_pack([(k, f[0].width, f[0].height) for k, f in frames.items()])
    for old in glob.glob(os.path.join(OUT, glob.escape(tag) + '-*.webp')):      # pages of an earlier run
        os.remove(old)
    textures = []
    for i, placed in enumerate(pages):
        W = pot(max(x + frames[k][0].width + EXTRUDE for k, x, _ in placed))
        H = pot(max(y + frames[k][0].height + EXTRUDE for k, _, y in placed))
        page = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        out = []
        for k, x, y in placed:
            img, (sw, sh), box = frames[k]
            extrude(page, img, x, y)
            out.append({'filename': k, 'rotated': False, 'trimmed': box != (0, 0, sw, sh),
                        'sourceSize': {'w': sw, 'h': sh},
                        'spriteSourceSize': {'x': box[0], 'y': box[1], 'w': img.width, 'h': img.height},
                        'frame': {'x': x, 'y': y, 'w': img.width, 'h': img.height}})
        image = f'{tag}-{i}.webp'
        page.save(os.path.join(OUT, image), 'WEBP', quality=90, method=6, exact=True)
        textures.append({'image': image, 'format': 'RGBA8888', 'size': {'w': W, 'h': H}, 'scale': 1, 'frames': out})
    with open(os.path.join(OUT, tag + '.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'textures': textures, 'meta': {'app': 'scripts/atlas/pack.py', 'version': '1'}}, f, separators=(',', ':'))
    used = sum(t['size']['w'] * t['size']['h'] for t in textures)
    print(f'{tag}: {len(frames)} frames on {len(textures)} page(s) {[(t["size"]["w"], t["size"]["h"]) for t in textures]}, {used * 4 / 2**20:.1f} MB in memory')


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name in sys.argv[1:] or ATLASES:
        for half in (False, True):
            build(name, ATLASES[name], half)
    # The list the title screen loads (game/art.js): every atlas whose file is there.
    have = sorted(n for n in ATLASES if os.path.exists(os.path.join(OUT, n + '.json')))
    with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'atlases': have}, f)
