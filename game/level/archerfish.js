// The archerfish (pure, no Phaser; spec 5.0n): late in the mangrove an archerfish waits just under
// the surface below an overhanging leaf with a fly on it. When Lompi comes near it spits a jet of
// water, the fly drops into the water with a little splash, and the archerfish snaps it up. Then a
// new fly lands, and it does it again. A small sight to laugh at, nothing to do and nothing to fear.

import { BIOMES } from './biomes.js';

export const ARCHER = {
    biome: 'mangrove',
    at: 0.8,            // share of the biome's width where it lives (between the root nursery and the reef)
    near: 1300,         // px from Lompi at which it starts its show
    cycleS: 6.5,        // s for one round: aim, spit, the fly falls, snap, a new fly lands
    under: 60,          // px under the surface the archerfish waits
    leaf: [240, 70],    // the fly sits this far ahead of the archerfish and this high over the surface (a low leaf: in the picture, under the HUD row)
    arc: 50,            // px the jet bows up above the straight line to the fly
    drops: 12           // droplets in the jet
};

/** Where it lives: x. */
export function archerX(cfg = ARCHER) {
    const b = BIOMES.find(bi => bi.id === cfg.biome);
    return b.from + b.width * cfg.at;
}

/** The round's beat at time u (s since the show started): which part, and how far into it (0..1). */
export function archerBeat(u, cfg = ARCHER) {
    const k = ((u / cfg.cycleS) % 1 + 1) % 1;
    const beats = [['aim', 0.18], ['spit', 0.12], ['fall', 0.14], ['snap', 0.1], ['wait', 0.26], ['land', 0.2]];
    let start = 0;
    for (const [name, len] of beats) {
        if (k < start + len) return { name, t: (k - start) / len };
        start += len;
    }
    return { name: 'land', t: 1 };
}

/** A point on the jet from the mouth to the fly, u in 0..1: a straight line bowed up by `arc`. */
export function jetPoint(from, to, u, cfg = ARCHER) {
    return { x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u - cfg.arc * 4 * u * (1 - u) };
}
