import { HUNTER, hunterSpots, spotNear, startHunter, stepHunter, sightBlocked } from './hunter.js';
import { due, everyOf } from '../throttle.js';

/**
 * What the passing hunter looks like (level/hunter.js says how it hunts): a long silver barracuda
 * that comes in from outside the picture, chases Lompi and swims off. Nothing exists between
 * events; one image during one.
 *
 *   create():  this.hunter = new HunterLayer(scene, { solid, top }, { warn, caught, escaped, seen })
 *   update():  this.hunter.update(fish, dt)
 */
export const HUNTER_LOOK = { depth: 3.8, wag: 0.07, wagHz: 5, bubbleS: 0.12 };

const KEY = 'barracuda';      // a painted picture under this key (head right) replaces the drawn one

function ensureTexture(scene) {
    if (scene.textures.exists(KEY)) return;
    // A barracuda from the side: a long silver torpedo, dark blue-green back, pale belly, faint bars,
    // pointed head with the lower jaw forward, two small back fins, a forked tail.
    const W = 420, H = 96, t = scene.textures.createCanvas(KEY, W, H), c = t.getContext(), m = H / 2;
    c.fillStyle = '#5f7f8c';      // tail fork and fins behind the body
    c.beginPath(); c.moveTo(48, m); c.lineTo(4, m - 40); c.lineTo(26, m); c.lineTo(4, m + 40); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(250, m - 20); c.lineTo(228, m - 42); c.lineTo(214, m - 19); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(130, m - 16); c.lineTo(108, m - 36); c.lineTo(98, m - 14); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(126, m + 16); c.lineTo(104, m + 34); c.lineTo(96, m + 13); c.closePath(); c.fill();
    const body = c.createLinearGradient(0, m - 24, 0, m + 24);
    body.addColorStop(0, '#2f5564'); body.addColorStop(0.42, '#a9c3cc'); body.addColorStop(0.6, '#e6f0f2'); body.addColorStop(1, '#f6fafa');
    c.fillStyle = body;
    c.beginPath(); c.moveTo(40, m); c.quadraticCurveTo(150, m - 30, 300, m - 22); c.quadraticCurveTo(380, m - 16, 416, m + 4);
    c.quadraticCurveTo(380, m + 18, 300, m + 22); c.quadraticCurveTo(150, m + 28, 40, m); c.fill();
    c.strokeStyle = 'rgba(40,70,84,0.28)'; c.lineWidth = 7;      // faint bars on the upper flank
    for (let x = 90; x < 300; x += 26) { c.beginPath(); c.moveTo(x, m - 20); c.lineTo(x - 8, m + 2); c.stroke(); }
    c.strokeStyle = '#3b5560'; c.lineWidth = 2; c.beginPath(); c.moveTo(352, m + 8); c.lineTo(414, m + 5); c.stroke();   // mouth line
    c.fillStyle = '#f4e9b8'; c.beginPath(); c.arc(356, m - 5, 7, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#15202a'; c.beginPath(); c.arc(357, m - 5, 3.6, 0, Math.PI * 2); c.fill();
    t.refresh();
}

export default class HunterLayer {
    /** `world` = { solid(x, y) rock there, top(x) the surface's y }; `on` = { warn(), caught(x, y), escaped(), seen(kind) }. */
    constructor(scene, world, on) {
        this.scene = scene; this.world = world; this.on = on;
        this.spots = hunterSpots(); this.done = new Set();
        this.h = null; this.img = null; this.sees = true; this.bubble = 0;
        ensureTexture(scene);
    }

    /** Per frame. `fish` = { x, y }, `dt` s. */
    update(fish, dt) {
        const frame = this.scene.game.loop.frame, tier = this.scene.quality?.tier;
        if (!this.h) {
            // No event: is Lompi at a spot? Asked only now and then (throttle.js 'idle').
            if (!due(frame, everyOf('idle', tier), 7)) return;
            const s = spotNear(fish.x, this.done, HUNTER, this.spots);
            if (!s) return;
            this.done.add(s.id);
            this.h = startHunter(fish, HUNTER, this.world);
            this.on.warn();
            return;
        }
        const h = this.h, was = h.phase;
        // Rock between them hides Lompi; looked up every few frames (throttle.js 'check').
        if (h.phase === 'chase' && due(frame, everyOf('check', tier), 3)) this.sees = !sightBlocked(this.world.solid, h.x, h.y, fish.x, fish.y);
        stepHunter(h, fish, this.sees, dt, HUNTER, this.world);
        if (h.phase === 'done') { this.img?.destroy(); this.img = null; this.h = null; return; }
        if (h.phase === 'warn') return;
        if (!this.img) {
            this.img = this.scene.add.image(h.x, h.y, KEY).setDepth(HUNTER_LOOK.depth);
            this.img.setScale(HUNTER.size / this.img.width);
            this.on.seen('barracuda');
        }
        if (was === 'chase' && h.phase === 'leave') { if (h.result === 'caught') this.on.caught(h.x, h.y); else this.on.escaped(); }
        // Head along its way (the picture faces right; swimming left it is flipped, not upside down), the tail beating.
        const L = HUNTER_LOOK, left = Math.cos(h.angle) < 0, wag = Math.sin(h.t * Math.PI * 2 * L.wagHz) * L.wag;
        this.img.setPosition(h.x, h.y).setFlipY(left).setRotation(h.angle + wag);
        this.bubble -= dt;
        if (this.bubble <= 0) { this.bubble = L.bubbleS; this.scene.particles.spawn('bubble', h.x - Math.cos(h.angle) * HUNTER.size * 0.45, h.y - Math.sin(h.angle) * HUNTER.size * 0.45, 1, { radius: 10, spread: 14 }); }
    }
}
