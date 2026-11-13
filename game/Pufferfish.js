import Phaser from 'phaser';
import { CHARACTERS } from './characters.js';
import { play } from './audio.js';

/** Tunables — physics feel is adjusted here (velocities are px per physics step). */
export const FISH = {
    thrust: 0.0013,        // terminal swim speed ~ thrust * 278 / drag        // swim force per unit mass
    maxSpeed: 26,
    carrySpeed: 16,        // top speed while being carried by a finger
    brake: 0.9,
    alignFrom: 3,          // below this speed the fish stays level
    alignFull: 8,          // from this speed it fully points along its movement
    finFlapMin: 7,         // side fin swing in degrees when idle ...
    finFlapMore: 14,       // ... plus this much at full effort (kept small: the retouch under the fin is rough)
    wiggleSegments: 12,    // strips the sprite is cut into for the swim animation
    turnRate: 0.2,         // radians per step the nose turns toward the travel direction            // velocity kept per step while braking
    mass: 6,
    inflateMs: 2600,
    puffGuardMs: 1300,     // invincibility right after puffing up
    cooldownMs: 500,
    hoverLift: 0.00012,
    sinkForce: 0.00012,    // what the world gravity does to a fish, per unit mass (used to cancel part of it)    // cancels the sink while inflated (hover in place)     // upward force per unit mass while inflated
    airGravity: 0.0011,    // extra downward force per unit mass above the water
    airDrag: 0.0015,        // almost no drag in the air
    airTurn: 0.009,        // radians per step the flight path can be bent in the air (no speed gain)
    shoveRadius: 340,
    shovePower: 16
};

/** Lompi's looks double as the fallback for any character whose art is missing. */
const DEFAULT_STATES = CHARACTERS[0].states;

export const CAT = { WORLD: 1, FISH: 2, PADDLE: 4 };

/**
 * The player. Control schemes drive it ONLY through this API:
 *   thrust(dir)   steady swim force (dir length 0..1)
 *   dragTo(point) follow a finger (grab) — release keeps the velocity = fling
 *   launch(vec)   one-shot velocity kick
 *   puff()        toggle the inflated state
 */
export default class Pufferfish {
    /** @param character one entry of CHARACTERS (movement profile, art, special) */
    constructor(scene, x, y, character = CHARACTERS[0]) {
        this.scene = scene;
        this.char = character;
        // States = looks + collision size. Missing art falls back to Lompi's.
        this.states = {};
        for (const [name, st] of Object.entries(character.states)) {
            this.states[name] = scene.textures.exists(st.key) ? st : { ...st, key: DEFAULT_STATES.normal.key };
        }
        const m = (k, d = 1) => character[k] ?? d;
        this.move = {
            thrust: FISH.thrust * m('thrust'), maxSpeed: FISH.maxSpeed * m('maxSpeed'), drag: m('drag'),
            turn: FISH.turnRate * m('turn'), airGravity: FISH.airGravity * m('airGravity'),
            airTurn: FISH.airTurn * m('airTurn'), sink: m('sink')
        };
        this.shield = 0;
        this.state = 'normal';
        this.inflateLeft = 0;
        this.cooldown = 0;
        this.invulnerable = 0;
        this.inAir = false;
        // Velocity of the water around the fish (currents, bubble columns), set by
        // the scene. Being carried by the water must never turn the fish around:
        // it points where it SWIMS, i.e. along its velocity relative to the water.
        this.flow = new Phaser.Math.Vector2(0, 0);
        this.squash = 0;        // >0 = stretched along the travel direction, <0 = squashed; springs back
        this.pushed = 0;        // ms left during which a knock-back must not turn the fish
        this.steered = false;   // set by the scene while keyboard input is active
        this.facing = 1;        // 1 = right, -1 = left

        ensureFallbackTextures(scene);
        // `sprite` is the physics body (invisible, advanced in fixed 60 Hz steps).
        // `view` is what you see: drawn every frame at a position interpolated
        // between the last two physics steps, so motion is smooth at any refresh rate.
        this.sprite = scene.matter.add.sprite(x, y, this.states.normal.key).setVisible(false);
        // One bendable strip-mesh per state: the tail end is waved for the fin /
        // swim animation (see render()).
        this.views = {};
        for (const [name, s] of Object.entries(this.states)) {
            // With the layered art (body without side fin + the fin on its own)
            // the fin flaps separately; otherwise the single image is used as is.
            const pivot = scene.cache.json.get('fins')?.[s.key];
            const layered = !!pivot && scene.textures.exists(`${s.key}_body`) && scene.textures.exists(`${s.key}_fin`);
            const rope = scene.add.rope(x, y, layered ? `${s.key}_body` : s.key, null, FISH.wiggleSegments, true)
                .setDepth(5).setVisible(false);
            rope.baseScale = s.width / rope.frame.width;
            if (layered) {
                const fin = scene.add.image(x, y, `${s.key}_fin`).setDepth(5.1).setVisible(false);
                fin.setOrigin((pivot.pivotX - pivot.finX) / fin.width, (pivot.pivotY - pivot.finY) / fin.height);
                // fin joint relative to the body centre, in texture pixels
                fin.jointX = pivot.pivotX - rope.frame.width / 2;
                fin.jointY = pivot.pivotY - rope.frame.height / 2;
                fin.tail = 1 - pivot.pivotX / rope.frame.width; // 1 = at the tail end
                rope.fin = fin;
            }
            this.views[name] = rope;
        }
        this.view = this.views.normal;
        this.swimPhase = 0;
        this.guard = 0;         // ms of invincibility left after a puff
        this.aura = scene.add.circle(x, y, 80, 0xfff3b0, 0.12).setStrokeStyle(5, 0xfff3b0, 0.8).setDepth(4.9).setVisible(false);
        this.effort = 0;
        this.prev = new Phaser.Math.Vector2(x, y);
        this.cur = new Phaser.Math.Vector2(x, y);
        this.applyState('normal');
    }

