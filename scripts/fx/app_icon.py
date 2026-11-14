# The app icons (assets/icons/, copied into public/ by scripts/gen-icons.mjs): Lompi himself, the
# painted pufferfish the game plays, large on a soft ocean gradient with a glow behind him and a few
# bubbles, so he reads at 48 px. The maskable variants keep him inside the central 80% safe circle.
# usage: python -I scripts/fx/app_icon.py <repo root>
import sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = sys.argv[1]
OUT = os.path.join(ROOT, 'assets', 'icons')
W = 1024                                   # worked at this size, scaled down at the end
TOP, BOTTOM, GLOW = (86, 222, 236), (10, 70, 150), (255, 246, 214)

def background():
    y = np.linspace(0, 1, W)[:, None, None]
    g = np.array(TOP, np.float32) * (1 - y) + np.array(BOTTOM, np.float32) * y
    img = np.repeat(g, W, axis=1)
    # A soft light from above behind him.
    yy, xx = np.mgrid[0:W, 0:W]
    r = np.hypot((xx - W * 0.5) / (W * 0.42), (yy - W * 0.44) / (W * 0.4))
    k = np.clip(1 - r, 0, 1)[..., None] ** 1.8 * 0.55
    img = img * (1 - k) + np.array(GLOW, np.float32) * k
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')

def bubbles(img, scale):
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))      # drawn on their own layer, then blended (drawing straight onto RGBA replaces)
    d = ImageDraw.Draw(layer)
    for (x, y, r) in [(0.17, 0.2, 0.035), (0.24, 0.12, 0.022), (0.83, 0.24, 0.028), (0.88, 0.14, 0.017), (0.13, 0.33, 0.015)]:
        cx, cy = W * (0.5 + (x - 0.5) * scale), W * (0.5 + (y - 0.5) * scale)
        R = W * r * scale
        d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(255, 255, 255, 60), outline=(255, 255, 255, 170), width=max(2, int(R * 0.12)))
        d.ellipse([cx - R * 0.55, cy - R * 0.6, cx - R * 0.15, cy - R * 0.2], fill=(255, 255, 255, 200))
    img.alpha_composite(layer)

def icon(fish_w, scale):
    img = background()
    bubbles(img, scale)
    fish = Image.open(os.path.join(ROOT, 'public', 'img', 'puffer_normal.png')).convert('RGBA')
    fw = int(W * fish_w); fh = round(fish.height * fw / fish.width)
    fish = fish.resize((fw, fh), Image.LANCZOS)
    # A soft dark shadow under him lifts him off the gradient.
    sh = Image.new('RGBA', fish.size, (5, 30, 60, 0)); sh.putalpha(fish.getchannel('A').point(lambda a: a * 0.45))
    sh = sh.filter(ImageFilter.GaussianBlur(W * 0.012))
    x, y = (W - fw) // 2, int(W * 0.53 - fh / 2)
    img.alpha_composite(sh, (x + int(W * 0.01), y + int(W * 0.025)))
    img.alpha_composite(fish, (x, y))
    return img.convert('RGB')

os.makedirs(OUT, exist_ok=True)
plain, mask = icon(0.86, 1.0), icon(0.66, 0.8)        # maskable: within the central 80%
for name, img, sizes in [('pwa', plain, [512, 192]), ('maskable', mask, [512, 192])]:
    for s in sizes:
        fn = f'pwa-{s}x{s}.png' if name == 'pwa' else f'maskable-{s}.png'
        img.resize((s, s), Image.LANCZOS).save(os.path.join(OUT, fn), optimize=True)
        print(fn)
plain.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, 'card_preview.png'), optimize=True)
plain.resize((48, 48), Image.LANCZOS).save(os.path.join(OUT, '_check48.png'))
