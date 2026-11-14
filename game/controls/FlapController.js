import Phaser from 'phaser';
import ControllerBase from './ControllerBase.js';
import SteerAssist from './SteerAssist.js';
import { play } from '../audio.js';

const KICK = 10.5; // velocity added per tap at full deflection
const LONG_PRESS_MS = 380;

/**
 * Tap-rhythm swimming. Every tap is one fin stroke:
 *   - WHERE you tap sets the direction: left/right half = left/right,
 *     upper/lower = up/down (analog — further from the centre = stronger).
 *   - HOW FAST you tap sets the speed.
 * Tap on the fish to puff.
 */
export default class FlapController extends ControllerBase {
    enter() {
        const W = this.scene.scale.width, H = this.scene.scale.height;
        this.center = new Phaser.Math.Vector2(W / 2, H / 2);

        this.hint(this.de ? `Schnell tippen = schnell schwimmen · Tipp-Ort = Richtung · lange halten = ${this.specialWord()}`
            : `Tap fast = swim fast · where you tap = direction · long press = ${this.specialWord()}`);
        this.held = null;
        this.assist = new SteerAssist(this.scene, this.fish);

        this.listen(this.scene.input, 'pointerdown', this.onDown);
    }

    onDown(pointer) {
        if (this.overHud(pointer)) return;
        this.held = pointer;
        this.heldSince = this.scene.time.now;
        const dir = new Phaser.Math.Vector2(
            Phaser.Math.Clamp((pointer.x - this.center.x) / (this.center.x * 0.6), -1, 1),
            Phaser.Math.Clamp((pointer.y - this.center.y) / (this.center.y * 0.6), -1, 1)
        );
        // A stroke against a step goes up along it (the shared wall slide), as strong as the tap asked for.
        const len = Math.min(1, dir.length());
        if (len > 0) { const d = this.assist.aim(dir.normalize()); dir.set(d.x, d.y); }
        this.fish.launch(dir.scale(len * KICK));
        play('flap');
    }

    update() {
        // Long press = puff (rapid taps are swimming here, so no double tap).
        if (!this.held) return;
        if (!this.held.isDown) { this.held = null; return; }
        if (this.scene.time.now - this.heldSince > LONG_PRESS_MS) {
            this.fish.special();
            this.held = null;
        }
    }
}
