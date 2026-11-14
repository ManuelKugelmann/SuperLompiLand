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

/**
 * The front itself (open-sea idea #5): tannin-dark mangrove water on the west meets clearer
 * water on the east along the seam. Where they meet the surface water converges: a foam line
 * with weed caught in it, and a jet that carries the fish east across the seam just under the
 * surface. FrontLayer.js draws it; `jetAt` is the push for MainScene.waterAt.
 */
export const FRONT_LOOK = {
    haze: 1100,          // px the dark water reaches west of the seam (fading out)
    edge: 140,           // px the seam itself is wide (the sharp part of the change)
    jet: {
        top: 40,         // px under the surface where the jet starts ...
        bottom: 620,     // ... and how deep it reaches (fading)
        half: 1100,      // px either side of the seam it runs
        push: 8          // px per 60 Hz step at its heart (a current to ride: the chain counts from 6)
    }
};

const smooth = v => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));

/** The jet's push at (x, y), `surface` = the water surface's y there: writes px per 60 Hz step east into add.{x, y}. */
export function jetAt(x, y, surface, add, cfg = FRONT_LOOK) {
    const J = cfg.jet, s = frontSlot(), d = Math.abs(x - s.x), under = y - surface;
    const k = smooth(1 - d / J.half) * smooth((under - J.top) / 80) * smooth((J.bottom - under) / 200);
    add.x = J.push * k;
    add.y = 0;
    return add;
}
