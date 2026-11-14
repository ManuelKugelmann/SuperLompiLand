// Where things may happen in the open sea (pure, no Phaser): stretches already taken by the
// storm, the currents, friends, events and small rescues, and how to slide a new stretch east
// until it stands clear of them. Shared by blooms.js and baitballs.js.

import { WEATHER, weatherZones } from './weather.js';
import { JOURNEY, chapters } from '../journey.js';
import { rescueSpots } from '../rescues.js';

/** Taken stretches along x: [[x0, x1], ...]. */
export function busyStretches() {
    const w = weatherZones(), out = [w.storm, ...w.downs.map(([a, z]) => [a - WEATHER.down.ramp, z + WEATHER.down.ramp])];
    for (const c of chapters()) {
        if (c.friend) out.push([c.x, c.x]);
        if (c.event) out.push([c.event.x - JOURNEY.eventClear, c.event.endX + JOURNEY.eventClear]);
    }
    for (const r of rescueSpots()) out.push([r.x, r.x]);
    return out;
}

/** True if [x0, x0 + width] keeps `gap` px from every taken stretch. */
export const isClear = (x0, width, taken, gap) => !taken.some(([a, z]) => x0 + width + gap >= a && x0 - gap <= z);

/** The first x0 at or east of `x0` where [x0, x0 + width] stands clear (gives up after `tries` moves). */
export function slideClear(x0, width, taken, gap, tries = 8) {
    let at = x0;
    for (let k = 0; k < tries; k++) {
        const hit = taken.find(([a, z]) => at + width + gap >= a && at - gap <= z);
        if (!hit) return at;
        at = hit[1] + gap + 1;
    }
    return at;
}
