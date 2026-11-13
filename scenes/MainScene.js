import Phaser from 'phaser';
import ProgressionManager from '../systems/ProgressionManager.js';
import Pufferfish from '../game/Pufferfish.js';
import LevelGenerator, { LEVEL } from '../game/level/LevelGenerator.js';
import Backdrop from '../game/level/Backdrop.js';
import { makeController, CONTROL_SCHEMES } from '../game/controls/index.js';
import { waveY } from '../game/level/surface.js';
import { HUD_KEY } from './HudScene.js';
import { SCENE_KEYS } from './keys.js';

const STEP_MS = 1000 / 60;

/** World tunables. */
const WORLD = {
    gravity: 0.12,         // gentle sink
    cameraEase: 0.88,     // per-step camera lag (lower = snappier)
    lookAhead: 9,         // camera leads the fish by velocity * this
    doubleTapMs: 320,
    doubleTapDist: 110,
    coinLossOnHit: 3,
    friendBonus: 5
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
        this.camX = LEVEL.spawn.x - W / 2;
        this.camY = LEVEL.spawn.y - H / 2;
        this.maxDepth = 0;

        this.backdrop = new Backdrop(this, LEVEL.maxDepth);
        this.level = new LevelGenerator(this);
        this.level.update(this.camX, this.camY);

        this.fish = new Pufferfish(this, LEVEL.spawn.x, LEVEL.spawn.y);

        const saved = this.progression.get?.('scheme', null);
        this.activeScheme = CONTROL_SCHEMES.some(s => s.id === saved) ? saved : CONTROL_SCHEMES[0].id;
        this.controller = makeController(this.activeScheme, this, this.fish);

        this.coins = 0;
        this.best = this.progression.get?.('best_coins', 0) || 0;

        // HUD (menu, scheme switcher, puff button, counters) runs as its own
        // scene on top — see HudScene.
        this.scene.launch(HUD_KEY, { main: this });
        // Phaser lets the top scene swallow input for the scenes below, and it
        // also swallows the first tap after a HUD button was touched. Turn that
        // off: this scene always gets every tap and asks isOverHud() itself.
        this.prevTopOnly = this.input.manager.globalTopOnly;
        this.input.manager.globalTopOnly = false;

        // Double tap = puff, in every control scheme except flap (rapid taps
        // are swimming there; it uses a long press instead).
        this.lastTap = { t: -9999, x: 0, y: 0 };
        this.input.on('pointerdown', pointer => {
            if (this.isOverHud(pointer) || this.activeScheme === 'flap') return;
            const now = this.time.now, last = this.lastTap;
            const near = Phaser.Math.Distance.Between(pointer.x, pointer.y, last.x, last.y) < WORLD.doubleTapDist;
            if (now - last.t < WORLD.doubleTapMs && near) {
                this.fish.puff();
                this.lastTap = { t: -9999, x: 0, y: 0 };
            } else {
                this.lastTap = { t: now, x: pointer.x, y: pointer.y };
            }
        });

        // Splash when the fish breaks the surface in either direction.
        this.events.on('fish-splash', ({ x, y, speed }) => {
            const n = Phaser.Math.Clamp(Math.round(speed * 0.9), 5, 22);
            for (let i = 0; i < n; i++) {
                const d = this.add.circle(x + Phaser.Math.Between(-40, 40), y, Phaser.Math.Between(4, 11), 0xffffff, 0.85).setDepth(6);
                const up = Phaser.Math.Between(40, 60 + speed * 9);
                this.tweens.add({ targets: d, x: d.x + Phaser.Math.Between(-130, 130), duration: 620, ease: 'Linear' });
                this.tweens.add({
                    targets: d, y: y - up, duration: 310, ease: 'Quad.easeOut', yoyo: true,
                    onComplete: () => d.destroy()
                });
            }
            const ring = this.add.ellipse(x, y, 60, 14, 0xffffff, 0.6).setDepth(6);
            this.tweens.add({ targets: ring, scaleX: 5, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
        });

        // Keyboard (always on, alongside the touch scheme): arrows / WASD swim, space puffs.
        const kb = this.input.keyboard;
        if (kb) {
            this.keys = kb.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D');
            kb.on('keydown-SPACE', () => this.fish.puff());
        }
        this.keyDir = new Phaser.Math.Vector2();

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scene.stop(HUD_KEY);
            this.input.manager.globalTopOnly = this.prevTopOnly;
            this.controller?.destroy();
            kb?.removeAllListeners('keydown-SPACE');
            this.events.off('fish-splash');
        });
    }

    /** True if the pointer is on a HUD element (button, open menu). */
    isOverHud(pointer) {
        const hud = this.scene.get(HUD_KEY);
        if (!hud || !this.scene.isActive(HUD_KEY)) return false;
        return hud.consumedDown === pointer.downTime || hud.input.hitTestPointer(pointer).length > 0;
    }

    finish() {
        if (this.coins > this.best) this.progression.set?.('best_coins', this.coins);
        this.scene.start(SCENE_KEYS.END, { score: this.coins, distance: this.maxDepth });
    }

    depthMeters() {
        return Math.max(0, Math.round(this.fish.sprite.y / 100));
    }

    switchScheme(id) {
        if (id === this.activeScheme) return;
        this.controller.destroy();
        this.activeScheme = id;
        this.controller = makeController(id, this, this.fish);
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
        return this.debugOn;
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
        for (const f of this.level.friends) {
            if (f.greeted || !f.img.active || p.distance(f.img) > fr + f.r) continue;
            f.greeted = true;
            this.coins += WORLD.friendBonus;
            const heart = this.add.text(f.img.x, f.img.y - f.r, `♥ +${WORLD.friendBonus}`, {
                fontFamily: 'Arial', fontSize: '54px', color: '#ff6b9a', fontStyle: 'bold',
                stroke: '#ffffff', strokeThickness: 8
            }).setOrigin(0.5).setDepth(8);
            this.tweens.add({ targets: heart, y: heart.y - 120, alpha: 0, duration: 1100, onComplete: () => heart.destroy() });
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
        this.controller.update(STEP_MS);
        if (this.keys) {
            const k = this.keys;
            this.keyDir.set(
                (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0),
                (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0));
            this.fish.steered = this.keyDir.lengthSq() > 0;
            if (this.fish.steered) this.fish.thrust(this.keyDir.normalize());
        }
        this.fish.update(STEP_MS, waveY(this.fish.sprite.x, this.time.now / 1000));
        this.matter.world.step(STEP_MS);
    }

    update(time, delta) {
        const W = this.scale.width, H = this.scale.height;
        const sp = this.fish.sprite;

        this.acc = Math.min(this.acc + delta, STEP_MS * 5);
        while (this.acc >= STEP_MS) { this.fixedStep(); this.acc -= STEP_MS; }

        // Camera follows in both axes, leading slightly in the travel direction.
        const v = sp.body.velocity;
        const k = 1 - Math.pow(WORLD.cameraEase, delta / STEP_MS);
        const prevX = this.camX, prevY = this.camY;
        this.camX = Phaser.Math.Linear(this.camX, sp.x + v.x * WORLD.lookAhead - W / 2, k);
        this.camY = Phaser.Math.Linear(this.camY, sp.y + v.y * WORLD.lookAhead - H / 2, k);
        this.camY = Math.max(this.camY, -760); // room for a jump, not the whole sky
        this.cameras.main.setScroll(this.camX, this.camY);

        // Bubble trail when moving fast.
        const speed = Math.hypot(v.x, v.y);
        this.trailAt = (this.trailAt || 0) - delta;
        if (speed > 9 && this.trailAt <= 0) {
            this.trailAt = 55;
            const b = this.add.circle(sp.x - v.x * 3 + Phaser.Math.Between(-20, 20), sp.y - v.y * 3 + Phaser.Math.Between(-20, 20),
                Phaser.Math.Between(6, 15), 0xffffff, 0.35).setStrokeStyle(2, 0xffffff, 0.7).setDepth(4);
            this.tweens.add({ targets: b, y: b.y - 70, alpha: 0, scale: 1.5, duration: 700, onComplete: () => b.destroy() });
        }

        this.level.update(this.camX, this.camY);
        this.backdrop.update(this.camX, this.camY, this.camX - prevX, this.camY - prevY);
        this.collect();
        this.maxDepth = Math.max(this.maxDepth, this.depthMeters());
    }
}
