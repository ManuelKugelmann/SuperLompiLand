import Phaser from 'phaser';
import { ASSIST, slideDir, climbForce, holdLift, restDepth, levelThrust, easing, easeRest } from './assist.js';
import { ROUTE } from '../level/density.js';

/**
 * The steering help of assist.js applied to the fish, for any control scheme that steers by a
 * direction: steps in the way are climbed, speed up or down the player did not ask for is
 * damped, and the depth the fish was left at is held (never ratcheting deeper, and easing back
 * toward the calm lane when the player did not dive there). The scheme says where the player
 * points; this turns it into thrust through the Player's own API.
 */
export default class SteerAssist {
    constructor(scene, fish) {
        this.scene = scene; this.fish = fish;
        this.restY = null;      // the depth the fish holds when nothing is steered
        this.resting = false;   // nothing is steered right now
        this.dived = false;     // during this pull the player steered down on purpose
        this.chosen = false;    // the depth held now was chosen by a dive (kept; any other eases back toward the lane)
        this.easing = false;    // the held depth is on its way back up to the lane
        this.dir = { x: 0, y: 0, climbing: false };
        this.v = new Phaser.Math.Vector2();
        this.isOpen = (x, y) => this.scene.level.isOpen(x, y, 0);
    }

    /** Once per step, before pull() or rest(): a depth the player did not choose, far below the calm lane, rises gently back toward it. */
    ease(dt) {
        const pos = this.fish.pos;
        const laneBottom = this.scene.level.field.routeY(pos.x) + ROUTE.halfWidth;
        this.easing = easing(this.restY, laneBottom, this.chosen, this.easing);
        if (this.easing) this.restY = easeRest(this.restY, laneBottom, dt / 1000);
    }

    /** The direction to kick or pull in: `dir` (unit vector) turned up along a step that is in the way. Returns { x, y, climbing }. */
    aim(dir) {
        return slideDir(this.fish.pos, dir, this.isOpen, this.dir);
    }

    /**
     * The player points along `dir` (unit vector) with `strength` (0..1); `gain` = the scheme's
     * own thrust at full strength; `dive` = the player steers down on purpose.
     */
    pull(dir, strength, gain, dive) {
        const fish = this.fish, vy = fish.body.velocity.y;
        this.resting = false;
        if (dive) this.dived = true;
        const d = this.aim(dir);
        // A climb is a steady pull, not a launch: once the fish rises fast enough it gets no more.
        fish.thrust(this.v.set(d.x, d.y).scale((d.climbing ? climbForce(vy) : strength) * gain));
        if (fish.inAir || d.climbing) return;
        // Pointing sideways means "go there", not "and keep flying up": speed up or down that came from a slope or a current is damped.
        const level = levelThrust(d.y, vy);
        if (level) fish.thrust(this.v.set(0, level));
        // A level pull keeps the held depth too.
        const lift = this.dived || this.restY === null || Math.abs(d.y) >= ASSIST.lane.level ? 0 : holdLift(fish.pos.y, this.restY);
        if (lift > 0) fish.thrust(this.v.set(0, -lift));
    }

    /** Nothing is steered: the fish stays where it was instead of sinking away. `brake` = the scheme stops it too. */
    rest(brake) {
        const fish = this.fish;
        if (brake) fish.brake();
        if (!this.resting) { this.resting = true; this.chosen = this.dived; this.restY = restDepth(fish.pos.y, this.restY, this.dived); this.dived = false; }
        const lift = fish.inAir ? 0 : holdLift(fish.pos.y, this.restY);
        if (lift > 0) fish.thrust(this.v.set(0, -lift));
    }
}
