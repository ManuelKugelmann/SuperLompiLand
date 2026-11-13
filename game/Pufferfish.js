import Phaser from 'phaser';

const BODY_R = 70;          // physics + art base radius
const TEX_KEY = 'puffer';

/**
 * The player: a smoothly-shaded pufferfish on a Matter circle body.
 * Control schemes drive it ONLY through this small API:
 *   thrust(dirVec)   — steady swim force in a direction (virtual stick)
 *   seekTo(point)    — swim toward a world point with arrival (tap-to-move)
 *   launch(vec)      — one-shot impulse (slingshot / angry-birds)
 *   puff()           — inflate special: grow + shove nearby bodies away
 */
export default class Pufferfish {
    constructor(scene, x, y) {
        this.scene = scene;
        this.radius = BODY_R;
        this._puffCooldown = 0;

        buildTexture(scene);

        this.sprite = scene.matter.add.sprite(x, y, TEX_KEY, null, {
            shape: { type: 'circle', radius: BODY_R }
        });
        this.sprite
            .setFrictionAir(0.055)   // water drag — floaty, not slippery
            .setBounce(0.35)
            .setFixedRotation()      // never tumble; we flip the art by heading
            .setMass(6);
    }

    get body() { return this.sprite.body; }
    get pos() { return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y); }

    /** Steady directional swim force (dir: normalized-ish Vector2, length 0..1). */
    thrust(dir) {
        const m = this.sprite.body.mass;
        this.sprite.applyForce(dir.clone().scale(0.009 * m));
    }

    /** Swim toward a point, slowing on arrival. Returns distance remaining. */
    seekTo(point) {
        const to = point.clone().subtract(this.pos);
        const dist = to.length();
        if (dist < 8) return dist;
        const arrival = Phaser.Math.Clamp(dist / 260, 0, 1); // ease near target
        this.thrust(to.normalize().scale(arrival));
        return dist;
    }

    /** One-shot launch impulse (slingshot). vec = velocity to add. */
    launch(vec) {
        const v = this.sprite.body.velocity;
        this.sprite.setVelocity(v.x + vec.x, v.y + vec.y);
    }

    /** Inflate special: visual puff + radial shove of nearby bodies. */
    puff() {
        if (this._puffCooldown > 0) return;
        this._puffCooldown = 900;

        this.scene.tweens.add({
            targets: this.sprite, scale: 1.65, duration: 140,
            yoyo: true, ease: 'Quad.easeOut'
        });

        const origin = this.pos;
        const bodies = this.scene.matter.world.localWorld.bodies;
        for (const b of bodies) {
            if (b === this.sprite.body || b.isStatic) continue;
            const bp = new Phaser.Math.Vector2(b.position.x, b.position.y);
            const d = bp.clone().subtract(origin);
            const dist = d.length();
            if (dist < 300 && dist > 0.1) {
                const power = (1 - dist / 300) * 14;
                const push = d.normalize().scale(power);
                this.scene.matter.body.setVelocity(b, {
                    x: b.velocity.x + push.x, y: b.velocity.y + push.y
                });
            }
        }
        // ring flash
        const ring = this.scene.add.circle(origin.x, origin.y, this.radius, 0xffffff, 0.35)
            .setDepth(5);
        this.scene.tweens.add({
            targets: ring, radius: 300, alpha: 0, duration: 400,
            onUpdate: () => ring.setScale(1), onComplete: () => ring.destroy()
        });
    }

    update(dt) {
        if (this._puffCooldown > 0) this._puffCooldown -= dt;
        // Face travel direction.
        const vx = this.sprite.body.velocity.x;
        if (Math.abs(vx) > 0.2) this.sprite.setFlipX(vx < 0);
    }
}

/** Bake a soft radially-shaded pufferfish into a texture (once). */
function buildTexture(scene) {
    if (scene.textures.exists(TEX_KEY)) return;
    const R = BODY_R;
    const pad = 26; // room for spikes
    const size = (R + pad) * 2;
    const c = R + pad;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });

    // Spikes (behind body).
    g.fillStyle(0xef8a4b, 1);
    const spikes = 14;
    for (let i = 0; i < spikes; i++) {
        const a = (i / spikes) * Math.PI * 2;
        const bx = c + Math.cos(a) * (R - 4);
        const by = c + Math.sin(a) * (R - 4);
        const tx = c + Math.cos(a) * (R + pad - 4);
        const ty = c + Math.sin(a) * (R + pad - 4);
        const px = Math.cos(a + 0.18) * 11, py = Math.sin(a + 0.18) * 11;
        g.fillTriangle(tx, ty, bx + px, by + py, bx - px, by - py);
    }

    // Body: concentric circles, edge->center colour ramp, light offset up-left.
    const edge = new Phaser.Display.Color(0xd9661f);
    const core = new Phaser.Display.Color(0xffc266);
    const steps = 32;
    for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const col = Phaser.Display.Color.Interpolate.ColorWithColor(edge, core, steps - 1, i);
        g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1);
        const rr = R * (1 - t);
        const ox = c - t * 14; // shift highlight toward top-left
        const oy = c - t * 16;
        g.fillCircle(ox, oy, rr);
    }

    // Belly highlight.
    g.fillStyle(0xffe4b0, 0.5);
    g.fillEllipse(c - 10, c + 18, R * 0.9, R * 0.6);

    // Eye.
    g.fillStyle(0xffffff, 1); g.fillCircle(c + R * 0.42, c - R * 0.22, R * 0.2);
    g.fillStyle(0x203040, 1); g.fillCircle(c + R * 0.5, c - R * 0.2, R * 0.1);
    g.fillStyle(0xffffff, 1); g.fillCircle(c + R * 0.46, c - R * 0.26, R * 0.035);

    g.generateTexture(TEX_KEY, size, size);
    g.destroy();
}
