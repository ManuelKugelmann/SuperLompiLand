import { FERRY, ferrySpot, passage, hullX, washY, washAt, lookUp, lookEase } from './ferry.js';

export const FERRY_LOOK = {
    hullDepth: 6.3,      // the hull lies in the waterline, in front of the world
    shadowDepth: 5.6,    // its shadow falls through the water in front of the play plane (soft, never hiding the fish)
    shadowDeep: 1900,    // px down the shadow reaches
    bubbleMs: 22,        // ms between bubbles of the wash
    washDepth: 4.2,      // the wash's white band lies just behind the fish
    washAlpha: 0.5,
    propSpin: 14,        // rad/s the propeller turns
    hullTint: 0x1c2a33
};

/** The painted hull from below (loaded by the title screen); drawn procedurally while missing. */
export const FERRY_ART = { ferry_hull: 'img/ferry_hull.webp' };

const HULL = 'ferry_hull', SHADOW = 'ferry_shadow', WASH = 'ferry_wash', PROP = 'ferry_prop';

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
            const side = 1 - Math.abs(x / (W - 1) * 2 - 1), a = Math.min(1, side * 3) * (1 - 0.35 * y / H) * Math.min(1, (H - y) / 24);      // even all the way down, soft at the sides and at its foot
            img.data[(y * W + x) * 4 + 3] = Math.round(255 * a);
        }
        c.putImageData(img, 0, 0);
        t.refresh();
    }
    if (!T.exists(WASH)) {
        // Churned white water: a band of soft blobs, fading out at its edges and toward its far end (left).
        const W = 512, H = 128, t = T.createCanvas(WASH, W, H), c = t.getContext();
        for (let i = 0; i < 220; i++) {
            const u = ((i * 61) % 97) / 97, v = ((i * 37) % 89) / 89, x = u * W, y = H / 2 + (v - 0.5) * H * 0.8 * (0.5 + 0.5 * u), r = 6 + ((i * 13) % 14);
            const g = c.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, `rgba(255,255,255,${0.5 * u})`); g.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
        }
        t.refresh();
    }
    if (!T.exists(PROP)) {
        // The propeller from the side: three bronze blades round a hub.
        const S = 64, t = T.createCanvas(PROP, S, S), c = t.getContext();
        c.fillStyle = '#b8894a';
        for (let i = 0; i < 3; i++) { c.save(); c.translate(S / 2, S / 2); c.rotate(i * Math.PI * 2 / 3); c.beginPath(); c.ellipse(0, -16, 8, 15, 0.3, 0, Math.PI * 2); c.fill(); c.restore(); }
        c.beginPath(); c.arc(S / 2, S / 2, 6, 0, Math.PI * 2); c.fill();
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
        this.look = 0;      // 0..1: how far the camera's look up at the hull is eased in
    }

    /** The wash's pull at (x, y), into `out` (px/step). */
    flowAt(x, y, out) {
        const L = this.live;
        return washAt(x, y, L.hx, L.pass.dir, L.surface, L.route, out);
    }

    /** How far (px) the camera should look up now; `viewTop` = the picture's top edge without it. */
    lookPx(viewTop) {
        return this.look > 0 ? lookUp(viewTop, this.live ? this.live.surface : 0, this.look) : 0;
    }

    update(fish, heading, t, delta) {
        const F = FERRY, K = FERRY_LOOK;
        this.look = lookEase(this.look, this.live ? this.live.hx - fish.x : Infinity, delta / 1000);
        if (!this.live) {
            if (fish.x < this.spot.x0 || fish.x > this.spot.x1 || t < this.next || !this.scene.buildSlot()) return;
            ensureTextures(this.scene);
            const s = this.scene, hull = s.add.image(0, 0, HULL).setOrigin(0.5, 0).setDepth(K.hullDepth).setTint(K.hullTint);
            hull.setDisplaySize(F.hull[0], F.hull[1]);
            const shadow = s.add.image(0, 0, SHADOW).setOrigin(0.5, 0).setDepth(K.shadowDepth).setTint(0x04121c).setAlpha(F.shadow).setDisplaySize(F.hull[0] * 1.15, K.shadowDeep);
            const pass = passage(fish.x, heading >= 0 ? 1 : -1);
            hull.setFlipX(pass.dir < 0);
            // The wash: a slanted piece from the stern down to the lane and a level piece along it; the propeller turns at the stern.
            const wash = [0, 1].map(() => s.add.image(0, 0, WASH).setDepth(K.washDepth).setAlpha(K.washAlpha).setBlendMode('ADD').setFlipX(pass.dir < 0));
            const prop = s.add.image(0, 0, PROP).setDepth(K.hullDepth + 0.01).setDisplaySize(70, 70);
            this.live = { pass, start: t, hull, shadow, wash, prop, hx: pass.x0, surface: 0, route: 0 };
        }
        const L = this.live, u = t - L.start;
        if (u > L.pass.seconds) {
            for (const o of [L.hull, L.shadow, L.prop, ...L.wash]) o.destroy();
            this.live = null; this.next = t + F.restS;
            return;
        }
        L.hx = hullX(L.pass, u); L.surface = this.surfaceY(L.hx); L.route = this.routeY(L.hx);
        L.hull.setPosition(L.hx, L.surface - 12);
        L.shadow.setPosition(L.hx, L.surface + F.hull[1] * 0.6);
        const dir = L.pass.dir, stern = L.hx - dir * F.hull[0] / 2, top = L.surface + F.hull[1], deep = L.route + F.wash.under, run = (deep - top) / F.wash.slope;
        L.prop.setPosition(stern + dir * 30, top - 20).setRotation(t * K.propSpin);
        // Slanted piece: from the propeller down to where the band reaches the lane; level piece: on along the lane to the wash's end.
        const slant = Math.hypot(run, deep - top), [a, b] = L.wash;
        a.setOrigin(dir > 0 ? 1 : 0, 0.5).setPosition(stern, top).setRotation(dir * -Math.atan2(deep - top, run)).setDisplaySize(slant, F.wash.half * 1.6);
        b.setOrigin(dir > 0 ? 1 : 0, 0.5).setPosition(stern - dir * run, deep).setDisplaySize(Math.max(1, F.wash.length - run), F.wash.half * 1.6);
        // The wash: bubbles all along the band behind the stern, streaming after the ferry.
        this.bubbleIn -= delta;
        if (this.bubbleIn <= 0) {
            this.bubbleIn = K.bubbleMs;
            const s = Math.random() ** 1.6 * F.wash.length, x = L.hx - L.pass.dir * (F.hull[0] / 2 + s);
            const y = washY(s, L.surface, L.route) + (Math.random() - 0.5) * F.wash.half * 1.4;
            this.scene.particles?.spawn('bubble', x, y, 3, { radius: 11, spread: 34, vx: L.pass.dir * 120 });
        }
        if (!this.seen && Math.abs(fish.x - L.hx) < F.seen) { this.seen = true; this.onSeen(); }
    }

    destroy() {
        if (!this.live) return;
        for (const o of [this.live.hull, this.live.shadow, this.live.prop, ...this.live.wash]) o.destroy();
        this.live = null;
    }
}
