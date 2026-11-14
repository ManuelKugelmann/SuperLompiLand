// The small things on the ground (pure, no Phaser; spec 5.5c "Micro" layer): pebbles, shells,
// mussel beds and tufts of algae that cover the seabed the way a real one is covered. Which
// of them lies where is decided here; MicroArt.js paints them, LevelGenerator places them.

export const MICRO = {
    rate: 0.66,        // chance that a piece of floor gets something
    max: 9,            // at most this many per chunk (object budget: chunks are loaded well beyond the view)
    width: [140, 260], // px across of one patch (sized for the painted patches)
    variants: 3        // pictures per kind
};

/** Kinds of patch. */
export const MICRO_KINDS = ['pebbles', 'shells', 'mussels', 'tufts', 'rubble'];

// Per biome: weights of the kinds. Shells and pebbles on sand, mussels on the mangroves' mud
// and the harbour's piles, coral rubble on the reef, algae tufts on cold rock; in the dark
// of the deep only stones.
const BY_BIOME = {
    beach: { shells: 4, pebbles: 3, tufts: 1 },
    mangrove: { mussels: 4, pebbles: 1, tufts: 2 },
    reef: { rubble: 4, shells: 2, tufts: 1 },
    blue: { pebbles: 1 },
    kelp: { tufts: 4, pebbles: 2, mussels: 1 },
    harbour: { mussels: 3, pebbles: 3, rubble: 1 },
    wreck: { pebbles: 2, rubble: 1 },
    shore: { pebbles: 4, mussels: 2, tufts: 2 },
    trench: { pebbles: 1 }
};

/** The weights for a biome (unknown biomes get stones). */
export function microTable(biomeId) {
    return BY_BIOME[biomeId] || { pebbles: 1 };
}

/**
 * What lies on a piece of floor: { kind, variant, width, flip } or null. `r()` gives numbers
 * in 0..1 (the chunk's own random stream); `slope` = the floor's angle in radians (steep rock
 * stays bare: things roll off).
 */
export function microAt(biomeId, slope, r, cfg = MICRO) {
    if (Math.abs(slope) > 0.6 || r() > cfg.rate) return null;
    const table = microTable(biomeId), total = Object.values(table).reduce((a, b) => a + b, 0);
    let roll = r() * total, kind = Object.keys(table)[0];
    for (const [k, w] of Object.entries(table)) { roll -= w; if (roll <= 0) { kind = k; break; } }
    return { kind, variant: Math.floor(r() * cfg.variants), width: cfg.width[0] + r() * (cfg.width[1] - cfg.width[0]), flip: r() < 0.5 };
}

/** Texture key of a patch. */
export const microKey = (kind, variant) => `micro_${kind}_${variant}`;
