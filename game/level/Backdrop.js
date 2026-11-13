import Phaser from 'phaser';

/**
 * Calm layered backdrop: depth gradient, drifting light rays and two tiling
 * silhouette layers (far ruins, near reef) that scroll slower than the level.
 */
export default class Backdrop {
    constructor(scene) {
        this.scene = scene;
        const W = scene.scale.width, H = scene.scale.height;

        makeGradient(scene, 'bd_grad', H, [[0, 0x8fe3ea], [0.18, 0x39b9cf], [0.55, 0x1480a8], [1, 0x0a3f6e]]);
        scene.add.image(0, 0, 'bd_grad').setOrigin(0).setDisplaySize(W, H).setScrollFactor(0).setDepth(-30);

        makeSilhouette(scene, 'bd_far', 2048, 620, 0x2f93b4, 3, true);
        makeSilhouette(scene, 'bd_near', 2048, 520, 0x17688e, 5, false);
        this.far = scene.add.tileSprite(0, H - 560, W, 620, 'bd_far').setOrigin(0).setScrollFactor(0).setDepth(-20).setAlpha(0.55);
        this.near = scene.add.tileSprite(0, H - 430, W, 520, 'bd_near').setOrigin(0).setScrollFactor(0).setDepth(-15).setAlpha(0.75);

        this.rays = [];
        for (let i = 0; i < 6; i++) {
            const x = (W / 6) * i + Phaser.Math.Between(-60, 60);
            const ray = scene.add.triangle(x, 0, 0, 0, 190, 0, 380, H * 0.95, 0xffffff, 0.06)
                .setOrigin(0).setScrollFactor(0).setDepth(-12).setBlendMode(Phaser.BlendModes.ADD);
            scene.tweens.add({
                targets: ray, alpha: 0.02, x: x + Phaser.Math.Between(-80, 80),
                duration: Phaser.Math.Between(3500, 6500), yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
            });
            this.rays.push(ray);
        }

        // Ambient bubbles drifting up across the screen.
        this.bubbles = [];
        for (let i = 0; i < 14; i++) {
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
        b.setDisplaySize(size, size).setAlpha(Phaser.Math.FloatBetween(0.25, 0.6));
        b.x = Phaser.Math.Between(0, W);
        b.y = anywhere ? Phaser.Math.Between(0, H) : H + 60;
        b.speed = 0.4 + size / 40;
        b.phase = Math.random() * 6.28;
    }

    update(cameraX, dx) {
        this.far.tilePositionX = cameraX * 0.12;
        this.near.tilePositionX = cameraX * 0.3;
        const t = this.scene.time.now / 1000;
        for (const b of this.bubbles) {
            b.y -= b.speed;
            b.x += Math.sin(t * 1.4 + b.phase) * 0.5 - dx * 0.5;
            if (b.y < -60 || b.x < -80) this.resetBubble(b, false);
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

/** Tileable hill/ruin silhouette (sine periods divide the width, so it wraps). */
function makeSilhouette(scene, key, w, h, color, waves, ruins) {
    if (scene.textures.exists(key)) return;
    const tex = scene.textures.createCanvas(key, w, h);
    const ctx = tex.getContext();
    const css = '#' + color.toString(16).padStart(6, '0');
    const k = (Math.PI * 2) / w;
    const top = x => h * 0.5
        - Math.sin(x * k * waves) * h * 0.14
        - Math.sin(x * k * (waves * 2 + 1) + 1.7) * h * 0.08
        - Math.sin(x * k * (waves * 5 + 2) + 0.6) * h * 0.03;
    ctx.fillStyle = css;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, top(x));
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    if (ruins) {
        for (const [cx, cols] of [[380, 3], [1260, 4], [1750, 2]]) {
            const baseY = top(cx) + 30;
            for (let c = 0; c < cols; c++) {
                const colH = 150 + ((c * 53) % 90);
                ctx.fillRect(cx + c * 62, baseY - colH, 22, colH + 60);
                ctx.fillRect(cx + c * 62 - 6, baseY - colH - 10, 34, 12);
            }
            ctx.fillRect(cx - 8, baseY - 232, Math.max(1, cols - 1) * 62 - 26, 18);
        }
    }
    tex.refresh();
}
