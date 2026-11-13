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
        // Dart pointing right at rotation 0, drawn once into a texture. It must be long
        // and notched: a near-equilateral triangle looks the same turned by 120°, so
        // its direction could not be read.
        if (!scene.textures.exists('mp_arrow')) {
            const g = scene.make.graphics({ add: false });
            const dart = (pad, color) => {
                g.fillStyle(color, 1).fillPoints([
                    { x: pad, y: pad }, { x: 52 - pad * 1.6, y: 20 }, { x: pad, y: 40 - pad }, { x: 14 + pad * 0.6, y: 20 }
                ], true);
            };
            dart(0, 0x0a3f6e);
            dart(5, 0xffffff);
            g.generateTexture('mp_arrow', 52, 40);
            g.destroy();
        }
        this.arrow = scene.add.image(0, 0, 'mp_arrow').setScrollFactor(0).setDepth(59).setAlpha(0.95).setVisible(false);
        // Colour ring (spec: no names; each fish shows its character plus a colour ring).
        this.ring = scene.add.circle(0, 0, 60).setDepth(4.7).setVisible(false);
        this.iconRing = scene.add.circle(0, 0, ICON_W * 0.62).setScrollFactor(0).setDepth(58.9).setVisible(false);
        this.radius = 60;
        this.setColor(0xffffff);
    }

    setColor(color) {
        if (color === this.color) return;
        this.color = color;
        this.ring.setStrokeStyle(7, color, 0.85);
        this.iconRing.setFillStyle(0x0a3f6e, 0.45).setStrokeStyle(5, color, 1);
        this.arrow.setTint(color);
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
        this.radius = (st.radius || 60) * 1.25;
        this.ring.setRadius(this.radius);
    }

    /** Where to show an emote over this fish (world position), or null if it is not drawn. */
    get head() { return this.img.visible ? { x: this.img.x, y: this.img.y - this.radius - 30 } : null; }

    render(now) {
        const p = this.char && this.snaps.sample(now);
        const img = this.img;
        if (!p) return;
        if (p.stale) {
            img.setVisible(false).setAlpha(0);
            for (const o of [this.icon, this.arrow, this.ring, this.iconRing]) o.setVisible(false);
            return;
        }
        const m = edgeMarker(this.scene.cameras.main.worldView, p);
        this.icon.setVisible(!!m);
        this.arrow.setVisible(!!m);
        this.iconRing.setVisible(!!m);
        if (m) {
            const bob = Math.sin(now / 260) * 4;
            this.icon.setPosition(m.x, m.y + bob);
            this.iconRing.setPosition(m.x, m.y + bob);
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
        this.ring.setPosition(p.x, p.y).setVisible(true).setAlpha(img.alpha);
    }

    destroy() { for (const o of [this.img, this.icon, this.arrow, this.ring, this.iconRing]) o.destroy(); }
}
