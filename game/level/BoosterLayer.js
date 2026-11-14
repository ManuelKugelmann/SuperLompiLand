import Phaser from 'phaser';
import { BOOST, boostersFor, touches, cannonShot, padBounce } from './boosters.js';
import { musicClock, nowSeconds } from '../audio.js';

// Draws the bubble cannons and bounce pads near the view and fires them (rules and
// placement: boosters.js). Textures are painted once; idle motion is a sine in update,
// no tweens at rest.

const KEEP = 900;            // px beside the view within which elements exist
const DEPTH = 3.4;
/** Painted pad art (optional, public/img/props/<key>.webp, loaded by IntroScene). */
export const PAD_ART = ['bo_pad_jelly', 'bo_pad_anemone'];

function makeTextures(scene) {
    if (scene.textures.exists('bo_cannon')) return;
    // Bubble cannon: a ring of bubbles with a bright mouth on the firing side (+x).
    const c = scene.textures.createCanvas('bo_cannon', 240, 240), g = c.getContext();
    const glow = g.createRadialGradient(120, 120, 20, 120, 120, 112);
    glow.addColorStop(0, 'rgba(190,240,255,0.30)'); glow.addColorStop(1, 'rgba(190,240,255,0)');
    g.fillStyle = glow; g.fillRect(0, 0, 240, 240);
    const bubble = (x, y, r) => {
        const b = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
        b.addColorStop(0, 'rgba(255,255,255,0.95)'); b.addColorStop(0.5, 'rgba(170,230,255,0.55)'); b.addColorStop(1, 'rgba(120,200,255,0.15)');
        g.fillStyle = b; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2; g.stroke();
    };
    for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2, front = Math.cos(a);
        bubble(120 + Math.cos(a) * 84, 120 + Math.sin(a) * 84, 13 + front * 5 + (i % 3) * 2);
    }
    for (const [x, r] of [[150, 9], [176, 12], [206, 15]]) { bubble(x, 120 - r * 1.6, r * 0.7); bubble(x, 120 + r * 1.6, r * 0.7); }
    c.refresh();
    // Bounce pad: a pad in open water is a big friendly moon jelly. Painted art is `bo_pad_jelly`;
    // this soft bell with a fringe of short arms is the fallback.
    const p = scene.textures.createCanvas('bo_pad', 280, 150), q = p.getContext();
    for (let i = 0; i < 15; i++) {
        const x = 30 + i * 15.7, h = 26 + (i % 4) * 7;
        const arm = q.createLinearGradient(0, 96, 0, 96 + h);
        arm.addColorStop(0, '#ff8fb3'); arm.addColorStop(1, '#ffd1a6');
        q.fillStyle = arm; q.beginPath(); q.ellipse(x, 100 + h / 2, 7, h / 2, 0, 0, Math.PI * 2); q.fill();
    }
    const dome = q.createRadialGradient(120, 40, 10, 140, 90, 140);
    dome.addColorStop(0, '#fff0f5'); dome.addColorStop(0.35, '#ff9ec4'); dome.addColorStop(1, '#d9508f');
    q.fillStyle = dome; q.beginPath(); q.ellipse(140, 104, 128, 92, 0, Math.PI, 0); q.fill();
    q.fillStyle = 'rgba(255,255,255,0.45)'; q.beginPath(); q.ellipse(105, 46, 46, 14, -0.25, 0, Math.PI * 2); q.fill();
    p.refresh();
}

export default class BoosterLayer {
    /**
     * @param flow    the scene's flow field (streamsIn)
     * @param isFree  (x, y) -> true when there is open water there
     */
    constructor(scene, flow, isFree) {
        this.scene = scene; this.flow = flow; this.isFree = isFree;
        this.live = new Map();      // id -> { b, img, firedAt, punch }
        this.checked = new Map();   // id -> does it have room (decided once)
        this.out = { x: 0, y: 0 };
        makeTextures(scene);
    }

    /** Room for the whole element, not just its middle. */
    hasRoom(b) {
        if (!this.checked.has(b.id)) {
            const r = b.kind === 'cannon' ? BOOST.cannonRadius : BOOST.padRadius;
            this.checked.set(b.id, [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].every(([dx, dy]) => this.isFree(b.x + dx, b.y + dy)));
        }
        return this.checked.get(b.id);
    }

    /**
     * Keep the elements near the view alive, and fire the one the fish touches.
     * Returns 'cannon' or 'pad' when one fired this call, else null.
     */
    update(view, fish, now) {
        const x0 = view.x - KEEP, x1 = view.right + KEEP;
        for (const s of this.flow.streamsIn(x0, x1)) {
            for (const b of boostersFor(s)) {
                if (this.live.has(b.id) || b.x < x0 || b.x > x1 || !this.hasRoom(b)) continue;
                const pad = this.scene.textures.exists('bo_pad_jelly') ? 'bo_pad_jelly' : 'bo_pad';
                const img = this.scene.add.image(b.x, b.y, b.kind === 'cannon' ? 'bo_cannon' : pad).setDepth(DEPTH);
                if (b.kind === 'pad') img.base = BOOST.padRadius * 2.6 / img.width;      // shown about as wide as its reach
                if (b.kind === 'cannon') img.setRotation(Math.atan2(b.dy, b.dx)).setBlendMode(Phaser.BlendModes.SCREEN);
                this.live.set(b.id, { b, img, firedAt: -Infinity });
            }
        }
        let fired = null;
        const beat = musicClock.pulse(nowSeconds(), 4);      // the jelly's bell pulses on the music's beat
        const sp = fish.sprite, v = sp.body.velocity;
        for (const [id, e] of this.live) {
            const { b, img } = e;
            if (b.x < x0 || b.x > x1) { img.destroy(); this.live.delete(id); continue; }
            // Idle: the ring breathes, the cushion sways; a shot punches the scale and settles.
            const punch = Math.max(0, 1 - (now - e.firedAt) / 380);
            const idle = Math.sin(now / 420 + b.x) * 0.04;
            if (b.kind === 'cannon') img.setScale(1 + idle + punch * 0.45).setAlpha(0.85 + punch * 0.15);
            else img.setScale(img.base * (1 + idle * 0.5 - beat * 0.05 + punch * 0.12), img.base * (1 - idle * 0.5 + beat * 0.08 - punch * 0.3));
            if (fired || fish.inAir || now - e.firedAt < (b.kind === 'cannon' ? BOOST.cannonRearm : BOOST.padRearm)) continue;
            if (!touches(b, sp.x, sp.y, fish.radius)) continue;
            const out = b.kind === 'cannon' ? cannonShot(v.x, v.y, b, BOOST, this.out) : padBounce(v.x, v.y, b, BOOST, this.out);
            if (!out) continue;
            fish.hold = null;
            sp.setVelocity(out.x, out.y);
            e.firedAt = now;
            fired = b.kind;
        }
        return fired;
    }

    destroy() {
        for (const e of this.live.values()) e.img.destroy();
        this.live.clear();
    }
}
