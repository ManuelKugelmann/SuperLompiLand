// The far view under the open sea (pure, no Phaser; spec 5.0c "open sea: wide, calm water with
// a far view"): out at sea there is no rock behind the play plane, so the eye needs something
// else to hold on to. Ahead, the next island's underwater socket rises out of the haze and
// shows where the journey goes; now and then something big passes far away.

import { BIOMES, biomeIndexAt, seaShare } from './biomes.js';

export const SEA_FAR = {
    socketScroll: 0.22,   // the socket passes at this share of the camera's movement (far away)
    socketFrom: 11000,    // px before an island at which its socket begins to show ...
    socketFull: 3500,     // ... and from which it shows fully
    socketAlpha: 0.5,     // how solid it gets: it stays a shape in the haze
    passEvery: [16, 34],  // s between two big shapes passing
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
 * It shows faintly from far away, grows clearer, and reaches the middle of the screen as the
 * camera reaches the island's edge.
 */
export function socketView(cam, width, cfg = SEA_FAR, out = { x: 0, alpha: 0 }) {
    const sea = seaShare(cam), at = nextIslandX(cam);
    if (sea <= 0 || at === null) return null;
    const away = at - cam;
    if (away > cfg.socketFrom) return null;
    const near = Math.max(0, Math.min(1, (cfg.socketFrom - away) / (cfg.socketFrom - cfg.socketFull)));
    out.x = width / 2 + away * cfg.socketScroll;
    out.alpha = cfg.socketAlpha * near * sea;
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
        kind: cfg.kinds[Math.floor(r() * cfg.kinds.length)], wait: between(cfg.passEvery), time: between(cfg.passTime),
        dir: r() < 0.5 ? 1 : -1, depth: 0.25 + r() * 0.55, scale: between(cfg.passScale)
    };
}
