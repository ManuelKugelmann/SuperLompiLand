// The upside-down jellyfish garden (pure, no Phaser; spec 5.0n): on the mangrove's mud flat dozens
// of upside-down jellies (Cassiopea) lie on their backs and pulse. Each pulse pushes a little water
// up: swimming low over the garden, the fish is lifted in soft bumps, and coins hang over the
// thickest patch. A toy, never a hazard (real Cassiopea sting very mildly; ours only puff).

import { BIOMES } from './biomes.js';

export const JELLY_GARDEN = {
    biome: 'mangrove',
    at: 0.12,            // share of the biome's width where the garden starts (about a minute into the mangrove)
    width: 2600,         // px the garden is long
    count: 22,           // jellies lying in it
    patch: 0.55,         // where along the garden (0..1) the jellies lie thickest, and the coins hang
    size: [80, 125],     // px across a jelly (under one fish: a garden of small animals, not a wall)
    periodS: 1.7,        // s between two pulses of one jelly
    lift: 3.2,           // px/step a pulse lifts the fish at its strongest (a vent lifts 4.5)
    reach: 240,          // px above the mud the pulses are felt
    halfWidth: 110,      // px either side of a jelly its puff reaches
    coins: 3,            // coins over the thickest patch ...
    coinOver: 170,       // ... the lowest this far over the mud
    coinStep: 110,
    seen: 700            // px from the garden's middle at which it counts as seen (reef book)
};

let SPOT = null;

/** Where the garden is: { x0, x1 }. */
export function gardenSpot(cfg = JELLY_GARDEN) {
    if (cfg === JELLY_GARDEN && SPOT) return SPOT;
    const b = BIOMES.find(bi => bi.id === cfg.biome), x0 = b.from + b.width * cfg.at, spot = { x0, x1: x0 + cfg.width };
    if (cfg === JELLY_GARDEN) SPOT = spot;
    return spot;
}

const hash = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };

/** Jelly `i`: { x, size, phase }. Thickest round the patch, thinning toward both ends. */
export function jellyAt(i, cfg = JELLY_GARDEN) {
    const s = gardenSpot(cfg), u = (i + 0.5) / cfg.count;
    // Pull the even spread toward the patch: a gentle crowding, never two jellies on one spot.
    const pulled = u + (cfg.patch - u) * 0.45 * (1 - Math.abs(cfg.patch - u) * 2) + (hash(i, 1) - 0.5) * 0.5 / cfg.count;
    return {
        x: s.x0 + Math.min(1, Math.max(0, pulled)) * (s.x1 - s.x0),
        size: cfg.size[0] + (cfg.size[1] - cfg.size[0]) * hash(i, 2),
        phase: hash(i, 3)
    };
}

/** How far into its pulse a jelly is at time t (s): 1 at the squeeze, falling to 0, then resting. */
export function pulseAt(jelly, t, cfg = JELLY_GARDEN) {
    const k = ((t / cfg.periodS + jelly.phase) % 1 + 1) % 1;
    return k < 0.35 ? 1 - k / 0.35 : 0;
}

/**
 * The lift at (x, y) over the garden at time t, into out (px/step, up is negative). `groundY` = the
 * mud under x. Strongest right over a pulsing jelly and close to the mud, fading with height.
 */
export function gardenLift(x, y, groundY, t, jellies, out = { x: 0, y: 0 }, cfg = JELLY_GARDEN) {
    out.x = 0; out.y = 0;
    const above = groundY - y;
    if (above < 0 || above > cfg.reach) return out;
    const s = gardenSpot(cfg);
    if (x < s.x0 - cfg.halfWidth || x > s.x1 + cfg.halfWidth) return out;
    let best = 0;
    for (const j of jellies) {
        const side = Math.abs(x - j.x);
        if (side > cfg.halfWidth) continue;
        const across = 1 - side / cfg.halfWidth;
        best = Math.max(best, across * across * (3 - 2 * across) * pulseAt(j, t, cfg));
    }
    out.y = -cfg.lift * best * (1 - above / cfg.reach);
    return out;
}

/** The coins over the thickest patch: [{ x, y }], lowest first. */
export function gardenCoins(groundY, cfg = JELLY_GARDEN) {
    const s = gardenSpot(cfg), x = s.x0 + cfg.patch * (s.x1 - s.x0);
    return Array.from({ length: cfg.coins }, (_, k) => ({ x, y: groundY - cfg.coinOver - k * cfg.coinStep }));
}
