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
        this.band = this.scene.add.graphics();
        this.world.add(this.band);
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
        this.band.clear();
        if (this.held && !this.held.isDown) this.held = null;
        if (!this.held) { this.fish.brake(); return; }

        const target = this.worldPoint(this.held);
        const to = target.clone().subtract(this.fish.pos);
        const dist = to.length();
        const pull = Phaser.Math.Clamp(dist / BAND_FULL, 0, 1);
        if (dist > this.fish.radius * 0.6) this.fish.thrust(to.normalize().scale(pull * 1.35));
        else this.fish.brake();

        this.band.lineStyle(4 + pull * 8, 0xffffff, 0.25 + pull * 0.45);
        this.band.lineBetween(this.fish.sprite.x, this.fish.sprite.y, target.x, target.y);
        this.band.fillStyle(0xffffff, 0.55).fillCircle(target.x, target.y, 16);
    }
}
