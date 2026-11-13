import Phaser from 'phaser';
import { CHARACTERS, MOTION, glideLift, skim } from './characters.js';
import { FLIGHT, fly } from './flight.js';
import { SPECIALS, canUse, chainStep } from './specials.js';
import Rig from './Rig.js';
import { play } from './audio.js';

/** Tunables — physics feel is adjusted here (velocities are px per physics step). */
export const PLAYER = {
    // Momentum ("ballistic" feel): little water drag, so a push carries far; less thrust, so
    // the top speed stays the same but it takes longer to get going and to turn; a gentle
    // brake, so letting go means coasting. The puff is the real brake.
    // First step: thrust 0.0013 -> 0.00078, waterDrag 1 -> 0.6, brake 0.9 -> 0.975, bounce x1.5.
    // Second step (higher top speed, same acceleration): waterDrag 0.6 -> 0.43, maxSpeed 26 -> 36.
    thrust: 0.00078,       // swim force per unit mass; terminal swim speed ~ thrust * 278 / (drag * waterDrag)
    ...MOTION,             // waterDrag, airDrag, airGravity (shared with the network prediction)
    bounce: 1.5,           // multiplier on every state's bounciness off rock (capped at 0.9)
    maxSpeed: 36,
    brake: 0.975,          // velocity kept per step while braking
    turnRate: 0.2,         // radians per step the nose turns toward the travel direction
    mass: 6,
    hoverLift: 0.00012,    // upward force per unit mass while holding a pose (hover in place)
    sinkForce: 0.00012,    // what the world gravity does to a swimmer, per unit mass (used to cancel part of it)
    airTurn: 0.009,        // ballistic flight: radians per step the path can be bent (bird flight: see flight.js)
    shoveRadius: 340,
    shovePower: 16
};

// Tuning on a device without a rebuild: ?tune=waterDrag:0.5,thrust:0.0009,brake:0.98
// overrides any number in PLAYER for this page load.
if (typeof window !== 'undefined') {
    for (const pair of (new URLSearchParams(window.location.search).get('tune') || '').split(',')) {
        const [key, value] = pair.split(':');
        if (key in PLAYER && Number.isFinite(Number(value))) PLAYER[key] = Number(value);
    }
    // Short form for the one number tried most: ?drag=0.4
    const drag = Number(new URLSearchParams(window.location.search).get('drag'));
    if (drag > 0) PLAYER.waterDrag = drag;
}

export const CAT = { WORLD: 1, PLAYER: 2 };

/**
 * A playable character: body, water/air movement, health reactions and the
 * special move. Everything that differs between characters is data
 * (characters.js, specials.js); the look is a Rig. Control schemes drive it
 * ONLY through this API:
 *   thrust(dir)   steady swim force (dir length 0..1)
 *   launch(vec)   one-shot velocity kick
 *   special()     the character's special move (data in specials.js)
 */
