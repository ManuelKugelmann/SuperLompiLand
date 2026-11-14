// The sea slug garden (pure, no Phaser; user references 2026-11-14, lookdev/nudibranchs.png): on the
// reef a stretch of rock where bright sea slugs creep, each a different kind, and a blue dragon
// (Glaucus) drifts by in the water above. A small "wow, look" beat: colourful, slow, kind.

import { BIOMES } from './biomes.js';

export const NUDI_GARDEN = {
    biome: 'reef',
    at: 0.55,           // share of the biome's width where the garden starts
    width: 2200,        // px the garden is long
    kinds: ['nudi_stripe', 'nudi_spotted', 'nudi_cerata', 'nudi_leafsheep', 'nudi_bunny'],
    crawlers: 9,        // slugs on the rock (the kinds in turn)
    size: [100, 150],   // px long
    creep: [6, 14],     // px/s a slug creeps (slow, they are slugs)
    range: 120,         // px a slug creeps to and fro round its spot
    swimmer: 'nudi_glaucus',
    swimSize: 130,      // px the blue dragon is long
    swimOver: 260,      // px over the rock it drifts
    swimS: 26,          // s for the blue dragon to drift once across the garden and back
    seen: 700
};

let SPOT = null;

/** Where the garden is: { x0, x1 }. */
export function nudiSpot(cfg = NUDI_GARDEN) {
    if (cfg === NUDI_GARDEN && SPOT) return SPOT;
    const b = BIOMES.find(bi => bi.id === cfg.biome), x0 = b.from + b.width * cfg.at, spot = { x0, x1: x0 + cfg.width };
    if (cfg === NUDI_GARDEN) SPOT = spot;
    return spot;
}

const hash = (i, k) => { const v = Math.sin(i * 73.1 + k * 197.3) * 43758.5453; return v - Math.floor(v); };

/** Slug `i`: { key, home (x), size, speed, phase }. Spread over the garden, kinds in turn. */
export function nudiAt(i, cfg = NUDI_GARDEN) {
    const s = nudiSpot(cfg), step = (s.x1 - s.x0) / cfg.crawlers;
    return {
        key: cfg.kinds[i % cfg.kinds.length],
        home: s.x0 + (i + 0.2 + 0.6 * hash(i, 1)) * step,
        size: cfg.size[0] + (cfg.size[1] - cfg.size[0]) * hash(i, 2),
        speed: cfg.creep[0] + (cfg.creep[1] - cfg.creep[0]) * hash(i, 3),
        phase: hash(i, 4) * 6.283
    };
}

/** Where a slug is at time t (s): { x, facing }; it creeps to and fro round its home. */
export function nudiPos(n, t, cfg = NUDI_GARDEN) {
    const period = 4 * cfg.range / n.speed, u = (t / period + n.phase / 6.283) % 1;
    const tri = u < 0.5 ? u * 4 - 1 : 3 - u * 4;           // -1 .. 1 .. -1, steady speed
    return { x: n.home + tri * cfg.range, facing: u < 0.5 ? 1 : -1 };
}

/** Where the blue dragon is at time t: { x, dy (px, a slow bob), facing }. */
export function dragonPos(t, cfg = NUDI_GARDEN) {
    const s = nudiSpot(cfg), u = (t / cfg.swimS) % 1, tri = u < 0.5 ? u * 2 : 2 - u * 2;
    return { x: s.x0 + tri * (s.x1 - s.x0), dy: Math.sin(t * 0.9) * 18, facing: u < 0.5 ? 1 : -1 };
}
