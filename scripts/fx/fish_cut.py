# A painted animal (generated on white) made into a game picture: the cutout's alpha laid over the
# original at full resolution, cropped to the animal with a small margin, scaled to a width, and
# mirrored when asked (so every side view faces right). Used for the barracuda (img/barracuda.webp),
# shoal species (img/school/<id>.webp) and the birds (gannet_*, gull_*, heron).
# usage: python -I scripts/fx/fish_cut.py <painted png> <cutout png> <width> <out webp> [flip]
import sys
from PIL import Image

SRC, CUT, WIDTH, OUT = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
FLIP = len(sys.argv) > 5 and sys.argv[5] == 'flip'
MARGIN = 0.02            # share of the width kept free around the fish (soft edges stay whole)

img = Image.open(SRC).convert('RGBA')
img.putalpha(Image.open(CUT).getchannel('A').resize(img.size, Image.LANCZOS))
x0, y0, x1, y1 = img.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
m = round((x1 - x0) * MARGIN)
img = img.crop((max(0, x0 - m), max(0, y0 - m), min(img.width, x1 + m), min(img.height, y1 + m)))
img = img.resize((WIDTH, round(img.height * WIDTH / img.width)), Image.LANCZOS)
if FLIP: img = img.transpose(Image.FLIP_LEFT_RIGHT)
img.save(OUT, quality=90, method=6)
print(OUT, img.size)
