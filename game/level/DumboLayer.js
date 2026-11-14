import { BIOMES } from './biomes.js';

/**
 * A dumbo octopus in the trench (user reference 2026-11-14: "should have been a dumbo octopus"):
 * it hovers a little under the calm route, flaps its ear fins (a soft squash of the picture), bobs,
 * and drifts toward Lompi when he comes near, curious, never touching. One image, built near.
 *
 *   create():  this.dumbo = new DumboLayer(scene, routeY, onSeen)
 *   update():  this.dumbo.update(fish, t, dt)
 */
export const DUMBO = {
    biome: 'trench',
    at: 0.33,          // share of the trench's width where it lives
    under: 110,        // px under the calm route it hovers (in the picture when Lompi swims the route)
    size: 190,         // px tall
    flap: 1.7,         // flaps per second
    curious: 900,      // px from Lompi at which it drifts toward him ...
    keep: 260,         // ... but never closer than this
    drift: 70,         // px/s it drifts
    near: 2400, far: 3600,
    depth: 4.2
};

export const DUMBO_ART = { dumbo_octopus: 'img/dumbo_octopus.png' };

export default class DumboLayer {
    constructor(scene, routeY, onSeen) {
        this.scene = scene; this.routeY = routeY; this.onSeen = onSeen;
        const b = BIOMES.find(bi => bi.id === DUMBO.biome);
        this.home = b.from + b.width * DUMBO.at;
        this.x = this.home; this.y = null; this.img = null; this.seen = false;
    }

    /** Per frame. `fish` = { x, y }, `t` s, `dt` s. */
    update(fish, t, dt) {
        const D = DUMBO, dx = Math.abs(fish.x - this.home);
        if (this.img && dx > D.far) { this.img.destroy(); this.img = null; }
        if (!this.img) {
            if (dx > D.near || !this.scene.textures.exists('dumbo_octopus') || !this.scene.buildSlot()) return;
            this.img = this.scene.add.image(this.home, 0, 'dumbo_octopus').setDepth(D.depth);
            this.base = D.size / this.img.height;
            this.x = this.home; this.y = this.routeY(this.home) + D.under;
        }
        // Curious: within reach it drifts toward Lompi, stops at a polite distance, else back home.
        const toFish = Math.hypot(fish.x - this.x, fish.y - this.y);
        const tx = toFish < D.curious ? fish.x : this.home, ty = toFish < D.curious ? fish.y + 60 : this.routeY(this.home) + D.under;
        const dist = Math.hypot(tx - this.x, ty - this.y), stop = toFish < D.curious ? D.keep : 4;
        if (dist > stop) { const k = Math.min(1, D.drift * dt / dist); this.x += (tx - this.x) * k; this.y += (ty - this.y) * k; }
        // The ear fins flap: a soft squash, and the body bobs with each stroke.
        const f = Math.sin(t * D.flap * Math.PI * 2);
        this.img.setPosition(this.x, this.y - f * 6).setScale(this.base * (1 + f * 0.05), this.base * (1 - f * 0.04))
            .setFlipX(fish.x < this.x).setRotation(Math.sin(t * 0.6) * 0.07);
        if (!this.seen && toFish < D.curious) { this.seen = true; this.onSeen('dumbo_octopus'); }
    }
}
