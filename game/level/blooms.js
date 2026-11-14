// Jellyfish bloom fields in the open sea (pure, no Phaser; spec 5.0i): a cloud of moon jellies
// drifting across the calm route. They are harmless: the fish swims through and they are gently
// bumped aside. Fields come again and again along both open seas, never where a storm, a
// current, a friend or an event is.

import { BIOMES } from './biomes.js';
import { WEATHER, weatherZones } from './weather.js';
import { JOURNEY, chapters } from '../journey.js';
import { rescueSpots } from '../rescues.js';

export const BLOOM = {
    seas: ['blue', 'wreck'],
    first: 12000,        // px into each sea where its first field lies ...
    every: 35000,        // ... and again every so many px
    width: 2800,         // px a field is long
    top: 160, bottom: 1050,   // from just under the surface down to here (the calm route runs through it)
    keep: 1500,          // px a field stays away from storm, currents, friends, events and small rescues
    count: 44,           // jellies in a field
    small: 0.4,          // share of them that are small and further back
    drift: [70, 40],     // px each drifts to and fro, sideways and up and down
    bump: 170,           // px: a fish this close pushes a jelly ...
    shove: 110,          // ... up to this many px aside
    seen: 900            // px from a field's middle at which it counts as seen (reef book)
};

const hash = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };

let FIELDS = null;

/** Every bloom field, west to east: [{ id, x0, x1, top, bottom }]. */
export function bloomFields(cfg = BLOOM) {
    if (cfg === BLOOM && FIELDS) return FIELDS;
    const w = weatherZones(), keep = [w.storm, ...w.downs.map(([a, z]) => [a - WEATHER.down.ramp, z + WEATHER.down.ramp])], out = [];
    for (const c of chapters()) {
        keep.push([c.x, c.x]);
        if (c.event) keep.push([c.event.x - JOURNEY.eventClear, c.event.endX + JOURNEY.eventClear]);
    }
    for (const r of rescueSpots()) keep.push([r.x, r.x]);
    for (const id of cfg.seas) {
        const b = BIOMES.find(bi => bi.id === id);
        for (let x0 = b.from + cfg.first; x0 + cfg.width + cfg.first < b.from + b.width; x0 += cfg.every) {
            // Move on east until it stands clear.
            let at = x0;
            for (let tries = 0; tries < 8; tries++) {
                const hit = keep.find(([a, z]) => at + cfg.width + cfg.keep >= a && at - cfg.keep <= z);
                if (!hit) break;
                at = hit[1] + cfg.keep + 1;
            }
            if (at + cfg.width + cfg.first < b.from + b.width && (!out.length || at > out[out.length - 1].x1 + cfg.keep)) out.push({ id: `bloom${out.length}`, x0: at, x1: at + cfg.width, top: cfg.top, bottom: cfg.bottom });
        }
    }
    if (cfg === BLOOM) FIELDS = out;
    return out;
}

/** Where jelly `i` of a field is at time t (s), before any bump: writes { x, y, small } into `out`. */
export function jellyAt(field, i, t, out = {}, cfg = BLOOM) {
    const s = field.x0 * 0.001 + i, u = hash(s, 1), v = hash(s, 2), p = hash(s, 3) * 6.283;
    // Thicker toward the field's middle, thinning out at its ends.
    const along = 0.5 + (u - 0.5) * (0.55 + 0.45 * hash(s, 4));
    out.small = hash(s, 5) < cfg.small;
    out.x = field.x0 + along * (field.x1 - field.x0) + Math.sin(t * 0.13 + p) * cfg.drift[0];
    out.y = field.top + v * (field.bottom - field.top) + Math.sin(t * 0.37 + p * 1.7) * cfg.drift[1];
    return out;
}

/**
 * How far a jelly at (jx, jy) is pushed aside by a fish at (fx, fy): writes { x, y } (px) into
 * `out`. Nothing beyond `bump`; the closer, the further, straight away from the fish.
 */
export function bumpAside(jx, jy, fx, fy, out = { x: 0, y: 0 }, cfg = BLOOM) {
    const dx = jx - fx, dy = jy - fy, d = Math.hypot(dx, dy);
    out.x = 0; out.y = 0;
    if (d >= cfg.bump) return out;
    const k = (1 - d / cfg.bump) * cfg.shove / (d || 1);
    out.x = (d ? dx : 1) * k; out.y = dy * k;
    return out;
}
