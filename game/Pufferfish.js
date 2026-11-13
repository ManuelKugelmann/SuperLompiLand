import Phaser from 'phaser';

/** Tunables — physics feel is adjusted here (velocities are px per physics step). */
export const FISH = {
    thrust: 0.0021,        // swim force per unit mass
    maxSpeed: 34,
    brake: 0.9,            // velocity kept per step while braking
    mass: 6,
    inflateMs: 2600,
    cooldownMs: 500,
    buoyancy: 0.00075,     // upward force per unit mass while inflated
    shoveRadius: 340,
    shovePower: 16,
    states: {
        normal: { key: 'puffer_normal', width: 170, radius: 56, air: 0.05, bounce: 0.35 },
        inflated: { key: 'puffer_inflated', width: 255, radius: 98, air: 0.085, bounce: 0.75 }
    }
};

export const CAT = { WORLD: 1, FISH: 2, PADDLE: 4 };

/**
 * The player. Control schemes drive it ONLY through this API:
 *   thrust(dir)   steady swim force (dir length 0..1)
 *   seekTo(point) swim toward a world point, easing on arrival
 *   dragTo(point) follow a finger (grab) — release keeps the velocity = fling
 *   launch(vec)   one-shot velocity kick
 *   puff()        toggle the inflated state
 */
export default class Pufferfish {
    constructor(scene, x, y) {
        this.scene = scene;
        this.state = 'normal';
        this.inflateLeft = 0;
        this.cooldown = 0;
        this.invulnerable = 0;

        ensureFallbackTextures(scene);
        this.sprite = scene.matter.add.sprite(x, y, FISH.states.normal.key).setDepth(5);
        this.applyState('normal');
    }

    get body() { return this.sprite.body; }
    get pos() { return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y); }
    get radius() { return FISH.states[this.state].radius; }
    get inflated() { return this.state === 'inflated'; }

    applyState(name) {
        const s = FISH.states[name];
        const sp = this.sprite;
        const vel = sp.body ? { x: sp.body.velocity.x, y: sp.body.velocity.y } : { x: 0, y: 0 };
        this.state = name;

        sp.setTexture(s.key);
        sp.setDisplaySize(s.width, s.width * (sp.frame.height / sp.frame.width));
        sp.setBody({ type: 'circle', radius: s.radius });
        sp.setFixedRotation()
            .setMass(FISH.mass)
            .setFrictionAir(s.air)
            .setBounce(s.bounce)
            .setFriction(0.02)
            .setCollisionCategory(CAT.FISH)
            .setCollidesWith([CAT.WORLD, CAT.PADDLE]);
        sp.setVelocity(vel.x, vel.y);
    }

    thrust(dir) {
        this.sprite.applyForce(dir.clone().scale(FISH.thrust * this.body.mass));
    }

    seekTo(point) {
        const to = point.clone().subtract(this.pos);
        const dist = to.length();
        if (dist < 10) return dist;
        this.thrust(to.normalize().scale(Phaser.Math.Clamp(dist / 280, 0.15, 1)));
        return dist;
    }

    dragTo(point) {
        const v = point.clone().subtract(this.pos).scale(0.3);
        if (v.length() > FISH.maxSpeed) v.setLength(FISH.maxSpeed);
        this.sprite.setVelocity(v.x, v.y);
    }

    /** Actively slow down (call every step while braking). */
    brake() {
        const v = this.body.velocity;
        this.sprite.setVelocity(v.x * FISH.brake, v.y * FISH.brake);
    }

    /** Replace the velocity outright (release of a grab = the throw). */
    throwAt(vec) {
        const v = vec.clone();
        if (v.length() > FISH.maxSpeed) v.setLength(FISH.maxSpeed);
        this.sprite.setVelocity(v.x, v.y);
    }

    launch(vec) {
        const v = new Phaser.Math.Vector2(this.body.velocity.x + vec.x, this.body.velocity.y + vec.y);
        if (v.length() > FISH.maxSpeed) v.setLength(FISH.maxSpeed);
        this.sprite.setVelocity(v.x, v.y);
    }

    puff() {
        if (this.inflated) { this.deflate(); return; }
        if (this.cooldown > 0) return;
        this.applyState('inflated');
        this.inflateLeft = FISH.inflateMs;

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

    deflate() {
        if (!this.inflated) return;
        this.applyState('normal');
        this.inflateLeft = 0;
        this.cooldown = FISH.cooldownMs;
    }

    /** Hazard contact. Returns true if it hurt (normal state, not invulnerable). */
    hit(from) {
        const away = this.pos.subtract(from);
        if (away.lengthSq() < 1) away.set(0, -1);
        away.setLength(this.inflated ? 15 : 11);
        this.sprite.setVelocity(away.x, away.y);
        if (this.inflated || this.invulnerable > 0) return false;
        this.invulnerable = 1200;
        this.scene.tweens.add({
            targets: this.sprite, alpha: 0.35, duration: 110, yoyo: true, repeat: 4,
            onComplete: () => this.sprite.setAlpha(1)
        });
        return true;
    }

    update(dt) {
        if (this.cooldown > 0) this.cooldown -= dt;
        if (this.invulnerable > 0) this.invulnerable -= dt;
        if (this.inflated) {
            this.sprite.applyForce({ x: 0, y: -FISH.buoyancy * this.body.mass });
            this.inflateLeft -= dt;
            if (this.inflateLeft <= 0) this.deflate();
        }
        const vel = this.body.velocity;
        const speed = Math.hypot(vel.x, vel.y);
        if (speed > FISH.maxSpeed) {
            this.sprite.setVelocity(vel.x * FISH.maxSpeed / speed, vel.y * FISH.maxSpeed / speed);
        }
        const vx = this.body.velocity.x;
        if (Math.abs(vx) > 0.6) this.sprite.setFlipX(vx < 0);
        // Gentle tilt toward travel direction.
        const tilt = Phaser.Math.Clamp(this.body.velocity.y * 1.6, -22, 22) * (this.sprite.flipX ? -1 : 1);
        this.sprite.setAngle(Phaser.Math.Linear(this.sprite.angle, tilt, 0.15));
    }
}

/** Procedural stand-ins so the game runs even if the art files are missing. */
function ensureFallbackTextures(scene) {
    for (const [name, s] of Object.entries(FISH.states)) {
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
