import Phaser from 'phaser';

// Speed lines: when the run is in flow (a long chain, or simply very fast), thin bright
// streaks rush past on the screen against the direction of travel. A fixed pool of images
// in screen space; nothing is created or tweened while playing.

export const SPEEDLINES = {
    count: 16,          // streaks on screen at full strength
    fromSpeed: 20,      // px per step at which they begin to show without a chain ...
    fullSpeed: 28,      // ... and are at full strength
    fade: 0.004,        // change of strength per ms (fades in and out in about a quarter second)
    length: [140, 320],
    rush: 2.6,          // how many times the player's own speed the streaks move at
    alpha: 0.5
};

function makeTexture(scene) {
    if (scene.textures.exists('fx_streak')) return;
    const tex = scene.textures.createCanvas('fx_streak', 128, 8), g = tex.getContext();
    const along = g.createLinearGradient(0, 0, 128, 0);
    along.addColorStop(0, 'rgba(255,255,255,0)'); along.addColorStop(0.7, 'rgba(235,250,255,0.9)'); along.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = along; g.fillRect(0, 2, 128, 4);
    tex.refresh();
}

export default class SpeedLines {
    constructor(scene, depth = 9) {
        this.scene = scene;
        this.amount = 0;
        makeTexture(scene);
        this.lines = [];
        for (let i = 0; i < SPEEDLINES.count; i++) {
            const img = scene.add.image(0, 0, 'fx_streak').setScrollFactor(0).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
            img.len = Phaser.Math.Between(SPEEDLINES.length[0], SPEEDLINES.length[1]);
            img.setPosition(Math.random() * scene.scale.width, Math.random() * scene.scale.height);
            this.lines.push(img);
        }
    }

    /** `vx, vy` = the player's velocity (px per step); `inFlow` = the chain is long enough. */
    update(delta, vx, vy, inFlow) {
        const c = SPEEDLINES, speed = Math.hypot(vx, vy);
        const want = speed < 4 ? 0 : Math.max(inFlow ? 1 : 0, Phaser.Math.Clamp((speed - c.fromSpeed) / (c.fullSpeed - c.fromSpeed), 0, 1));
        this.amount += Phaser.Math.Clamp(want - this.amount, -c.fade * delta, c.fade * delta);
        const on = this.amount > 0.01;
        if (!on && !this.shown) return;
        this.shown = on;
        const W = this.scene.scale.width, H = this.scene.scale.height, angle = Math.atan2(vy, vx);
        const step = delta / 16.67 * c.rush;
        for (const img of this.lines) {
            img.setVisible(on);
            if (!on) continue;
            let x = img.x - vx * step, y = img.y - vy * step;
            // Past an edge: come back in on the opposite side, somewhere new.
            if (x < -200) { x = W + 200; y = Math.random() * H; } else if (x > W + 200) { x = -200; y = Math.random() * H; }
            if (y < -200) { y = H + 200; x = Math.random() * W; } else if (y > H + 200) { y = -200; x = Math.random() * W; }
            // Fewer in the middle of the picture, where the player is.
            const centre = 1 - Math.min(1, Math.hypot(x - W / 2, y - H / 2) / (H * 0.45));
            img.setPosition(x, y).setRotation(angle).setDisplaySize(img.len * (0.5 + this.amount * 0.5), 6)
                .setAlpha(c.alpha * this.amount * (1 - centre * 0.85));
        }
    }

    destroy() {
        for (const img of this.lines) img.destroy();
        this.lines.length = 0;
    }
}
