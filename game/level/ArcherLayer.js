import { play } from '../audio.js';
import { ARCHER, archerX, archerBeat, jetPoint } from './archerfish.js';

/**
 * What the archerfish looks like (level/archerfish.js says where and when): the fish under the
 * surface, a mangrove leaf with a fly over it, the jet as a row of droplets. A handful of images,
 * built only while Lompi is near; positions move per frame, nothing is redrawn.
 *
 *   create():  this.archer = new ArcherLayer(scene, surfaceY, splash, onSeen)
 *   update():  this.archer.update(fish, t)
 */
export const ARCHER_LOOK = { depth: 4.4, size: 170, leaf: 1.5, fly: 1.7, far: 2600 };

const FISH = 'archerfish', LEAF = 'mangrove_leaf', FLY = 'leaf_fly', DROP = 'jet_drop';

/** Painted pictures loaded under these keys replace the drawn ones. */
export const ARCHER_ART = { [FISH]: 'img/archerfish.webp' };

function ensureTextures(scene) {
    const tex = scene.textures, TAU = Math.PI * 2;
    const make = (key, w, h, draw) => { if (tex.exists(key)) return; const t = tex.createCanvas(key, w, h); draw(t.getContext(), w, h); t.refresh(); };
    // A silver archerfish with dark bars, a pointed upturned mouth (it faces right, up a little).
    make(FISH, 160, 80, (c, W, H) => {
        const body = c.createLinearGradient(0, 0, 0, H);
        body.addColorStop(0, '#d7e2c6'); body.addColorStop(0.55, '#f4f6ee'); body.addColorStop(1, '#c4cdb8');
        c.fillStyle = body; c.beginPath(); c.moveTo(W * 0.96, H * 0.38); c.quadraticCurveTo(W * 0.6, H * 0.05, W * 0.22, H * 0.3);
        c.lineTo(W * 0.04, H * 0.12); c.lineTo(W * 0.08, H * 0.5); c.lineTo(W * 0.04, H * 0.88); c.lineTo(W * 0.22, H * 0.7);
        c.quadraticCurveTo(W * 0.6, H * 0.95, W * 0.96, H * 0.38); c.fill();
        c.fillStyle = 'rgba(30,30,30,0.75)';
        for (const [x, w] of [[0.36, 0.06], [0.52, 0.055], [0.66, 0.05], [0.28, 0.04]]) { c.beginPath(); c.ellipse(W * x, H * 0.38, W * w / 2, H * 0.24, 0.15, 0, TAU); c.fill(); }
        c.fillStyle = '#1b1b1b'; c.beginPath(); c.arc(W * 0.83, H * 0.36, 5, 0, TAU); c.fill();
        c.fillStyle = '#ffffff'; c.beginPath(); c.arc(W * 0.835, H * 0.345, 1.8, 0, TAU); c.fill();
    });
    make(LEAF, 150, 60, (c, W, H) => {
        c.fillStyle = '#4f7a2e'; c.beginPath(); c.ellipse(W * 0.5, H * 0.55, W * 0.45, H * 0.28, -0.12, 0, TAU); c.fill();
        c.strokeStyle = '#2f4f1a'; c.lineWidth = 3; c.beginPath(); c.moveTo(W * 0.06, H * 0.62); c.lineTo(W * 0.94, H * 0.45); c.stroke();
    });
    make(FLY, 36, 28, (c, W, H) => {
        c.fillStyle = 'rgba(220,235,255,0.75)'; c.beginPath(); c.ellipse(W * 0.4, H * 0.3, 9, 6, -0.5, 0, TAU); c.fill(); c.beginPath(); c.ellipse(W * 0.62, H * 0.3, 9, 6, 0.5, 0, TAU); c.fill();
        c.fillStyle = '#2a2a2a'; c.beginPath(); c.ellipse(W * 0.5, H * 0.62, 9, 6, 0, 0, TAU); c.fill();
    });
    make(DROP, 14, 14, (c, W, H) => { const g = c.createRadialGradient(W / 2, H / 2, 1, W / 2, H / 2, W / 2); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(200,235,255,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); });
}

