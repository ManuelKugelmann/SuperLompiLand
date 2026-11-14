// The ocean front's place (pure, no Phaser; spec 5.0i, 5.0j world map): a seam where two water
// masses meet, with a foam line at the surface and life gathered along it. This module only
// reserves where: a clear stretch of the calm route in the mangroves. The seam, its look and
// its jet are built around `frontSlot()`.

import { BIOMES } from './biomes.js';
import { nestSpots, setPieceStretches, FIELD } from './density.js';
import { rescueSpots } from '../rescues.js';
import { JOURNEY, chapters } from '../journey.js';

export const FRONT = {
    biome: 'mangrove',
    from: 0.33,          // share of the biome's width from which a clear stretch is looked for
    length: 3000,        // px across the seam that belong to it
    keep: 1200,          // px it stays away from nests, rescues, friends and set pieces
    step: 250            // px by which the search moves on
};

let SLOT = null;

/** The stretch: { x (the seam, its middle), x0, x1 }: the first clear one from `from` on (null if there were none, which the tests rule out). */
export function frontSlot(cfg = FRONT) {
    if (cfg === FRONT && SLOT) return SLOT;
    const b = BIOMES.find(bi => bi.id === cfg.biome), keep = setPieceStretches();
    for (const x of nestSpots()) keep.push([x, x + FIELD.nestSearch * 120]);      // a nest may have moved east to find its seabed
    for (const r of rescueSpots()) keep.push([r.x, r.x]);
    for (const c of chapters()) {
        if (c.friend) keep.push([c.x - JOURNEY.clear, c.x + JOURNEY.clear]);
        if (c.event) keep.push([c.event.x - JOURNEY.eventClear, c.event.endX + JOURNEY.eventClear]);
    }
    let slot = null;
    for (let x0 = b.from + b.width * cfg.from; x0 + cfg.length < b.from + b.width - 6000 && !slot; x0 += cfg.step) {
        if (!keep.some(([a, z]) => x0 + cfg.length + cfg.keep > a && x0 - cfg.keep < z)) slot = { x: x0 + cfg.length / 2, x0, x1: x0 + cfg.length };
    }
    if (cfg === FRONT) SLOT = slot;
    return slot;
}
