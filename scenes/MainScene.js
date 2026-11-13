import Phaser from 'phaser';
import BurgerMenu from '@gks/sdk/ui/BurgerMenu.js';
import ProgressionManager from '../systems/ProgressionManager.js';
import Pufferfish from '../game/Pufferfish.js';
import ControlSwitcher from '../game/ui/ControlSwitcher.js';
import { makeController } from '../game/controls/index.js';
import { SCENE_KEYS } from './keys.js';

export default class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: SCENE_KEYS.MAIN });
    }

    create() {
        const W = this.scale.width;
        const H = this.scale.height;
        const lang = this.registry.get('currentLanguage') || 'de';

        this.progression = new ProgressionManager();
        this.progression.init?.();

        // --- Water world -------------------------------------------------
        this.matter.world.setBounds(0, 0, W, H);
        this.matter.world.setGravity(0, 0.35); // gentle sink; thrust lifts
        this.debugOn = false;

        this.drawBackground(W, H);
        this.buildObstacles(W, H);
        this.spawnBubbles(W, H, 7);

        // --- Fish + controls --------------------------------------------
        this.fish = new Pufferfish(this, W * 0.3, H * 0.5);
        this.activeScheme = this.progression.get?.('scheme', 'stick') || 'stick';
        this.controller = makeController(this.activeScheme, this, this.fish);

        this.switcher = new ControlSwitcher(
            this, this.activeScheme,
            id => this.switchScheme(id),
            () => this.toggleDebug()
        );

        // --- HUD ---------------------------------------------------------
        this.score = this.progression.get?.('bubbles', 0) || 0;
        this.scoreText = this.add.text(40, H - 70, this.scoreLabel(lang), {
            fontFamily: 'Arial', fontSize: '40px', color: '#ffffff', fontStyle: 'bold'
        }).setDepth(60);

        const isSmall = W < 1000;
        new BurgerMenu(this, isSmall ? 40 : 60, isSmall ? 40 : 60, [
            { label: lang === 'de' ? 'ENDE' : 'END', color: 0x2e7d32, callback: () => this.scene.start(SCENE_KEYS.END, { score: this.score }) },
            { label: lang === 'de' ? 'ZURÜCK' : 'EXIT', color: 0xd32f2f, callback: () => this.scene.start('MainMenuScene') }
        ]);
    }

    scoreLabel(lang) {
        const l = lang || this.registry.get('currentLanguage') || 'de';
        return (l === 'de' ? 'Blasen: ' : 'Bubbles: ') + this.score;
    }

    switchScheme(id) {
        if (id === this.activeScheme) return;
        this.controller.destroy();
        this.activeScheme = id;
        this.controller = makeController(id, this, this.fish);
        this.switcher.setActive(id);
        this.progression.set?.('scheme', id);
    }

    toggleDebug() {
        this.debugOn = !this.debugOn;
        if (this.debugOn && !this.matter.world.debugGraphic) this.matter.world.createDebugGraphic();
        this.matter.world.drawDebug = this.debugOn;
        if (this.matter.world.debugGraphic) this.matter.world.debugGraphic.setVisible(this.debugOn);
        if (!this.debugOn && this.matter.world.debugGraphic) this.matter.world.debugGraphic.clear();
        this.switcher.setDebug(this.debugOn);
    }

    drawBackground(W, H) {
        for (let i = 0; i < 16; i++) {
            const col = Phaser.Display.Color.Interpolate.ColorWithColor(
                new Phaser.Display.Color(0x1aa3b5), new Phaser.Display.Color(0x053b42), 15, i);
            this.add.rectangle(W / 2, (H / 16) * (i + 0.5), W, H / 16 + 2,
                Phaser.Display.Color.GetColor(col.r, col.g, col.b)).setDepth(-10);
        }
        // light rays
        for (let i = 0; i < 5; i++) {
            const x = (W / 5) * i + 120;
            this.add.triangle(x, 0, 0, 0, 160, 0, 90, H, 0xffffff, 0.04).setDepth(-9);
        }
    }

    buildObstacles(W, H) {
        // Seabed floor (static).
        this.add.rectangle(W / 2, H - 30, W, 60, 0x0a5a52).setDepth(-5);
        this.matter.add.rectangle(W / 2, H - 20, W, 80, { isStatic: true });

        // A few rocks: visual ellipse + static circle body.
        const rocks = [[W * 0.6, H - 120, 150], [W * 0.78, H - 90, 110], [W * 0.45, H - 80, 90]];
        for (const [x, y, r] of rocks) {
            this.add.ellipse(x, y, r * 2.1, r * 1.5, 0x0c6b60).setDepth(-4);
            this.matter.add.circle(x, y + 10, r, { isStatic: true });
        }
    }

    spawnBubbles(W, H, n) {
        this.bubbles = [];
        for (let i = 0; i < n; i++) {
            const x = Phaser.Math.Between(200, W - 200);
            const y = Phaser.Math.Between(180, H - 300);
            const c = this.add.circle(x, y, 28, 0xbff4ff, 0.75)
                .setStrokeStyle(4, 0xffffff, 0.8).setDepth(2);
            this.tweens.add({ targets: c, y: y - 20, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            this.bubbles.push(c);
        }
    }

    collectBubbles() {
        const p = this.fish.pos;
        for (const b of this.bubbles) {
            if (!b.active) continue;
            if (p.distance(new Phaser.Math.Vector2(b.x, b.y)) < this.fish.radius + 28) {
                b.destroy();
                this.score++;
                this.progression.set?.('bubbles', this.score);
                this.scoreText.setText(this.scoreLabel());
                const burst = this.add.circle(b.x, b.y, 28, 0xffffff, 0.6).setDepth(3);
                this.tweens.add({ targets: burst, radius: 70, alpha: 0, duration: 300, onComplete: () => burst.destroy() });
            }
        }
    }

    update(time, delta) {
        this.fish.update(delta);
        this.controller.update(delta);
        this.collectBubbles();
    }
}
