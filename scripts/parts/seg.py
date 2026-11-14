# Shared by the part tools (bake.py, recolour.py): polygon masks and segmentation of a painted
# picture into a part and the rest. Pure numpy/scipy.
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

SLIVER = 3               # px: body slivers thinner than about twice this inside a part's band go to the part
BAND = 14                # px either side of a part's polygon where segmentation decides (spec `band` overrides)

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

