/**
 * A handful of bonus coins that belong to a set piece, not to a chunk (the arc through the sea
 * arch, the trail down to a rescue on the seabed): drawn as pictures, taken by touch, counted
 * by the scene through `onCoin(x, y)`. With `backAfter` (s) they return that long after the
 * last one was taken; without it they stay gone.
 */
export const BONUS_COIN = { size: 72, reach: 40 };   // px across as drawn; px (plus the fish's radius) at which one is taken

export default class BonusCoins {
    constructor(scene, points, depth, onCoin, backAfter = null) {
        this.onCoin = onCoin; this.backAfter = backAfter; this.emptyAt = null;
        this.coins = points.map(p => {
            const img = scene.textures.exists('coin')
                ? scene.add.image(p.x, p.y, 'coin').setDisplaySize(BONUS_COIN.size, BONUS_COIN.size)
                : scene.add.circle(p.x, p.y, 32, 0xffd23f).setStrokeStyle(5, 0xfff3b0);
            return img.setDepth(depth);
        });
    }

    /** Per frame. `fish` = { x, y }, `radius` its radius, `t` s. */
    update(fish, radius, t) {
        let left = 0;
        for (const c of this.coins) {
            if (!c.visible) continue;
            if (Math.hypot(c.x - fish.x, c.y - fish.y) < radius + BONUS_COIN.reach) { c.setVisible(false); this.onCoin(c.x, c.y); } else left++;
        }
        if (this.backAfter === null) return;
        if (left === 0 && this.emptyAt === null) this.emptyAt = t;
        if (this.emptyAt !== null && t - this.emptyAt > this.backAfter) { this.emptyAt = null; for (const c of this.coins) c.setVisible(true); }
    }

    destroy() { for (const c of this.coins) c.destroy(); }
}
