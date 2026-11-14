// The far view under the open sea (pure, no Phaser; spec 5.0c "open sea: wide, calm water with
// a far view"): out at sea there is no rock behind the play plane, so the eye needs something
// else to hold on to. Ahead, the next island's underwater socket rises out of the haze and
// shows where the journey goes; now and then something big passes far away.

import { BIOMES, biomeIndexAt, seaShare } from './biomes.js';

export const SEA_FAR = {
    socketFrom: 11000,    // px before an island at which its socket begins to show
    socketX: [0.92, 0.12],   // where its foot stands on the screen (share of the width): when it first shows, and at the island's edge
    socketAlpha: [0.35, 0.7],   // how solid it is: when it first shows, and at the island's edge
    firstPass: 4,         // s after reaching open sea before the first big shape passes: everyone sees one
    passEvery: [11, 19],  // s between two big shapes passing (about every 15 s, spec 5.0i)
    passTime: [22, 34],   // s one takes to cross the view
    passScale: [0.5, 1],  // how big (near) or small (far) it is
    kinds: ['manta', 'shark', 'school']
};

/** World x where the next island east of x begins, or null when only sea is left. */
export function nextIslandX(x) {
    for (let i = biomeIndexAt(x) + 1; i < BIOMES.length; i++) if (BIOMES[i].zone === 'island') return BIOMES[i].from;
    return null;
}

/**
 * The socket of the island ahead as seen from a camera whose middle is at world x `cam` on a
 * screen `width` wide: { x (screen), alpha } or null out of the open sea or with no island ahead.
 * It comes in from the right as a clear dark shoulder, and has grown across most of the view
 * and darker by the time the camera reaches the island's edge.
 */
export function socketView(cam, width, cfg = SEA_FAR, out = { x: 0, alpha: 0 }) {
    const sea = seaShare(cam), at = nextIslandX(cam);
    if (sea <= 0 || at === null) return null;
    const away = at - cam;
    if (away > cfg.socketFrom) return null;
    const near = Math.max(0, Math.min(1, 1 - away / cfg.socketFrom));
    out.x = width * (cfg.socketX[0] + (cfg.socketX[1] - cfg.socketX[0]) * near);
    out.alpha = (cfg.socketAlpha[0] + (cfg.socketAlpha[1] - cfg.socketAlpha[0]) * near) * sea;
    return out;
}

/** Small deterministic random source. */
function rnd(seed) {
    let a = seed >>> 0;
    return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
}

/**
 * The n-th big shape to pass: { kind, wait (s after the one before left), time (s to cross),
 * dir (1 east, -1 west), depth (0 top .. 1 bottom of the view), scale }. Same for every player.
 */
export function passing(n, cfg = SEA_FAR) {
    const r = rnd(n * 7919 + 13), between = ([a, b]) => a + r() * (b - a);
    return {
        kind: cfg.kinds[Math.floor(r() * cfg.kinds.length)], wait: n === 0 ? (r(), cfg.firstPass) : between(cfg.passEvery), time: between(cfg.passTime),
        dir: r() < 0.5 ? 1 : -1, depth: 0.25 + r() * 0.55, scale: between(cfg.passScale)
    };
}
