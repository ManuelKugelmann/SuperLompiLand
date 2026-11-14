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

/** The game picture is always this tall; its width follows the screen so there are no bars. */
export const PICTURE = { height: 1080, minWidth: 1440, maxWidth: 2640 };

/**
 * Logical game width for a screen of this shape (as seen in landscape). Between
 * 4:3 and about 22:9 the picture fills the screen exactly; beyond that it is
 * capped and the rest is letterboxed.
 */
export function widthFor(screenW, screenH, cfg = PICTURE) {
    if (!(screenW > 0 && screenH > 0)) return 1920;
    const w = Math.round(cfg.height * screenW / screenH / 2) * 2;      // even numbers centre cleanly
    return Math.min(cfg.maxWidth, Math.max(cfg.minWidth, w));
}
