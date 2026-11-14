import { createRig } from '../CardRig.js';
import { SEA_OTTER, otterSpot, otterAt, diveTo } from './seaOtter.js';

export const SEA_OTTER_LOOK = { depth: 4.4, floatDepth: 6.2 };      // diving: just behind the fish; floating: on the waterline

/** The painted otter (loaded by the title screen): swimming, head right, and floating on its back with its kelp strand and shell. Drawn procedurally while missing. */
export const SEA_OTTER_ART = { sea_otter: 'img/sea_otter.webp', sea_otter_float: 'img/sea_otter_float.webp' };

const SWIM = 'sea_otter', FLOAT = 'sea_otter_float';

function ensureTextures(scene) {
    const T = scene.textures, fur = '#6b4a34', pale = '#d9c3a3';
    if (!T.exists(SWIM)) {
        // Side view, head right: a long furry body, a pale face, a flat tail.
        const W = 256, H = 80, t = T.createCanvas(SWIM, W, H), c = t.getContext();
        c.fillStyle = fur;
        c.beginPath(); c.moveTo(4, 44); c.quadraticCurveTo(30, 34, 60, 38); c.bezierCurveTo(110, 14, 190, 16, 214, 30);
        c.bezierCurveTo(240, 30, 250, 44, 232, 54); c.bezierCurveTo(190, 70, 110, 70, 60, 52); c.quadraticCurveTo(30, 56, 4, 44); c.fill();
        c.fillStyle = pale; c.beginPath(); c.ellipse(226, 42, 20, 13, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#1b1410'; c.beginPath(); c.arc(230, 38, 3, 0, Math.PI * 2); c.arc(246, 42, 2.4, 0, Math.PI * 2); c.fill();
        t.refresh();
    }
    if (!T.exists(FLOAT)) {
        // On its back, head right: belly up, paws on the chest holding a shell, a strand of kelp over the middle.
        const W = 256, H = 96, t = T.createCanvas(FLOAT, W, H), c = t.getContext();
        c.fillStyle = fur; c.beginPath(); c.ellipse(118, 58, 104, 22, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.moveTo(18, 56); c.quadraticCurveTo(0, 40, 6, 60); c.quadraticCurveTo(8, 70, 22, 64); c.fill();      // tail
        c.fillStyle = pale; c.beginPath(); c.ellipse(214, 46, 24, 18, 0, 0, Math.PI * 2); c.fill();      // head
        c.fillStyle = '#1b1410'; c.beginPath(); c.arc(220, 40, 3, 0, Math.PI * 2); c.arc(236, 46, 2.6, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#8a674c'; c.beginPath(); c.ellipse(150, 42, 16, 9, -0.3, 0, Math.PI * 2); c.ellipse(176, 42, 16, 9, 0.3, 0, Math.PI * 2); c.fill();      // paws
        c.fillStyle = '#cfd6da'; c.beginPath(); c.ellipse(163, 36, 11, 8, 0, 0, Math.PI * 2); c.fill();      // the shell
        c.strokeStyle = '#5f7f3a'; c.lineWidth = 9; c.lineCap = 'round';
        c.beginPath(); c.moveTo(70, 28); c.quadraticCurveTo(96, 62, 84, 92); c.stroke();      // the kelp strand it is wrapped in
        t.refresh();
    }
}

/**
 * Draws the sea otter (seaOtter.js): a picture while it floats, a rig while it dives.
 *   create():  this.seaOtter = new SeaOtterLayer(scene, surfaceY, routeY, onSeen)
 *   update():  this.seaOtter.update(fish, heading, t, dt)      // fish = { x, y }, heading +1 east, t and dt in s
 */
export default class SeaOtterLayer {
    constructor(scene, surfaceY, routeY, onSeen) {
        this.scene = scene; this.surfaceY = surfaceY; this.routeY = routeY; this.onSeen = onSeen;
        this.spot = otterSpot();
        this.built = null; this.seen = false; this.p = {}; this.last = null; this.tapped = false;
    }

    update(fish, heading, t, dt) {
        const d = Math.abs(fish.x - this.spot.x);
        if (this.built && d > SEA_OTTER.near * 1.4) { this.destroy(); return; }
        if (!this.built) {
            if (d > SEA_OTTER.near || !this.scene.buildSlot()) return;
            ensureTextures(this.scene);
            const s = this.scene, float = s.add.image(this.spot.x, 0, FLOAT).setDepth(SEA_OTTER_LOOK.floatDepth);
            float.setScale(SEA_OTTER.length / float.width);
            const rig = createRig(s, { states: { normal: { key: SWIM, width: SEA_OTTER.length, wiggle: 9 } }, anim: 'swim', soft: 0.6 }, this.spot.x, 0, SEA_OTTER_LOOK.depth);
            this.built = { float, rig };
        }
        const B = this.built, x0 = this.spot.x;
        // While it floats it keeps deciding where the next dive goes: just ahead of the fish.
        if (this.p.part === 'float' || this.diveX === undefined) this.diveX = diveTo(x0, fish.x, heading >= 0 ? 1 : -1);
        const p = otterAt(t, x0, this.surfaceY(x0), this.routeY(this.diveX), this.p, SEA_OTTER, this.diveX), floating = p.part === 'float';
        B.float.setVisible(floating); B.rig.setVisible(!floating);
        if (floating) {
            B.float.setPosition(p.x, p.y - 6).setRotation(Math.sin(t * 1.3) * 0.04);
            // A tap on the shell: a little glint over its chest, once per tap.
            if (p.tap && !this.tapped) this.scene.particles?.spawn('glint', p.x + SEA_OTTER.length * 0.14, p.y - 24, 2, { radius: 5, spread: 14 });
            this.last = null;
        } else {
            const vx = this.last ? (p.x - this.last.x) / Math.max(dt, 1e-3) / 60 : 0, vy = this.last ? (p.y - this.last.y) / Math.max(dt, 1e-3) / 60 : 0;
            B.rig.draw({ x: p.x, y: p.y, vx, vy, frames: dt * 60, effort: 0.6, turn: 0.3 });
            this.last = { x: p.x, y: p.y };
            // Down at the lane it cracks its shell too: a glint at its paws.
            if (p.tap && !this.tapped) this.scene.particles?.spawn('glint', p.x + SEA_OTTER.length * 0.3, p.y + 6, 2, { radius: 5, spread: 14 });
        }
        this.tapped = p.tap;
        if (!this.seen && Math.hypot(p.x - fish.x, p.y - fish.y) < SEA_OTTER.seen) { this.seen = true; this.onSeen(); }
    }

    destroy() {
        if (!this.built) return;
        this.built.float.destroy(); this.built.rig.destroy();
        this.built = null;
    }
}
