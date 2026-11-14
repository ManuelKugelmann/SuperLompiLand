import Phaser from 'phaser';
import SteerAssist from './SteerAssist.js';
import { ASSIST, stickLift, stickSmooth } from './assist.js';
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
        this.aim = new Phaser.Math.Vector2();
        this.lift = 0;      // the stick's smoothed up or down part
        this.assist = new SteerAssist(this.scene, this.fish);
        this.active = false;
        this.pointerId = null;
        this.pressAt = 0;
        this.pressPos = new Phaser.Math.Vector2();

        this.ring = this.scene.add.circle(this.base.x, this.base.y, this.R, 0xffffff, 0.04)
            .setStrokeStyle(3, 0xffffff, 0.16);
        this.thumb = this.scene.add.circle(this.base.x, this.base.y, 54, 0xffffff, 0.16)
            .setStrokeStyle(3, 0xffffff, 0.28);
        this.ui.add([this.ring, this.thumb]);
        this.hint(this.de ? `Ziehen = schwimmen · Doppeltipp = ${this.specialWord()}` : `Drag = swim · double tap = ${this.specialWord()}`);

        this.listen(this.scene.input, 'pointerdown', this.onDown);
        this.listen(this.scene.input, 'pointermove', this.onMove);
        this.listen(this.scene.input, 'pointerup', this.onUp);
        // Losing the window (another app, a system dialog) lets go of the stick too.
        this.listen(this.scene.game.events, 'blur', this.recenter);
    }

    /** The ghost finger shows the stick at its resting ring. */
    demoAnchor() { return [this.base.x, this.base.y]; }

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
        this.recenter();
    }

    /** Let go: the thumb springs back to the middle and the fish gets no more push. */
    recenter() {
        this.active = false;
        this.pointerId = null;
        this.vec.set(0, 0);
        this.thumb.setPosition(this.base.x, this.base.y);
    }

    update(dt = 1000 / 60) {
        // A press can also end without any event reaching us (the pointer was taken away by
        // the system): the pointer itself knows whether it is still down.
        if (this.active && !this.scene.input.manager.pointers.some(p => p.id === this.pointerId && p.isDown)) this.recenter();
        // The stick's direction with the shared steering help: steps climbed, the depth held when the thumb lets go.
        this.assist.ease(dt);
        const len = this.vec.length();
        // Up and down are calmer than the thumb: level within a dead band, turned down beyond it, and smoothed (ASSIST.stick).
        this.lift = stickSmooth(this.lift, this.active ? stickLift(this.vec.x, this.vec.y) : 0, dt / 1000);
        if (this.active && len > 0.05) {
            const aim = this.aim.set(this.vec.x, this.lift), strength = Math.min(1, Math.max(len, aim.length()));
            if (aim.lengthSq() < 1e-6) aim.set(this.fish.facing, 0);      // straight up or down inside the smoothing's first moment: keep going the way it faces
            aim.normalize();
            this.assist.pull(aim, strength, 1, aim.y > ASSIST.hold.diveDir);
        } else this.assist.rest(false);      // no brake: the stick lets the fish glide on
    }
}
