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
