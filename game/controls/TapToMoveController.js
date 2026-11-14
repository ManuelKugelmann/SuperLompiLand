import Phaser from 'phaser';
import ControllerBase from './ControllerBase.js';
import SteerAssist from './SteerAssist.js';
import { steersDown } from './assist.js';

const BAND_FULL = 520; // finger distance at which the pull is at full strength
const BAND_GAIN = 1.35; // thrust at full pull

/**
 * Rubber band. Touch and hold: the fish is pulled toward the finger as if tied
 * to it by an elastic band — further away pulls harder. Let go and it brakes to
 * a stop and stays about at that depth. A step in the way is climbed (SteerAssist).
 */
export default class TapToMoveController extends ControllerBase {
    enter() {
        this.held = null;
        this.assist = new SteerAssist(this.scene, this.fish);
        this.hint(this.de ? `Halten = Gummiband zum Finger · Loslassen = bremsen · Doppeltipp = ${this.specialWord()}`
            : `Hold = rubber band to your finger · let go = brake · double tap = ${this.specialWord()}`);

        this.listen(this.scene.input, 'pointerdown', this.onDown);
        this.listen(this.scene.input, 'pointerup', this.onUp);
    }

    onDown(pointer) {
        if (!this.held && !this.overHud(pointer)) this.held = pointer;
    }

    onUp(pointer) {
        if (this.held === pointer) this.held = null;
    }

    update(dt = 1000 / 60) {
        if (this.held && !this.held.isDown) this.held = null;
        this.assist.ease(dt);
        if (!this.held) { this.assist.rest(true); return; }

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
