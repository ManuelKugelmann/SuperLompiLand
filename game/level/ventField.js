// The vent field (pure, no Phaser; spec 5.0k, world map): the last wonder before the grand nest.
// At the trench's east end black smoker chimneys stand on the deep seabed, breathing dark mineral
// smoke; their mouths glow warm, and tube worms crowd round their feet. The warm water rises: over
// each chimney a gentle column lifts the fish, and coins hang in it, so the field is a staircase
// of warm lifts toward the nest. Nothing here can hurt: real smokers are hot, ours only glow.

import { BIOMES } from './biomes.js';

export const VENT_FIELD = {
    biome: 'trench',
    end: 5200,           // px before the trench's (and the world's) east end where the field ends ...
    width: 9500,         // ... and how long it is
    chimneys: 7,
    height: [520, 900],  // px a chimney stands over the seabed ...
    clear: -220,         // ... its mouth at most this far below the calm route (negative: above it; chimneys are
                         // pictures behind the fish, so the glowing mouths line the lane at eye height)
    width_px: [170, 250],    // px across at the foot
    lift: 4.5,           // px/step the warm column lifts (a downwelling pulls 11)
    halfWidth: 120,      // px either side of the mouth the column reaches
    reach: 700,          // px above the calm route where the lift fades out
    coins: 4,            // coins hanging in each column ...
    coinStep: 120,       // ... this far apart, the lowest one this far over the mouth
    plumeMs: 650,        // how often a mouth puffs smoke
    worms: [5, 9],       // tube worms round each foot
    seen: 900            // px from a chimney at which the field counts as seen (reef book)
};

let SPOT = null;

/** Where the field is: { x0, x1 }. */
export function ventSpot(cfg = VENT_FIELD) {
    if (cfg === VENT_FIELD && SPOT) return SPOT;
    const b = BIOMES.find(bi => bi.id === cfg.biome), x1 = b.from + b.width - cfg.end, spot = { x0: x1 - cfg.width, x1 };
    if (cfg === VENT_FIELD) SPOT = spot;
    return spot;
}

const hash = (i, k) => { const v = Math.sin(i * 91.7 + k * 271.3) * 43758.5453; return v - Math.floor(v); };

/** Chimney `i`: { x, height (wanted, px), width (px at the foot), phase, worms }. Spread evenly, a little uneven. */
export function chimneyAt(i, cfg = VENT_FIELD) {
    const s = ventSpot(cfg), step = (s.x1 - s.x0) / cfg.chimneys;
    return {
        x: s.x0 + (i + 0.25 + 0.5 * hash(i, 1)) * step,
        height: cfg.height[0] + (cfg.height[1] - cfg.height[0]) * hash(i, 2),
        width: cfg.width_px[0] + (cfg.width_px[1] - cfg.width_px[0]) * hash(i, 3),
        phase: hash(i, 4) * 6.283,
        worms: Math.round(cfg.worms[0] + (cfg.worms[1] - cfg.worms[0]) * hash(i, 5))
    };
}

/** How high a chimney on the seabed at `groundY` really stands: never into the calm lane over it (routeY). */
export function chimneyHeight(c, groundY, routeY, cfg = VENT_FIELD) {
    return Math.max(0, Math.min(c.height, groundY - (routeY + cfg.clear)));
}

/**
 * The warm lift at (x, y) over chimneys whose mouths are `mouths` ([{ x, y }]), into out (px/step,
 * y up is negative): strongest over the mouth's middle, fading at the column's sides, and above
 * the calm route by `reach`.
 */
export function ventLift(x, y, mouths, routeY, out = { x: 0, y: 0 }, cfg = VENT_FIELD) {
    out.x = 0; out.y = 0;
    for (const m of mouths) {
        const side = Math.abs(x - m.x);
        if (side > cfg.halfWidth || y > m.y || y < routeY - cfg.reach) continue;
        const across = 1 - side / cfg.halfWidth, top = Math.min(1, (y - (routeY - cfg.reach)) / 200);
        out.y = -cfg.lift * across * across * (3 - 2 * across) * top;
        return out;
    }
    return out;
}

/** Where the coins hang over a mouth: [{ x, y }], lowest first, all below the top of the lift. */
export function ventCoins(mouth, routeY, cfg = VENT_FIELD) {
    const out = [];
    for (let k = 0; k < cfg.coins; k++) {
        const y = mouth.y - cfg.coinStep * (k + 1);
        if (y < routeY - cfg.reach + 60) break;
        out.push({ x: mouth.x, y });
    }
    return out;
}
