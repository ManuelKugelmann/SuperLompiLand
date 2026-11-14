// The second danger branch (pure, no Phaser; spec 5.2c): the docks under the harbour's pier.
// Up at the surface, far above the calm route: oily murk between the piles, loose ropes
// hanging from the deck, a tangle of net, and in a loop of rope a hermit crab stuck in a
// bottle cap. A special set off close by (or a nudge) frees it. Nothing here blocks the way:
// it is a place to go to, not through.

import { BIOMES } from './biomes.js';

export const DOCKS = {
    biome: 'harbour',
    chunk: 960,          // the pier stands in the middle of the chunk column at the biome's middle (LevelGenerator.pierAt)
    half: 620,           // px to either side of the pier's middle that count as "under the docks"
    top: 60, bottom: 470,   // from just under the surface down to here
    net: [-190, 250],    // the net tangle: px from the pier's middle, and its depth
    crab: [250, 340],    // the hermit crab in its bottle cap, hanging in a rope
    ropes: [-430, -60, 250, 470],   // loose ropes hanging from the deck (px from the middle); the third holds the crab
    freeRadius: 340,     // px: a special set off this close frees the crab ...
    nudge: 80,           // ... and so does swimming right up to it
    coins: 15
};

/** Where the docks are: { x (the pier's middle), x0, x1, top, bottom, net: {x, y}, crab: {x, y}, ropes: [x, ...] }. */
export function docksSpot(biomes = BIOMES, cfg = DOCKS) {
    const b = biomes.find(bi => bi.id === cfg.biome), cx = Math.floor((b.from + b.width / 2) / cfg.chunk), x = cx * cfg.chunk + cfg.chunk / 2;
    return {
        x, x0: x - cfg.half, x1: x + cfg.half, top: cfg.top, bottom: cfg.bottom,
        net: { x: x + cfg.net[0], y: cfg.net[1] }, crab: { x: x + cfg.crab[0], y: cfg.crab[1] }, ropes: cfg.ropes.map(dx => x + dx)
    };
}

/** How deep in the docks' murk a point is (0 outside .. 1 in the middle of it), for the look and the sound. */
export function docksShare(spot, x, y) {
    if (y < spot.top - 40 || y > spot.bottom + 160 || x < spot.x0 - 200 || x > spot.x1 + 200) return 0;
    const kx = Math.min(1, (x - (spot.x0 - 200)) / 200, (spot.x1 + 200 - x) / 200), ky = Math.min(1, (spot.bottom + 160 - y) / 160);
    return Math.max(0, Math.min(kx, ky));
}

/** Does a special set off at (x, y), or a fish at (x, y) with `nudge` true, free the crab? */
export function freesCrab(spot, x, y, nudge = false, cfg = DOCKS) {
    return Math.hypot(x - spot.crab.x, y - spot.crab.y) < (nudge ? cfg.nudge : cfg.freeRadius);
}
