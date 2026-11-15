"""Strip the painted ground base off floor props and corals (user: "No sand blocks on floor. Drop blocks, make
part of terrain."). Generated pictures came with their own sand pad or rock lump under them, which read as a
block lying on the seabed (and barrel_2's pad was cut straight at the picture's edge). This removes that base,
so the picture's own contour is its foot and the game sets it into the terrain.

The base is everything reached from the picture's bottom, inside its lower part, through base pixels:
  hue   not the picture's own colour (its main hue, measured in its upper part: polyps, fan)
  sand  that, or pale warm sand (wood or leaves on a sand pad)
  grey  grey rock (little saturation): coral clusters of many colours on a stone
  dark  grey rock or a dark mossy disc
It is faded out over a couple of pixels, crumbs left floating are dropped and the empty rows below trimmed.
Originals are kept once under _ref/art_orig/ and always read from there, so a rerun is repeatable.

    python -I scripts/props/strip_base.py
"""
import os
import shutil
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
IMG = os.path.join(ROOT, 'public', 'img')
ORIG = os.path.join(ROOT, '_ref', 'art_orig')

# picture (under public/img): (share of the height from the top below which the base may lie, mode)
PICTURES = {
    'props/barrel_1.webp': (0.45, 'sand'),
    'props/barrel_2.webp': (0.45, 'sand'),
    'props/seagrass_1.webp': (0.6, 'sand'),
    'props/anemone_1.webp': (0.55, 'hue'),
    'props/seafan_1.webp': (0.7, 'hue'),
    'coral_1.png': (0.55, 'grey'),
    'coral_2.png': (0.6, 'grey'),
    'coral_3.png': (0.6, 'dark'),
    'coral_4.webp': (0.6, 'grey'),
    'coral_5.webp': (0.55, 'grey'),
    'coral/coral_fan.webp': (0.7, 'grey'),
    'coral/coral_staghorn.webp': (0.6, 'grey'),
    'coral/coral_table.webp': (0.6, 'grey'),
}
HUE_TOL = 40 / 360      # a pixel this close to the picture's main hue (and saturated) is the prop
SAT_MIN = 0.3
GREY = 0.33             # rock: saturation under this
DARK = 0.55             # a dark base: value under this
CRUMB = 0.03            # pieces smaller than this share of the largest are dropped


def hsv(rgb):
    a = np.array(Image.fromarray(rgb).convert('HSV'), np.float32) / 255
    return a[..., 0], a[..., 1], a[..., 2]


def components(mask):
    """Label 4-connected regions of a boolean mask; returns labels and sizes."""
    H, W = mask.shape
    lab = np.zeros((H, W), np.int32)
    sizes = [0]
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0]:
            continue
        k = len(sizes)
        lab[y0, x0] = k
        q, n = deque([(y0, x0)]), 0
        while q:
            y, x = q.popleft(); n += 1
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and mask[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = k; q.append((yy, xx))
        sizes.append(n)
    return lab, np.array(sizes)


def base_pixels(im, mode):
    H = im.shape[0]
    h, s, v = hsv(np.ascontiguousarray(im[..., :3]))
    grey = s < GREY
    if mode == 'grey':
        return grey
    if mode == 'dark':
        return grey | (v < DARK)
    # The picture's main hue: circular mean of the saturated pixels in its upper half.
    up = (im[: H // 2, :, 3] > 128) & (s[: H // 2] > SAT_MIN)
    ang = h[: H // 2][up] * 2 * np.pi
    main = (np.arctan2(np.sin(ang).mean(), np.cos(ang).mean()) / (2 * np.pi)) % 1
    dh = np.abs(h - main); dh = np.minimum(dh, 1 - dh)
    other = ~((dh < HUE_TOL) & (s > SAT_MIN))
    if mode == 'sand':
        return other | ((s < 0.45) & (v > 0.5) & (im[..., 0] >= im[..., 2]))      # pale, warm, little saturation
    return other


def strip(rel, top, mode):
    dst, src = os.path.join(IMG, rel), os.path.join(ORIG, rel)
    if not os.path.exists(src):
        os.makedirs(os.path.dirname(src), exist_ok=True)
        shutil.copy2(dst, src)
    im = np.array(Image.open(src).convert('RGBA'))
    H, W = im.shape[:2]
    alpha = im[..., 3]
    can = base_pixels(im, mode) & (alpha > 8)
    can[: int(H * top)] = False
    # Flood from the lowest opaque pixel of every column through base pixels.
    base = np.zeros((H, W), bool)
    q = deque()
    for x in range(W):
        ys = np.nonzero(alpha[:, x] > 8)[0]
        if len(ys) and can[ys[-1], x]:
            base[ys[-1], x] = True; q.append((ys[-1], x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < H and 0 <= xx < W and can[yy, xx] and not base[yy, xx]:
                base[yy, xx] = True; q.append((yy, xx))
    # A soft edge of a couple of pixels where the base met the picture.
    soft = np.array(Image.fromarray((base * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.2)), np.float32) / 255
    out = im.copy()
    out[..., 3] = (alpha * (1 - soft)).astype(np.uint8)
    # Crumbs left floating (grains, pebbles, faint shadow): gone.
    lab, sizes = components(out[..., 3] > 8)
    small = np.nonzero(sizes < sizes.max() * CRUMB)[0]
    out[..., 3][np.isin(lab, small) & (lab > 0)] = 0
    out[..., 3][out[..., 3] <= 8] = 0
    rows = np.nonzero((out[..., 3] > 0).any(axis=1))[0]
    out = out[: rows[-1] + 1]
    img = Image.fromarray(out)
    if rel.endswith('.png'):
        img.save(dst, 'PNG', optimize=True)
    else:
        img.save(dst, 'WEBP', quality=90, method=6)
    return base.sum() / max(1, (alpha > 8).sum()), out.shape[0], H


if __name__ == '__main__':
    for rel, (top, mode) in PICTURES.items():
        share, h, H = strip(rel, top, mode)
        print(f'{rel}: base {share:.0%} of the picture removed, height {H} -> {h}')
