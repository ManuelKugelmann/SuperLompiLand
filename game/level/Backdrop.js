import Phaser from 'phaser';

/**
 * Calm backdrop for the open world: a depth gradient that darkens as you dive,
 * drifting light rays near the surface, ambient bubbles, and the sky + waterline
 * above y = 0.
 */
export default class Backdrop {
    constructor(scene, maxDepth) {
        this.scene = scene;
        this.maxDepth = maxDepth;
        const W = scene.scale.width, H = scene.scale.height;

        makeGradient(scene, 'bd_grad', H, [[0, 0x7fdce6], [0.25, 0x35b3cc], [0.6, 0x1480a8], [1, 0x0d5a8c]]);
        scene.add.image(0, 0, 'bd_grad').setOrigin(0).setDisplaySize(W, H).setScrollFactor(0).setDepth(-30);
        this.dark = scene.add.rectangle(0, 0, W, H, 0x04122e, 0).setOrigin(0).setScrollFactor(0).setDepth(-25);

        // Sky and waterline live in the world (scroll vertically, follow x).
        this.sky = scene.add.rectangle(0, -1200, W * 2, 1200, 0xd9f6f0).setOrigin(0.5, 0).setDepth(-28).setScrollFactor(0, 1);
        this.sky.x = W / 2;
        this.sun = scene.add.circle(W * 0.5, -260, 120, 0xffffff, 0.75).setDepth(-27).setScrollFactor(0, 1);
        this.surface = scene.add.rectangle(W / 2, 0, W * 2, 14, 0xffffff, 0.75).setDepth(-9).setScrollFactor(0, 1);

        this.rays = [];
        for (let i = 0; i < 6; i++) {
            const x = (W / 6) * i + Phaser.Math.Between(-60, 60);
            const ray = scene.add.triangle(x, 0, 0, 0, 190, 0, 380, H * 0.95, 0xffffff, 0.07)
                .setOrigin(0).setScrollFactor(0).setDepth(-12).setBlendMode(Phaser.BlendModes.ADD);
            ray.baseAlpha = Phaser.Math.FloatBetween(0.04, 0.09);
            ray.phase = Math.random() * 6.28;
            ray.baseX = x;
            this.rays.push(ray);
        }

        this.bubbles = [];
        for (let i = 0; i < 16; i++) {
            const b = scene.textures.exists('bubble')
                ? scene.add.image(0, 0, 'bubble')
                : scene.add.circle(0, 0, 20, 0xffffff, 0.3).setStrokeStyle(3, 0xffffff, 0.6);
            b.setScrollFactor(0).setDepth(-8);
            this.resetBubble(b, true);
            this.bubbles.push(b);
        }
    }

    resetBubble(b, anywhere) {
        const W = this.scene.scale.width, H = this.scene.scale.height;
        const size = Phaser.Math.Between(14, 54);
        b.setDisplaySize(size, size).setAlpha(Phaser.Math.FloatBetween(0.2, 0.55));
        b.x = Phaser.Math.Between(0, W);
        b.y = anywhere ? Phaser.Math.Between(0, H) : H + 60;
        b.speed = 0.4 + size / 40;
        b.phase = Math.random() * 6.28;
    }

    update(camX, camY, dx, dy) {
        const W = this.scene.scale.width, H = this.scene.scale.height;
        const depth = Phaser.Math.Clamp((camY + H / 2) / this.maxDepth, 0, 1);
        this.dark.setAlpha(depth * 0.78);

        const t = this.scene.time.now / 1000;
        for (const ray of this.rays) {
            ray.x = ray.baseX + Math.sin(t * 0.25 + ray.phase) * 70 - (camX * 0.05) % 40;
            ray.setAlpha(ray.baseAlpha * (0.6 + 0.4 * Math.sin(t * 0.6 + ray.phase)) * Math.max(0, 1 - depth * 2.2));
        }
        for (const b of this.bubbles) {
            b.y -= b.speed + dy * 0.5;
            b.x += Math.sin(t * 1.4 + b.phase) * 0.5 - dx * 0.5;
            if (b.y < -60 || b.y > H + 80 || b.x < -80 || b.x > W + 80) this.resetBubble(b, b.y > H + 80 || b.x < -80 || b.x > W + 80);
        }
    }
}

function makeGradient(scene, key, h, stops) {
    if (scene.textures.exists(key)) return;
    const tex = scene.textures.createCanvas(key, 4, h);
    const ctx = tex.getContext();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    for (const [t, c] of stops) grad.addColorStop(t, '#' + c.toString(16).padStart(6, '0'));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 4, h);
    tex.refresh();
}
