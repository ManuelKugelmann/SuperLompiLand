// The stingray (pure, no Phaser; spec 5.0o): in the lagoon a ray lies hidden under a thin layer of
// sand, only its eyes showing. When Lompi comes close it lifts off in a puff of sand and glides away
// low over the bottom, then settles again further on and shuffles itself under the sand. It keeps
// its distance: gentle, never a threat (its tail stays down).

import { BIOMES } from './biomes.js';

export const STINGRAY = {
    biome: 'beach',
    at: 0.387,          // share of the biome's width where it first lies
    wake: 330,          // px from Lompi at which it lifts off
    glide: 1500,        // px it glides before it settles again
    glideS: 4.5,        // s the glide takes
    lift: 70,           // px it rises over the sand at the glide's middle
    settleS: 1.2,       // s it takes to shuffle under the sand again
    rests: 3,           // after this many glides it stays put (the lagoon goes on without it)
    size: 330           // px across
};

/** Where it first lies: x. */
export function rayStart(cfg = STINGRAY) {
    const b = BIOMES.find(bi => bi.id === cfg.biome);
    return b.from + b.width * cfg.at;
}

const smooth = v => { const t = v <= 0 ? 0 : v >= 1 ? 1 : v; return t * t * (3 - 2 * t); };

/**
 * Where the ray is `s` seconds after it lifted off from `x0`: { x, lift (px over the sand), buried
 * (0 visible .. 1 under the sand), done (settled) }.
 */
export function rayGlide(x0, s, cfg = STINGRAY) {
    const u = Math.min(1, s / cfg.glideS);
    const x = x0 + cfg.glide * smooth(u);
    const lift = cfg.lift * Math.sin(Math.PI * u);
    const settle = Math.max(0, s - cfg.glideS) / cfg.settleS;
    return { x, lift, buried: Math.min(1, settle) * 0.8, done: settle >= 1 };
}
