import Phaser from 'phaser';
import { biomeBlendAt, mixColor } from './biomes.js';

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
        this.tint = scene.add.rectangle(0, 0, W, H, 0xffffff, 0).setOrigin(0).setScrollFactor(0).setDepth(-26);

        // Sky and waterline live in the world (scroll vertically, follow x).
        // Both are redrawn every frame so the waterline can wave.
        makeGradient(scene, 'bd_sky', 1400, [[0, 0x6fc3ee], [0.6, 0xbfe9f5], [1, 0xf2fbf4]]);
        this.sun = scene.add.circle(W * 0.72, -420, 110, 0xfffbe0, 0.95).setDepth(-29).setScrollFactor(0, 1);
        this.skyImg = scene.add.image(0, -1400, 'bd_sky').setOrigin(0).setDisplaySize(W, 1460)
            .setDepth(-29.5).setScrollFactor(0, 1);
        this.sea = scene.add.graphics().setDepth(-28);   // water body drawn over the sky, wavy top edge
        this.foam = scene.add.graphics().setDepth(6);    // bright crest line, in front of the fish

        // The volcano's glow on the eastern horizon: always shows which way the journey goes.
        this.eastGlow = scene.add.ellipse(W + 120, H * 0.5, 520, H * 1.5, 0xff3b1f, 0.12)
            .setScrollFactor(0).setDepth(-11).setBlendMode(Phaser.BlendModes.ADD);
        scene.tweens.add({ targets: this.eastGlow, alpha: 0.2, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        // Distant schools of small fish: silhouettes far behind the play plane that
        // drift past slower than the world (parallax) and never interact.
        this.schools = [];
        for (let k = 0; k < 4; k++) {
            const school = {
                x: Phaser.Math.Between(0, 4000), y: Phaser.Math.Between(120, H - 160), dir: k % 2 ? 1 : -1,
                speed: Phaser.Math.FloatBetween(0.5, 1.1), depthFactor: 0.25 + k * 0.08, fish: []
            };
            const n = Phaser.Math.Between(7, 13);
            for (let i = 0; i < n; i++) {
                const size = Phaser.Math.Between(16, 26) * (0.7 + k * 0.12);
                const body = scene.add.ellipse(0, 0, size, size * 0.42, 0x0d4763, 0.3 + k * 0.05).setScrollFactor(0).setDepth(-16 + k * 0.1);
                school.fish.push({ body, ox: Phaser.Math.Between(-150, 150), oy: Phaser.Math.Between(-70, 70), phase: Math.random() * 6.28 });
            }
            this.schools.push(school);
        }

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

    update(camX, camY, dx, dy, surface) {
        const W = this.scene.scale.width, H = this.scene.scale.height;
        const depth = Phaser.Math.Clamp((camY + H / 2) / this.maxDepth, 0, 1);
        this.dark.setAlpha(Phaser.Math.Clamp((camY + H / 2 - 2200) / 3400, 0, 1) * 0.7);
        // Each biome colours the water; neighbours fade into each other.
        const bl = biomeBlendAt(camX + W / 2);
        this.tint.setFillStyle(mixColor(bl.a.water[0], bl.b.water[0], bl.t), Phaser.Math.Linear(bl.a.water[1], bl.b.water[1], bl.t));

        const t = this.scene.time.now / 1000;

        // Waterline: only when it is on screen.
        this.sea.clear();
        this.foam.clear();
        if (camY < 80) {
            const pts = [];
            for (let sx = -40; sx <= W + 40; sx += 32) pts.push({ x: camX + sx, y: surface.heightAt(camX + sx, t) });
            // Sky is a screen-wide image; hide the part below the waves with sea colour.
            // The sky image reaches a little below sea level; cover it from the
            // wave line down with a bright band that fades into the depth gradient.
            const x0 = pts[0].x, x1 = pts[pts.length - 1].x;
            this.sea.fillStyle(0x9be9ef, 1).beginPath().moveTo(x0, 62);
            for (const p of pts) this.sea.lineTo(p.x, p.y);
            this.sea.lineTo(x1, 62).closePath().fillPath();
            for (let k = 0; k < 40; k++) this.sea.fillStyle(0x9be9ef, 0.9 * (1 - k / 40) ** 1.6).fillRect(x0, 62 + k * 6, x1 - x0, 6);
            this.foam.lineStyle(7, 0xffffff, 0.85).beginPath().moveTo(pts[0].x, pts[0].y);
            for (const p of pts) this.foam.lineTo(p.x, p.y);
            this.foam.strokePath();
        }

        const depthFade = Math.max(0.25, 1 - depth * 0.8);
        for (const sc of this.schools) {
            sc.x += sc.dir * sc.speed;
            const span = W + 900;
            const sx = (((sc.x - camX * sc.depthFactor) % span) + span) % span - 450;
            const sy = sc.y - (camY * sc.depthFactor * 0.3) % 200;
            for (const f of sc.fish) {
                f.body.setPosition(sx + f.ox + Math.sin(t * 0.7 + f.phase) * 18, sy + f.oy + Math.sin(t * 1.1 + f.phase) * 10);
                f.body.setScale(sc.dir * (1 + Math.sin(t * 9 + f.phase) * 0.12), 1);   // tail beat
                f.body.setVisible(camY + f.body.y > 60).setAlpha(f.body.fillAlpha * 0 + 0.32 * depthFade);
            }
        }
        for (const ray of this.rays) {
            ray.x = ray.baseX + Math.sin(t * 0.25 + ray.phase) * 70 - (camX * 0.05) % 40;
            ray.setAlpha(ray.baseAlpha * (0.6 + 0.4 * Math.sin(t * 0.6 + ray.phase)) * Math.max(0, 1 - depth * 2.2));
        }
        for (const b of this.bubbles) {
            b.y -= b.speed + dy * 0.5;
            b.x += Math.sin(t * 1.4 + b.phase) * 0.5 - dx * 0.5;
            b.setVisible(camY + b.y > 40); // no bubbles in the sky
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
