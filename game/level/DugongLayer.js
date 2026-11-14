import { meadowSpot } from './meadow.js';
import { due, everyOf } from '../throttle.js';

/**
 * A dugong at the lagoon's seagrass meadow (user reference 2026-11-14): it grazes along the seabed,
 * nose down, puffing up a little sand; when Lompi comes near it lifts its head, looks at him, and
 * goes back to grazing. Big, slow and kind. One image, built only near.
 *
 *   create():  this.dugong = new DugongLayer(scene, groundY, onSeen)
 *   update():  this.dugong.update(fish, t, dt)
 */
export const DUGONG = {
    before: 1100,      // px west of the meadow's start where it grazes
    range: 380,        // px it wanders to either side of that place ...
    lapS: 34,          // ... once there and back in this many seconds
    over: 70,          // px its middle hovers over the seabed
    size: 430,         // px long
    look: 650,         // px from Lompi at which it lifts its head
    graze: 0.14,       // nose-down tilt while grazing (rad) ...
    up: -0.1,          // ... and the tilt with its head lifted
    puffS: 2.4,        // s between two puffs of sand at its nose
    near: 2600, far: 3800,
    depth: 3.6
};

export const DUGONG_ART = { dugong: 'img/dugong.png' };

export default class DugongLayer {
    constructor(scene, groundY, onSeen) {
        this.scene = scene; this.groundY = groundY; this.onSeen = onSeen;
        this.home = meadowSpot().x0 - DUGONG.before;
        this.img = null; this.seen = false; this.tilt = DUGONG.graze; this.puff = 0;
        this.offset = Math.floor(this.home) % 30;
    }

    /** Per frame. `fish` = { x, y }, `t` s, `dt` s. */
    update(fish, t, dt) {
        const D = DUGONG, frame = this.scene.game.loop.frame;
        if (!this.img) {
            // Not there yet: is Lompi near? Asked only now and then (throttle.js 'idle').
            if (!due(frame, everyOf('idle', this.scene.quality?.tier), this.offset)) return;
            if (Math.abs(fish.x - this.home) > D.near || !this.scene.textures.exists('dugong') || !this.scene.buildSlot()) return;
            this.img = this.scene.add.image(this.home, 0, 'dugong').setDepth(D.depth);
            this.base = D.size / this.img.width;
            this.ground = this.groundY(this.home);
        }
        if (Math.abs(fish.x - this.home) > D.far) { this.img.destroy(); this.img = null; return; }
        if (this.ground === null) { this.img.setVisible(false); return; }
        // It wanders slowly to and fro, facing the way it goes; the picture faces right.
        const u = (t / D.lapS) % 1, tri = u < 0.5 ? u * 4 - 1 : 3 - u * 4, x = this.home + tri * D.range, going = u < 0.5 ? 1 : -1;
        const dist = Math.hypot(fish.x - x, fish.y - (this.ground - D.over)), looking = dist < D.look;
        // Head up to look at Lompi (and turned toward him), else nose down in the grass.
        const want = looking ? D.up : D.graze, face = looking ? (fish.x >= x ? 1 : -1) : going;
        this.tilt += (want - this.tilt) * Math.min(1, dt * 2.5);
        const breathe = Math.sin(t * 1.1) * 0.02;
        this.img.setVisible(true).setPosition(x, this.ground - D.over + Math.sin(t * 0.8) * 8)
            .setFlipX(face < 0).setRotation(this.tilt * face).setScale(this.base * (1 + breathe), this.base * (1 - breathe));
        // Grazing puffs a little sand up at its nose.
        this.puff -= dt;
        if (!looking && this.puff <= 0) {
            this.puff = D.puffS;
            this.scene.particles.spawn('silt', x + face * D.size * 0.42, this.ground - 12, 5, { radius: 26, spread: 30, vy: -25 });
        }
        if (!this.seen && looking) { this.seen = true; this.onSeen('dugong'); }
    }
}
