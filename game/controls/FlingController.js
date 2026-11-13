import Phaser from 'phaser';
import ControllerBase from './ControllerBase.js';
import { CAT } from '../Pufferfish.js';

const PADDLE_R = 62;
const PADDLE_MAX_SPEED = 40;
const THROW_GAIN = 1.0; // 1 = fish leaves exactly at finger speed

/**
 * Air-hockey controls. Two ways to move the fish, no modes to pick:
 *   - Touch the FISH and drag: it sticks to the finger; let go mid-swipe and it
 *     keeps flying that way (direct fling).
 *   - Touch the WATER: the finger becomes a paddle that shoves the fish when it
 *     runs into it.
 * A quick tap on the fish puffs.
 */
export default class FlingController extends ControllerBase {
    enter() {
        this.pointer = null;
        this.mode = null; // 'grab' | 'paddle'
        this.paddle = null;
        this.samples = [];
        this.pressAt = 0;
        this.pressPos = new Phaser.Math.Vector2();

        this.paddleGfx = this.scene.add.circle(0, 0, PADDLE_R, 0xffffff, 0.07)
            .setStrokeStyle(3, 0xffffff, 0.3).setVisible(false);
        this.grabGfx = this.scene.add.circle(0, 0, 10, 0xffffff, 0)
            .setStrokeStyle(3, 0xffffff, 0.3).setVisible(false);
        this.world.add([this.paddleGfx, this.grabGfx]);
        this.hint('Fisch anfassen & werfen · oder mit dem Finger schubsen · Doppeltipp = aufblasen');

        this.listen(this.scene.input, 'pointerdown', this.onDown);
        this.listen(this.scene.input, 'pointerup', this.onUp);
    }

    onDown(pointer) {
        if (this.pointer || this.overHud(pointer)) return;
        this.pointer = pointer;
        this.pressAt = this.scene.time.now;
        this.pressPos.set(pointer.x, pointer.y);
        const p = this.worldPoint(pointer);

        if (p.distance(this.fish.pos) < this.fish.radius * 1.35) {
            this.mode = 'grab';
            this.grabGfx.setVisible(true);
        } else {
            this.mode = 'paddle';
            this.paddle = this.scene.matter.add.circle(p.x, p.y, PADDLE_R, {
                ignoreGravity: true, frictionAir: 0, restitution: 0.9, mass: 60,
                collisionFilter: { category: CAT.PADDLE, mask: CAT.FISH }
            });
            this.paddleGfx.setPosition(p.x, p.y).setVisible(true);
        }
    }

    onUp(pointer) {
        if (pointer !== this.pointer) return;
        if (this.mode === 'grab') {
            const moved = this.pressPos.distance(new Phaser.Math.Vector2(pointer.x, pointer.y));
            if (moved > 18) this.fish.throwAt(this.fingerVelocity());
        }
        this.release();
    }

    /** Finger velocity over the last ~100 ms, in px per physics step. */
    fingerVelocity() {
        const s = this.samples;
        if (s.length < 2) return new Phaser.Math.Vector2(0, 0);
        const a = s[0], b = s[s.length - 1];
        const dt = Math.max(b.t - a.t, 16);
        return new Phaser.Math.Vector2(b.x - a.x, b.y - a.y).scale(THROW_GAIN * (1000 / 60) / dt);
    }

    release() {
        this.samples = [];
        if (this.paddle) { this.scene.matter.world.remove(this.paddle); this.paddle = null; }
        this.paddleGfx.setVisible(false);
        this.grabGfx.setVisible(false);
        this.pointer = null;
        this.mode = null;
    }

    update() {
        if (!this.pointer) return;
        if (!this.pointer.isDown) { this.release(); return; }
        const p = this.worldPoint(this.pointer);
        const now = this.scene.time.now;
        this.samples.push({ t: now, x: p.x, y: p.y });
        while (this.samples.length > 2 && now - this.samples[0].t > 100) this.samples.shift();

        if (this.mode === 'grab') {
            this.fish.dragTo(p);
        } else if (this.paddle) {
            // Drive the paddle by velocity so the physics engine transfers momentum.
            const v = p.clone().subtract(new Phaser.Math.Vector2(this.paddle.position.x, this.paddle.position.y));
            if (v.length() > PADDLE_MAX_SPEED) v.setLength(PADDLE_MAX_SPEED);
            this.scene.matter.body.setVelocity(this.paddle, { x: v.x, y: v.y });
        }
    }

    draw() {
        if (this.mode === 'grab') {
            this.grabGfx.setPosition(this.fish.view.x, this.fish.view.y).setRadius(this.fish.radius + 12);
        } else if (this.paddle && this.pointer) {
            // Follow the finger directly so the paddle looks smooth; the physics
            // body trails it by a step.
            const p = this.worldPoint(this.pointer);
            this.paddleGfx.setPosition(p.x, p.y);
        }
    }

    destroy() {
        this.release();
        super.destroy();
    }
}
