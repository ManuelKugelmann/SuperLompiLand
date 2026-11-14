// The bait ball's place (pure, no Phaser; spec 5.0i open sea, 5.0j world map): near the end of
// the open blue the calm route passes through a great ball of small fish. This module only
// reserves the slot: where it is and how big; the ball itself (its fish, its hunters) is built
// by whoever draws it, around `baitballSlot()`.

import { BIOMES } from './biomes.js';

export const BAITBALL = {
    biome: 'blue',
    at: 0.92,          // where in the biome its centre lies (share of the width): the quiet stretch before the kelp island
    radius: 900        // px: the ball and everything that belongs to it stays inside this circle
};

let SLOT = null;

/**
 * The slot: { x (centre), x0, x1, radius }. Its depth is the calm route's there: the centre is
 * (x, routeY(x)), so the route passes through the ball's middle.
 */
export function baitballSlot(cfg = BAITBALL) {
    if (cfg === BAITBALL && SLOT) return SLOT;
    const b = BIOMES.find(bi => bi.id === cfg.biome), x = b.from + b.width * cfg.at;
    const slot = { x, x0: x - cfg.radius, x1: x + cfg.radius, radius: cfg.radius };
    if (cfg === BAITBALL) SLOT = slot;
    return slot;
}

/** Is world point (x, y) inside the slot, given the route's depth at its centre? */
export function inBaitball(x, y, routeY, cfg = BAITBALL) {
    const s = baitballSlot(cfg);
    return Math.hypot(x - s.x, y - routeY(s.x)) < s.radius;
}
