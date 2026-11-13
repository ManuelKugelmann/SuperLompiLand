import Phaser from 'phaser';
import { getCharacter } from './characters.js';
import { SnapshotBuffer } from '../net/snapshots.js';
import { edgeMarker } from '../net/edgeMarker.js';

const ICON_W = 78; // off-screen marker size (px)

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
        // Off-screen marker: a small picture of the friend at the screen edge plus an arrow.
        this.icon = scene.add.image(0, 0, 'puffer_normal').setScrollFactor(0).setDepth(59).setAlpha(0.95).setVisible(false);
        this.arrow = scene.add.triangle(0, 0, 0, -16, 30, 0, 0, 16, 0xffffff, 0.95)
            .setScrollFactor(0).setDepth(59).setStrokeStyle(4, 0x0a3f6e).setVisible(false);
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
        this.icon.setTexture(key);
        this.icon.setScale(ICON_W / this.icon.width);
    }

    render(now) {
        const p = this.char && this.snaps.sample(now);
        const img = this.img;
        if (!p) return;
        if (p.stale) { img.setVisible(false).setAlpha(0); this.icon.setVisible(false); this.arrow.setVisible(false); return; }
        const m = edgeMarker(this.scene.cameras.main.worldView, p);
        this.icon.setVisible(!!m);
        this.arrow.setVisible(!!m);
        if (m) {
            const bob = Math.sin(now / 260) * 4;
            this.icon.setPosition(m.x, m.y + bob);
            this.arrow.setPosition(m.x + Math.cos(m.angle) * 58, m.y + Math.sin(m.angle) * 58).setRotation(m.angle);
        }
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

    destroy() { this.img.destroy(); this.icon.destroy(); this.arrow.destroy(); }
}
