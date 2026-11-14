# Control-scheme icons for the control switcher (public/img/ui/ctrl_<id>.webp, 128x128, one per
# scheme in game/controls/index.js): tap (a finger tapping, with rings), flap (a wing beating up),
# tilt (a phone tipped, with a curved arrow), stick (a thumbstick in its ring). One style: white
# shapes with a soft dark outline and shadow, readable at 48 px on bright and dark water alike.
# Procedural and deterministic.
# usage: python -I scripts/fx/control_icons.py <repo root>
import sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = sys.argv[1]
OUT = os.path.join(ROOT, 'public', 'img', 'ui')
os.makedirs(OUT, exist_ok=True)
S, SS = 128, 4                     # icon size, supersampling
Z = S * SS
W8 = 9 * SS                        # stroke width of lines

def canvas():
    m = Image.new('L', (Z, Z), 0)
    return m, ImageDraw.Draw(m)

def p(*v):
    return [c * SS for c in v]

def tap():
    m, d = canvas()
    # rings where the finger touches
    for r, w in ((30, 6), (44, 5)):
        d.arc(p(64 - r, 34 - r * 0.45, 64 + r, 34 + r * 0.45), 200, 340, fill=255, width=w * SS)
    # the finger: a rounded bar pointing up, a hand below
    d.rounded_rectangle(p(54, 28, 74, 92), radius=10 * SS, fill=255)
    d.rounded_rectangle(p(44, 74, 96, 120), radius=18 * SS, fill=255)
    d.rounded_rectangle(p(34, 82, 54, 104), radius=10 * SS, fill=255)    # thumb
    return m

def flap():
    m, d = canvas()
    # a wing beating up: three tapered feathers fanned out from its root (with gaps between
    # them), and two motion arcs above their tips
    rx, ry = 30, 100
    for ang, length, width in ((-80, 86, 11), (-55, 82, 11), (-30, 72, 10)):
        a = np.radians(ang); ax, ay = np.cos(a), np.sin(a); nx, ny = -ay, ax
        side = lambda sgn: [(rx + ax * length * t + nx * sgn * width * np.sin(np.pi * t) ** 0.6,
                             ry + ay * length * t + ny * sgn * width * np.sin(np.pi * t) ** 0.6) for t in np.linspace(0, 1, 24)]
        d.polygon([(x * SS, y * SS) for x, y in side(1) + side(-1)[::-1]], fill=255)
    d.ellipse(p(rx - 14, ry - 14, rx + 14, ry + 14), fill=255)          # the wing's root
    for r in (84, 95):
        d.arc(p(rx - r, ry - r, rx + r, ry + r), 290, 318, fill=255, width=6 * SS)
    return m

def tilt():
    m, d = canvas()
    # a phone tipped to one side, and an arrow round it
    phone = Image.new('L', (Z, Z), 0); pd = ImageDraw.Draw(phone)
    pd.rounded_rectangle(p(44, 22, 84, 106), radius=10 * SS, fill=255)
    pd.rounded_rectangle(p(50, 32, 78, 92), radius=4 * SS, fill=0)       # its screen
    phone = phone.rotate(-24, resample=Image.BICUBIC, center=(Z / 2, Z / 2))
    m.paste(255, (0, 0), phone)
    d.arc(p(14, 14, 114, 114), 200, 250, fill=255, width=W8)             # curved arrow
    d.polygon(p(12, 52, 30, 44, 22, 66), fill=255)
    d.arc(p(14, 14, 114, 114), 20, 70, fill=255, width=W8)
    d.polygon(p(116, 76, 98, 84, 106, 62), fill=255)
    return m

def stick():
    m, d = canvas()
    # a thumbstick: an outer ring, and the knob pushed a little up and right
    d.ellipse(p(14, 14, 114, 114), outline=255, width=W8)
    d.ellipse(p(48, 34, 92, 78), fill=255)
    for a in (0, 90, 180, 270):                                          # four small direction ticks
        r = np.radians(a)
        cx, cy = 64 + np.cos(r) * 38, 64 + np.sin(r) * 38
        if a == 270 or a == 0: continue                                  # the knob covers those
        d.ellipse(p(cx - 4, cy - 4, cx + 4, cy + 4), fill=255)
    return m

def style(mask):
    """White shape, soft dark outline (reads on bright water), soft shadow (reads on anything)."""
    a = np.asarray(mask.resize((S, S), Image.LANCZOS)).astype(np.float32) / 255
    big = np.asarray(mask.filter(ImageFilter.MaxFilter(4 * SS + 1)).filter(ImageFilter.GaussianBlur(2 * SS)).resize((S, S), Image.LANCZOS)).astype(np.float32) / 255
    sh = np.asarray(mask.filter(ImageFilter.GaussianBlur(5 * SS)).resize((S, S), Image.LANCZOS)).astype(np.float32) / 255
    shadow = np.zeros_like(sh); shadow[4:, 3:] = sh[:-4, :-3]
    rgb = np.zeros((S, S, 3), np.float32); alpha = np.zeros((S, S), np.float32)
    def over(c, al):
        nonlocal rgb, alpha
        rgb = rgb * (1 - al[..., None]) + np.array(c, np.float32) * al[..., None]
        alpha = al + alpha * (1 - al)
    over((8, 30, 48), shadow * 0.45)
    over((20, 52, 74), np.clip(big - a, 0, 1) * 0.85)
    over((255, 255, 255), a)
    rgb = rgb / np.maximum(alpha, 1e-4)[..., None]
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255), np.clip(alpha * 255, 0, 255)]).astype(np.uint8), 'RGBA')

for name, draw in (('tap', tap), ('flap', flap), ('tilt', tilt), ('stick', stick)):
    style(draw()).save(os.path.join(OUT, f'ctrl_{name}.webp'), quality=92, method=6)
print('ok')
