// The lagoon's sandbar (pure, no Phaser; spec 5.2 biome 1 "wave-jump over a sandbar", 5.0j world
// map): half way along the lagoon a bar of pale sand lies just under the surface, its crown
// dry between two waves. The calm route passes underneath; the fun way is over the top: a trail
// of coins leads up to it and an arc of coins hangs in the air above it. The bar is a picture
// (nothing to bump into); jumping over its crown is what counts.

import { BIOMES } from './biomes.js';

export const SANDBAR = {
    biome: 'beach',
    at: 0.678,           // where in the biome its crown lies (share of the width): over the open sand flats, between two nests
    width: 1500,         // px the bar is long as drawn
    height: 300,         // px from its crown down to where it fades out in the water
    crown: 40,           // px its crown stands above the calm water
    over: 500,           // px to either side of the crown within which a jump counts as "over the bar"
    arc: 9,              // coins in the arc above it ...
    arcTop: 300,         // ... whose top is this far above the water
    trail: 5             // coins that lead up from the calm route to the bar's west end
};

let SPOT = null;

/** Where the bar is: { x (its crown), x0, x1 }. */
export function sandbarSpot(cfg = SANDBAR) {
    if (cfg === SANDBAR && SPOT) return SPOT;
    const b = BIOMES.find(bi => bi.id === cfg.biome), x = b.from + b.width * cfg.at, spot = { x, x0: x - cfg.width / 2, x1: x + cfg.width / 2 };
    if (cfg === SANDBAR) SPOT = spot;
    return spot;
}

/** The bar's coins, for a calm surface at y 0: a trail up from the calm route to its west end, then an arc in the air over its crown. */
export function sandbarCoins(routeY, cfg = SANDBAR) {
    const s = sandbarSpot(cfg), out = [];
    const from = { x: s.x0 - 900, y: routeY(s.x0 - 900) - 130 }, to = { x: s.x0 - 150, y: 140 };
    for (let i = 0; i < cfg.trail; i++) { const u = i / cfg.trail; out.push({ x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u }); }
    for (let i = 0; i < cfg.arc; i++) {
        const u = i / (cfg.arc - 1), x = s.x - cfg.over + u * cfg.over * 2;
        out.push({ x, y: 60 - Math.sin(Math.PI * u) * (cfg.arcTop + 60) });      // from just under the water, up over the crown, and down again
    }
    return out;
}

/** Did the fish cross the bar's crown in the air between two frames? `prev`, `cur` = { x, y }; y < 0 is above the calm water. */
export function jumpedOver(prev, cur, cfg = SANDBAR) {
    const s = sandbarSpot(cfg);
    if ((prev.x - s.x) * (cur.x - s.x) > 0 || prev.x === cur.x) return false;
    const y = prev.y + (cur.y - prev.y) * (s.x - prev.x) / (cur.x - prev.x);
    return y < -cfg.crown;
}