    get body() { return this.sprite.body; }
    get pos() { return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y); }
    get radius() { return this.states[this.state].radius; }
    get inflated() { return this.state === 'inflated'; }

    applyState(name) {
        const s = this.states[name];
        const sp = this.sprite;
        const vel = sp.body ? { x: sp.body.velocity.x, y: sp.body.velocity.y } : { x: 0, y: 0 };
        this.state = name;

        const old = this.view;
        this.view = this.views[name];
        this.view.setPosition(old.x, old.y).setRotation(old.rotation).setAlpha(1).setVisible(true);
        if (old !== this.view) { old.setVisible(false); old.fin?.setVisible(false); }
        this.view.fin?.setVisible(true);
        // Rebuild the collision circle AT THE CURRENT PLACE. Phaser would otherwise
        // put the new body where the sprite was last positioned by hand (the
        // start point), teleporting the fish there on every puff.
        const at = sp.body ? { x: sp.body.position.x, y: sp.body.position.y } : { x: sp.x, y: sp.y };
        sp.setScale(1);
        sp.setBody({ type: 'circle', radius: s.radius, x: at.x, y: at.y });
        sp.setFixedRotation()
            .setMass(FISH.mass)
            .setFrictionAir(this.inAir ? FISH.airDrag : s.air * this.move.drag)
            .setBounce(s.bounce)
            .setFriction(0.02)
            .setCollisionCategory(CAT.FISH)
            .setCollidesWith([CAT.WORLD, CAT.PADDLE]);
        sp.setVelocity(vel.x, vel.y);
    }

    thrust(dir) {
        if (this.inAir) { this.airSteer(dir, 1); return; }
        this.sprite.applyForce(dir.clone().scale(this.move.thrust * this.body.mass));
        this.effort = Math.min(1, this.effort + dir.length() * 0.25);
    }

    /**
     * Limited control in the air: input only bends the flight path toward `dir`,
     * it never adds speed. `strength` scales how far it may turn this step.
     */
    airSteer(dir, strength) {
        const v = this.body.velocity;
        const speed = Math.hypot(v.x, v.y);
        if (speed < 0.5 || dir.lengthSq() < 0.0001) return;
        const heading = Math.atan2(v.y, v.x);
        const want = Phaser.Math.Angle.Wrap(Math.atan2(dir.y, dir.x) - heading);
        const max = this.move.airTurn * Math.min(1, dir.length()) * strength;
        const a = heading + Phaser.Math.Clamp(want, -max, max);
        this.sprite.setVelocity(Math.cos(a) * speed, Math.sin(a) * speed);
    }

    dragTo(point) {
        if (this.inAir) return; // cannot be carried through the air
        const v = point.clone().subtract(this.pos).scale(0.22);
        if (v.length() > FISH.carrySpeed) v.setLength(FISH.carrySpeed);
        this.sprite.setVelocity(v.x, v.y);
    }

    /** Actively slow down (call every step while braking). */
    brake() {
        if (this.inAir || this.steered) return; // never fight a jump or other input
        const v = this.body.velocity;
        this.sprite.setVelocity(v.x * FISH.brake, v.y * FISH.brake);
    }

    /** Replace the velocity outright (release of a grab = the throw). */
    throwAt(vec) {
        const v = vec.clone();
        if (v.length() > this.move.maxSpeed) v.setLength(this.move.maxSpeed);
        this.sprite.setVelocity(v.x, v.y);
    }

    launch(vec) {
        if (this.inAir) { this.airSteer(vec, 6); return; } // a kick in the air only steers
        const v = new Phaser.Math.Vector2(this.body.velocity.x + vec.x, this.body.velocity.y + vec.y);
        if (v.length() > this.move.maxSpeed) v.setLength(this.move.maxSpeed);
        this.sprite.setVelocity(v.x, v.y);
    }

    /** The character's special move (double tap / long press / Space). */
    puff() {
        const kind = this.char.special;
        if (kind !== 'puff' || !this.states.inflated) { this.special(kind); return; }
        if (this.inflated) { this.deflate(); return; }
        if (this.cooldown > 0) return;
        this.applyState('inflated');
        this.squash = -0.3;
        play('puff');
        this.inflateLeft = FISH.inflateMs;
        // Air brake: puffing up stops the fish where it is (in the water).
        if (!this.inAir) this.sprite.setVelocity(this.body.velocity.x * 0.08, this.body.velocity.y * 0.08);
        this.guard = FISH.puffGuardMs;

        // Shove loose bodies away + ring flash.
        const origin = this.pos;
        for (const b of this.scene.matter.world.localWorld.bodies) {
            if (b === this.body || b.isStatic) continue;
            const d = new Phaser.Math.Vector2(b.position.x - origin.x, b.position.y - origin.y);
            const dist = d.length();
            if (dist > 0.1 && dist < FISH.shoveRadius) {
                const push = d.normalize().scale((1 - dist / FISH.shoveRadius) * FISH.shovePower);
                this.scene.matter.body.setVelocity(b, { x: b.velocity.x + push.x, y: b.velocity.y + push.y });
            }
        }
        const ring = this.scene.add.circle(origin.x, origin.y, this.radius, 0xffffff, 0.4).setDepth(4);
        this.scene.tweens.add({ targets: ring, scale: 3.2, alpha: 0, duration: 420, onComplete: () => ring.destroy() });
        this.scene.events.emit('fish-puff', origin);
    }

    special(kind) {
        if (this.cooldown > 0) return;
        const v = this.body.velocity;
        const ahead = Math.hypot(v.x, v.y) > 1
            ? new Phaser.Math.Vector2(v.x, v.y).normalize()
            : new Phaser.Math.Vector2(this.facing, 0);
        let color = 0xffffff;
        if (kind === 'dash') {                      // burst forward
            if (this.inAir) return;
            this.sprite.setVelocity(v.x + ahead.x * 15, v.y + ahead.y * 15);
            this.invulnerable = Math.max(this.invulnerable, 350);
            this.cooldown = 900;
        } else if (kind === 'leap') {               // launch up and forward, made for breaking the surface
            if (this.inAir) return;
            this.sprite.setVelocity(v.x + this.facing * 9, Math.min(v.y, 0) - 17);
            this.cooldown = 1100;
        } else if (kind === 'pulse') {              // jellyfish pump
            if (this.inAir) return;
            this.sprite.setVelocity(v.x * 0.6, Math.min(v.y, 0) - 13);
            this.cooldown = 500;
        } else if (kind === 'shield') {             // hazards cannot hurt for a while
            this.shield = 2600;
            this.cooldown = 4200;
            color = 0xffe08a;
        } else {
            return;
        }
        play('special');
        const ring = this.scene.add.circle(this.sprite.x, this.sprite.y, this.radius, color, 0.4).setDepth(4);
        this.scene.tweens.add({ targets: ring, scale: 2.6, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
    }

    deflate() {
        if (!this.inflated) return;
        this.applyState('normal');
        play('deflate');
        this.inflateLeft = 0;
        this.cooldown = FISH.cooldownMs;
    }

    /** Hazard contact. Returns true if it hurt (normal state, not invulnerable). */
    hit(from) {
        if (this.guard > 0 || this.shield > 0) return false; // fully protected: not even pushed
        const away = this.pos.subtract(from);
        if (away.lengthSq() < 1) away.set(0, -1);
        away.setLength(this.inflated ? 15 : 11);
        this.sprite.setVelocity(away.x, away.y);
        this.pushed = 450;
        if (this.inflated || this.invulnerable > 0) return false;
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
        if (this.invulnerable > 0) this.invulnerable -= dt;

        // Water <-> air. In the air: no drag, real gravity, hardly any control.
        // Hysteresis, so a fish bobbing right at the waterline does not flip between
        // air and water (and splash) every few frames.
        const inAir = this.inAir ? this.sprite.y < waterY + 10 : this.sprite.y < waterY - 16;
        if (inAir !== this.inAir) {
            this.inAir = inAir;
            this.sprite.setFrictionAir(inAir ? FISH.airDrag : this.states[this.state].air * this.move.drag);
            this.scene.events.emit('fish-splash', {
                x: this.sprite.x, y: waterY, speed: Math.hypot(this.body.velocity.x, this.body.velocity.y), entering: !inAir
            });
        }
        if (this.inAir) this.sprite.applyForce({ x: 0, y: this.move.airGravity * this.body.mass });
        // Light swimmers sink less than the world gravity alone would make them.
        else if (this.move.sink < 1) this.sprite.applyForce({ x: 0, y: -FISH.sinkForce * (1 - this.move.sink) * this.body.mass });
        if (this.shield > 0) this.shield -= dt;
        if (this.guard > 0) this.guard -= dt;
        if (this.pushed > 0) this.pushed -= dt;

        if (this.inflated) {
            if (!this.inAir) this.sprite.applyForce({ x: 0, y: -FISH.hoverLift * this.body.mass });
            this.inflateLeft -= dt;
            if (this.inflateLeft <= 0) this.deflate();
        }
        const vel = this.body.velocity;
        const speed = Math.hypot(vel.x, vel.y);
        if (speed > this.move.maxSpeed) {
            this.sprite.setVelocity(vel.x * this.move.maxSpeed / speed, vel.y * this.move.maxSpeed / speed);
        }
    }

    /** Call right after each physics step: remembers the last two positions. */
    afterStep() {
        this.prev.copy(this.cur);
        this.cur.set(this.sprite.x, this.sprite.y);
    }

    /**
     * Draw the fish for this frame. `alpha` = how far we are between the last
     * two physics steps (0..1), `frames` = elapsed time in 60 Hz steps.
     */
    render(alpha, frames) {
        this.view.setPosition(
            Phaser.Math.Linear(this.prev.x, this.cur.x, alpha),
            Phaser.Math.Linear(this.prev.y, this.cur.y, alpha));

        // Orientation depends on speed: slow = level, just hovering up and down;
        // faster = the nose follows the movement vector. The art faces right;
        // heading left it is mirrored vertically so it never swims belly-up.
        const bv = this.body.velocity;
        const v = this.pushed > 0 ? { x: 0, y: 0 } : { x: bv.x - this.flow.x, y: bv.y - this.flow.y };
        const speed = Math.hypot(v.x, v.y);
        const facing = Math.abs(v.x) > 0.8 ? (v.x < 0 ? -1 : 1) : this.facing;
        if (facing !== this.facing) {
            // Turning round mirrors the fish; mirror its angle too so it flips
            // in place instead of rolling over its back.
            this.facing = facing;
            this.view.rotation = Phaser.Math.Angle.Wrap(Math.PI - this.view.rotation);
        }
        const level = this.facing < 0 ? Math.PI : 0;
        const follow = this.char.upright ? 0 : Phaser.Math.Clamp((speed - FISH.alignFrom) / (FISH.alignFull - FISH.alignFrom), 0, 1);
        const target = Phaser.Math.Angle.Wrap(level + Phaser.Math.Angle.Wrap(Math.atan2(v.y, v.x) - level) * follow);
        this.squash *= Math.pow(0.86, frames);
        const sq = Phaser.Math.Clamp(this.squash, -0.35, 0.35);
        this.view.setScale(this.view.baseScale * (1 + sq), this.view.baseScale * (1 - sq) * (this.facing < 0 ? -1 : 1));
        this.view.rotation = Phaser.Math.Angle.RotateTo(this.view.rotation, target, this.move.turn * frames);

        // Fin / tail animation: wave the strip mesh, strongest at the tail (left
        // end of the art), driven by how hard the fish is swimming and how fast
        // it moves. Idle = a slow, small flutter.
        this.effort = Math.max(0, this.effort - 0.035 * frames);
        const drive = Phaser.Math.Clamp(Math.max(this.effort, speed / 14), 0.12, 1); // being carried is not swimming
        this.swimPhase += (0.1 + drive * 0.42) * frames;
        const amp = this.states[this.state].wiggle * (0.25 + drive * 0.75);
        const pts = this.view.points, n = pts.length - 1;
        for (let i = 0; i <= n; i++) {
            const tail = 1 - i / n;                       // 1 at the tail, 0 at the nose
            pts[i].y = Math.sin(this.swimPhase - tail * 2.6) * amp * tail * tail;
        }
        this.view.setDirty();
        // Protective glow while a shield or the short puff invincibility is active.
        const safe = this.shield > 0 || this.guard > 0;
        this.aura.setVisible(safe);
        if (safe) {
            this.aura.setPosition(this.view.x, this.view.y).setRadius(this.radius + 16)
                .setAlpha(0.35 + 0.2 * Math.sin(this.swimPhase * 1.7));
        }

        // Side fin: paddles around its joint, faster and wider the harder the
        // fish swims. It rides on the body (position, turn, mirroring, wiggle).
        const fin = this.view.fin;
        if (fin) {
            const flip = this.facing < 0 ? -1 : 1;
            const sc = this.view.baseScale;
            const wave = Math.sin(this.swimPhase - fin.tail * 2.6) * amp * fin.tail * fin.tail;
            const lx = fin.jointX * sc, ly = (fin.jointY + wave) * sc * flip;
            const cos = Math.cos(this.view.rotation), sin = Math.sin(this.view.rotation);
            fin.setPosition(this.view.x + lx * cos - ly * sin, this.view.y + lx * sin + ly * cos);
            fin.setScale(sc * (1 + sq), sc * (1 - sq) * flip);
            const flap = Math.sin(this.swimPhase * 1.15) * Phaser.Math.DegToRad(FISH.finFlapMin + drive * FISH.finFlapMore);
            fin.rotation = this.view.rotation + flap * flip;
            fin.setAlpha(this.view.alpha);
        }
    }
}

/** Procedural stand-ins so the game runs even if the art files are missing. */
function ensureFallbackTextures(scene) {
    for (const [name, s] of Object.entries(DEFAULT_STATES)) {
        if (scene.textures.exists(s.key)) continue;
        const R = 100, pad = name === 'inflated' ? 30 : 6, c = R + pad;
        const g = scene.make.graphics({ add: false });
        if (name === 'inflated') {
            g.fillStyle(0xef8a4b, 1);
            for (let i = 0; i < 16; i++) {
                const a = (i / 16) * Math.PI * 2;
                const px = Math.cos(a + 1.57) * 12, py = Math.sin(a + 1.57) * 12;
                g.fillTriangle(c + Math.cos(a) * (R + pad), c + Math.sin(a) * (R + pad),
                    c + Math.cos(a) * R + px, c + Math.sin(a) * R + py,
                    c + Math.cos(a) * R - px, c + Math.sin(a) * R - py);
            }
        }
        for (let i = 0; i < 28; i++) {
            const t = i / 27;
            const col = Phaser.Display.Color.Interpolate.ColorWithColor(
                new Phaser.Display.Color(217, 150, 31), new Phaser.Display.Color(255, 226, 120), 27, i);
            g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1);
            g.fillCircle(c - t * 18, c - t * 20, R * (1 - t));
        }
        g.fillStyle(0xffffff, 1).fillCircle(c + 45, c - 22, 24);
        g.fillStyle(0x1b2c5c, 1).fillCircle(c + 52, c - 20, 13);
        g.generateTexture(s.key, c * 2, c * 2);
        g.destroy();
    }
}
