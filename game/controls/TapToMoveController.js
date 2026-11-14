import Phaser from 'phaser';
import ControllerBase from './ControllerBase.js';
import { slideDir, climbForce, holdLift } from './assist.js';

const BAND_FULL = 520; // finger distance at which the pull is at full strength

/**
 * Rubber band. Touch and hold: the fish is pulled toward the finger as if tied
 * to it by an elastic band — further away pulls harder. Let go and it brakes to
 * a stop and stays about at that depth. A step in the way is climbed (assist.js).
 */
export default class TapToMoveController extends ControllerBase {
    enter() {
        this.held = null;
        this.restY = null;      // the depth at which the fish was let go (held there until the next touch)
        this.pull = { x: 0, y: 0, climbing: false };
        this.up = new Phaser.Math.Vector2(0, -1);
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

    update() {
        if (this.held && !this.held.isDown) this.held = null;
        if (!this.held) {
            this.fish.brake();
            // Let go: it stays where it was, instead of sinking away while the child looks around.
            if (this.restY === null) this.restY = this.fish.pos.y;
            const lift = this.fish.inAir ? 0 : holdLift(this.fish.pos.y, this.restY);
            if (lift > 0) this.fish.thrust(this.up.set(0, -lift));
            return;
        }
        this.restY = null;

        const to = this.worldPoint(this.held).subtract(this.fish.pos);
        const dist = to.length();
        if (dist > this.fish.radius * 0.6) {
            // Toward the finger; a step or ledge straight in the way is climbed along its face.
            const d = slideDir(this.fish.pos, to.normalize(), (x, y) => this.scene.level.isOpen(x, y, 0), this.pull);
            // A climb is a steady pull, not a launch: once the fish rises fast enough it gets no more.
            const pull = d.climbing ? climbForce(this.fish.body.velocity.y) : Phaser.Math.Clamp(dist / BAND_FULL, 0, 1);
            this.fish.thrust(to.set(d.x, d.y).scale(pull * 1.35));
        } else {
            this.fish.brake();
        }
    }
}
