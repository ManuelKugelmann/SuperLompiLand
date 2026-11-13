import Phaser from 'phaser';
import ControllerBase from './ControllerBase.js';

/**
 * Move-to-clicked-location. Tap the water and the fish swims there (with arrival
 * easing). Tap ON the fish to fire the puff special.
 */
export default class TapToMoveController extends ControllerBase {
    enter() {
        this.target = null;
        this.marker = this.scene.add.circle(0, 0, 26, 0xffffff, 0)
            .setStrokeStyle(5, 0xffffff, 0.7).setDepth(6).setVisible(false);
        this.ui.add(this.marker);

        this.hint = this.scene.add.text(this.scene.scale.width / 2, this.scene.scale.height - 90,
            'Tippen = hinschwimmen · Fisch antippen = aufblasen', {
                fontFamily: 'Arial', fontSize: '28px', color: '#ffffff'
            }).setOrigin(0.5).setAlpha(0.6).setDepth(41);
        this.ui.add(this.hint);

        this.listen(this.scene.input, 'pointerdown', this.onDown);
    }

    onDown(pointer, currentlyOver) {
        if (this.overHud(currentlyOver)) return;
        const p = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
        if (p.distance(this.fish.pos) < this.fish.radius * 1.6) {
            this.fish.puff();
            return;
        }
        this.target = p;
        this.marker.setPosition(p.x, p.y).setVisible(true).setScale(1).setAlpha(1);
        this.scene.tweens.add({ targets: this.marker, scale: 1.6, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });
    }

    update() {
        if (!this.target) return;
        const dist = this.fish.seekTo(this.target);
        if (dist < 12) {
            this.target = null;
            this.scene.tweens.killTweensOf(this.marker);
            this.marker.setVisible(false);
        }
    }
}
