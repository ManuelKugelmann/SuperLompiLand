import Phaser from 'phaser';
import ControllerBase from './ControllerBase.js';

/**
 * Floating virtual stick. Press anywhere, drag to swim in that direction.
 * A quick tap (no drag) fires the puff special.
 */
export default class VirtualStickController extends ControllerBase {
    enter() {
        const H = this.scene.scale.height;
        this.base = new Phaser.Math.Vector2(300, H - 300);
        this.R = 150;
        this.vec = new Phaser.Math.Vector2(0, 0);
        this.active = false;
        this.pointerId = null;
        this.pressAt = 0;
        this.pressPos = new Phaser.Math.Vector2();

        this.ring = this.scene.add.circle(this.base.x, this.base.y, this.R, 0xffffff, 0.08)
            .setStrokeStyle(6, 0xffffff, 0.35);
        this.thumb = this.scene.add.circle(this.base.x, this.base.y, 62, 0xffc266, 0.85)
            .setStrokeStyle(5, 0xffffff, 0.6);
        this.ui.add([this.ring, this.thumb]);
        this.hint('Ziehen = schwimmen · Doppeltipp = aufblasen');

        this.listen(this.scene.input, 'pointerdown', this.onDown);
        this.listen(this.scene.input, 'pointermove', this.onMove);
        this.listen(this.scene.input, 'pointerup', this.onUp);
    }

    onDown(pointer) {
        if (this.active || this.overHud(pointer)) return;
        this.active = true;
        this.pointerId = pointer.id;
        this.pressAt = this.scene.time.now;
        this.pressPos.set(pointer.x, pointer.y);
        this.base.set(pointer.x, pointer.y);
        this.ring.setPosition(this.base.x, this.base.y);
        this.thumb.setPosition(this.base.x, this.base.y);
    }

    onMove(pointer) {
        if (!this.active || pointer.id !== this.pointerId) return;
        const d = new Phaser.Math.Vector2(pointer.x - this.base.x, pointer.y - this.base.y);
        if (d.length() > this.R) d.setLength(this.R);
        this.thumb.setPosition(this.base.x + d.x, this.base.y + d.y);
        this.vec.set(d.x / this.R, d.y / this.R);
    }

    onUp(pointer) {
        if (!this.active || pointer.id !== this.pointerId) return;
        this.active = false;
        this.pointerId = null;
        this.vec.set(0, 0);
        this.thumb.setPosition(this.base.x, this.base.y);
    }

    update() {
        if (this.active && this.vec.length() > 0.05) this.fish.thrust(this.vec);
    }
}
