// The set pieces of the long sea stretches (pure, no Phaser; spec 5.0e): every chapter has one
// iconic thing on its route. In the wreck sea a ghost ship stands on a pinnacle of rock that
// rises from the deep floor, right under the storm, and the calm route goes through its hull.
// In the trench the route leaves the surface at the trench's start and goes all the way down
// to the grand nest, which shines up from the bottom.

import { BIOMES } from './biomes.js';
import { WEATHER, stormSpan } from './weather.js';

export const SET_PIECES = {
    ship: {
        hull: 480,           // px height of its hull: it spans the calm route's lane
        keelUnder: 215,      // px its keel lies under the calm route: the route passes through the hole in its hull, just above the keel
        pinnacleHalf: 860,   // px to either side of its middle that the pinnacle carries the ship: the keel's whole length lies on rock
        bed: 50,             // px above the keel line at which the rock begins to close (it is solid at the keel line)
        pinnacleSlope: 2.1,  // px the pinnacle falls per px beyond that, on average: a steep spire ...
        ledge: [520, 320],   // ... broken by ledges: every so many px outward a cliff of about this height, gentler slopes between
        lump: 120,           // px its top and flanks rise and fall on a broad scale (the noise is added in density.js) ...
        knobs: 40,           // ... and this much in small bumps
        clear: 1400,         // px to either side of the ship that stay free of hazards
        deckCoins: 8,        // coins in a row along its deck, through the hull ...
        coinStep: 150,       // ... this far apart
        second: [1550, 800]  // a smaller wreck lies on the pinnacle's east slope: px east of the ship's middle, and its length
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
 * Depth of the pinnacle's upper face at x (before its lumps): a level bed under the ship's keel,
 * then falling away steeply in cliffs and ledges to both sides; Infinity far from it.
 */
export function pinnacleTop(x, cfg = SET_PIECES.ship) {
    const s = ghostShip(cfg), dx = Math.abs(x - s.x), out = Math.max(0, dx - cfg.pinnacleHalf);
    if (out > 2600) return Infinity;
    // Its flanks: steep on average, in steps (a ledge, then a steeper face), and steeper on the east side.
    const [every, step] = cfg.ledge, k = out / every, ledges = step * (Math.floor(k) + Math.min(1, (k - Math.floor(k)) * 3));
    const side = x > s.x ? 1.25 : 0.85;
    // Under the keel the bed is level (the lane above it must stay open down to the keel); the shape is in the flanks.
    return s.keelY - cfg.bed + out * (cfg.pinnacleSlope - step / every) * side + ledges;
}

/** World x at which the calm route starts down toward the grand nest. */
export function descentStart(cfg = SET_PIECES.descent) {
    return BIOMES[BIOMES.length - 1].from + cfg.lead;
}
