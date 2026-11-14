// Danger branches (pure, no Phaser; spec 5.2c "Danger is optional"): side ways off the calm
// route that a player enters knowingly. The first one is a side cave on the kelp island: a ridge
// of rock lies under the route, a tunnel runs through it from a mouth to an exit further east,
// a current inside carries you along (so it is the faster way), a tangle of net hangs in it,
// and a giant clam with a pearl waits near the far end. The calm route above is untouched.

import { BIOMES } from './biomes.js';

export const BRANCH = {
    biome: 'kelp', at: 0.45,   // which island, and where along it the mouth lies
    length: 1800,       // px from the mouth to the exit
    under: 330,         // px the ridge's top lies under the calm route (below the lane)
    deep: 660,          // px the tunnel's middle lies under the route
    half: 150,          // half height of the tunnel: narrow-ish, room for a fish that is not puffed up
    mouth: 190,         // half width of the mouth and of the exit, where the tunnel opens upward
    ends: 420,          // px beyond mouth and exit over which the ridge falls away
    slope: 1.7,         // ... this steeply
    lump: 55,           // px the ridge's top rises and falls (noise added in density.js)
    chamber: [460, 250],   // the clam's chamber near the exit: its length and half height
    net: 0.42,          // where the net tangle hangs, as a share of the tunnel's length
    netUp: 95,          // ... this far above the tunnel's middle, so there is a way under it even when it bobs down
    current: 17,        // px/step the water runs east inside the tunnel (about a stream's speed: it is the faster way)
    coins: 25           // what the pearl is worth
};

/**
 * The side cave for a world whose calm route is `routeY(x)`: where everything is.
 * { x0 (mouth), x1 (exit), ry (route depth there), top (ridge top), y (tunnel middle),
 *   net: { x, y }, clam: { x, y } }
 */
export function sideCave(routeY, cfg = BRANCH) {
    const b = BIOMES.find(bi => bi.id === cfg.biome), x0 = b.from + b.width * cfg.at, x1 = x0 + cfg.length, ry = routeY(x0);
    const y = ry + cfg.deep, [cl, ch] = cfg.chamber;
    return {
        x0, x1, ry, top: ry + cfg.under, y,
        net: { x: x0 + cfg.length * cfg.net, y: y - cfg.netUp },
        clam: { x: x1 - cfg.mouth - cl * 0.55, y: y + ch - 40 }       // on the chamber's floor
    };
}

/** Depth of the ridge's upper face at x (before its lumps); Infinity away from the cave. */
export function ridgeTop(cave, x, cfg = BRANCH) {
    const out = Math.max(0, cave.x0 - cfg.mouth - x, x - cave.x1 - cfg.mouth);
    if (out > cfg.ends * 4) return Infinity;
    return cave.top + (out > 0 ? out * cfg.slope : 0);
}

/** Half height of the open tunnel at x (0 outside it): wider in the clam's chamber. */
export function tunnelHalf(cave, x, cfg = BRANCH) {
    if (x < cave.x0 - cfg.mouth || x > cave.x1 + cfg.mouth) return 0;
    const [cl, ch] = cfg.chamber, c = cave.x1 - cfg.mouth - cl / 2, k = Math.max(0, 1 - Math.abs(x - c) / (cl / 2));
    return cfg.half + (ch - cfg.half) * Math.min(1, k * 2);
}

/**
 * What the cave makes of the point (x, y), given the lumpy ridge top there: 1 = rock of the
 * ridge, -1 = open water of the tunnel, mouth or exit, 0 = none of its business.
 */
export function caveAt(cave, x, y, top, cfg = BRANCH) {
    if (y < top - 4) return 0;
    const half = tunnelHalf(cave, x, cfg);
    if (half > 0) {
        if (Math.abs(y - cave.y) < half) return -1;
        // Mouth and exit: the tunnel opens upward through the ridge's top.
        if ((Math.abs(x - cave.x0) < cfg.mouth || Math.abs(x - cave.x1) < cfg.mouth) && y < cave.y) return -1;
    }
    return 1;
}

/** The current inside the tunnel: water running east (px per step), fading at its walls and ends. */
export function caveFlow(cave, x, y, out = { x: 0, y: 0 }, cfg = BRANCH) {
    out.x = 0; out.y = 0;
    const half = tunnelHalf(cave, x, cfg);
    if (half <= 0 || Math.abs(y - cave.y) >= half) return out;
    const ends = Math.min(1, (x - cave.x0) / 300, (cave.x1 - x) / 300);
    if (ends <= 0) return out;
    out.x = cfg.current * ends * (1 - Math.abs(y - cave.y) / half);
    return out;
}