export default class ArcherLayer {
    constructor(scene, surfaceY, splash, onSeen) {
        this.scene = scene; this.surfaceY = surfaceY; this.splash = splash; this.onSeen = onSeen;
        this.x = archerX();
        this.live = null; this.seen = false; this.start = 0; this.last = '';
        ensureTextures(scene);
    }

    build(t) {
        const s = this.scene, d = ARCHER_LOOK.depth;
        const fish = s.add.image(0, 0, FISH).setDepth(d);
        fish.setScale(ARCHER_LOOK.size / fish.width);
        const leaf = s.add.image(0, 0, LEAF).setOrigin(0.15, 0.6).setDepth(d + 0.1).setScale(ARCHER_LOOK.leaf);
        const fly = s.add.image(0, 0, FLY).setDepth(d + 0.2).setScale(ARCHER_LOOK.fly);
        const drops = Array.from({ length: ARCHER.drops }, () => s.add.image(0, 0, DROP).setDepth(d + 0.2).setVisible(false));
        this.start = t;
        return { fish, leaf, fly, drops };
    }

    /** Per frame. `fish` = Lompi { x, y }, `t` s. */
    update(lompi, t) {
        const dx = lompi.x - this.x;
        if (this.live && Math.abs(dx) > ARCHER_LOOK.far) this.clear();
        if (!this.live) {
            if (Math.abs(dx) > ARCHER.near || !this.scene.buildSlot()) return;
            this.live = this.build(t);
        }
        const L = this.live, top = this.surfaceY(this.x);
        const mouth = { x: this.x + ARCHER_LOOK.size * 0.42, y: top + ARCHER.under - 10 };
        const perch = { x: this.x + ARCHER.leaf[0], y: top - ARCHER.leaf[1] };
        const beat = archerBeat(t - this.start);
        // The archerfish: waits under the surface, tilts up to aim, darts to the fly's splash to snap it.
        let fx = this.x, tilt = -0.12;
        if (beat.name === 'aim') tilt = -0.12 - 0.25 * beat.t;
        else if (beat.name === 'spit') tilt = -0.37;
        else if (beat.name === 'fall') { tilt = -0.2; fx = this.x + ARCHER.leaf[0] * 0.6 * beat.t; }
        else if (beat.name === 'snap') { tilt = 0.1; fx = this.x + ARCHER.leaf[0] * (0.6 + 0.3 * Math.sin(beat.t * Math.PI)); }
        else if (beat.name === 'wait') fx = this.x + ARCHER.leaf[0] * 0.6 * (1 - beat.t);
        L.fish.setPosition(fx, top + ARCHER.under).setRotation(tilt);
        L.leaf.setPosition(perch.x - 45, perch.y + 14);
        // The fly: on the leaf, then falling to the water, gone after the snap, landing again.
        if (beat.name === 'fall') L.fly.setPosition(perch.x, perch.y + (top - perch.y) * beat.t * beat.t).setVisible(true).setAlpha(1);
        else if (beat.name === 'snap' || beat.name === 'wait') L.fly.setVisible(false);
        else if (beat.name === 'land') L.fly.setPosition(perch.x + 60 * (1 - beat.t), perch.y - 60 * (1 - beat.t)).setVisible(true).setAlpha(beat.t);
        else L.fly.setPosition(perch.x, perch.y).setVisible(true).setAlpha(1);
        // The jet: droplets running from the mouth to the fly.
        const spitting = beat.name === 'spit';
        L.drops.forEach((dr, i) => {
            if (!spitting) { dr.setVisible(false); return; }
            const u = beat.t * 1.6 - i / ARCHER.drops * 0.6;
            dr.setVisible(u > 0 && u < 1);
            if (u > 0 && u < 1) { const p = jetPoint(mouth, perch, u); dr.setPosition(p.x, p.y); }
        });
        // Sounds and the splash, once per beat.
        if (beat.name !== this.last) {
            if (beat.name === 'spit') play('splash');
            if (beat.name === 'snap') { this.splash(perch.x, 2.2); play('ringPop'); }
            this.last = beat.name;
        }
        if (!this.seen && Math.abs(dx) < ARCHER.near * 0.6) { this.seen = true; this.onSeen('archerfish'); }
    }

    clear() {
        const L = this.live;
        for (const o of [L.fish, L.leaf, L.fly, ...L.drops]) o.destroy();
        this.live = null; this.last = '';
    }
}
