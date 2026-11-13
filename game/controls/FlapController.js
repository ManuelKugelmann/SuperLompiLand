import Phaser from 'phaser';
import ControllerBase from './ControllerBase.js';

const KICK = 10.5; // velocity added per tap at full deflection

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
        cross.lineStyle(4, 0xffffff, 0.12);
        cross.lineBetween(W / 2, 140, W / 2, H - 40);
        cross.lineBetween(40, H / 2, W - 40, H / 2);
        this.ui.add(cross);
        this.hint('Schnell tippen = schnell schwimmen · Tipp-Ort = Richtung');

        this.listen(this.scene.input, 'pointerdown', this.onDown);
    }

    onDown(pointer, currentlyOver) {
        if (this.overHud(currentlyOver)) return;
        if (this.worldPoint(pointer).distance(this.fish.pos) < this.fish.radius * 1.3) {
            this.fish.puff();
            return;
        }
        const dir = new Phaser.Math.Vector2(
            Phaser.Math.Clamp((pointer.x - this.center.x) / (this.center.x * 0.6), -1, 1),
            Phaser.Math.Clamp((pointer.y - this.center.y) / (this.center.y * 0.6), -1, 1)
        );
        if (dir.length() > 1) dir.normalize();
        this.fish.launch(dir.scale(KICK));

        const dot = this.scene.add.circle(pointer.x, pointer.y, 30, 0xffffff, 0.35);
        this.ui.add(dot);
        this.scene.tweens.add({ targets: dot, scale: 2.4, alpha: 0, duration: 300, onComplete: () => dot.destroy() });
    }
}
