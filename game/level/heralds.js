// Big animals are heard before they are seen (research 5.0x #14: "big animals announced by sound
// first"). Pure, no Phaser: where each one lives and what is heard, once, a little before its place:
// a soft musical swell, its two notes per animal (audio.js herald). Real recorded calls can replace it later.

import { whaleSharkSlot } from './whaleShark.js';
import { seaLionSpot } from './seaLion.js';
import { sealSpot } from './seal.js';
import { otterSpot } from './seaOtter.js';
import { meadowSpot } from './meadow.js';
import { DUGONG } from './DugongLayer.js';

export const HERALDS = {
    lead: 2400,      // px before the animal's place at which it is heard (its picture is built from ~2600 on)
    late: 900,       // ... and not any more once the fish is closer than this (it is in view by then)
    calls: {                      // the swell's two notes (Hz) per animal: big ones low, small ones higher
        whale_shark: [392, 587.33], dugong: [349.23, 523.25], sea_lion: [440, 659.25], seal: [440, 554.37], sea_otter: [523.25, 783.99]
    }
};

/** Every herald, west to east: { id, x (the animal's place), call }. */
export function heraldSpots(cfg = HERALDS) {
    const at = {
        whale_shark: whaleSharkSlot().x0,
        sea_lion: seaLionSpot().x0,
        seal: sealSpot().x0,
        sea_otter: otterSpot().x0,
        dugong: meadowSpot().x0 - DUGONG.before
    };
    return Object.entries(at).map(([id, x]) => ({ id, x, call: cfg.calls[id] })).sort((a, b) => a.x - b.x);
}

/** The herald to sound now for a fish at x, or null. `heard` = a Set of ids already sounded. */
export function heraldDue(x, heard, spots = heraldSpots(), cfg = HERALDS) {
    return spots.find(s => !heard.has(s.id) && x > s.x - cfg.lead && x < s.x - cfg.late) || null;
}
