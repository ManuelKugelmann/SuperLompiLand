import { mangroveTrees, fitTree, MANGROVE_TREES } from './mangroveTrees.js';

// The mangrove's whole trees (mangroveTrees.js): one picture each, canopy, trunk and prop roots
// through the waterline, standing behind the swimmer. Built near the view, dropped when left.
// Without the painted pictures the chunks' own procedural roots stand instead (LevelGenerator).

export const MANGROVE_LOOK = {
    depth: -7,          // behind the play plane, with the back rock (depths.js backProps)
    near: 3600,         // px from the view's middle within which a tree is made
    alpha: 0.95
};

/** Painted trees: picture and anchors (loaded by the title screen). */
export const MANGROVE_TREE_ART = Array.from({ length: MANGROVE_TREES.arts }, (_, i) => ({ key: `mangrove_tree_${i + 1}`, file: `img/mangrove_tree_${i + 1}.webp`, json: `img/mangrove_tree_${i + 1}.json` }));

/** Whether the painted trees (and their anchors) are there: then they stand, else the procedural roots. */
export function haveMangroveTrees(scene) {
    return MANGROVE_TREE_ART.every(a => scene.textures.exists(a.key) && scene.cache.json.exists(a.key));
}

export default class MangroveTreeLayer {
    /** `groundAt(x)` = world y of the mud under x. */
    constructor(scene, seed, groundAt) {
        this.scene = scene;
        this.groundAt = groundAt;
        this.on = haveMangroveTrees(scene);
        this.trees = this.on ? mangroveTrees(seed) : [];
        this.live = new Map();      // index -> image
    }

    /** Per frame: the trees near the view. */
    update(cx) {
        if (!this.on) return;
        const L = MANGROVE_LOOK;
        this.trees.forEach((t, i) => {
            const near = Math.abs(t.x - cx) < L.near, img = this.live.get(i);
            if (near && !img && this.scene.buildSlot()) {
                const key = `mangrove_tree_${t.art}`, f = fitTree(this.scene.cache.json.get(key), this.groundAt(t.x));
                this.live.set(i, this.scene.add.image(t.x, 0, key).setOrigin(t.flip ? 1 - f.originX : f.originX, f.originY)
                    .setScale(f.scale).setFlipX(t.flip).setDepth(L.depth).setAlpha(L.alpha));
            } else if (!near && img) { img.destroy(); this.live.delete(i); }
        });
    }

    destroy() { for (const img of this.live.values()) img.destroy(); this.live.clear(); }
}