export default class Player {
    /** @param character one entry of CHARACTERS (movement profile, art, special) */
    constructor(scene, x, y, character = CHARACTERS[0]) {
        this.scene = scene;
        this.char = character;
        this.states = character.states;   // collision size and water feel per state
        const m = (k, d = 1) => character[k] ?? d;
        this.move = {
            thrust: PLAYER.thrust * m('thrust'), maxSpeed: PLAYER.maxSpeed * m('maxSpeed'), drag: m('drag'),
            turn: PLAYER.turnRate * m('turn'), airGravity: PLAYER.airGravity * m('airGravity'),
            airTurn: PLAYER.airTurn * m('airTurn'), sink: m('sink')
        };
        this.state = 'normal';
        this.poseLeft = 0;      // ms left in a special's pose
        this.poseCooldown = 0;  // cooldown that starts when the pose ends
        this.cooldown = 0;
        this.skips = 0;         // wave tops skipped off in the current flight
        this.steer = { x: 0, y: 0, steps: 0 };   // steering input for the flight model, and how many steps it lasts
        this.wings = {};        // scratch for the flight model
        this.mode = null;       // a special's temporary behaviour: { left, drag, sink, flow, bounce, tuck }
        this.hold = null;       // { x, y } rock the character holds on to (anchor special)
        this.findHold = null;   // set by the scene: reach -> { x, y } to hold on to, or null
        this.chain = { count: 0, left: 0 };   // uses of a chained special so far, ms left to continue
        this.shield = 0;        // ms hazards cannot hurt
        this.guard = 0;         // ms fully protected (not even pushed)
        this.invulnerable = 0;  // ms without damage
        this.inAir = false;
        // Velocity of the water around the player (currents, bubble columns), set by
        // the scene. Being carried by the water must never turn the body around:
        // it points where it SWIMS, i.e. along its velocity relative to the water.
        this.flow = new Phaser.Math.Vector2(0, 0);
        this.squash = 0;        // >0 = stretched along the travel direction, <0 = squashed; springs back
        this.pushed = 0;        // ms left during which a knock-back must not turn the body
        this.steered = false;   // set by the scene while keyboard input is active
        this.effort = 0;
        this.boost = 1;         // speed multiplier set by the scene (swimming in a school)
        this.makeRoom = null;   // set by the scene: radius -> { x, y, moved } with open water for that size, or null

        // `rig` is what you see. `sprite` is the physics body (invisible, advanced
        // in fixed 60 Hz steps); the rig is drawn every frame at a position
        // interpolated between the last two steps, so motion is smooth at any refresh rate.
        this.rig = new Rig(scene, character, x, y);
        this.sprite = scene.matter.add.sprite(x, y, this.rig.view.texture.key).setVisible(false);
        this.aura = scene.add.circle(x, y, 80, 0xfff3b0, 0.12).setStrokeStyle(5, 0xfff3b0, 0.8).setDepth(4.9).setVisible(false);
        this.prev = new Phaser.Math.Vector2(x, y);
        this.cur = new Phaser.Math.Vector2(x, y);
        this.applyState('normal');
    }

