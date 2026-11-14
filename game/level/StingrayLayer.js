import { STINGRAY, rayStart, rayGlide } from './stingray.js';

/**
 * What the stingray looks like (level/stingray.js says how it glides): a flat sandy ray lying in
 * the sand, lifting off in a puff of sand when Lompi comes close, gliding low over the bottom with
 * its wings rippling, and settling again further on. One image, built only while Lompi is near.
 *
 *   create():  this.stingray = new StingrayLayer(scene, groundY, onSeen)
 *   update():  this.stingray.update(fish, t)
 */
export const RAY_LOOK = { near: 2400, far: 3800, depth: 3.0, ripple: 0.08 };

const RAY = 'sand_ray';         // the painted sand ray (also the meadow's): a ray lying flat, head right

/** The painted ray replaces the drawn one. */
export const RAY_ART = { [RAY]: 'img/sand_ray.webp' };

function ensureTexture(scene) {
    if (scene.textures.exists(RAY)) return;
    // Seen from the side and well above: the wide disc shows (a ray is flat), sandy grey with a darker
    // back and a pale rim, two eyes near the front, a thin tail trailing behind.
    const W = 300, H = 130, t = scene.textures.createCanvas(RAY, W, H), c = t.getContext(), TAU = Math.PI * 2;
    const body = c.createRadialGradient(W * 0.5, H * 0.45, 8, W * 0.5, H * 0.5, W * 0.4);
    body.addColorStop(0, '#8f846b'); body.addColorStop(0.75, '#ada186'); body.addColorStop(1, '#d9d0b8');
    c.fillStyle = body;
    c.beginPath(); c.moveTo(W * 0.86, H * 0.48); c.quadraticCurveTo(W * 0.6, H * 0.02, W * 0.22, H * 0.4); c.quadraticCurveTo(W * 0.14, H * 0.5, W * 0.22, H * 0.6);
    c.quadraticCurveTo(W * 0.6, H * 0.98, W * 0.86, H * 0.48); c.fill();
    c.strokeStyle = '#7d735c'; c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(W * 0.18, H * 0.5); c.quadraticCurveTo(W * 0.06, H * 0.48, 4, H * 0.56); c.stroke();
    c.fillStyle = '#2a261f'; for (const dy of [-8, 8]) { c.beginPath(); c.arc(W * 0.74, H * 0.48 + dy, 3.4, 0, TAU); c.fill(); }
    t.refresh();
}

export default class StingrayLayer {
    constructor(scene, groundY, onSeen) {
        this.scene = scene; this.groundY = groundY; this.onSeen = onSeen;
        this.x = rayStart(); this.glides = 0; this.since = -1; this.from = this.x;
        this.img = null; this.seen = false;
        ensureTexture(scene);
    }

    /** Per frame. `fish` = { x, y }, `t` s. */
    update(fish, t) {
        const L = RAY_LOOK, dx = Math.abs(fish.x - this.x);
        if (this.img && dx > L.far) { this.img.destroy(); this.img = null; }
        if (!this.img) {
            if (dx > L.near || !this.scene.buildSlot()) return;
            this.img = this.scene.add.image(this.x, 0, RAY).setDepth(L.depth);
            this.img.setScale(STINGRAY.size / this.img.width);
            this.base = this.img.scale;
        }
        const ground = this.groundY(this.x) ?? 0;
        if (this.since < 0) {
            // Lying under the sand, only the eyes and the outline showing; Lompi close by wakes it.
            // Lying under the sand it still lives (tester: it looked static): the wing edges ripple slowly and it breathes.
            const breathe = Math.sin(t * 1.6), ripple = Math.sin(t * 2.7);
            this.img.setPosition(this.x + ripple * 2, ground - 6 - breathe * 1.5).setAlpha(0.5).setScale(this.base * (1 + ripple * 0.025), this.base * 0.85 * (1 + breathe * 0.05)).setRotation(ripple * 0.012);
            if (this.glides < STINGRAY.rests && Math.hypot(fish.x - this.x, fish.y - ground) < STINGRAY.wake) {
                this.since = t; this.from = this.x;
                this.scene.particles.spawn('silt', this.x, ground - 10, 14, { radius: STINGRAY.size * 0.4, spread: 60, vy: -60 });
                if (!this.seen) { this.seen = true; this.onSeen('stingray'); }
            }
            return;
        }
        const g = rayGlide(this.from, t - this.since);
        this.x = g.x;
        const under = this.groundY(g.x) ?? ground;
        this.img.setPosition(g.x, under - 8 - g.lift).setAlpha(1 - 0.55 * g.buried)
            .setScale(this.base * (1 + Math.sin(t * 5 + 1) * L.ripple * 0.4), this.base * (1 + Math.sin(t * 5) * L.ripple * (g.lift > 2 ? 1 : 0.4))).setRotation(Math.sin(t * 2.5) * 0.04);
        if (g.done) { this.since = -1; this.glides++; this.scene.particles.spawn('silt', g.x, under - 6, 8, { radius: STINGRAY.size * 0.3, spread: 40, vy: -30 }); }
    }
}
