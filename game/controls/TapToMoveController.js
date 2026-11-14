import Phaser from 'phaser';
import ControllerBase from './ControllerBase.js';
import { ASSIST, slideDir, climbForce, holdLift, restDepth, steersDown, levelThrust, easeRest } from './assist.js';
import { ROUTE } from '../level/density.js';

const BAND_FULL = 520; // finger distance at which the pull is at full strength

/**
 * Rubber band. Touch and hold: the fish is pulled toward the finger as if tied
 * to it by an elastic band — further away pulls harder. Let go and it brakes to
 * a stop and stays about at that depth. A step in the way is climbed (assist.js).
 */
export default class TapToMoveController extends ControllerBase {
    enter() {
        this.held = null;
        this.restY = null;      // the depth the fish holds when it is let go
        this.resting = false;   // let go right now
        this.dived = false;     // during this pull the finger was well below the fish: the player steered down
        this.chosen = false;    // the depth held now was chosen by a dive (it is kept; any other sinks no further than near the lane)
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

    update(dt = 1000 / 60) {
        if (this.held && !this.held.isDown) this.held = null;
        // A depth the player did not choose, far below the calm lane, rises gently back toward it.
        const pos = this.fish.pos;
        this.restY = easeRest(this.restY, this.scene.level.field.routeY(pos.x) + ROUTE.halfWidth, this.chosen, dt / 1000);
        if (!this.held) {
            this.fish.brake();
            // Let go: it stays where it was, instead of sinking away while the child looks around.
            if (!this.resting) { this.resting = true; this.chosen = this.dived; this.restY = restDepth(this.fish.pos.y, this.restY, this.dived); this.dived = false; }
            const lift = this.fish.inAir ? 0 : holdLift(this.fish.pos.y, this.restY);
            if (lift > 0) this.fish.thrust(this.up.set(0, -lift));
            return;
        }
        this.resting = false;

        const to = this.worldPoint(this.held).subtract(this.fish.pos);
        const dist = to.length();
        if (steersDown(this.fish.pos.y + to.y, this.fish.pos.y)) this.dived = true;
        if (dist > this.fish.radius * 0.6) {
            // Toward the finger; a step or ledge straight in the way is climbed along its face.
            const d = slideDir(this.fish.pos, to.normalize(), (x, y) => this.scene.level.isOpen(x, y, 0), this.pull);
            // A climb is a steady pull, not a launch: once the fish rises fast enough it gets no more.
            const pull = d.climbing ? climbForce(this.fish.body.velocity.y) : Phaser.Math.Clamp(dist / BAND_FULL, 0, 1);
            this.fish.thrust(to.set(d.x, d.y).scale(pull * 1.35));
            // Pointing sideways means "go there", not "and keep flying up": speed up or down that came from a slope or a current is damped.
            const level = this.fish.inAir || d.climbing ? 0 : levelThrust(d.y, this.fish.body.velocity.y);
            if (level) this.fish.thrust(this.up.set(0, level));
            // A level pull keeps the held depth too (the hold does not only act once the finger is lifted).
            const lift = this.fish.inAir || d.climbing || this.dived || this.restY === null || Math.abs(d.y) >= ASSIST.lane.level ? 0 : holdLift(pos.y, this.restY);
            if (lift > 0) this.fish.thrust(this.up.set(0, -lift));
        } else {
            this.fish.brake();
        }
    }
}
