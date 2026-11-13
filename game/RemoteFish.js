import Phaser from 'phaser';
import { getCharacter } from './characters.js';

const DELAY_MS = 120;   // render this far in the past so there are always two snapshots to blend
const KEEP = 12;        // snapshots kept per fish
const STALE_MS = 6000;  // no update for this long = fish fades out

/**
 * Another player's fish: view only, no Matter body, never collides. Draws a
 * slightly see-through copy of that player's character at a position blended
 * between the snapshots received over the network.
 */
export default class RemoteFish {
    constructor(scene) {
        this.scene = scene;
        this.buf = [];
        this.img = scene.add.image(0, 0, 'puffer_normal').setDepth(4.8).setAlpha(0).setVisible(false);
        this.char = null;
        this.stateName = 'normal';
        this.seen = 0;
    }

    /** Snapshot: { x, y, vx, vy, s: 'normal'|'inflated', f: 1|-1, c: characterId } */
    push(snap, now) {
        this.buf.push({ ...snap, t: now });
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
        const age = now - this.seen;
        if (age > STALE_MS) { img.setVisible(false); return; }
        const t = now - DELAY_MS;
        let a = b[0], c = b[b.length - 1];
        for (let i = b.length - 1; i > 0; i--) {
            if (b[i - 1].t <= t) { a = b[i - 1]; c = b[i]; break; }
        }
        let x, y, vx, vy;
        if (t >= c.t) {
            // Past the newest snapshot: coast on its velocity (60 Hz steps), briefly.
            const dt = Math.min(t - c.t, 250) / (1000 / 60);
            x = c.x + c.vx * dt; y = c.y + c.vy * dt; vx = c.vx; vy = c.vy;
        } else {
            const k = a === c ? 1 : Phaser.Math.Clamp((t - a.t) / (c.t - a.t), 0, 1);
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
