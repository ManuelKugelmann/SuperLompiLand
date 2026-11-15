// Which chunks of a rock layer behind the play plane are wanted (pure, no Phaser): the ones on screen
// and a margin round it, plus a look-ahead toward where the view is going (user: "world gen not as fast
// as fish, look ahead, no popping"). The window never holds more chunks than the layer's atlas
// (review: on a 20:9 phone the old window of the screen, a ring and the lead wanted up to 56 of 25 places,
// so the lead chunks never showed): the look-ahead shrinks first on the slower axis.

export const LAYER_LEAD = {
    leadS: 2.5,       // s: chunks are asked for as far ahead as the view covers in this long
    leadMax: 2,       // ... at most this many chunks further
    margin: 0.6,     // share of a chunk round the screen that is wanted too (a slow start does not wait for the lead)
    ease: 0.15        // share of the way to the view's new speed per 60th of a second
};

/**
 * [x0, x1, y0, y1] (chunk columns and rows, inclusive) wanted for a layer view whose top left is at
 * lx, ly (layer px), W x H px on screen, moving vx, vy layer px per s; `chunk` px per chunk, `most`
 * chunks the atlas holds. Rows start at 0 (the layers end at the surface).
 */
export function layerWindow(lx, ly, W, H, vx, vy, chunk, most, cfg = LAYER_LEAD) {
    const m = cfg.margin * chunk;
    let x0 = Math.floor((lx - m) / chunk), x1 = Math.floor((lx + W + m) / chunk);
    let y0 = Math.max(0, Math.floor((ly - m) / chunk)), y1 = Math.floor((ly + H + m) / chunk);
    const lead = v => Math.min(cfg.leadMax, Math.ceil(Math.abs(v) * cfg.leadS / chunk));
    let ax = lead(vx), ay = lead(vy);
    const cols = x1 - x0 + 1, rows = y1 - y0 + 1;
    while ((cols + ax) * (rows + ay) > most && ax + ay > 0) {
        if (ay > 0 && (ax === 0 || Math.abs(vy) <= Math.abs(vx))) ay--; else ax--;
    }
    if (vx < 0) x0 -= ax; else x1 += ax;
    if (vy < 0) y0 = Math.max(0, y0 - ay); else y1 += ay;
    return [x0, x1, y0, y1];
}
