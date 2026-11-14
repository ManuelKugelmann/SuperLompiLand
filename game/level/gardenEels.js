// Garden eels (pure, no Phaser; spec 5.0o): on the sand where the rocky shore begins a colony of
// thin eels stands up out of their holes, swaying in the current and picking plankton. When Lompi
// comes close they pull back into the sand, one after another, and rise again behind him: a wave
// the child makes by swimming over. Shy, harmless, a toy.

import { BIOMES } from './biomes.js';

export const GARDEN_EELS = {
    biome: 'shore',
    at: 0.135,          // share of the biome's width where the colony starts
    width: 1900,        // px the colony is long
    count: 26,
    height: [150, 220], // px an eel stands out of its hole
    shy: 240,           // px (sideways) at which an eel pulls back ...
    above: 520,         // ... while the fish is no higher than this over the sand
    hide: 7,            // share of the way per s an eel dives in (fast)
    rise: 0.9,          // ... and comes back out (slow)
    calm: 1.1,          // s an eel waits after the fish has gone before it rises
    seen: 700           // px from the colony's middle at which it counts as seen (reef book)
};

let SPOT = null;

/** Where the colony is: { x0, x1 }. */
export function eelSpot(cfg = GARDEN_EELS) {
    if (cfg === GARDEN_EELS && SPOT) return SPOT;
    const b = BIOMES.find(bi => bi.id === cfg.biome), x0 = b.from + b.width * cfg.at, spot = { x0, x1: x0 + cfg.width };
    if (cfg === GARDEN_EELS) SPOT = spot;
    return spot;
}

const hash = (i, k) => { const v = Math.sin(i * 157.3 + k * 289.1) * 43758.5453; return v - Math.floor(v); };

/** Eel `i`: { x, height, phase, out (1 = fully up), wait (s left before it may rise) }. */
export function eelAt(i, cfg = GARDEN_EELS) {
    const s = eelSpot(cfg), step = (s.x1 - s.x0) / cfg.count;
    return {
        x: s.x0 + (i + 0.2 + 0.6 * hash(i, 1)) * step,
        height: cfg.height[0] + (cfg.height[1] - cfg.height[0]) * hash(i, 2),
        phase: hash(i, 3) * 6.283,
        out: 1, wait: 0
    };
}

/** Is an eel at `x` on sand at `groundY` frightened by a fish at (fx, fy)? */
export const scared = (x, groundY, fx, fy, cfg = GARDEN_EELS) => Math.abs(fx - x) < cfg.shy && fy > groundY - cfg.above && fy < groundY + 50;

/** One step of an eel (dt s): dives in fast while frightened, waits a moment, rises slowly. Changes eel. */
export function stepEel(eel, frightened, dt, cfg = GARDEN_EELS) {
    if (frightened) { eel.wait = cfg.calm; eel.out = Math.max(0, eel.out - cfg.hide * dt); return eel; }
    if (eel.wait > 0) { eel.wait = Math.max(0, eel.wait - dt); return eel; }
    eel.out = Math.min(1, eel.out + cfg.rise * dt);
    return eel;
}
