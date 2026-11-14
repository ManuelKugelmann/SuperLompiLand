import { createRig } from '../CardRig.js';
import { SEA_LION, seaLionSpot, seaLionAt } from './seaLion.js';

export const SEA_LION_LOOK = { depth: 4.4 };      // just behind the fish

/** The painted sea lion pup (head right; loaded by the title screen, part cards in img/parts too); drawn procedurally while missing. */
export const SEA_LION_ART = { sea_lion: 'img/sea_lion.webp' };

const KEY = 'sea_lion';

function ensureTexture(scene) {
    if (scene.textures.exists(KEY)) return;
    // A sleek brown pup, head right: a torpedo body, a paler belly, fore and hind flippers, a dark eye.
    const W = 256, H = 96, t = scene.textures.createCanvas(KEY, W, H), c = t.getContext();
    const body = c.createLinearGradient(0, 18, 0, 80);
    body.addColorStop(0, '#5a4636'); body.addColorStop(0.6, '#7b6250'); body.addColorStop(1, '#b59c84');
    c.fillStyle = body;
    c.beginPath(); c.moveTo(18, 50);
    c.bezierCurveTo(60, 14, 170, 10, 226, 34); c.bezierCurveTo(250, 42, 250, 56, 228, 62);
    c.bezierCurveTo(170, 84, 70, 82, 18, 50); c.fill();
    c.fillStyle = '#4a3a2d';
    c.beginPath(); c.moveTo(150, 66); c.quadraticCurveTo(128, 96, 100, 90); c.quadraticCurveTo(122, 76, 128, 62); c.fill();      // fore flipper
    c.beginPath(); c.moveTo(24, 50); c.quadraticCurveTo(0, 30, 4, 54); c.quadraticCurveTo(2, 74, 26, 56); c.fill();      // hind flippers
    c.fillStyle = '#1b1410'; c.beginPath(); c.arc(222, 42, 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.arc(223, 41, 1.3, 0, Math.PI * 2); c.fill();
    t.refresh();
}

/**
 * Draws the sea lion pup (seaLion.js): it exists only during a visit.
 *   create():  this.seaLion = new SeaLionLayer(scene, surfaceY, onSeen)      // surfaceY(x) -> the waterline
 *   update():  this.seaLion.update(fish, heading, t, dt)      // fish = { x, y }, heading +1 east, t and dt in s
 */
export default class SeaLionLayer {
    constructor(scene, surfaceY, onSeen) {
        this.scene = scene; this.surfaceY = surfaceY; this.onSeen = onSeen;
        this.spot = seaLionSpot();
        this.rig = null; this.start = null; this.next = 0; this.dir = 1; this.seen = false;
        this.p = {}; this.last = null; this.bubbleAt = 0;
    }

    update(fish, heading, t, dt) {
        const inSpot = fish.x > this.spot.x0 && fish.x < this.spot.x1;
        if (this.start === null) {
            if (!inSpot || t < this.next || !this.scene.buildSlot()) return;
            ensureTexture(this.scene);
            this.rig = createRig(this.scene, { states: { normal: { key: KEY, width: SEA_LION.length, wiggle: 10 } }, anim: 'swim', spine: { tail: 0, plane: true }, soft: 0.6 }, fish.x, fish.y, SEA_LION_LOOK.depth);
            this.start = t; this.dir = heading >= 0 ? 1 : -1; this.last = null;
        }
        const p = seaLionAt(t - this.start, fish.x, fish.y, this.dir, this.surfaceY(fish.x), this.p);
        if (p.done) {
            this.rig.destroy(); this.rig = null; this.start = null; this.next = t + SEA_LION.restS;
            return;
        }
        const vx = this.last ? (p.x - this.last.x) / Math.max(dt, 1e-3) / 60 : 0, vy = this.last ? (p.y - this.last.y) / Math.max(dt, 1e-3) / 60 : 0;
        this.rig.draw({ x: p.x, y: p.y, vx, vy, frames: dt * 60, effort: 0.8, turn: 0.35 });
        this.last = { x: p.x, y: p.y };
        if (p.part === 'loop' && t > this.bubbleAt) {
            this.bubbleAt = t + SEA_LION.bubbleS;
            this.scene.particles?.spawn('bubble', p.x, p.y, 1, { radius: 7, spread: 14 });
        }
        if (!this.seen && Math.hypot(p.x - fish.x, p.y - fish.y) < SEA_LION.seen) { this.seen = true; this.onSeen(); }
    }

    destroy() { this.rig?.destroy(); this.rig = null; }
}
