import Phaser from 'phaser';
import ControllerBase from './ControllerBase.js';
import SteerAssist from './SteerAssist.js';
import { ASSIST, steersDown } from './assist.js';
import { EDGE, edgeAim, inEdge } from './edgeAim.js';

const BAND_FULL = 520; // finger distance at which the pull is at full strength
const BAND_GAIN = 1.35; // thrust at full pull

/**
 * Touch steering, two ways in one scheme (user 2026-11-14: "Tippen and Ränder very similar, merge,
 * more robust"). Where the touch starts decides, and it stays that way until the finger lifts:
 *
 * - In the picture: rubber band. The fish is pulled toward the finger as if tied to it by an
 *   elastic band, further away pulls harder. Let go and it brakes and stays about at that depth.
 * - On the left or right edge strip: that edge is an up-down slider for a resting thumb. Left edge
 *   swims left, right edge right; the middle is level at full speed, the corners straight up or
 *   down (edgeAim). Let go and the fish glides on and holds its depth.
 *
 * A step in the way is climbed either way (SteerAssist).
 */
export default class TapToMoveController extends ControllerBase {
    enter() {
        const W = this.scene.scale.width, H = this.scene.scale.height, w = Math.round(W * EDGE.gauge);
        this.held = null; this.onEdge = false; this.glide = false;
        this.aim = new Phaser.Math.Vector2();
        this.assist = new SteerAssist(this.scene, this.fish);
        // Two faint gauges along the edges: where a thumb can rest, and a dot where it is now.
        const top = H * EDGE.top, mid = (top + H) / 2;
        this.gaugeX = [w / 2, W - w / 2];
        for (const x of this.gaugeX) {
            this.ui.add([
                this.scene.add.rectangle(x, mid, w, (H - top) * 0.94, 0xffffff, 0.05).setStrokeStyle(2, 0xffffff, 0.12),
                this.scene.add.rectangle(x, mid, w * 0.7, 3, 0xffffff, 0.25)]);
        }
        this.dot = this.scene.add.circle(0, 0, 30, 0xffffff, 0.22).setStrokeStyle(3, 0xffffff, 0.4).setVisible(false);
        this.ui.add(this.dot);
        this.hint(this.de ? `Halten = zum Finger schwimmen · am Rand halten = lenken · Doppeltipp = ${this.specialWord()}`
            : `Hold = swim to your finger · hold an edge = steer · double tap = ${this.specialWord()}`);

        this.listen(this.scene.input, 'pointerdown', this.onDown);
        this.listen(this.scene.input, 'pointermove', this.onMove);
        this.listen(this.scene.input, 'pointerup', this.onUp);
        this.listen(this.scene.game.events, 'blur', this.release);
    }

    onDown(pointer) {
        if (this.held || this.overHud(pointer)) return;
        this.held = pointer;
        this.onEdge = inEdge(pointer.x, pointer.y, this.scene.scale.width, this.scene.scale.height);
        this.onMove(pointer);
    }

    onMove(pointer) {
        if (pointer !== this.held || !this.onEdge) return;
        const W = this.scene.scale.width, H = this.scene.scale.height, a = edgeAim(pointer.x, pointer.y, W, H);
        this.aim.set(a.x, a.y);
        this.dot.setPosition(this.gaugeX[pointer.x < W / 2 ? 0 : 1], Phaser.Math.Clamp(pointer.y, H * EDGE.top, H * 0.97)).setVisible(true);
    }

    onUp(pointer) {
        if (this.held === pointer) this.release();
    }

    release() {
        this.glide = this.onEdge;      // after the edge the fish glides on; after the band it brakes
        this.held = null; this.onEdge = false;
        this.dot.setVisible(false);
    }

    update(dt = 1000 / 60) {
        if (this.held && !this.held.isDown) this.release();
        this.assist.ease(dt);
        if (!this.held) { this.assist.rest(!this.glide); return; }
        if (this.onEdge) { this.assist.pull(this.aim, 1, 1, this.aim.y > ASSIST.hold.diveDir); return; }

        const pos = this.fish.pos, to = this.worldPoint(this.held).subtract(pos), dist = to.length();
        if (dist > this.fish.radius * 0.6) {
            // Toward the finger, as hard as the band is stretched; a finger well below the fish means "dive".
            const dive = steersDown(pos.y + to.y, pos.y);
            this.assist.pull(to.normalize(), Phaser.Math.Clamp(dist / BAND_FULL, 0, 1), BAND_GAIN, dive);
        } else {
            this.fish.brake();
        }
    }
}
