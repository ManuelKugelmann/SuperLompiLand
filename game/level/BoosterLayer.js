import { BOOST, boostersFor, touches, padBounce } from './boosters.js';
import { musicClock, nowSeconds } from '../audio.js';

// Draws the bounce pads near the view and lets them throw (rules and placement: boosters.js).
// The fallback picture is painted once; idle motion is a sine in update, no tweens at rest.

const KEEP = 900;            // px beside the view within which pads exist
const DEPTH = 3.4;
/** Painted pad art (optional, public/img/props/<key>.webp, loaded by IntroScene). */
export const PAD_ART = ['bo_pad_jelly', 'bo_pad_anemone'];

function makeTextures(scene) {
    if (scene.textures.exists('bo_pad')) return;
    // A pad in open water is a big friendly moon jelly. Painted art is `bo_pad_jelly`;
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
        this.live = new Map();      // id -> { b, img, firedAt }
        this.checked = new Map();   // id -> does it have room (decided once)
        this.out = { x: 0, y: 0 };
        makeTextures(scene);
    }

    /** Room for the whole pad, not just its middle. */
    hasRoom(b) {
        if (!this.checked.has(b.id)) {
            const r = BOOST.padRadius;
            this.checked.set(b.id, [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].every(([dx, dy]) => this.isFree(b.x + dx, b.y + dy)));
        }
        return this.checked.get(b.id);
    }

    /** Keep the pads near the view alive, and let the one the fish drops onto throw it. Returns true when one threw this call. */
    update(view, fish, now) {
        const x0 = view.x - KEEP, x1 = view.right + KEEP;
        for (const s of this.flow.streamsIn(x0, x1)) {
            for (const b of boostersFor(s)) {
                if (this.live.has(b.id) || b.x < x0 || b.x > x1 || !this.hasRoom(b)) continue;
                const img = this.scene.add.image(b.x, b.y, this.scene.textures.exists('bo_pad_jelly') ? 'bo_pad_jelly' : 'bo_pad').setDepth(DEPTH);
                img.base = BOOST.padRadius * 2.6 / img.width;      // shown about as wide as its reach
                this.live.set(b.id, { b, img, firedAt: -Infinity });
            }
        }
        let fired = false;
        const beat = musicClock.pulse(nowSeconds(), 4);      // the jelly's bell pulses on the music's beat
        const sp = fish.sprite, v = sp.body.velocity;
        for (const [id, e] of this.live) {
            const { b, img } = e;
            if (b.x < x0 || b.x > x1) { img.destroy(); this.live.delete(id); continue; }
            // Idle: the cushion sways; a bounce punches the scale and settles.
            const punch = Math.max(0, 1 - (now - e.firedAt) / 380), idle = Math.sin(now / 420 + b.x) * 0.04;
            img.setScale(img.base * (1 + idle * 0.5 - beat * 0.05 + punch * 0.12), img.base * (1 - idle * 0.5 + beat * 0.08 - punch * 0.3));
            if (fired || fish.inAir || now - e.firedAt < BOOST.padRearm || !touches(b, sp.x, sp.y, fish.radius)) continue;
            const out = padBounce(v.x, v.y, b, BOOST, this.out);
            if (!out) continue;
            fish.hold = null;
            sp.setVelocity(out.x, out.y);
            e.firedAt = now;
            fired = true;
        }
        return fired;
    }

    destroy() {
        for (const e of this.live.values()) e.img.destroy();
        this.live.clear();
    }
}
