import Phaser from 'phaser';
import ControllerBase from './ControllerBase.js';

const BAND_FULL = 520; // finger distance at which the pull is at full strength

/**
 * Rubber band. Touch and hold: the fish is pulled toward the finger as if tied
 * to it by an elastic band — further away pulls harder. Let go and it brakes to
 * a stop.
 */
export default class TapToMoveController extends ControllerBase {
    enter() {
        this.held = null;
        this.hint('Halten = Gummiband zum Finger · Loslassen = bremsen · Doppeltipp = aufblasen');

        this.listen(this.scene.input, 'pointerdown', this.onDown);
        this.listen(this.scene.input, 'pointerup', this.onUp);
    }

    onDown(pointer) {
        if (!this.held && !this.overHud(pointer)) this.held = pointer;
    }

    onUp(pointer) {
        if (this.held === pointer) this.held = null;
    }

    update() {
        if (this.held && !this.held.isDown) this.held = null;
        if (!this.held) { this.fish.brake(); return; }

        const to = this.worldPoint(this.held).subtract(this.fish.pos);
        const dist = to.length();
        if (dist > this.fish.radius * 0.6) {
            this.fish.thrust(to.normalize().scale(Phaser.Math.Clamp(dist / BAND_FULL, 0, 1) * 1.35));
        } else {
            this.fish.brake();
        }
    }
}
