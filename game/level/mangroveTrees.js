// The mangrove's trees (pure, no Phaser; playtest: "mangrove roots above water and below should
// match", "1 asset for the whole tree, not split"). Each tree is one painted picture (trunk,
// canopy and prop roots through the waterline: img/mangrove_tree_N.webp with its anchors in
// mangrove_tree_N.json: picture size, the waterline row, the trunk's x, the row its roots meet the
// mud). Here: where they stand along the mangrove, and how a picture is fitted to the water there.

import { BIOMES } from './biomes.js';
import { hash } from './terrain.js';

export const MANGROVE_TREES = {
    biome: 'mangrove',
    gap: [3200, 5200],   // px between two trees
    edge: 1800,          // px kept free at both ends of the biome
    arts: 2,             // pictures to choose from (mangrove_tree_1 .. N)
    bury: 30             // px the roots reach into the mud
};

/** The trees, west to east: { x (the trunk), art (1..arts), flip }. The same for the same seed. */
export function mangroveTrees(seed, cfg = MANGROVE_TREES) {
    const b = BIOMES.find(bm => bm.id === cfg.biome);
    if (!b) return [];
    const out = [], end = b.from + b.width - cfg.edge;
    let x = b.from + cfg.edge, i = 0;
    while (x < end) {
        out.push({ x, art: 1 + Math.floor(hash(i, 81, seed) * cfg.arts), flip: hash(i, 82, seed) < 0.5 });
        x += cfg.gap[0] + (cfg.gap[1] - cfg.gap[0]) * hash(i, 83, seed);
        i++;
    }
    return out;
}

/**
 * How a tree's picture is drawn so its waterline row lies on the surface (world y 0) and its roots reach
 * `bury` px into the ground at `groundY`: { scale, originX, originY } (origin in shares of the picture).
 */
export function fitTree(anchors, groundY, cfg = MANGROVE_TREES) {
    const [w, h] = anchors.size, water = anchors.mud - anchors.waterline;
    return { scale: (groundY + cfg.bury) / water, originX: anchors.trunk / w, originY: anchors.waterline / h };
}
