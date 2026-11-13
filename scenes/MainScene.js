import Phaser from 'phaser';
import ProgressionManager from '../systems/ProgressionManager.js';
import WorldState from '../systems/worldState.js';
import Player from '../game/Player.js';
import Multiplayer from '../game/Multiplayer.js';
import LevelGenerator, { LEVEL } from '../game/level/LevelGenerator.js';
import { BIOMES, biomeIndexAt, biomeBlendAt, mixColor, spotFor } from '../game/level/biomes.js';
import { UNSTICK, popOut, wedged, Stillness } from '../game/level/unstick.js';
import Backdrop from '../game/level/Backdrop.js';
import WaterLight from '../game/fx/WaterLight.js';
import BackLayers from '../game/level/BackLayers.js';
import { makeController, CONTROL_SCHEMES } from '../game/controls/index.js';
import { getCharacter, loadSelectedId } from '../game/characters.js';
import { WaterSurface } from '../game/level/surface.js';
import { play } from '../game/audio.js';
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
    maxHealth: 5,
    hitStopMs: 70,
    ventLift: 0.0026,     // upward force per unit mass inside a bubble column
    friendBonus: 5,
    schoolRadius: 420,    // friends (other players) this close swim as a school ...
    schoolBoost: 0.1,     // ... each of up to two makes you this much faster
    roomReach: 320,       // a pose that needs more room may move the player this far to find it
    downedMs: 5000,       // playing together: how long friends have to revive you before the nest respawn
    reviveHealth: 2
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
        // Relaxed = just swim and explore: hazards are only scenery and cannot hurt.
        this.relaxed = !!this.progression.get?.('relaxed', false);

        this.matter.world.setGravity(0, WORLD.gravity);
        this.matter.world.autoUpdate = false; // stepped manually in fixedStep()
        this.acc = 0;
        this.perf = { physics: { sum: 0, n: 0, max: 0 }, world: { sum: 0, n: 0, max: 0 } }; // see ?debug=perf
        this.debugOn = false;
        this.maxDepth = 0;

        this.surface = new WaterSurface();   // spring columns: splashes make ripples that travel
        this.hitStop = 0;                    // ms the action freezes after a hit (impact feel)
        this.backdrop = new Backdrop(this, LEVEL.maxDepth);
        this.backLayers = new BackLayers(this);   // far haze, far reef, back floor (parallax)
        this.waterLight = new WaterLight(this);   // light shafts, caustics, depth grade
        // What has been collected stays collected (per chunk bitfields, see worldState.js).
        // Playing together, the room has its own memory, separate from the solo journey.
        this.world = new WorldState(window.localStorage, Multiplayer.worldKey(this.registry) || 'sll_world', `${LEVEL.seed}.${LEVEL.version}`);
        this.level = new LevelGenerator(this, this.world);
        this.density = (x, y) => this.level.density(x, y);

        // Start at the last nest reached (kept across sessions), else the start pool.
        this.nestIndex = Phaser.Math.Clamp(this.progression.get?.('nest', 0) || 0, 0, this.level.nests.length - 2);
        this.banked = this.progression.get?.('banked', 0) || 0;
        this.character = getCharacter(this.registry.get('character') || loadSelectedId());
        const start = this.startPoint();
        this.camX = start.x - W / 2;
        this.camY = start.y - H / 2;
        this.level.update(this.camX, this.camY);

        this.fish = new Player(this, start.x, start.y, this.character);
        // Never stuck (level/unstick.js): room is checked before a bigger pose, a body
        // inside rock pops into open water, pushing in vain gets a lift.
        this.fish.makeRoom = radius => {
            const sp = this.fish.sprite, p = this.fish.inAir ? { x: sp.x, y: sp.y, moved: false } : popOut(this.density, sp.x, sp.y, radius);
            return p && Math.hypot(p.x - sp.x, p.y - sp.y) <= WORLD.roomReach ? p : null;
        };
        this.stillness = new Stillness();

        // Lighting layers (screen-fixed): ambient multiply + a soft vignette.
        this.ambient = this.add.rectangle(0, 0, W, H, 0xffffff).setOrigin(0).setScrollFactor(0).setDepth(40)
            .setBlendMode(Phaser.BlendModes.MULTIPLY);
        if (!this.textures.exists('vignette')) {
            const tex = this.textures.createCanvas('vignette', 256, 144);
            const ctx = tex.getContext();
            const grad = ctx.createRadialGradient(128, 72, 40, 128, 72, 150);
            grad.addColorStop(0, 'rgba(0,10,30,0)'); grad.addColorStop(1, 'rgba(0,10,30,0.55)');
            ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 144);
            tex.refresh();
        }
        this.add.image(0, 0, 'vignette').setOrigin(0).setDisplaySize(W, H).setScrollFactor(0).setDepth(41).setAlpha(0.5);
        this.glow = this.add.circle(start.x, start.y, 260, 0xbfe9ff, 0).setDepth(42).setBlendMode(Phaser.BlendModes.ADD);
        this.health = WORLD.maxHealth;
        this.maxHealth = WORLD.maxHealth;

        const saved = this.progression.get?.('controls', null);
        this.activeScheme = CONTROL_SCHEMES.some(s => s.id === saved) ? saved : CONTROL_SCHEMES[0].id;
        this.controller = makeController(this.activeScheme, this, this.fish);

        this.coins = this.banked;
        this.biomeIndex = -1;
        this.best = this.progression.get?.('best_coins', 0) || 0;

        // HUD (menu, scheme switcher, puff button, counters) runs as its own
        // scene on top — see HudScene.
        this.scene.launch(HUD_KEY, { main: this });
        // Phaser lets the top scene swallow input for the scenes below, and it
        // also swallows the first tap after a HUD button was touched. Turn that
        // off: this scene always gets every tap and asks isOverHud() itself.
        this.prevTopOnly = this.input.manager.globalTopOnly;
        this.input.manager.globalTopOnly = false;

        // Double tap = puff, except in the tap-driven schemes (flap, tilt), where
        // rapid taps are swimming; those use a long press instead.
        this.lastTap = { t: -9999, x: 0, y: 0 };
        this.input.on('pointerdown', pointer => {
            if (this.isOverHud(pointer) || this.activeScheme === 'flap' || this.activeScheme === 'tilt') return;
            const now = this.time.now, last = this.lastTap;
            const near = Phaser.Math.Distance.Between(pointer.x, pointer.y, last.x, last.y) < WORLD.doubleTapDist;
            if (now - last.t < WORLD.doubleTapMs && near) {
                this.fish.special();
                this.lastTap = { t: -9999, x: 0, y: 0 };
            } else {
                this.lastTap = { t: now, x: pointer.x, y: pointer.y };
            }
        });

        // Splash when the fish breaks the surface in either direction.
        this.events.on('fish-splash', ({ x, y, speed, entering }) => {
            if (speed < 2 || this.time.now - (this.lastSplash || -999) < 180) return; // no plop for a gentle bob
            this.lastSplash = this.time.now;
            play('splash', speed);
            // Kick the surface springs: a dent going in, a small bulge coming out (ripples of ~10-35 px).
            this.surface.splash(x, (entering ? 1 : -0.7) * Math.min(5.5, 1.2 + speed * 0.3), 2.5);
            this.fish.squash = entering ? 0.28 : -0.2;
            // Droplets: water-coloured with a bright rim so they read against sky and sea.
            const n = Phaser.Math.Clamp(Math.round(6 + speed), 8, 26);
            for (let i = 0; i < n; i++) {
                const d = this.add.circle(x + Phaser.Math.Between(-46, 46), y, Phaser.Math.Between(6, 15), 0x7fd6f0, 0.95)
                    .setStrokeStyle(3, 0xffffff, 1).setDepth(9);
                const up = Phaser.Math.Between(70, 110 + speed * 12);
                this.tweens.add({ targets: d, x: d.x + Phaser.Math.Between(-170, 170), duration: 720, ease: 'Linear' });
                this.tweens.add({ targets: d, y: y - up, duration: 360, ease: 'Quad.easeOut', yoyo: true, onComplete: () => d.destroy() });
                this.tweens.add({ targets: d, scale: 0.4, duration: 720 });
            }
            // Foam ring on the surface and a burst of bubbles underneath.
            const ring = this.add.ellipse(x, y, 90, 22, 0xffffff, 0.85).setDepth(9);
            this.tweens.add({ targets: ring, scaleX: 5.5, scaleY: 1.6, alpha: 0, duration: 650, onComplete: () => ring.destroy() });
            if (entering) {
                for (let i = 0; i < 9; i++) {
                    const bub = this.add.circle(x + Phaser.Math.Between(-60, 60), y + Phaser.Math.Between(20, 90), Phaser.Math.Between(6, 16), 0xffffff, 0.35)
                        .setStrokeStyle(2, 0xffffff, 0.8).setDepth(6);
                    this.tweens.add({ targets: bub, y: y + 6, alpha: 0, duration: Phaser.Math.Between(500, 1000), onComplete: () => bub.destroy() });
                }
            }
        });

        // Keyboard (always on, alongside the touch scheme): arrows / WASD swim, space puffs.
        const kb = this.input.keyboard;
        if (kb) {
            this.keys = kb.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D');
            kb.on('keydown-SPACE', () => this.fish.special());
        }
        this.keyDir = new Phaser.Math.Vector2();

        // Save the world state now and then, and when the game goes to the background.
        this.time.addEvent({ delay: 5000, loop: true, callback: () => this.world.save() });
        const saveNow = () => this.world.save();
        document.addEventListener('visibilitychange', saveNow);
        window.addEventListener('pagehide', saveNow);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            saveNow();
            document.removeEventListener('visibilitychange', saveNow);
            window.removeEventListener('pagehide', saveNow);
            this.scene.stop(HUD_KEY);
            this.level.worker?.terminate();
            this.input.manager.globalTopOnly = this.prevTopOnly;
            this.controller?.destroy();
            kb?.removeAllListeners('keydown-SPACE');
            this.events.off('fish-splash');
            this.mp?.destroy();
            this.mp = null;
        });

        this.mp = Multiplayer.create(this); // null unless a room code was chosen on the title
    }

    /** True if the pointer is on a HUD element (button, open menu). */
    isOverHud(pointer) {
        const hud = this.scene.get(HUD_KEY);
        if (!hud || !this.scene.isActive(HUD_KEY)) return false;
        return hud.consumedDown === pointer.downTime || hud.input.hitTestPointer(pointer).length > 0;
    }

    /** Where a (re)start puts the fish: above the current nest, or the start pool. */
    startPoint() {
        // ?at=kelp | abyss | x,y : start at a named place (repeatable screenshots, reviews).
        const spot = spotFor(new URLSearchParams(window.location.search).get('at'));
        if (spot) {
            // Move into open water: try further and further above and below.
            return this.safeSpot(spot.x, spot.y);
        }
        if (this.nestIndex === 0) return this.safeSpot(LEVEL.spawn.x, LEVEL.spawn.y);
        const nest = this.level.nests[this.nestIndex];
        return this.safeSpot(nest.x, nest.y - 240);
    }

    /** The nearest place to (x, y) with open water for the character even at its biggest. */
    safeSpot(x, y) {
        const biggest = Math.max(...Object.values(this.character.states).map(s => s.radius));
        return popOut(this.density, x, y, biggest) || { x, y };
    }

    /** Pop the player into open water with a little puff of bubbles (never stuck). */
    popFree(radius) {
        const sp = this.fish.sprite, p = popOut(this.density, sp.x, sp.y, radius);
        if (!p || !p.moved) return;
        this.fish.place(p.x, p.y);
        sp.setVelocity(sp.body.velocity.x * 0.3, sp.body.velocity.y * 0.3);
        this.fish.guard = Math.max(this.fish.guard, 600);
        play('deflate');
        for (let i = 0; i < 7; i++) {
            const b = this.add.circle(p.x + Phaser.Math.Between(-40, 40), p.y + Phaser.Math.Between(-30, 30), Phaser.Math.Between(5, 12), 0xffffff, 0.5).setDepth(6);
            this.tweens.add({ targets: b, y: b.y - Phaser.Math.Between(60, 130), alpha: 0, duration: Phaser.Math.Between(400, 800), onComplete: () => b.destroy() });
        }
    }

    /** Big friendly line of text in the middle of the screen (shown by the HUD). */
    announce(title, subtitle = '') {
        this.scene.get(HUD_KEY)?.banner?.(title, subtitle);
    }

    /** Swam into a nest: coins are safe, this is the new restart point. */
    reachNest(nest) {
        const de = this.lang === 'de';
        const first = nest.index > this.nestIndex;
        if (first) this.nestIndex = nest.index;
        if (!first && this.coins === this.banked && this.health >= this.maxHealth) return;
        this.banked = this.coins;
        this.world.save();
        this.health = this.maxHealth;
        play(nest.grand ? 'win' : 'nest');
        this.progression.set?.('nest', this.nestIndex);
        this.progression.set?.('banked', this.banked);
        if (nest.grand) {
            this.progression.set?.('nest', 0);
            this.progression.set?.('banked', 0);
            this.time.delayedCall(900, () => this.scene.start(SCENE_KEYS.END, { score: this.coins, distance: this.maxDepth, won: true }));
            this.announce(de ? 'Das große Nest!' : 'The Grand Nest!', de ? 'Du hast es geschafft!' : 'You made it!');
        } else if (first) {
            this.announce(de ? 'Nest erreicht!' : 'Nest reached!', de ? 'Münzen gesichert · hier geht es weiter' : 'Coins saved · you restart here');
        }
        for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2;
            const star = this.add.star(nest.x, nest.y - 40, 5, 9, 20, 0xfff3b0).setDepth(8);
            this.tweens.add({
                targets: star, x: nest.x + Math.cos(a) * 260, y: nest.y - 160 + Math.sin(a) * 150, alpha: 0, angle: 220,
                duration: 900, ease: 'Quad.easeOut', onComplete: () => star.destroy()
            });
        }
    }

    /** Out of health. Alone: straight back to the nest. Together: friends get a moment to revive you first. */
    goDown() {
        this.respawning = true;
        if (!this.mp) { this.respawn(); return; }
        const de = this.lang === 'de', sp = this.fish.sprite;
        this.mp.downed(sp.x, sp.y);
        sp.setVelocity(0, 0);
        this.fish.guard = WORLD.downedMs;                 // nothing can hurt or push a downed player
        this.announce(de ? 'Hilfe!' : 'Help!', de ? 'Ein Freund kann dich anstupsen' : 'A friend can nudge you awake');
        this.downTimer = this.time.delayedCall(WORLD.downedMs, () => { this.downTimer = null; this.respawn(); });
    }

    /** A friend touched our revive bubble (called by Multiplayer): carry on right here. */
    revive() {
        if (!this.downTimer) return;
        this.downTimer.remove();
        this.downTimer = null;
        this.respawning = false;
        this.health = Math.min(this.maxHealth, WORLD.reviveHealth);
        this.fish.guard = 2000;
        play('friend');
        this.announce(this.lang === 'de' ? 'Weiter geht’s!' : 'Back in the swim!');
    }

    /** Out of health: no fail screen — back to the last nest with what was saved there. */
    respawn() {
        const de = this.lang === 'de';
        const p = this.startPoint();
        play('respawn');
        this.cameras.main.fadeOut(260, 10, 40, 70);
        this.time.delayedCall(280, () => {
            this.fish.endPose();
            this.fish.place(p.x, p.y);
            this.fish.sprite.setVelocity(0, 0);
            this.fish.guard = 2500;
            this.health = this.maxHealth;
            this.coins = this.banked;
            this.camX = p.x - this.scale.width / 2;
            this.camY = p.y - this.scale.height / 2;
            this.respawning = false;
            this.cameras.main.fadeIn(320, 10, 40, 70);
            this.announce(de ? 'Nochmal!' : 'Try again!', de ? 'Zurück am letzten Nest' : 'Back at the last nest');
        });
    }

    /** Menu: switch between relaxed (no damage) and adventure. Takes effect at once. */
    setRelaxed(on) {
        this.progression.set?.('relaxed', !!on);
        this.scene.restart();
    }

    /** Menu: forget the saved nest and coins and begin at the home reef again. */
    startOver() {
        this.progression.set?.('nest', 0);
        this.progression.set?.('banked', 0);
        this.world.reset();
        this.scene.restart();
    }

    finish() {
        if (this.coins > this.best) this.progression.set?.('best_coins', this.coins);
        this.scene.start(SCENE_KEYS.END, { score: this.coins, distance: this.maxDepth });
    }

    /** Playing together: what the room has collected, from the shared record, so every screen shows the same number. */
    teamCoins() {
        return this.world.count('coin') + WORLD.friendBonus * this.world.count('friend');
    }

    depthMeters() {
        return Math.max(0, Math.round(this.fish.sprite.y / 100));
    }

    switchScheme(id) {
        if (id === this.activeScheme) return;
        this.controller.destroy();
        this.activeScheme = id;
        this.controller = makeController(id, this, this.fish);
        this.progression.set?.('controls', id);
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
            this.world.set(c.chunkKey, 'coin', c.index);
            this.mp?.claim(c.chunkKey, 'coin', c.index);
            this.coins++;
            play('coin');
            for (let i = 0; i < 5; i++) {           // sparkle
                const a = (i / 5) * Math.PI * 2 + Math.random();
                const star = this.add.star(x, y, 4, 4, 11, 0xffffff).setDepth(3);
                this.tweens.add({ targets: star, x: x + Math.cos(a) * 70, y: y + Math.sin(a) * 70, alpha: 0, angle: 180, scale: 0.3, duration: 380, onComplete: () => star.destroy() });
            }
            const pop = this.add.circle(x, y, 30, 0xfff3b0, 0.8).setDepth(3);
            this.tweens.add({ targets: pop, scale: 2.6, alpha: 0, duration: 260, onComplete: () => pop.destroy() });
        }
        for (const f of this.level.friends) {
            if (f.greeted || !f.img.active || p.distance(f.img) > fr + f.r) continue;
            f.greeted = true;
            play('friend');
            this.health = Math.min(this.maxHealth, this.health + 1); // friends cheer you up
            const bonus = f.rewarded ? 0 : WORLD.friendBonus;      // coins only the first time ever
            if (bonus) {
                f.rewarded = true;
                this.world.set(f.chunkKey, 'friend', f.index);
                this.mp?.claim(f.chunkKey, 'friend', f.index);
                this.coins += bonus;
            }
            const heart = this.add.text(f.img.x, f.img.y - f.r, bonus ? `♥ +${bonus}` : '♥', {
                fontFamily: 'Arial', fontSize: '54px', color: '#ff6b9a', fontStyle: 'bold',
                stroke: '#ffffff', strokeThickness: 8
            }).setOrigin(0.5).setDepth(8);
            this.tweens.add({ targets: heart, y: heart.y - 120, alpha: 0, duration: 1100, onComplete: () => heart.destroy() });
        }
        for (const nest of this.level.nests) {
            if (Math.abs(p.x - nest.x) < 230 && p.y > nest.y - 260 && p.y < nest.y + 40) this.reachNest(nest);
        }
        for (const h of this.level.hazards) {
            if (this.relaxed) break;
            if (!h.img.active || p.distance(h.img) > fr * LEVEL.hitSlack + h.r) continue;
            if (this.fish.hit(new Phaser.Math.Vector2(h.img.x, h.img.y))) {
                play('hit');
                this.hitStop = WORLD.hitStopMs;
                this.fish.squash = -0.3;
                this.health = Math.max(0, this.health - (this.character.armor ?? 1));
                this.cameras.main.shake(180, 0.008);
                if (this.health <= 0 && !this.respawning) { this.goDown(); return; }
            }
        }
    }

    /** One fixed 60 Hz simulation step: all forces + physics, display-rate independent. */
    fixedStep() {
        if (!this.downTimer) this.controller.update(STEP_MS);
        // Swimming close to friends makes everyone a little faster (a school).
        this.fish.boost = 1 + WORLD.schoolBoost * Math.min(2, this.mp?.nearFriends(this.fish.sprite.x, this.fish.sprite.y, WORLD.schoolRadius) ?? 0);
        if (this.keys) {
            const k = this.keys;
            this.keyDir.set(
                (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0),
                (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0));
            this.fish.steered = this.keyDir.lengthSq() > 0;
            if (this.fish.steered && !this.downTimer) this.fish.thrust(this.keyDir.normalize());
        }
        // Bubble plants carry the fish upward.
        const fsp = this.fish.sprite;
        const lifted = this.level.liftAt(fsp.x, fsp.y);
        if (lifted) fsp.applyForce({ x: 0, y: -WORLD.ventLift * fsp.body.mass });
        // Whatever carries the fish upward inside a bubble column is the water's doing.
        this.fish.flow.set(0, lifted ? Math.min(0, fsp.body.velocity.y) : 0);
        this.surface.recenter(fsp.x);
        this.surface.step();
        this.fish.update(STEP_MS, this.surface.heightAt(fsp.x, this.time.now / 1000));
        this.matter.world.step(STEP_MS);
        // Never stuck: a body whose centre is inside rock pops out at once; one that
        // is wedged between rock and pushes without moving for a while is lifted to roomier water.
        const body = fsp.body, r = this.fish.radius;
        if (this.density(fsp.x, fsp.y) > LEVEL.threshold + UNSTICK.slack) this.popFree(r);
        else if (this.stillness.step(STEP_MS, this.fish.effort > 0.3, Math.hypot(body.velocity.x, body.velocity.y), wedged(this.density, fsp.x, fsp.y, r * 1.15))) this.popFree(r * 1.8);
        this.fish.afterStep();
    }

    update(time, delta) {
        const W = this.scale.width, H = this.scale.height;
        const sp = this.fish.sprite;

        const t0 = performance.now();
        if (this.hitStop > 0) { this.hitStop -= delta; delta = 0; }   // freeze-frame on impact
        this.acc = Math.min(this.acc + delta, STEP_MS * 5);
        while (this.acc >= STEP_MS) { this.fixedStep(); this.acc -= STEP_MS; }
        const t1 = performance.now();
        this.fish.render(this.acc / STEP_MS, delta / STEP_MS);
        this.controller.draw?.();
        this.mp?.tick(this.fish);
        const view = this.fish.view;

        // Camera follows in both axes, leading slightly in the travel direction.
        const v = sp.body.velocity;
        const k = 1 - Math.pow(WORLD.cameraEase, delta / STEP_MS);
        const prevX = this.camX, prevY = this.camY;
        this.camX = Phaser.Math.Linear(this.camX, view.x + v.x * WORLD.lookAhead - W / 2, k);
        this.camY = Phaser.Math.Linear(this.camY, view.y + v.y * WORLD.lookAhead - H / 2, k);
        this.camY = Math.max(this.camY, -760); // room for a jump, not the whole sky
        this.cameras.main.setScroll(this.camX, this.camY);

        // Bubble trail when moving fast.
        const speed = Math.hypot(v.x, v.y);
        this.trailAt = (this.trailAt || 0) - delta;
        if (speed > 9 && this.trailAt <= 0) {
            this.trailAt = 55;
            const b = this.add.circle(view.x - v.x * 3 + Phaser.Math.Between(-20, 20), view.y - v.y * 3 + Phaser.Math.Between(-20, 20),
                Phaser.Math.Between(6, 15), 0xffffff, 0.35).setStrokeStyle(2, 0xffffff, 0.7).setDepth(4);
            this.tweens.add({ targets: b, y: b.y - 70, alpha: 0, scale: 1.5, duration: 700, onComplete: () => b.destroy() });
        }

        // Sand is kicked up when swimming fast just above the ground.
        this.sandAt = (this.sandAt || 0) - delta;
        if (speed > 4 && this.sandAt <= 0 && !this.fish.inAir) {
            const ground = this.level.groundBelow(view.x, view.y + this.fish.radius * 0.5, 130);
            if (ground) {
                this.sandAt = 70;
                for (let i = 0; i < 2 + Math.min(4, speed / 4); i++) {
                    const puff = this.add.circle(view.x + Phaser.Math.Between(-50, 50), ground.y - Phaser.Math.Between(0, 14),
                        Phaser.Math.Between(5, 13), ground.color, 0.55).setDepth(6);
                    this.tweens.add({
                        targets: puff, x: puff.x - v.x * Phaser.Math.Between(4, 9), y: puff.y - Phaser.Math.Between(30, 90),
                        scale: 2.4, alpha: 0, duration: Phaser.Math.Between(600, 1000), ease: 'Quad.easeOut',
                        onComplete: () => puff.destroy()
                    });
                }
            }
        }

        // Ambient light: one multiply layer over the whole world — warm and bright
        // near the surface, taking on the biome's water colour and dimming with depth.
        const bl = biomeBlendAt(view.x);
        // Bright down to the reef floor, dimming only in real depth; the abyss is dark.
        const depth01 = Phaser.Math.Clamp((view.y - 2200) / 3400, 0, 1) * 0.55 + Phaser.Math.Clamp((view.y - 5600) / 3000, 0, 1) * 0.45;
        const water = mixColor(bl.a.water[0], bl.b.water[0], bl.t);
        const waterAmt = Phaser.Math.Linear(bl.a.water[1], bl.b.water[1], bl.t);
        const lit = mixColor(mixColor(0xffffff, water, 0.1 + waterAmt * 0.6), 0x0c1436, depth01 * 0.8);
        this.ambient.setFillStyle(lit, 1);
        // In the dark the fish carries a little light of its own.
        this.glow.setPosition(view.x, view.y).setAlpha(depth01 * 0.5);

        this.level.update(this.camX, this.camY);
        this.level.animate(time / 1000, view, speed);
        this.backdrop.update(this.camX, this.camY, this.camX - prevX, this.camY - prevY, this.surface);
        this.backLayers.update(this.camX, this.camY);
        this.waterLight.update();
        this.collect();
        this.maxDepth = Math.max(this.maxDepth, this.depthMeters());
        const t2 = performance.now();
        for (const [k, ms] of [['physics', t1 - t0], ['world', t2 - t1]]) {
            const a = this.perf[k]; a.sum += ms; a.n++; if (ms > a.max) a.max = ms;
        }

        // Announce a biome when the fish swims into it.
        const bi = biomeIndexAt(sp.x);
        if (bi !== this.biomeIndex) {
            if (this.biomeIndex !== -1 || time > 0) this.announce(BIOMES[bi].name[this.lang] || BIOMES[bi].name.en);
            this.biomeIndex = bi;
        }
    }
}
