import Phaser from 'phaser';
import { getCharacter } from './characters.js';
import { SnapshotBuffer } from '../net/snapshots.js';

/**
 * Another player's fish: view only, no Matter body, never collides. Draws a
 * slightly see-through copy of that player's character. All the smoothing is
 * in net/snapshots.js; this class only draws.
 */
export default class RemoteFish {
    constructor(scene) {
        this.scene = scene;
        this.snaps = new SnapshotBuffer();
        this.img = scene.add.image(0, 0, 'puffer_normal').setDepth(4.8).setAlpha(0).setVisible(false);
        this.char = null;
        this.stateName = 'normal';
        this.scale = 1;
    }

    /** Snapshot: { n, t, x, y, vx, vy, s: 'normal'|'inflated', f: 1|-1, c: characterId }. `now` = local clock, ms. */
    push(snap, now) {
        if (!this.snaps.push(snap, now)) return;
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
        const p = this.char && this.snaps.sample(now);
        const img = this.img;
        if (!p) return;
        if (p.stale) { img.setVisible(false).setAlpha(0); return; }
        const facing = p.f < 0 ? -1 : 1;
        const speed = Math.hypot(p.vx, p.vy);
        const follow = this.char.upright ? 0 : Phaser.Math.Clamp((speed - 3) / 8, 0, 1);
        const level = facing < 0 ? Math.PI : 0;
        const target = Phaser.Math.Angle.Wrap(level + Phaser.Math.Angle.Wrap(Math.atan2(p.vy, p.vx) - level) * follow);
        img.setPosition(p.x, p.y);
        img.setScale(this.scale, this.scale * facing);
        img.rotation = Phaser.Math.Angle.RotateTo(img.rotation, target, 0.12);
        img.setVisible(true).setAlpha(Math.min(0.8, img.alpha + 0.05));
    }

    destroy() { this.img.destroy(); }
}
