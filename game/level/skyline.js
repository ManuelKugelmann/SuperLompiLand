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
    wreck: [['stacks', 0.2, 0.08, 0.8], ['palms', 0.6, 0.1, 0.9]],
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
