import { scaledTexture } from '../fx/scaledTexture.js';
import { magnetStep } from '../friendPowers.js';

/**
 * A handful of bonus coins that belong to a set piece, not to a chunk (the arc through the sea
 * arch, the trail down to a rescue on the seabed): taken by touch, counted by the scene through
 * `onCoin(x, y)`. With `backAfter` (s) they return that long after the last one was taken;
 * without it they stay gone. All of one set are bobs of a single Blitter (one display object).
 */
export const BONUS_COIN = { size: 72, reach: 40 };   // px across as drawn; px (plus the fish's radius) at which one is taken

export default class BonusCoins {
    constructor(scene, points, depth, onCoin, backAfter = null) {
        this.onCoin = onCoin; this.backAfter = backAfter; this.emptyAt = null;
        const S = BONUS_COIN.size, key = scaledTexture(scene, 'coin', S) || BonusCoins.fallback(scene);
        this.blitter = scene.add.blitter(0, 0, key).setDepth(depth);
        this.coins = points.map(p => {
            const bob = this.blitter.create(p.x - S / 2, p.y - S / 2);
            bob.cx = p.x; bob.cy = p.y; bob.hx = p.x; bob.hy = p.y;      // where it is, and where it belongs
            return bob;
        });
    }

    /** A drawn coin when the art is missing (every texture has a procedural fallback). */
    static fallback(scene) {
        const key = 'bonus_coin_drawn';
        if (!scene.textures.exists(key)) {
            const S = BONUS_COIN.size, t = scene.textures.createCanvas(key, S, S), c = t.getContext();
            c.fillStyle = '#ffd23f'; c.strokeStyle = '#fff3b0'; c.lineWidth = 5;
            c.beginPath(); c.arc(S / 2, S / 2, S / 2 - 4, 0, 7); c.fill(); c.stroke();
            t.refresh();
        }
        return key;
    }

    /** Per frame. `fish` = { x, y }, `radius` its radius, `t` s. */
    update(fish, radius, t) {
        let left = 0;
        const steps = Math.min(4, this.blitter.scene.game.loop.delta / (1000 / 60));      // coins fly by time, not by frame
        for (const c of this.coins) {
            if (!c.visible) continue;
            const m = BonusCoins.magnet && magnetStep(c.cx, c.cy, fish.x, fish.y, BonusCoins.magnet, c.age || 0, steps);      // a friend's power (spec 5.0r)
            if (m) { c.age = (c.age || 0) + steps; c.cx = m.x; c.cy = m.y; c.x = m.x - BONUS_COIN.size / 2; c.y = m.y - BONUS_COIN.size / 2; }
            if (Math.hypot(c.cx - fish.x, c.cy - fish.y) < radius + BONUS_COIN.reach) { c.visible = false; this.onCoin(c.cx, c.cy); } else left++;
        }
        if (this.backAfter === null) return;
        if (left === 0 && this.emptyAt === null) this.emptyAt = t;
        if (this.emptyAt !== null && t - this.emptyAt > this.backAfter) { this.emptyAt = null; for (const c of this.coins) { c.visible = true; c.age = 0; c.cx = c.hx; c.cy = c.hy; c.x = c.hx - BONUS_COIN.size / 2; c.y = c.hy - BONUS_COIN.size / 2; } }
    }

    destroy() { this.blitter.destroy(); }
}

/** The coin magnet of the friends' powers (friendPowers.js), set by the scene; null = none. */
BonusCoins.magnet = null;
