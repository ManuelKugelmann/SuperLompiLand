import Phaser from 'phaser';
import { getCharacter } from './characters.js';
import Rig from './Rig.js';
import { SnapshotBuffer } from '../net/snapshots.js';
import { edgeMarker } from '../net/edgeMarker.js';

const ICON_W = 78; // off-screen marker size (px)

/**
 * Another player: view only, no Matter body, never collides. Draws a slightly
 * see-through copy of that player's character with the same Rig as the local
 * one, driven by network snapshots (smoothing: net/snapshots.js).
 */
export default class RemoteFish {
    constructor(scene) {
        this.scene = scene;
        this.snaps = new SnapshotBuffer();
        this.rig = null;        // built when the first snapshot says which character it is
        this.alpha = 0;
        this.last = 0;
        this.char = null;
        this.stateName = 'normal';
        this.pos = null;        // last drawn world position, null while gone quiet
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
        this.down = false;      // 0 hearts: the edge marker pulses red with a heart so friends come to help
        this.help = scene.add.text(0, 0, '💗', { fontFamily: 'Arial', fontSize: '44px' }).setOrigin(0.5).setScrollFactor(0).setDepth(59.1).setVisible(false);
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
        const char = getCharacter(charId);
        if (char !== this.char) {
            this.rig?.destroy();
            this.char = char;
            this.rig = new Rig(this.scene, char, 0, 0, 4.8).setVisible(false);
        }
        this.stateName = char.states[stateName] ? stateName : 'normal';
        this.rig.setState(this.stateName);
        const st = char.states[this.stateName];
        this.icon.setTexture(this.rig.view.texture.key);
        this.icon.setScale(ICON_W / this.icon.width);
        this.radius = (st.radius || 60) * 1.25;
        this.ring.setRadius(this.radius);
    }

    /** Where to show an emote over this fish (world position), or null if it is not drawn. */
    get head() { return this.alpha > 0 ? { x: this.rig.view.x, y: this.rig.view.y - this.radius - 30 } : null; }

    render(now) {
        const p = this.char && this.snaps.sample(now);
        if (!p) return;
        if (p.stale) {
            this.rig.setVisible(false);
            this.alpha = 0;
            this.pos = null;
            for (const o of [this.icon, this.arrow, this.ring, this.iconRing, this.help]) o.setVisible(false);
            return;
        }
        this.pos = { x: p.x, y: p.y };
        const m = edgeMarker(this.scene.cameras.main.worldView, p);
        this.icon.setVisible(!!m);
        this.arrow.setVisible(!!m);
        this.iconRing.setVisible(!!m);
        this.help.setVisible(!!m && this.down);
        if (m) {
            const bob = Math.sin(now / 260) * 4;
            this.icon.setPosition(m.x, m.y + bob);
            this.iconRing.setPosition(m.x, m.y + bob);
            if (this.down) {
                const pulse = 0.5 + 0.5 * Math.sin(now / 140);
                this.iconRing.setStrokeStyle(6 + pulse * 4, 0xff3b6b, 1).setScale(1 + pulse * 0.15);
                this.help.setPosition(m.x, m.y - 64 + bob).setScale(0.9 + pulse * 0.25);
            } else if (this.iconRing.scale !== 1) {
                this.iconRing.setScale(1).setStrokeStyle(5, this.color, 1);
            }
            this.arrow.setPosition(m.x + Math.cos(m.angle) * 58, m.y + Math.sin(m.angle) * 58).setRotation(m.angle);
        }
        const frames = Phaser.Math.Clamp((now - this.last) / (1000 / 60), 0, 3);
        this.last = now;
        this.alpha = Math.min(0.8, this.alpha + 0.05);
        this.rig.setVisible(true).setAlpha(this.alpha);
        this.rig.draw({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, facing: p.f < 0 ? -1 : 1, frames, turn: 0.12 });
        this.ring.setPosition(p.x, p.y).setVisible(true).setAlpha(this.alpha);
    }

    destroy() {
        this.rig?.destroy();
        for (const o of [this.icon, this.arrow, this.ring, this.iconRing, this.help]) o.destroy();
    }
}
