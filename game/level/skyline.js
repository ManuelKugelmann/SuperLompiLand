// What stands on the horizon above the water (pure, no Phaser; spec 10.12): far, soft shapes
// that follow the journey. Each biome has its own coast, and the volcano in the far east is in
// sight from the first minute, growing as you come closer.

import { BIOMES, WORLD_WEST, WORLD_END } from './biomes.js';

export const SKYLINE = {
    volcanoAt: 0.42,       // the volcano sits this share of the screen right of the middle at the world's west end
    volcanoGrow: [0.4, 1], // its size at the west end and at the east end
    margin: 80             // px beyond the screen edge at which a shape is still kept visible
};

// Per biome: [kind, where in the biome 0..1, parallax (share of the camera's movement; small = far), size].
// Kinds are drawn in SkyLayer.js: palms (sandy islet with palms), canopy (mangrove tree line),
// light (rock with a lighthouse), stacks (bare sea stacks), ship (a freighter on the horizon),
// port (cranes, sheds, lights).
const COASTS = {
    beach: [['palms', 0.3, 0.12, 1], ['palms', 0.85, 0.06, 0.6]],
    mangrove: [['canopy', 0.35, 0.14, 1], ['canopy', 0.8, 0.08, 0.7]],
    reef: [['light', 0.5, 0.09, 1]],
    kelp: [['stacks', 0.3, 0.1, 1], ['stacks', 0.75, 0.06, 0.6]],
    blue: [['ship', 0.25, 0.05, 1], ['ship', 0.7, 0.04, 0.7]],
    wreck: [['ship', 0.3, 0.05, 0.9], ['stacks', 0.8, 0.06, 0.6]],
    shore: [['stacks', 0.25, 0.12, 1], ['light', 0.7, 0.1, 0.9]],
    harbour: [['port', 0.5, 0.13, 1]],
    trench: [['stacks', 0.3, 0.07, 0.7]]
};

/** Everything on the horizon, west to east: { kind, x (world anchor), scroll, size }. */
export function skyItems(biomes = BIOMES) {
    const out = [];
    for (const b of biomes) {
        for (const [kind, at, scroll, size] of COASTS[b.id] || []) out.push({ kind, x: b.from + b.width * at, scroll, size });
    }
    return out;
}

/**
 * The island's own coast close by (spec 5.0c "above water: that island's coast"): painted
 * pieces standing on the waterline behind the play plane, nearer than the horizon. Per island
 * biome its picture (img/coast/<id>.webp as sky_coast_<id>), set along the biome with gaps, a
 * little bigger or smaller and mirrored now and then so it never repeats exactly.
 */
export const NEAR_COAST = {
    scroll: 0.72,          // share of the camera's movement (near, but behind the play plane)
    width: 1400,           // px of one piece at size 1
    size: [0.85, 1.2],
    gap: [0.05, 0.55],     // gap after a piece, in piece widths (small: the island shows on most jumps)
    edge: 0.08,            // share of the biome left free at both ends (its neighbours' coasts take over)
    biomes: ['reef', 'kelp', 'harbour', 'shore']
};

/** The near coast pieces, west to east: { kind, x (world anchor), scroll, size, flip }. */
export function nearCoastItems(biomes = BIOMES, cfg = NEAR_COAST) {
    const out = [];
    for (const b of biomes) {
        if (!cfg.biomes.includes(b.id)) continue;
        let seed = (b.from | 0) ^ 0x5bd1e995;
        const r = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
        // A piece of on-screen width w covers w / scroll of world x (it moves slower than the camera).
        const x1 = b.from + b.width * (1 - cfg.edge);
        let x = b.from + b.width * cfg.edge, flip = r() < 0.5;
        while (true) {
            const size = cfg.size[0] + r() * (cfg.size[1] - cfg.size[0]), span = cfg.width * size / cfg.scroll;
            if (x + span > x1) break;
            flip = r() < 0.75 ? !flip : flip;      // mostly alternating: neighbours never all face the same way
            out.push({ kind: `coast_${b.id}`, x: x + span / 2, scroll: cfg.scroll, size, flip });
            x += span * (1 + cfg.gap[0] + r() * (cfg.gap[1] - cfg.gap[0]));
        }
    }
    return out;
}

/** Where a shape is on a screen `width` wide when the camera's middle is at world x `cam`: right in the middle when the camera is at its anchor. */
export function screenX(item, cam, width) {
    return width / 2 + (item.x - cam) * item.scroll;
}

export function onScreen(sx, halfWidth, width, cfg = SKYLINE) {
    return sx > -halfWidth - cfg.margin && sx < width + halfWidth + cfg.margin;
}

/**
 * The volcano, the journey's compass: { x on screen, size }. It stands right of the middle at
 * the west end of the world and comes to the middle, full size, at the east end.
 */
export function volcanoAt(cam, width, cfg = SKYLINE) {
    const t = Math.max(0, Math.min(1, (cam - WORLD_WEST) / (WORLD_END - WORLD_WEST)));
    return { x: width / 2 + width * cfg.volcanoAt * (1 - t), size: cfg.volcanoGrow[0] + (cfg.volcanoGrow[1] - cfg.volcanoGrow[0]) * t };
}
