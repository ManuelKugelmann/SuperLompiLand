// Life at the surface of the open sea (pure, no Phaser; spec 5.0i): floating sargassum rafts
// with young fish sheltering under them, and flying fish that break the surface in a burst
// when the player skips off a wave. Nothing here does anything to the player: it is there to
// be seen, far above the calm route's deep stretches and right beside its shallow ones.

import { BIOMES, isSea } from './biomes.js';
import { WEATHER, stormSpan } from './weather.js';
import { JOURNEY, chapters } from '../journey.js';

export const RAFTS = {
    seas: ['blue', 'wreck'],
    first: 6000,         // px into each sea where its first raft floats ...
    every: 22000,        // ... and again every so many px
    width: 760,          // px across as drawn
    keep: 2500,          // px they stay away from the storm and from big events
    seen: 700            // px: this close, sargassum goes into the reef book
};

export const FLYERS = {
    count: 5,            // fish in a burst
    ahead: [-150, 350],  // px ahead of the leap where they come out of the water (beside the fish: "they burst out next to me")
    speed: [11, 15],     // px per step forward
    lift: [5, 7],        // px per step upward at the start: arcs peak at ~60-110 px, low over the water, under the HUD
    gravity: 0.22,       // px per step per step: a long, flat glide
    again: 2.5           // s before a skim sets off the next burst
};

let SPOTS = null;

/** Where the rafts float, west to east: [{ id, x }]. */
export function raftSpots(cfg = RAFTS) {
    if (cfg === RAFTS && SPOTS) return SPOTS;
    const s = stormSpan(), keep = [[s.x0 - WEATHER.storm.ramp, s.x1 + WEATHER.storm.ramp]], out = [];
    for (const c of chapters()) if (c.event) keep.push([c.event.x - JOURNEY.eventClear, c.event.endX + JOURNEY.eventClear]);
    for (const id of cfg.seas) {
        const b = BIOMES.find(bi => bi.id === id);
        for (let x = b.from + cfg.first; x < b.from + b.width - cfg.first; x += cfg.every) {
            if (!keep.some(([a, z]) => x > a - cfg.keep && x < z + cfg.keep)) out.push({ id: `raft${out.length}`, x });
        }
    }
    if (cfg === RAFTS) SPOTS = out;
    return out;
}

const hash = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
const pick = (r, h) => r[0] + (r[1] - r[0]) * h;

/** Does a skim at world x set off flying fish? Only out at sea. */
export function flyersAt(x) {
    return isSea(x);
}

/**
 * Where fish `i` of a burst is `steps` (60 Hz steps) after a skim at (x, surfaceY) heading
 * `dir` (1 east, -1 west): writes { x, y, angle (radians, its flight path), done (back in the
 * water) } into `out`. Each leaves the water a little later and further ahead than the last.
 */
export function flyerAt(i, seed, x, surfaceY, dir, steps, out = {}, cfg = FLYERS) {
    const s = seed + i * 7.3, age = steps - i * 5;
    const vx = pick(cfg.speed, hash(s, 1)) * dir, vy0 = -pick(cfg.lift, hash(s, 2)), x0 = x + dir * pick(cfg.ahead, hash(s, 3));
    if (age < 0) { out.x = x0; out.y = surfaceY; out.angle = 0; out.done = false; out.out = false; return out; }
    const y = surfaceY + vy0 * age + 0.5 * cfg.gravity * age * age;
    out.x = x0 + vx * age; out.y = y; out.angle = Math.atan2(vy0 + cfg.gravity * age, Math.abs(vx)); out.out = true;
    out.done = age > 2 && y >= surfaceY;
    return out;
}
