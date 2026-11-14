import Phaser from 'phaser';
import SteerAssist from './SteerAssist.js';
import { ASSIST } from './assist.js';
import { EDGE, edgeAim } from './edgeAim.js';
import ControllerBase from './ControllerBase.js';

/**
 * Edge steering (user 2026-11-14): the left and right edges of the screen are two up-down sliders.
 * Touch on the right half swims right, on the left half swims left; the touch's height steers:
 * the middle is level at full speed, the corners straight up or down (edgeAim). Let go and the
 * fish glides on and holds its depth (the shared steering help).
 */
export default class EdgeController extends ControllerBase {
    enter() {
        const W = this.scene.scale.width, H = this.scene.scale.height, w = Math.round(W * EDGE.gauge);
        this.assist = new SteerAssist(this.scene, this.fish);
        this.pointerId = null;
        this.aim = new Phaser.Math.Vector2();
        // Two faint gauges along the edges: where to put the thumbs, and a dot where it is now.
        this.gauges = [w / 2, W - w / 2].map(x => {
            const top = H * EDGE.top, mid = (top + H) / 2;
            const bar = this.scene.add.rectangle(x, mid, w, (H - top) * 0.94, 0xffffff, 0.05).setStrokeStyle(2, 0xffffff, 0.12);
            const line = this.scene.add.rectangle(x, mid, w * 0.7, 3, 0xffffff, 0.25);
            this.ui.add([bar, line]);
            return bar;
        });
        this.dot = this.scene.add.circle(0, 0, 30, 0xffffff, 0.22).setStrokeStyle(3, 0xffffff, 0.4).setVisible(false);
        this.ui.add(this.dot);
        this.hint(this.de ? 'Rechts oder links halten = schwimmen · hoch und runter am Rand = lenken' : 'Hold right or left = swim · up and down along the edge = steer');
        this.listen(this.scene.input, 'pointerdown', this.onDown);
        this.listen(this.scene.input, 'pointermove', this.onMove);
        this.listen(this.scene.input, 'pointerup', this.onUp);
        this.listen(this.scene.game.events, 'blur', this.release);
    }

    /** The ghost finger shows the right edge, at its middle. */
    demoAnchor() { const H = this.scene.scale.height; return [this.scene.scale.width - this.scene.scale.width * EDGE.gauge / 2, (H * EDGE.top + H) / 2]; }

    onDown(pointer) {
        if (this.pointerId !== null || this.overHud(pointer)) return;
        this.pointerId = pointer.id;
        this.onMove(pointer);
    }

    onMove(pointer) {
        if (pointer.id !== this.pointerId) return;
        const W = this.scene.scale.width, H = this.scene.scale.height, a = edgeAim(pointer.x, pointer.y, W, H);
        this.aim.set(a.x, a.y);
        const gx = pointer.x < W / 2 ? this.gauges[0].x : this.gauges[1].x;
        this.dot.setPosition(gx, Phaser.Math.Clamp(pointer.y, H * EDGE.top, H * 0.97)).setVisible(true);
    }

    onUp(pointer) {
        if (pointer.id === this.pointerId) this.release();
    }

    release() {
        this.pointerId = null;
        this.dot.setVisible(false);
    }

    update(dt = 1000 / 60) {
        if (this.pointerId !== null && !this.scene.input.manager.pointers.some(p => p.id === this.pointerId && p.isDown)) this.release();
        this.assist.ease(dt);
        if (this.pointerId !== null) this.assist.pull(this.aim, 1, 1, this.aim.y > ASSIST.hold.diveDir);
        else this.assist.rest(false);      // let go: glide on, the depth is held
    }
}
