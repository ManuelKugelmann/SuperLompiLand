// The whale shark's stretch (pure, no Phaser; spec 5.0i open sea, 5.0j world map): a gentle
// giant cruises slowly along the calm route in the ship graveyard's sea. This module only
// reserves where: a clear stretch of the route east of the storm. The animal, its layer and
// its slipstream are built around `whaleSharkSlot()`.

import { BIOMES } from './biomes.js';
import { WEATHER, stormSpan, downwellings } from './weather.js';
import { SET_PIECES, ghostShip } from './setPieces.js';
import { bloomFields } from './blooms.js';
import { rescueSpots } from '../rescues.js';
import { JOURNEY, chapters } from '../journey.js';

export const WHALE_SHARK = {
    biome: 'wreck',
    length: 6000,        // px of the calm route it cruises along
    keep: 900,           // px the stretch stays away from everything else on the route
    step: 500            // px by which the search for a clear stretch moves on
};

let SLOT = null;

/** Everything on the route in that sea that the stretch must not touch: [x0, x1] each. */
function taken() {
    const s = stormSpan(), ship = ghostShip().x, out = [[s.x0 - WEATHER.storm.ramp, s.x1 + WEATHER.storm.ramp], [ship - SET_PIECES.ship.clear, ship + SET_PIECES.ship.clear]];
    for (const d of downwellings()) out.push([d.down - WEATHER.down.ramp, d.up + WEATHER.down.ramp]);
    for (const b of bloomFields()) out.push([b.x0, b.x1]);
    for (const r of rescueSpots()) out.push([r.x, r.x]);
    for (const c of chapters()) {
        if (c.friend) out.push([c.x - JOURNEY.clear, c.x + JOURNEY.clear]);
        if (c.event) out.push([c.event.x - JOURNEY.eventClear, c.event.endX + JOURNEY.eventClear]);
    }
    return out;
}

/** The stretch: { x0, x1 }, the first clear one east of the storm (null if the sea had none, which the tests rule out). */
export function whaleSharkSlot(cfg = WHALE_SHARK) {
    if (cfg === WHALE_SHARK && SLOT) return SLOT;
    const b = BIOMES.find(bi => bi.id === cfg.biome), keep = taken(), end = b.from + b.width - cfg.length - 6000;
    let slot = null;
    for (let x0 = stormSpan().x1; x0 <= end && !slot; x0 += cfg.step) {
        if (!keep.some(([a, z]) => x0 + cfg.length + cfg.keep > a && x0 - cfg.keep < z)) slot = { x0, x1: x0 + cfg.length };
    }
    if (cfg === WHALE_SHARK) SLOT = slot;
    return slot;
}