    get view() { return this.rig.view; }
    get facing() { return this.rig.facing; }
    get posed() { return this.state !== 'normal'; }
    get body() { return this.sprite.body; }
    get pos() { return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y); }
    get radius() { return this.states[this.state].radius; }

    applyState(name) {
        const s = this.states[name];
        const sp = this.sprite;
        const vel = sp.body ? { x: sp.body.velocity.x, y: sp.body.velocity.y } : { x: 0, y: 0 };
        this.state = name;

        this.rig.setState(name);
        this.view.setAlpha(1);
        // Rebuild the collision circle AT THE CURRENT PLACE. Phaser would otherwise
        // put the new body where the sprite was last positioned by hand (the
        // start point), teleporting the fish there on every puff.
        const at = sp.body ? { x: sp.body.position.x, y: sp.body.position.y } : { x: sp.x, y: sp.y };
        sp.setScale(1);
        sp.setBody({ type: 'circle', radius: s.radius, x: at.x, y: at.y });
        sp.setFixedRotation()
            .setMass(PLAYER.mass)
            .setFrictionAir(this.waterDrag())
            .setBounce(this.mode?.bounce ?? Math.min(0.9, s.bounce * PLAYER.bounce))
            .setFriction(0.02)
            .setCollisionCategory(CAT.PLAYER)
            .setCollidesWith([CAT.WORLD]);
        sp.setVelocity(vel.x, vel.y);
    }

    /** Resistance of the medium the body is in right now (a special's mode can change it). */
    waterDrag() {
        if (this.inAir) return FLIGHT.model === 'bird' && this.posed ? FLIGHT.brakeDrag : PLAYER.airDrag;
        return Math.min(0.5, this.states[this.state].air * this.move.drag * PLAYER.waterDrag * (this.mode?.drag ?? 1));
    }

    /** A special changes how the body behaves for a while (see `mode` in specials.js); null ends it. */
    setMode(mode) {
        this.mode = mode ? { ...mode, left: mode.ms } : null;
        this.sprite.setFrictionAir(this.waterDrag())
            .setBounce(this.mode?.bounce ?? Math.min(0.9, this.states[this.state].bounce * PLAYER.bounce));
    }

    thrust(dir) {
        if (this.hold) return;                 // holding on to a rock: no swimming until it lets go
        if (this.inAir) { this.airSteer(dir, 1); return; }
        this.sprite.applyForce(dir.clone().scale(this.move.thrust * this.boost * this.body.mass));
        this.effort = Math.min(1, this.effort + dir.length() * 0.25);
    }

    /**
     * Limited control in the air: input only bends the flight path toward `dir`,
     * it never adds speed. `strength` scales how far it may turn this step.
     */
    airSteer(dir, strength) {
        if (FLIGHT.model === 'bird') {
            // The wings do the turning in update(); a one-shot kick keeps steering for a few steps.
            const len = dir.length();
            if (len > 0.0001) { this.steer.x = dir.x / len * Math.min(1, len); this.steer.y = dir.y / len * Math.min(1, len); this.steer.steps = strength; }
            return;
        }
        const v = this.body.velocity;
        const speed = Math.hypot(v.x, v.y);
        if (speed < 0.5 || dir.lengthSq() < 0.0001) return;
        const heading = Math.atan2(v.y, v.x);
        const want = Phaser.Math.Angle.Wrap(Math.atan2(dir.y, dir.x) - heading);
        const max = this.move.airTurn * Math.min(1, dir.length()) * strength;
        const a = heading + Phaser.Math.Clamp(want, -max, max);
        this.sprite.setVelocity(Math.cos(a) * speed, Math.sin(a) * speed);
    }

    /** Actively slow down (call every step while braking). */
    brake() {
        if (this.inAir || this.steered) return; // never fight a jump or other input
        const v = this.body.velocity;
        this.sprite.setVelocity(v.x * PLAYER.brake, v.y * PLAYER.brake);
    }

    launch(vec) {
        if (this.inAir) { this.airSteer(vec, 6); return; } // a kick in the air only steers
        const v = new Phaser.Math.Vector2(this.body.velocity.x + vec.x, this.body.velocity.y + vec.y);
        if (v.length() > this.move.maxSpeed) v.setLength(this.move.maxSpeed);
        this.sprite.setVelocity(v.x, v.y);
    }

    /** Put the body somewhere at once (respawn, pop out of rock); the velocity stays. */
    place(x, y) {
        const v = this.body.velocity, vx = v.x, vy = v.y;
        this.sprite.setPosition(x, y).setVelocity(vx, vy);
        this.prev.set(x, y);
        this.cur.set(x, y);
        this.rig.view.grid.halo.fresh = true;
    }

    /** The character's special move (double tap / long press / Space). See specials.js. */
    special() {
        if (this.posed) { this.endPose(); return; }       // using it again ends a held pose early
        const sp = SPECIALS[this.char.special];
        if (!canUse(sp, this)) return;
        const v = this.body.velocity;
        // A special that holds on to rock asks the scene for a spot within its reach.
        const spot = sp.reach && !this.hold ? this.findHold?.(sp.reach) : null;
        const fx = sp.start({ vx: v.x, vy: v.y, facing: this.facing, inAir: this.inAir, holding: !!this.hold, canHold: !!spot });
        if (fx.hold) this.hold = spot;
        if (fx.release) this.hold = null;
        if (fx.mode) this.setMode(fx.mode);
        // A chained special (the sprint) counts its uses and rests after the last one.
        const step = chainStep(sp, this.chain);
        this.chain.count = step.count; this.chain.left = step.left;
        this.cooldown = step.cooldown;
        if (fx.pose && this.states[fx.pose]) {
            // A bigger pose needs room: move into open water first, or do not start it.
            const room = this.makeRoom ? this.makeRoom(this.states[fx.pose].radius) : this.pos;
            if (!room) return;
            if (room.moved) this.place(room.x, room.y);
            this.applyState(fx.pose);
            this.poseLeft = fx.poseMs;
            this.poseCooldown = sp.endCooldown ?? 0;
        }
        this.sprite.setVelocity(fx.vx, fx.vy);
        this.guard = Math.max(this.guard, fx.guard ?? 0);
        this.shield = Math.max(this.shield, fx.shield ?? 0);
        this.invulnerable = Math.max(this.invulnerable, fx.invulnerable ?? 0);
        if (fx.squash) this.squash = fx.squash;
        if (fx.shove) this.shove();
        play(fx.sound ?? 'special');
        this.scene.events.emit('fish-special', { x: this.sprite.x, y: this.sprite.y, kind: this.char.special });
        this.burst(fx.burst ?? 'ring', fx);
    }

    /** What a special looks like the moment it starts: every one has its own picture. */
    burst(kind, fx) {
        const s = this.scene, x = this.sprite.x, y = this.sprite.y, color = fx.color ?? 0xffffff;
        if (kind === 'ring') {
            const ring = s.add.circle(x, y, this.radius, color, 0.4).setDepth(4);
            s.tweens.add({ targets: ring, scale: fx.ring ?? 2.6, alpha: 0, duration: 400, onComplete: () => ring.destroy() });
        } else if (kind === 'spines') {
            // A ring of spines stands up all around and fades.
            for (let i = 0; i < 14; i++) {
                const a = (i / 14) * Math.PI * 2, r = this.radius * 0.9;
                const spine = s.add.triangle(x + Math.cos(a) * r, y + Math.sin(a) * r, 0, -5, 0, 5, 46, 0, color, 0.9).setRotation(a).setDepth(4.2);
                s.tweens.add({ targets: spine, x: x + Math.cos(a) * (r + 70), y: y + Math.sin(a) * (r + 70), alpha: 0, scaleX: 1.5, duration: 520, ease: 'Quad.easeOut', onComplete: () => spine.destroy() });
            }
        } else if (kind === 'ripple' && s.textures.exists('bd_glow')) {
            // Light, not bubbles: a soft glow swells out and fades.
            const glow = s.add.image(x, y, 'bd_glow').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.2).setAlpha(0.85)
                .setDisplaySize(this.radius * 1.6, this.radius * 1.6);
            s.tweens.add({ targets: glow, scale: glow.scale * 4, alpha: 0, duration: 620, ease: 'Sine.easeOut', onComplete: () => glow.destroy() });
        }
    }

    /** Leave a special's pose (back to the normal look and size). */
    endPose() {
        if (!this.posed) return;
        this.applyState('normal');
        play('deflate');
        this.poseLeft = 0;
        this.cooldown = this.poseCooldown;
    }

    /** Push loose bodies around the player away. */
    shove() {
        const origin = this.pos;
        for (const b of this.scene.matter.world.localWorld.bodies) {
            if (b === this.body || b.isStatic) continue;
            const d = new Phaser.Math.Vector2(b.position.x - origin.x, b.position.y - origin.y);
            const dist = d.length();
            if (dist > 0.1 && dist < PLAYER.shoveRadius) {
                const push = d.normalize().scale((1 - dist / PLAYER.shoveRadius) * PLAYER.shovePower);
                this.scene.matter.body.setVelocity(b, { x: b.velocity.x + push.x, y: b.velocity.y + push.y });
            }
        }
    }

    /** Hazard contact. Returns true if it hurt (normal state, not invulnerable). */
    hit(from) {
        if (this.guard > 0 || this.shield > 0) return false; // fully protected: not even pushed
        const away = this.pos.subtract(from);
        if (away.lengthSq() < 1) away.set(0, -1);
        away.setLength(this.posed ? 15 : 11);
        this.sprite.setVelocity(away.x, away.y);
        this.pushed = 450;
        if (this.posed || this.invulnerable > 0) return false;
        this.invulnerable = 1200;
        this.scene.tweens.add({
            targets: this.view, alpha: 0.35, duration: 110, yoyo: true, repeat: 4,
            onComplete: () => this.view.setAlpha(1)
        });
        return true;
    }

    /** @param {number} dt ms  @param {number} waterY world y of the water surface at the fish */
    update(dt, waterY = -Infinity) {
        if (this.cooldown > 0) this.cooldown -= dt;
        if (this.mode) {
            this.mode.left -= dt;
            if (this.mode.sink && !this.inAir) this.sprite.applyForce({ x: 0, y: PLAYER.sinkForce * this.mode.sink * this.body.mass });
            if (this.mode.tuck) this.squash = -this.mode.tuck;
            if (this.mode.left <= 0) this.setMode(null);
        }
        if (this.hold) {
            // Holding on: pulled firmly to the spot, whatever the water does.
            this.sprite.setVelocity((this.hold.x - this.sprite.x) * 0.25, (this.hold.y - this.sprite.y) * 0.25);
        }
        if (this.chain.left > 0) this.chain.left -= dt;
        if (this.invulnerable > 0) this.invulnerable -= dt;

        // Water <-> air. In the air: no drag, real gravity, hardly any control.
        // Hysteresis, so a fish bobbing right at the waterline does not flip between
        // air and water (and splash) every few frames.
        const inAir = this.inAir ? this.sprite.y < waterY + 10 : this.sprite.y < waterY - 16;
        if (inAir !== this.inAir) {
            this.inAir = inAir;
            if (!inAir) this.skips = 0;
            this.sprite.setFrictionAir(this.waterDrag());
            if (inAir) this.hold = null;
            this.scene.events.emit('fish-splash', {
                x: this.sprite.x, y: waterY, speed: Math.hypot(this.body.velocity.x, this.body.velocity.y), entering: !inAir
            });
        }
        if (this.inAir) {
            // Wings carry part of the weight while the flight is fast (also of the world's own
            // gravity), and a gliding character skips off wave tops instead of diving in.
            const bv = this.body.velocity;
            if (FLIGHT.model === 'bird') {
                // Bird flight (flight.js): input turns the heading, wings carry part of the weight,
                // a dive gains speed. A held pose (the puffed ball) has no wings: it brakes and drops.
                const on = this.steer.steps > 0 && !this.posed;
                const w = this.posed ? null : fly({
                    vx: bv.x, vy: bv.y, ix: on ? this.steer.x : 0, iy: on ? this.steer.y : 0,
                    gravity: this.move.airGravity + PLAYER.sinkForce,
                    lift: this.char.glide?.lift, agility: this.move.airTurn / PLAYER.airTurn
                }, FLIGHT, this.wings);
                this.steer.steps--;
                if (w && on) this.sprite.setVelocity(w.vx, w.vy);
                this.sprite.applyForce({ x: (w ? w.ax : 0) * this.body.mass, y: (this.move.airGravity + (w ? w.ay : 0)) * this.body.mass });
            } else {
                const lift = glideLift(this.char, bv.x);
                this.sprite.applyForce({ x: 0, y: (this.move.airGravity * (1 - lift) - PLAYER.sinkForce * lift) * this.body.mass });
            }
            const hop = skim(this.char, { vx: bv.x, vy: bv.y, height: waterY - this.sprite.y, skips: this.skips });
            if (hop) {
                this.skips++;
                this.sprite.setVelocity(hop.vx, hop.vy);
                this.scene.events.emit('fish-splash', { x: this.sprite.x, y: waterY, speed: 4, entering: false });
            }
        }
        // Light swimmers sink less than the world gravity alone would make them.
        else if (this.move.sink < 1) this.sprite.applyForce({ x: 0, y: -PLAYER.sinkForce * (1 - this.move.sink) * this.body.mass });
        if (this.shield > 0) this.shield -= dt;
        if (this.guard > 0) this.guard -= dt;
        if (this.pushed > 0) this.pushed -= dt;

        if (this.posed) {
            if (!this.inAir) this.sprite.applyForce({ x: 0, y: -PLAYER.hoverLift * this.body.mass });
            this.poseLeft -= dt;
            if (this.poseLeft <= 0) this.endPose();
        }
        const vel = this.body.velocity;
        const speed = Math.hypot(vel.x, vel.y);
        const top = this.move.maxSpeed * this.boost;
        if (speed > top) {
            this.sprite.setVelocity(vel.x * top / speed, vel.y * top / speed);
        }
    }

    /** Call right after each physics step: remembers the last two positions. */
    afterStep() {
        this.prev.copy(this.cur);
        this.cur.set(this.sprite.x, this.sprite.y);
    }

    /**
     * Draw this frame. `alpha` = how far we are between the last two physics
     * steps (0..1), `frames` = elapsed time in 60 Hz steps.
     */
    render(alpha, frames) {
        // A knock-back or the water carrying the body must not turn it around.
        const bv = this.body.velocity, held = this.pushed > 0;
        this.squash *= Math.pow(0.86, frames);
        this.effort = Math.max(0, this.effort - 0.035 * frames);
        this.rig.draw({
            x: Phaser.Math.Linear(this.prev.x, this.cur.x, alpha),
            y: Phaser.Math.Linear(this.prev.y, this.cur.y, alpha),
            vx: held ? 0 : bv.x - this.flow.x, vy: held ? 0 : bv.y - this.flow.y,
            frames, effort: this.effort, squash: this.squash, turn: this.move.turn,
            flowX: this.flow.x, flowY: this.flow.y
        });
        // Protective glow while a shield or the short puff invincibility is active.
        const safe = this.shield > 0 || this.guard > 0;
        this.aura.setVisible(safe);
        if (safe) {
            this.aura.setPosition(this.view.x, this.view.y).setRadius(this.radius + 16)
                .setAlpha(0.35 + 0.2 * Math.sin(this.rig.phase * 1.7));
        }
    }
}
