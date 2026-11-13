import Phaser from 'phaser';
import BurgerMenu from '@gks/sdk/ui/BurgerMenu.js';
import ProgressionManager from '../systems/ProgressionManager.js';
import Pufferfish from '../game/Pufferfish.js';
import ControlSwitcher from '../game/ui/ControlSwitcher.js';
import LevelGenerator from '../game/level/LevelGenerator.js';
import Backdrop from '../game/level/Backdrop.js';
import { makeController, CONTROL_SCHEMES } from '../game/controls/index.js';
import { pwaMenuItems } from '../game/pwa.js';
import { SCENE_KEYS } from './keys.js';

const STEP_MS = 1000 / 60;

/** World tunables. */
const WORLD = {
    gravity: 0.22,        // gentle sink
    current: 0.00028,     // constant rightward drift (force per unit mass)
    cameraLead: 0.34,     // fish sits at this fraction of the screen width
    coinLossOnHit: 3
};

export default class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: SCENE_KEYS.MAIN });
    }

    create() {
        const W = this.scale.width, H = this.scale.height;
        this.lang = this.registry.get('currentLanguage') || 'de';

        this.progression = new ProgressionManager();
        this.progression.init?.();

        this.matter.world.setGravity(0, WORLD.gravity);
        this.matter.world.autoUpdate = false; // stepped manually in fixedStep()
        this.acc = 0;
        this.debugOn = false;
        this.camX = 0;

        this.backdrop = new Backdrop(this);
        this.level = new LevelGenerator(this);
        this.level.update(0);

        this.fish = new Pufferfish(this, W * WORLD.cameraLead, H * 0.42);

        const saved = this.progression.get?.('scheme', null);
        this.activeScheme = CONTROL_SCHEMES.some(s => s.id === saved) ? saved : CONTROL_SCHEMES[0].id;
        this.controller = makeController(this.activeScheme, this, this.fish);
        this.switcher = new ControlSwitcher(this, this.activeScheme,
            id => this.switchScheme(id), () => this.toggleDebug());

        // --- HUD ---------------------------------------------------------
        this.coins = 0;
        this.best = this.progression.get?.('best_coins', 0) || 0;
        const hudText = (x, y, size) => this.add.text(x, y, '', {
            fontFamily: 'Arial', fontSize: size, color: '#ffffff', fontStyle: 'bold',
            stroke: '#0a3f6e', strokeThickness: 8
        }).setScrollFactor(0).setDepth(60);
        if (this.textures.exists('coin')) {
            this.add.image(70, 190, 'coin').setDisplaySize(64, 64).setScrollFactor(0).setDepth(60);
        }
        this.coinText = hudText(116, 162, '50px');
        this.distText = hudText(40, 232, '34px');
        this.refreshHud();

        // Puff button (works in every control scheme).
        const pb = this.add.circle(W - 150, H - 150, 96, 0xffc266, 0.9)
            .setStrokeStyle(8, 0xffffff, 0.8).setScrollFactor(0).setDepth(60)
            .setInteractive({ useHandCursor: true });
        this.add.text(W - 150, H - 150, 'PUFF', {
            fontFamily: 'Arial', fontSize: '40px', color: '#06343a', fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(61);
        pb.on('pointerdown', () => this.fish.puff());

        const menu = new BurgerMenu(this, 60, 60, [
            { label: this.lang === 'de' ? 'ENDE' : 'END', color: 0x2e7d32, callback: () => this.finish() },
            ...pwaMenuItems(this, this.lang),
            { label: this.lang === 'de' ? 'ZURÜCK' : 'EXIT', color: 0xd32f2f, callback: () => this.scene.start('MainMenuScene') }
        ]);
        menu.setDepth(70).setScrollFactor(0, 0, true);
        menu.overlay.setScrollFactor(0, 0, true);

        // Keyboard (always on, alongside the touch scheme): arrows / WASD swim, space puffs.
        const kb = this.input.keyboard;
        if (kb) {
            this.keys = kb.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D');
            kb.on('keydown-SPACE', () => this.fish.puff());
        }
        this.keyDir = new Phaser.Math.Vector2();

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.controller?.destroy();
            kb?.removeAllListeners('keydown-SPACE');
        });
    }

    finish() {
        if (this.coins > this.best) this.progression.set?.('best_coins', this.coins);
        this.scene.start(SCENE_KEYS.END, { score: this.coins, distance: this.distance() });
    }

    distance() {
        return Math.max(0, Math.round((this.fish.sprite.x - this.scale.width * WORLD.cameraLead) / 100));
    }

    refreshHud() {
        this.coinText.setText(String(this.coins));
        this.distText.setText(`${this.distance()} m`);
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
        const world = this.matter.world;
        if (this.debugOn && !world.debugGraphic) world.createDebugGraphic();
        world.drawDebug = this.debugOn;
        if (world.debugGraphic) {
            world.debugGraphic.setVisible(this.debugOn);
            if (!this.debugOn) world.debugGraphic.clear();
        }
        this.switcher.setDebug(this.debugOn);
    }

    collect() {
        const p = this.fish.pos, fr = this.fish.radius;
        for (const c of this.level.coins) {
            if (!c.img.active || p.distance(c.img) > fr + c.r) continue;
            const { x, y } = c.img;
            this.tweens.killTweensOf(c.img);
            c.img.destroy();
            this.coins++;
            const pop = this.add.circle(x, y, 30, 0xfff3b0, 0.8).setDepth(3);
            this.tweens.add({ targets: pop, scale: 2.6, alpha: 0, duration: 260, onComplete: () => pop.destroy() });
        }
        for (const h of this.level.hazards) {
            if (!h.img.active || p.distance(h.img) > fr + h.r) continue;
            if (this.fish.hit(new Phaser.Math.Vector2(h.img.x, h.img.y))) {
                this.coins = Math.max(0, this.coins - WORLD.coinLossOnHit);
                this.cameras.main.shake(180, 0.008);
            }
        }
    }

    /** One fixed 60 Hz simulation step: all forces + physics, display-rate independent. */
    fixedStep() {
        const sp = this.fish.sprite;
        sp.applyForce({ x: WORLD.current * sp.body.mass, y: 0 });
        this.controller.update(STEP_MS);
        if (this.keys) {
            const k = this.keys;
            this.keyDir.set(
                (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0),
                (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0));
            if (this.keyDir.lengthSq() > 0) this.fish.thrust(this.keyDir.normalize());
        }
        this.fish.update(STEP_MS);
        this.matter.world.step(STEP_MS);
    }

    update(time, delta) {
        const W = this.scale.width;
        const sp = this.fish.sprite;

        this.acc = Math.min(this.acc + delta, STEP_MS * 5);
        while (this.acc >= STEP_MS) { this.fixedStep(); this.acc -= STEP_MS; }

        // Camera only moves forward; the fish cannot leave the screen on the left.
        const target = sp.x - W * WORLD.cameraLead;
        const prev = this.camX;
        if (target > this.camX) this.camX = Phaser.Math.Linear(this.camX, target, 1 - Math.pow(0.88, delta / STEP_MS));
        this.cameras.main.scrollX = this.camX;
        const leftEdge = this.camX + this.fish.radius;
        if (sp.x < leftEdge) {
            sp.setPosition(leftEdge, sp.y);
            if (sp.body.velocity.x < 0) sp.setVelocityX(0);
        }

        this.level.update(this.camX);
        this.backdrop.update(this.camX, this.camX - prev);
        this.collect();
        this.refreshHud();
    }
}
