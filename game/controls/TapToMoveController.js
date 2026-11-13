import ControllerBase from './ControllerBase.js';

/**
 * Move-to-tapped-location. Tap (or hold and drag) the water and the fish swims
 * there. Tap ON the fish to puff.
 */
export default class TapToMoveController extends ControllerBase {
    enter() {
        this.target = null;
        this.held = null;
        this.marker = this.scene.add.circle(0, 0, 26, 0xffffff, 0)
            .setStrokeStyle(5, 0xffffff, 0.7).setVisible(false);
        this.world.add(this.marker);
        this.hint('Tippen = hinschwimmen · Fisch antippen = aufblasen');

        this.listen(this.scene.input, 'pointerdown', this.onDown);
        this.listen(this.scene.input, 'pointermove', this.onMove);
        this.listen(this.scene.input, 'pointerup', this.onUp);
    }

    onDown(pointer, currentlyOver) {
        if (this.overHud(currentlyOver)) return;
        const p = this.worldPoint(pointer);
        if (p.distance(this.fish.pos) < this.fish.radius * 1.4) { this.fish.puff(); return; }
        this.held = pointer;
        this.setTarget(p);
    }

    onMove(pointer) {
        if (this.held === pointer && pointer.isDown) this.setTarget(this.worldPoint(pointer));
    }

    onUp(pointer) {
        if (this.held === pointer) this.held = null;
    }

    setTarget(p) {
        this.target = p;
        this.marker.setPosition(p.x, p.y).setVisible(true);
    }

    update() {
        if (!this.target) return;
        if (this.fish.seekTo(this.target) < 14 && !this.held) {
            this.target = null;
            this.marker.setVisible(false);
        }
    }
}
