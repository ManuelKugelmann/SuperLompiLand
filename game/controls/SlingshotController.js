import Phaser from 'phaser';
import ControllerBase from './ControllerBase.js';

/**
 * Slingshot / Angry-Birds style. Press near the fish, pull back to aim, release
 * to launch it the opposite way. Time slows while aiming for a clean shot.
 */
export default class SlingshotController extends ControllerBase {
    enter() {
        this.dragging = false;
        this.start = new Phaser.Math.Vector2();
        this.maxPull = 420;
        this.power = 0.09; // pull distance -> launch velocity

        this.aim = this.scene.add.graphics().setDepth(39);
        this.ui.add(this.aim);

        this.hint = this.scene.add.text(this.scene.scale.width / 2, this.scene.scale.height - 90,
            'Fisch zurückziehen & loslassen = schleudern', {
                fontFamily: 'Arial', fontSize: '28px', color: '#ffffff'
            }).setOrigin(0.5).setAlpha(0.6).setDepth(41);
        this.ui.add(this.hint);

        this.listen(this.scene.input, 'pointerdown', this.onDown);
        this.listen(this.scene.input, 'pointermove', this.onMove);
        this.listen(this.scene.input, 'pointerup', this.onUp);
    }

    onDown(pointer, currentlyOver) {
        if (this.overHud(currentlyOver)) return;
        const p = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
        if (p.distance(this.fish.pos) > this.fish.radius * 2.2) return;
        this.dragging = true;
        this.start.copy(this.fish.pos);
        this.scene.matter.world.engine.timing.timeScale = 0.35; // aim slow-mo
        this.hint.setAlpha(0);
    }

    onMove(pointer) {
        if (!this.dragging) return;
        this.drawAim(new Phaser.Math.Vector2(pointer.worldX, pointer.worldY));
    }

    onUp(pointer) {
        if (!this.dragging) return;
        this.dragging = false;
        this.scene.matter.world.engine.timing.timeScale = 1;
        this.aim.clear();

        const pull = this.fish.pos.clone().subtract(
            new Phaser.Math.Vector2(pointer.worldX, pointer.worldY));
        if (pull.length() > this.maxPull) pull.setLength(this.maxPull);
        this.fish.launch(pull.scale(this.power));
    }

    drawAim(pointer) {
        const pull = this.fish.pos.clone().subtract(pointer);
        if (pull.length() > this.maxPull) pull.setLength(this.maxPull);
        const tip = this.fish.pos.clone().add(pull);
        const strength = pull.length() / this.maxPull;
        const col = Phaser.Display.Color.GetColor(255, Math.round(200 * (1 - strength)), 60);

        this.aim.clear();
        this.aim.lineStyle(10, col, 0.9);
        this.aim.lineBetween(this.fish.pos.x, this.fish.pos.y, tip.x, tip.y);
        // predicted launch direction (opposite the pull)
        const launch = this.fish.pos.clone().subtract(pull);
        this.aim.lineStyle(6, 0xffffff, 0.4);
        this.aim.lineBetween(this.fish.pos.x, this.fish.pos.y, launch.x, launch.y);
        this.aim.fillStyle(col, 1).fillCircle(tip.x, tip.y, 14);
    }

    destroy() {
        this.scene.matter.world.engine.timing.timeScale = 1; // never leave slowed
        super.destroy();
    }
}
