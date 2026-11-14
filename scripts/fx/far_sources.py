# The far scenery's textures, baked ahead (img/far/<key>.webp): what FarLayers.js would bake at
# run time from the full-size art (220 px wide, softened, bottom faded into the water). Baking a
# big picture at run time decodes all of it: up to 50 ms on a desktop, several hundred on a phone,
# in the frame a jump lands in a new biome. Keep BAKE_W, BLUR and FADE in step with FarLayers.js.
# usage: python -I scripts/fx/far_sources.py <repo root>
import sys, os, glob
from PIL import Image, ImageFilter

ROOT = sys.argv[1]
IMG = os.path.join(ROOT, 'public', 'img')
OUT = os.path.join(IMG, 'far')
BAKE_W, BLUR, FADE, PAD = 220, 1.8, 0.38, 2
KEYS = ['root_1', 'root_3', 'seagrass_1', 'kelp_stalk_1', 'kelp_stalk_2', 'kelp_stalk_3',
        'coral_1', 'coral_2', 'coral_3', 'coral_4', 'coral_5', 'seafan_1',
        'boulder_1', 'boulder_2', 'boulder_4', 'boulder_5', 'wreck_1', 'wreck_2', 'trawler_1', 'cutter_1']

os.makedirs(OUT, exist_ok=True)
for key in KEYS:
    src = sorted(glob.glob(os.path.join(IMG, key + '.*')) + glob.glob(os.path.join(IMG, '*', key + '.*')))
    src = [p for p in src if os.sep + 'far' + os.sep not in p]
    im = Image.open(src[0]).convert('RGBA')
    w = min(BAKE_W, im.width); h = max(1, round(im.height * w / im.width))
    im = im.resize((w, h), Image.LANCZOS)
    canvas = Image.new('RGBA', (w + 2 * PAD, h + 2 * PAD), (0, 0, 0, 0))
    canvas.paste(im, (PAD, PAD))
    # Blur premultiplied, so transparent edges do not turn dark.
    r, g, b, a = [c.point(lambda v: v) for c in canvas.split()]
    pm = Image.merge('RGBA', [Image.composite(c, Image.new('L', c.size, 0), a) for c in (r, g, b)] + [a]).filter(ImageFilter.GaussianBlur(BLUR))
    px = pm.load()
    y0 = PAD + h * (1 - FADE)
    for y in range(pm.height):
        f = 1 if y <= y0 else max(0.0, 1 - (y - y0) / (h + PAD - y0))
        for x in range(pm.width):
            R, G, B, A = px[x, y]
            if A == 0: continue
            k = 255 / A
            px[x, y] = (min(255, round(R * k)), min(255, round(G * k)), min(255, round(B * k)), round(A * f))
    pm.save(os.path.join(OUT, key + '.webp'), quality=86, method=6)
    print(key, os.path.relpath(src[0], IMG), pm.size)
