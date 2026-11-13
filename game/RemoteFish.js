import Phaser from 'phaser';
import { getCharacter } from './characters.js';

const KEEP = 24;         // snapshots kept per fish
const STALE_MS = 6000;   // no update for this long = fish fades out
const MIN_DELAY = 90;    // render-delay bounds (ms): the cushion against network jitter
const MAX_DELAY = 320;
const SNAP_DIST = 700;   // a jump this far (respawn, nest) is a teleport, not a swim
const OFFSET_WINDOW = 80;

/**
 * Another player's fish: view only, no Matter body, never collides. Draws a
 * slightly see-through copy of that player's character.
 *
 * Smoothness: every snapshot carries the sender's clock (`t`). The offset
 * between the two clocks is estimated as the fastest recent delivery, so
 * bursty arrival (a stalled data channel releasing several packets at once)
 * does not turn into stutter. The fish is drawn a little in the past, with a
 * cushion that grows and shrinks with measured jitter.
 */
export default class RemoteFish {
    constructor(scene) {
        this.scene = scene;
        this.buf = [];
        this.img = scene.add.image(0, 0, 'puffer_normal').setDepth(4.8).setAlpha(0).setVisible(false);
        this.char = null;
        this.stateName = 'normal';
        this.seen = 0;
        this.lastSeq = -1;
        this.offsets = [];
        this.delay = 140;
        this.jitter = 0;
    }

    /** Snapshot: { n, t, x, y, vx, vy, s: 'normal'|'inflated', f: 1|-1, c: characterId }. `now` = local clock, ms. */
    push(snap, now) {
        if (typeof snap?.t !== 'number' || typeof snap.x !== 'number' || typeof snap.y !== 'number') return;
        if (snap.n <= this.lastSeq && this.lastSeq - snap.n < 1000) return; // late / duplicate
        this.lastSeq = snap.n;

        this.offsets.push(now - snap.t);
        if (this.offsets.length > OFFSET_WINDOW) this.offsets.shift();
        const offset = Math.min(...this.offsets);
        const lt = snap.t + offset;
        // How late this packet was compared with the fastest ones, smoothed.
        this.jitter += ((now - lt) - this.jitter) * 0.08;
        this.delay = Phaser.Math.Clamp(60 + this.jitter * 3, MIN_DELAY, MAX_DELAY);

        const last = this.buf[this.buf.length - 1];
        if (last && Math.hypot(snap.x - last.x, snap.y - last.y) > SNAP_DIST) this.buf.length = 0;
        this.buf.push({ ...snap, lt });
        if (this.buf.length > KEEP) this.buf.shift();
        this.seen = now;
        if (snap.c !== this.char?.id || snap.s !== this.stateName) this.setLook(snap.c, snap.s);
    }

    setLook(charId, stateName) {
        this.char = getCharacter(charId);
        this.stateName = this.char.states[stateName] ? stateName : 'normal';
        const st = this.char.states[this.stateName];
        const key = this.scene.textures.exists(st.key) ? st.key : 'puffer_normal';
        this.img.setTexture(key);
        this.scale = st.width / this.img.width;
        this.img.setScale(this.scale);
    }

    render(now) {
        const b = this.buf;
        if (!b.length || !this.char) return;
        const img = this.img;
        if (now - this.seen > STALE_MS) { img.setVisible(false).setAlpha(0); return; }

        // Local time that maps onto "sender time minus the cushion".
        const offset = Math.min(...this.offsets);
        const t = now - offset - this.delay;
        let a = b[0], c = b[b.length - 1];
        for (let i = b.length - 1; i > 0; i--) {
            if (b[i - 1].lt <= t) { a = b[i - 1]; c = b[i]; break; }
        }
        let x, y, vx, vy;
        if (t >= c.lt) {
            // Past the newest snapshot: coast on its velocity (60 Hz steps), briefly.
            const dt = Math.min(t - c.lt, 250) / (1000 / 60);
            x = c.x + c.vx * dt; y = c.y + c.vy * dt; vx = c.vx; vy = c.vy;
        } else {
            const k = a === c ? 1 : Phaser.Math.Clamp((t - a.lt) / (c.lt - a.lt), 0, 1);
            x = Phaser.Math.Linear(a.x, c.x, k); y = Phaser.Math.Linear(a.y, c.y, k);
            vx = Phaser.Math.Linear(a.vx, c.vx, k); vy = Phaser.Math.Linear(a.vy, c.vy, k);
        }
        const facing = c.f < 0 ? -1 : 1;
        const speed = Math.hypot(vx, vy);
        const follow = this.char.upright ? 0 : Phaser.Math.Clamp((speed - 3) / 8, 0, 1);
        const level = facing < 0 ? Math.PI : 0;
        const target = Phaser.Math.Angle.Wrap(level + Phaser.Math.Angle.Wrap(Math.atan2(vy, vx) - level) * follow);
        img.setPosition(x, y);
        img.setScale(this.scale, this.scale * facing);
        img.rotation = Phaser.Math.Angle.RotateTo(img.rotation, target, 0.12);
        img.setVisible(true).setAlpha(Math.min(0.8, img.alpha + 0.05));
    }

    destroy() { this.img.destroy(); }
}
