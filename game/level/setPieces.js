// The set pieces of the long sea stretches (pure, no Phaser; spec 5.0e): every chapter has one
// iconic thing on its route. In the wreck sea a ghost ship stands on a pinnacle of rock that
// rises from the deep floor, right under the storm, and the calm route goes through its hull.
// In the trench the route leaves the surface at the trench's start and goes all the way down
// to the grand nest, which shines up from the bottom.

import { BIOMES } from './biomes.js';
import { WEATHER, stormSpan } from './weather.js';

export const SET_PIECES = {
    ship: {
        length: 1500,        // px bow to stern
        keelUnder: 460,      // px its keel lies under the calm route (the route passes through the hull)
        pinnacleHalf: 300,   // px to either side of its middle that the pinnacle's top is flat-ish
        pinnacleSlope: 2.1,  // px the pinnacle falls per px beyond that: a steep spire
        lump: 70,            // px its top and flanks rise and fall
        clear: 1400          // px to either side of the ship that stay free of hazards
    },
    descent: {
        lead: 700,           // px into the trench before the route starts down
        beacon: [1500, 4600] // px width and height of the light that rises from the grand nest
    }
};

let SHIP = null;

/** Where the ghost ship stands: { x, y (of the calm route through it), keelY }. */
export function ghostShip(cfg = SET_PIECES.ship) {
    if (cfg === SET_PIECES.ship && SHIP) return SHIP;
    const { x0, x1 } = stormSpan(), ship = { x: (x0 + x1) / 2, y: WEATHER.storm.routeY, keelY: WEATHER.storm.routeY + cfg.keelUnder };
    if (cfg === SET_PIECES.ship) SHIP = ship;
    return ship;
}

/**
 * Depth of the pinnacle's upper face at x (before its lumps): just under the ship's keel in
 * the middle, falling away steeply to both sides; Infinity far from it.
 */
export function pinnacleTop(x, cfg = SET_PIECES.ship) {
    const s = ghostShip(cfg), out = Math.max(0, Math.abs(x - s.x) - cfg.pinnacleHalf);
    if (out > 2600) return Infinity;
    return s.keelY + out * cfg.pinnacleSlope;
}

/** World x at which the calm route starts down toward the grand nest. */
export function descentStart(cfg = SET_PIECES.descent) {
    return BIOMES[BIOMES.length - 1].from + cfg.lead;
}
