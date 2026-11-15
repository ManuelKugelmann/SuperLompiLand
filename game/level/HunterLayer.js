import { HUNTER, hunterSpots, spotNear, startHunter, stepHunter, sightBlocked, findCover } from './hunter.js';
import { due, everyOf } from '../throttle.js';
import { createRig } from '../CardRig.js';

/**
 * What the passing hunter looks like (level/hunter.js says how it hunts): a long silver barracuda
 * that comes in from outside the picture, chases Lompi and swims off. Nothing exists between
 * events; one image during one.
 *
 *   create():  this.hunter = new HunterLayer(scene, { solid, top }, { warn, caught, escaped, seen })
 *   update():  this.hunter.update(fish, dt)
 */
export const HUNTER_LOOK = { depth: 3.8, bubbleS: 0.12, coverR: 110, coverColor: 0xbff6ff, coverAlpha: [0.1, 0.28] };

const KEY = 'barracuda';      // a painted picture under this key (head right) replaces the drawn one
/** The painted barracuda (scripts/fx/fish_cut.py; loaded by the title screen). */
export const HUNTER_ART = { [KEY]: 'img/barracuda.webp' };

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
        this.h = null; this.rig = null; this.sees = true; this.bubble = 0;
        ensureTexture(scene);
    }

    /** Per frame. `fish` = { x, y }, `dt` s. */
    update(fish, dt) {
        const frame = this.scene.game.loop.frame, tier = this.scene.quality?.tier;
        if (!this.h) {
            // No event: is Lompi at a spot? Asked only now and then (throttle.js 'idle').
            if (!due(frame, everyOf('idle', tier), 7)) return;
            const s = spotNear(fish.x, this.done, HUNTER, this.spots);
            if (!s) { for (const q of this.spots) if (fish.x > q.x + HUNTER.window) this.done.add(q.id); return; }
            // Only where there is somewhere to hide: the place lights up softly so a child sees where to go.
            if (Math.abs(fish.x - (this.searchedAt ?? -Infinity)) < HUNTER.searchEvery) return;
            this.searchedAt = fish.x;
            const cover = findCover(this.world.solid, fish.x, fish.y);
            if (!cover) return;
            this.done.add(s.id);
            this.h = startHunter(fish, HUNTER, this.world);
            this.showCover(cover);
            this.on.warn();
            return;
        }
        const h = this.h, was = h.phase;
        // Rock between them hides Lompi; looked up every few frames (throttle.js 'check').
        if (h.phase === 'chase' && due(frame, everyOf('check', tier), 3)) this.sees = !sightBlocked(this.world.solid, h.x, h.y, fish.x, fish.y);
        // With the Feuerfisch in the school the barracuda gives up sooner (its spines, friendPowers.js).
        const spines = this.scene.powers?.().spines;
        stepHunter(h, fish, this.sees, dt, spines ? (this.spiny ??= { ...HUNTER, chaseS: HUNTER.chaseS * spines.chase }) : HUNTER, this.world);
        if (h.phase !== 'warn' && h.phase !== 'chase') this.hideCover();
        if (h.phase === 'done') { this.rig?.destroy(); this.rig = null; this.h = null; return; }
        if (h.phase === 'warn') return;
        if (!this.rig) {
            // The shared swim rig: it swims by the spine wave like every fish (tail-driven by default).
            this.rig = createRig(this.scene, { states: { normal: { key: KEY, width: HUNTER.size, wiggle: 8 } }, anim: 'swim' }, h.x, h.y, HUNTER_LOOK.depth);
            this.on.seen('barracuda');
        }
        if (was === 'chase' && h.phase === 'leave') { if (h.result === 'caught') this.on.caught(h.x, h.y); else this.on.escaped(); }
        // The rig heads along its velocity (px per step) and beats its tail with the effort: a sprint.
        const L = HUNTER_LOOK, speed = (h.phase === 'chase' ? HUNTER.speed : HUNTER.leaveSpeed) / 60;
        this.rig.draw({ x: h.x, y: h.y, vx: Math.cos(h.angle) * speed, vy: Math.sin(h.angle) * speed, frames: dt * 60, effort: 1, turn: 0.35 });
        this.bubble -= dt;
        if (this.bubble <= 0) { this.bubble = L.bubbleS; this.scene.particles.spawn('bubble', h.x - Math.cos(h.angle) * HUNTER.size * 0.45, h.y - Math.sin(h.angle) * HUNTER.size * 0.45, 1, { radius: 10, spread: 14 }); }
    }

    /** A soft pulsing light over the hiding place while the hunter is about. */
    showCover({ x, y }) {
        const L = HUNTER_LOOK;
        this.cover = this.scene.add.circle(x, y, L.coverR, L.coverColor, L.coverAlpha[1]).setDepth(L.depth - 0.1).setBlendMode('ADD');
        this.scene.tweens.add({ targets: this.cover, alpha: L.coverAlpha[0] / L.coverAlpha[1], scale: 1.15, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    hideCover() {
        if (!this.cover) return;
        this.scene.tweens.killTweensOf(this.cover);
        this.cover.destroy(); this.cover = null;
    }
}