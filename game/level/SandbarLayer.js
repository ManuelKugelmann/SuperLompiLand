import { SANDBAR, sandbarSpot, sandbarCoins, jumpedOver } from './sandbar.js';
import BonusCoins from './BonusCoins.js';

export const SANDBAR_LOOK = {
    near: 3200, far: 5000,   // px from the bar at which it is built, and beyond which it is removed
    depth: 2.2,          // behind the fish
    coinDepth: 2.6,
    coinsBack: 25,       // s after the last coin was taken until they are back
    again: 3             // s before a second jump over it is cheered again
};

const KEY = 'sandbar';

/** The painted sandbar (scripts/fx/sandbar.py; loaded by the title screen); drawn procedurally while missing. */
export const SANDBAR_ART = { [KEY]: 'img/sandbar.webp' };

/** Fallback picture: a long low mound of pale rippled sand, its crown a little above the waterline, fading out below (a painted file under the same key replaces it). */
function ensureTexture(scene) {
    if (scene.textures.exists(KEY)) return;
    const W = 750, H = 170, tex = scene.textures.createCanvas(KEY, W, H), c = tex.getContext();
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#fff3cf'); g.addColorStop(0.35, '#f0dba6'); g.addColorStop(1, 'rgba(214,190,140,0)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, H);
    c.bezierCurveTo(W * 0.12, H * 0.5, W * 0.34, 4, W * 0.5, 4);
    c.bezierCurveTo(W * 0.66, 4, W * 0.88, H * 0.5, W, H);
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(190,160,110,0.45)'; c.lineWidth = 3;
    for (let i = 0; i < 9; i++) { const y = 30 + i * 13, half = W * (0.1 + i * 0.045); c.beginPath(); c.moveTo(W / 2 - half, y); c.quadraticCurveTo(W / 2, y + 7, W / 2 + half, y); c.stroke(); }   // ripples
    tex.refresh();
}

/**
 * What the lagoon's sandbar looks like (level/sandbar.js says where it is): the bar lying in
 * the surface, and its coins: a trail up from the route and an arc in the air over the crown.
 * Built only while the fish is near. `surfaceY(x)` = height of the water surface, `onCoin(x, y)`
 * for every coin taken, `onJump()` when the fish flies over the crown.
 */
export default class SandbarLayer {
    constructor(scene, routeY, surfaceY, onCoin, onJump) {
        this.scene = scene; this.surfaceY = surfaceY; this.onCoin = onCoin; this.onJump = onJump;
        this.spot = sandbarSpot();
        this.coinSpots = sandbarCoins(routeY);
        ensureTexture(scene);
        this.live = null;      // { img, coins }
        this.prev = null; this.jumpedAt = -Infinity;
    }

    /** Per frame. `fish` = { x, y }, `radius` its radius, `t` s. */
    update(fish, radius, t) {
        const L = SANDBAR_LOOK, sp = this.spot;
        if (this.live && (fish.x < sp.x0 - L.far || fish.x > sp.x1 + L.far)) { this.live.img.destroy(); this.live.coins.destroy(); this.live = null; this.prev = null; }
        if (!this.live) {
            if (fish.x < sp.x0 - L.near || fish.x > sp.x1 + L.near || !this.scene.buildSlot()) return;
            const img = this.scene.add.image(sp.x, 0, KEY).setOrigin(0.5, SANDBAR.crown / SANDBAR.height).setDisplaySize(SANDBAR.width, SANDBAR.height).setDepth(L.depth);
            this.live = { img, coins: new BonusCoins(this.scene, this.coinSpots, L.coinDepth, this.onCoin, L.coinsBack) };
        }
        this.live.img.setY(this.surfaceY(sp.x));      // it lies in the surface: the swell washes over its crown
        this.live.coins.update(fish, radius, t);
        if (this.prev && t - this.jumpedAt > L.again && jumpedOver(this.prev, fish)) { this.jumpedAt = t; this.onJump(); }
        this.prev = { x: fish.x, y: fish.y };
    }
}
