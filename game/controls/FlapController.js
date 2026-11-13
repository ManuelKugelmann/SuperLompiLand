import Phaser from 'phaser';
import ControllerBase from './ControllerBase.js';

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

        const cross = this.scene.add.graphics();
        cross.lineStyle(2, 0xffffff, 0.06);
        cross.lineBetween(W / 2, 140, W / 2, H - 40);
        cross.lineBetween(40, H / 2, W - 40, H / 2);
        this.ui.add(cross);
        this.hint('Schnell tippen = schnell schwimmen · Tipp-Ort = Richtung · lange halten = aufblasen');
        this.held = null;

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
        if (dir.length() > 1) dir.normalize();
        this.fish.launch(dir.scale(KICK));

        const dot = this.scene.add.circle(pointer.x, pointer.y, 22, 0xffffff, 0.16);
        this.ui.add(dot);
        this.scene.tweens.add({ targets: dot, scale: 2.4, alpha: 0, duration: 300, onComplete: () => dot.destroy() });
    }

    update() {
        // Long press = puff (rapid taps are swimming here, so no double tap).
        if (!this.held) return;
        if (!this.held.isDown) { this.held = null; return; }
        if (this.scene.time.now - this.heldSince > LONG_PRESS_MS) {
            this.fish.puff();
            this.held = null;
        }
    }
}
