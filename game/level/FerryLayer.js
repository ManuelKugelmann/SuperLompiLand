import { FERRY, ferrySpot, passage, hullX, washY, washAt } from './ferry.js';

export const FERRY_LOOK = {
    hullDepth: 6.3,      // the hull lies in the waterline, in front of the world
    shadowDepth: 5.6,    // its shadow falls through the water in front of the play plane (soft, never hiding the fish)
    shadowDeep: 1900,    // px down the shadow reaches
    bubbleMs: 45,        // ms between bubbles of the wash
    hullTint: 0x1c2a33
};

/** The painted hull from below (loaded by the title screen); drawn procedurally while missing. */
export const FERRY_ART = { ferry_hull: 'img/ferry_hull.webp' };

const HULL = 'ferry_hull', SHADOW = 'ferry_shadow';

function ensureTextures(scene) {
    const T = scene.textures;
    if (!T.exists(HULL)) {
        // The hull seen from under water: a long dark keel shape, bow right, with a paler waterline.
        const W = 512, H = 80, t = T.createCanvas(HULL, W, H), c = t.getContext();
        c.fillStyle = '#ffffff';
        c.beginPath(); c.moveTo(6, 4); c.lineTo(470, 4); c.quadraticCurveTo(512, 6, 500, 30); c.quadraticCurveTo(470, 76, 380, 76);
        c.lineTo(60, 76); c.quadraticCurveTo(10, 70, 6, 4); c.fill();
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(6, 4, 492, 10);
        t.refresh();
    }
    if (!T.exists(SHADOW)) {
        // A column of shade: dark under the hull, fading out downward and at its sides.
        const W = 64, H = 256, t = T.createCanvas(SHADOW, W, H), c = t.getContext(), img = c.createImageData(W, H);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const side = 1 - Math.abs(x / (W - 1) * 2 - 1), a = Math.min(1, side * 2.5) * (1 - y / H) ** 1.5;
            img.data[(y * W + x) * 4 + 3] = Math.round(255 * a);
        }
        c.putImageData(img, 0, 0);
        t.refresh();
    }
}

/**
 * Draws the ferry's passage (ferry.js) and answers for its wash.
 *   create():  this.ferry = new FerryLayer(scene, surfaceY, routeY, onSeen)
 *   update():  this.ferry.update(fish, heading, t, delta)      // t in s, delta in ms
 *   water:     if (this.ferry.live) this.ferry.flowAt(x, y, out)
 */
export default class FerryLayer {
    constructor(scene, surfaceY, routeY, onSeen) {
        this.scene = scene; this.surfaceY = surfaceY; this.routeY = routeY; this.onSeen = onSeen;
        this.spot = ferrySpot();
        this.live = null;      // { pass, start, hull, shadow, hx }
        this.next = 0; this.seen = false; this.bubbleIn = 0;
    }

    /** The wash's pull at (x, y), into `out` (px/step). */
    flowAt(x, y, out) {
        const L = this.live;
        return washAt(x, y, L.hx, L.pass.dir, L.surface, L.route, out);
    }

    update(fish, heading, t, delta) {
        const F = FERRY, K = FERRY_LOOK;
        if (!this.live) {
            if (fish.x < this.spot.x0 || fish.x > this.spot.x1 || t < this.next || !this.scene.buildSlot()) return;
            ensureTextures(this.scene);
            const s = this.scene, hull = s.add.image(0, 0, HULL).setOrigin(0.5, 0).setDepth(K.hullDepth).setTint(K.hullTint);
            hull.setDisplaySize(F.hull[0], F.hull[1]);
            const shadow = s.add.image(0, 0, SHADOW).setOrigin(0.5, 0).setDepth(K.shadowDepth).setTint(0x04121c).setAlpha(F.shadow).setDisplaySize(F.hull[0] * 1.15, K.shadowDeep);
            const pass = passage(fish.x, heading >= 0 ? 1 : -1);
            hull.setFlipX(pass.dir < 0);
            this.live = { pass, start: t, hull, shadow, hx: pass.x0, surface: 0, route: 0 };
        }
        const L = this.live, u = t - L.start;
        if (u > L.pass.seconds) {
            L.hull.destroy(); L.shadow.destroy();
            this.live = null; this.next = t + F.restS;
            return;
        }
        L.hx = hullX(L.pass, u); L.surface = this.surfaceY(L.hx); L.route = this.routeY(L.hx);
        L.hull.setPosition(L.hx, L.surface - 12);
        L.shadow.setPosition(L.hx, L.surface + F.hull[1] * 0.6);
        // The wash: bubbles all along the band behind the stern, streaming after the ferry.
        this.bubbleIn -= delta;
        if (this.bubbleIn <= 0) {
            this.bubbleIn = K.bubbleMs;
            const s = Math.random() ** 1.6 * F.wash.length, x = L.hx - L.pass.dir * (F.hull[0] / 2 + s);
            const y = washY(s, L.surface, L.route) + (Math.random() - 0.5) * F.wash.half * 1.4;
            this.scene.particles?.spawn('bubble', x, y, 2, { radius: 9, spread: 30, vx: L.pass.dir * 120 });
        }
        if (!this.seen && Math.abs(fish.x - L.hx) < F.seen) { this.seen = true; this.onSeen(); }
    }

    destroy() {
        if (!this.live) return;
        this.live.hull.destroy(); this.live.shadow.destroy();
        this.live = null;
    }
}
