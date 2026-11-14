import { DOLPHIN_RINGS, dolphinSpot, dolphinAt, blowRing, stepRing, ringRadius, throughRing } from './dolphinRings.js';

/**
 * What the dolphins' game looks like (level/dolphinRings.js says how it plays): two dolphins on
 * their loop and the bubble rings they blow, drawn as upright hoops of bubbles. Built only near.
 * `routeY(x)` = the calm route; `onRing(x, y)` = the fish swam through a ring; `onSeen()` once.
 */
export const DOLPHIN_LOOK = {
    near: 2600, far: 4200,
    length: 330,         // px a dolphin is long as drawn
    depth: 1.8,          // just behind the fish
    ringDepth: 4.6,      // in front of the fish (a hoop it swims through)
    ringAlpha: 0.85
};

// Texture keys: a painted 'dolphin' loaded under this key replaces the drawn one.
const DOLPHIN = 'dolphin', RING = 'bubble_ring';

/** The painted dolphin (loaded by the title screen); drawn procedurally while missing. */
export const DOLPHIN_ART = { [DOLPHIN]: 'img/dolphin.webp' };

function ensureTextures(scene) {
    const tex = scene.textures;
    if (!tex.exists(DOLPHIN)) {
        // A bottlenose dolphin from the side, head right: grey-blue back, pale belly, beak, dorsal fin.
        const W = 256, H = 112, t = tex.createCanvas(DOLPHIN, W, H), c = t.getContext();
        const g = c.createLinearGradient(0, 20, 0, 96); g.addColorStop(0, '#5f7f9c'); g.addColorStop(0.55, '#86a4bd'); g.addColorStop(1, '#e6eef2');
        c.fillStyle = g;
        c.beginPath(); c.moveTo(18, 58); c.quadraticCurveTo(70, 26, 160, 34); c.quadraticCurveTo(214, 40, 236, 58);
        c.lineTo(254, 62); c.quadraticCurveTo(236, 70, 210, 72); c.quadraticCurveTo(130, 92, 40, 70); c.closePath(); c.fill();
        c.fillStyle = '#5f7f9c';
        c.beginPath(); c.moveTo(110, 34); c.quadraticCurveTo(118, 6, 138, 2); c.quadraticCurveTo(132, 22, 140, 36); c.fill();   // dorsal fin
        c.beginPath(); c.moveTo(26, 60); c.lineTo(2, 40); c.lineTo(10, 60); c.lineTo(2, 82); c.closePath(); c.fill();          // flukes
        c.beginPath(); c.moveTo(150, 70); c.quadraticCurveTo(140, 96, 122, 100); c.quadraticCurveTo(136, 82, 134, 70); c.fill(); // flipper
        c.fillStyle = '#1b2c5c'; c.beginPath(); c.arc(206, 54, 4, 0, 7); c.fill();
        t.refresh();
    }
    if (!tex.exists(RING)) {
        // An upright hoop of small bubbles (a vortex ring seen nearly edge-on).
        const W = 96, H = 192, t = tex.createCanvas(RING, W, H), c = t.getContext();
        for (let i = 0; i < 36; i++) {
            const a = i / 36 * Math.PI * 2, x = W / 2 + Math.cos(a) * W * 0.36, y = H / 2 + Math.sin(a) * H * 0.44, r = 4 + (i % 3) * 1.6;
            c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(x, y, r + 2, 0, 7); c.fill();
            c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
        }
        t.refresh();
    }
}

export default class DolphinLayer {
    constructor(scene, routeY, onRing, onSeen) {
        this.scene = scene; this.routeY = routeY; this.onRing = onRing; this.onSeen = onSeen;
        this.spot = dolphinSpot();
        this.seen = false;
        this.prev = null;
        ensureTextures(scene);
        this.live = null;
    }

    build() {
        const s = this.scene, L = DOLPHIN_LOOK, cy = this.routeY(this.spot.x) + DOLPHIN_RINGS.below;
        const dolphins = [0, 1].map(() => {
            const img = s.add.image(0, 0, DOLPHIN).setDepth(L.depth);
            img.setScale(L.length / img.width);
            return img;
        });
        return { dolphins, cy, rings: [], blowAt: 0, turn: 0 };
    }

    /** Per frame. `fish` = { x, y }, `t` s, `delta` ms. */
    update(fish, t, delta) {
        const L = DOLPHIN_LOOK, sp = this.spot, dt = delta / 1000;
        if (this.live && (fish.x < sp.x0 - L.far || fish.x > sp.x1 + L.far)) this.clear();
        if (!this.live) {
            if (fish.x < sp.x0 - L.near || fish.x > sp.x1 + L.near || !this.scene.buildSlot()) { this.prev = null; return; }
            this.live = this.build();
        }
        const v = this.live, ds = [0, 1].map(k => dolphinAt(k, t, sp.x, v.cy));
        ds.forEach((d, k) => v.dolphins[k].setPosition(d.x, d.y).setFlipX(d.dir < 0).setRotation(d.angle));
        // They take turns blowing rings.
        v.blowAt -= dt;
        if (v.blowAt <= 0 && v.rings.length < DOLPHIN_RINGS.max) {
            v.blowAt = DOLPHIN_RINGS.every;
            const r = blowRing(ds[v.turn]); v.turn = 1 - v.turn;
            r.img = this.scene.add.image(r.x, r.y, RING).setDepth(L.ringDepth).setAlpha(0);
            v.rings.push(r);
        }
        const prev = this.prev || fish;
        v.rings = v.rings.filter(r => {
            const alive = stepRing(r, dt), rad = ringRadius(r);
            const fade = Math.min(1, r.age / 0.6, (DOLPHIN_RINGS.life - r.age) / 1.2);
            r.img.setPosition(r.x, r.y + Math.sin(t * 3 + r.x * 0.01) * 4).setDisplaySize(rad, rad * 2).setAlpha(L.ringAlpha * Math.max(0, fade));
            if (alive && throughRing(r, prev, fish)) {
                this.scene.particles.spawn('bubble', r.x, r.y, 14, { radius: rad * 0.8, spread: 90 });
                this.onRing(r.x, r.y);
                r.img.destroy();
                return false;
            }
            if (!alive) r.img.destroy();
            return alive;
        });
        this.prev = { x: fish.x, y: fish.y };
        if (!this.seen && Math.abs(fish.x - sp.x) < sp.x1 - sp.x) { this.seen = true; this.onSeen('dolphin'); }
    }

    clear() {
        for (const d of this.live.dolphins) d.destroy();
        for (const r of this.live.rings) r.img.destroy();
        this.live = null; this.prev = null;
    }
}
