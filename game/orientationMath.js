// Pure pointer mapping for the rotated (portrait-shown-as-landscape) canvas.
// Unit-tested in tests/orientation.test.mjs.

/**
 * A canvas of logical size gameW x gameH is drawn rotated 90° clockwise about its
 * centre. `rect` is its axis-aligned bounding box on the page (so rect.height is
 * the canvas's un-rotated width). Maps a page point to game coordinates.
 */
export function rotatedPageToGame(pageX, pageY, rect, gameW, gameH) {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const scale = rect.height / gameW;
    return {
        x: (pageY - cy) / scale + gameW / 2,
        y: -(pageX - cx) / scale + gameH / 2
    };
}

/** The picture's short measures: normally 1080 tall; screens squarer than 4:3 keep the least width and grow taller. */
export const PICTURE = { height: 1080, minWidth: 1440 };

const even = v => Math.round(v / 2) * 2;      // even numbers centre cleanly

/**
 * Logical game size for a screen of this shape (as seen in landscape): the picture always has
 * exactly the screen's shape, so it fills it with no bars. Wide screens see more of the world
 * to the sides; screens squarer than 4:3 (and upright desktop windows) see more above and below.
 */
export function sizeFor(screenW, screenH, cfg = PICTURE) {
    if (!(screenW > 0 && screenH > 0)) return { width: 1920, height: cfg.height };
    const width = even(cfg.height * screenW / screenH);
    if (width >= cfg.minWidth) return { width, height: cfg.height };
    return { width: cfg.minWidth, height: even(cfg.minWidth * screenH / screenW) };
}

/**
 * The screen's safe-area insets (notch, rounded corners; CSS px, page edges) as insets of the
 * game picture, scaled by `k` (game px per CSS px). Rotated 90° clockwise the picture's left
 * edge lies along the page's top, its top along the page's right.
 */
export function gameInsets(page, rotated, k = 1) {
    const { top = 0, right = 0, bottom = 0, left = 0 } = page;
    return rotated
        ? { left: top * k, top: right * k, right: bottom * k, bottom: left * k }
        : { left: left * k, top: top * k, right: right * k, bottom: bottom * k };
}

/**
 * How a heads-up display drawn for a `w` x `h` picture fits inside the insets: the viewport to
 * give its camera, the zoom and the scroll that keep the whole layout visible and centred there.
 */
export function safeView(w, h, inset) {
    const vw = w - inset.left - inset.right, vh = h - inset.top - inset.bottom;
    return { x: inset.left, y: inset.top, width: vw, height: vh, zoom: Math.min(vw / w, vh / h), scrollX: (w - vw) / 2, scrollY: (h - vh) / 2 };
}

/** How far apart two shapes are: 0 = the same width to height ratio, 0.1 = one is 10 % wider than the other. */
export function shapeOff(w1, h1, w2, h2) {
    const a = w1 / h1, b = w2 / h2;
    return Math.max(a, b) / Math.min(a, b) - 1;
}
