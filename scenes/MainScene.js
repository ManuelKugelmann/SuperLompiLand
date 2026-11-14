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
import ParticleLayer from '../game/fx/ParticleLayer.js';
import SwarmLayer from '../game/ai/SwarmLayer.js';
import BackLayers from '../game/level/BackLayers.js';
import MidLayers from '../game/level/MidLayers.js';
import { makeController, CONTROL_SCHEMES } from '../game/controls/index.js';
import { getCharacter, loadSelectedId } from '../game/characters.js';
import { WaterSurface } from '../game/level/surface.js';
import { FLOW, createFlow, streamY, carry } from '../game/level/flow.js';
import { play, nowSeconds, musicClock } from '../game/audio.js';
import { createStreak, chainNote, chainChord } from '../game/music/melody.js';
import { CHAIN, createChain, createSpin } from '../game/chain.js';
import { createAutopilot } from '../game/ambient/autopilot.js';
import { createGuide } from '../game/guide.js';
import { createBook } from '../game/reefbook.js';
import { BOOK_KEY } from './ReefBookScene.js';
import { HUD_KEY } from './HudScene.js';
import { SCENE_KEYS } from './keys.js';
import { fitToWindow } from '../game/orientation.js';

const STEP_MS = 1000 / 60;

/** World tunables. */
/** Leaking oil drums (spec 7.1): how often they puff and how much. */
const OIL = { pulseMs: 1400, perPulse: 5, margin: 600, denseCount: 6, graceS: 1.2, pauseS: 2.5 };
/** Plumes at the trench's vents: how often, how many smoke and steam particles. */
const VENT_PLUME = { everyMs: 900, smoke: 3, steam: 2, margin: 500 };
/** Margin below the rock threshold that counts as open water for the guide and the autopilot. */
const OPEN_SLACK = 0.04;
/** Fin-tip contrails: from this speed (px per step), at these tips (× body radius, nose = +x). */
const CONTRAIL = { speed: 11, tips: [[-0.35, -0.55], [-0.35, 0.55]] };
/** Reef book: how often to look around, and how close counts as seen up close (px). */
const BOOK = { scanMs: 300, seePx: 420 };
/** How high coins hop on each beat (px). */
const COIN_BOB_PX = 12;

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
    streamBubbles: 45,    // bubbles per second that mark each stream in view
    roomReach: 320,       // a pose that needs more room may move the player this far to find it
    downedMs: 5000,       // playing together: how long friends have to revive you before the nest respawn
    reviveHealth: 2
};

export default class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: SCENE_KEYS.MAIN });
    }

    create() {
        fitToWindow(this.game);     // the picture fills the screen, whatever its shape
        const W = this.scale.width, H = this.scale.height;
        this.lang = this.registry.get('currentLanguage') || 'de';

        this.progression = new ProgressionManager();
        this.progression.init?.();
        // Relaxed = just swim and explore: hazards are only scenery and cannot hurt.
        this.relaxed = !!this.progression.get?.('relaxed', false);
        // Ambient reef (spec ch.12): the game as a meditative background. Lompi swims
        // on autopilot, no HUD, nothing hurts, any tap returns to the title.
        this.ambientMode = !!this.registry.get('ambient');
        if (this.ambientMode) this.relaxed = true;

        this.matter.world.setGravity(0, WORLD.gravity);
        this.matter.world.autoUpdate = false; // stepped manually in fixedStep()
        this.acc = 0;
        this.perf = { physics: { sum: 0, n: 0, max: 0 }, world: { sum: 0, n: 0, max: 0 } }; // see ?debug=perf
        this.debugOn = false;
        this.maxDepth = 0;

        this.surface = new WaterSurface();   // spring columns: splashes make ripples that travel
        this.hitStop = 0;                    // ms the action freezes after a hit (impact feel)
        this.chain = createChain();          // linked moves (game/chain.js); shown by the HUD, not in relaxed play
        this.spin = createSpin();            // loops flown in the air
        this.airAt = 0;
        this.streak = createStreak();        // coins in a row play a melody (game/music/melody.js)
        this.backdrop = new Backdrop(this, LEVEL.maxDepth);
        this.backLayers = new BackLayers(this);   // far haze, far reef, back floor (parallax)
        this.midLayers = new MidLayers(this);     // mid reef and back-play layer from the painted art
        this.waterLight = new WaterLight(this);   // light shafts, caustics, depth grade
        // What has been collected stays collected (per chunk bitfields, see worldState.js).
        // Playing together, the room has its own memory, separate from the solo journey.
        this.world = new WorldState(window.localStorage, Multiplayer.worldKey(this.registry) || 'sll_world', `${LEVEL.seed}.${LEVEL.version}`);
        this.level = new LevelGenerator(this, this.world);
        this.density = (x, y) => this.level.density(x, y);
        this.flow = createFlow(LEVEL.seed);     // currents and swell: one field for player and particles
        this.flowAt = { x: 0, y: 0 };
        this.particles = new ParticleLayer(this, this.particleEnv());   // silt, bubbles, oil... (spec 6.1b)
        this.swarms = new SwarmLayer(this, {   // shoals of small fish around the view (spec 6.2)
            isOpen: (x, y) => this.level.isOpen(x, y, OPEN_SLACK),
            flowAt: this.particles.env.flowAt,
            biomeAt: x => BIOMES[biomeIndexAt(x)].id,
            waterAt: x => { const bl = biomeBlendAt(x); return mixColor(bl.a.water[0], bl.b.water[0], bl.t); }
        });
        this.swarmPlayer = { x: 0, y: 0, vx: 0, vy: 0 };
        this.reefBook = createBook(this.progression.get?.('reefbook', []) || []);   // discovery journal (spec 5.2d)
        this.guide = createGuide({ isOpen: (x, y) => this.level.isOpen(x, y, OPEN_SLACK) });   // shows the way when stuck (spec 1.4)

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
        // The nearest rock surface within reach, for a character that holds on with its tail.
        this.fish.findHold = reach => {
            const sp = this.fish.sprite, r = this.fish.radius;
            let best = null;
            for (let i = 0; i < 16; i++) {
                const a = (i / 16) * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
                for (let d = r; d <= reach && (!best || d < best.d); d += 16) {
                    if (this.density(sp.x + dx * d, sp.y + dy * d) > LEVEL.threshold) { best = { d, dx, dy }; break; }
                }
            }
            // Sit just off the rock, tail toward it.
            return best ? { x: sp.x + best.dx * (best.d - r * 0.9), y: sp.y + best.dy * (best.d - r * 0.9) } : null;
        };

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
        if (this.ambientMode) this.startAmbient();
        else this.scene.launch(HUD_KEY, { main: this });
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

        // A special (fan, pulse...) is sudden: nearby shoals scatter in a panic wave.
        this.events.on('fish-special', ({ x, y }) => { this.swarms.startle(x, y); this.chainMove('special'); });

        // Splash when the fish breaks the surface in either direction.
        this.events.on('fish-splash', ({ x, y, speed, entering, skim }) => {
            // Chain moves: a fast jump out, a landing after real air time, a skip off a wave.
            if (skim) this.chainMove('skim');
            else if (!entering && speed >= CHAIN.minLeap) { this.airAt = this.time.now; this.chainMove('leap'); }
            else if (entering && this.airAt && this.time.now - this.airAt >= CHAIN.minAir) { this.airAt = 0; this.chainMove('landing'); }
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
            this.particles.destroy();
            this.swarms.destroy();
            this.events.off('fish-special');
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
        if (this.scene.isActive(HUD_KEY)) this.scene.get(HUD_KEY).banner?.(title, subtitle);   // no HUD in ambient mode
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
            this.streak.reset();
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

    /**
     * How the world looks to particles. The rock test is cached on a 32 px grid
     * (particles cluster, the noise field is not free); flowAt is the hook for the
     * shared flow field later: for now only bubble columns move the water.
     */
    particleEnv() {
        const cache = new Map();
        let cacheAt = 0;
        return {
            // Particles want px per second; the field speaks px per physics step.
            flowAt: (x, y, out) => {
                this.flow.at(x, y, this.time.now / 1000, out);
                out.x *= 60; out.y = out.y * 60 + (this.level.liftAt(x, y) ? -170 : 0);
            },
            isSolid: (x, y) => {
                const now = this.time.now;
                if (now - cacheAt > 2000) { cache.clear(); cacheAt = now; }   // chunks come and go
                const key = ((x >> 5) * 73856093) ^ ((y >> 5) * 19349663);
                let v = cache.get(key);
                if (v === undefined) { v = this.density(x, y) > LEVEL.threshold; cache.set(key, v); }
                return v;
            },
            surfaceY: x => this.surface.heightAt(x, this.time.now / 1000)
        };
    }

    /** Leaking oil drums near the view puff out pulses of oil that rise and pool at the surface (spec 7.1). */
    leakOil(delta) {
        this.leakAt = (this.leakAt || 0) - delta;
        if (this.leakAt > 0) return;
        this.leakAt = OIL.pulseMs;
        const cam = this.cameras.main, m = OIL.margin;
        for (const h of this.level.hazards) {
            if (h.key !== 'hazard_buoy' || !h.img.active) continue;
            const { x, y } = h.img;
            if (x < cam.scrollX - m || x > cam.scrollX + cam.width + m || y < cam.scrollY - m || y > cam.scrollY + cam.height + m) continue;
            this.particles.spawn('oil', x, y - h.r * 0.9, OIL.perPulse, { radius: 18, spread: 18, vy: -40 });
        }
    }

    /** Ambient reef: autopilot, controls hidden, the screen kept awake, any input leaves. */
    startAmbient() {
        this.controller.ui?.setVisible(false);
        this.autoDir = new Phaser.Math.Vector2();
        this.autopilot = createAutopilot({
            isOpen: (x, y) => this.level.isOpen(x, y, OPEN_SLACK),
            poi: (x, y) => {
                let best = null, bd = 1800;
                for (const f of this.level.friends) {
                    if (!f.img.active) continue;
                    const d = Math.hypot(f.img.x - x, f.img.y - y);
                    if (d > 300 && d < bd) { bd = d; best = { x: f.img.x, y: f.img.y - 120 }; }
                }
                return best;
            }
        });
        const de = this.lang === 'de';
        const hint = this.add.text(this.scale.width / 2, this.scale.height - 60, de ? 'Tippen zum Beenden' : 'Tap to leave', {
            fontFamily: 'Arial', fontSize: '30px', color: '#eafcff', stroke: '#0a3f6e', strokeThickness: 6
        }).setOrigin(0.5).setScrollFactor(0).setDepth(60).setAlpha(0.8);
        this.tweens.add({ targets: hint, alpha: 0, delay: 3500, duration: 1500, onComplete: () => hint.destroy() });
        try { navigator.wakeLock?.request('screen').then(l => { this.wakeLock = l; }).catch(() => {}); } catch { /* not supported */ }
        const leave = () => {
            if (this.leaving) return;
            this.leaving = true;
            this.registry.set('ambient', false);
            this.wakeLock?.release?.().catch?.(() => {});
            this.cameras.main.fadeOut(400, 10, 40, 70);
            this.time.delayedCall(420, () => this.scene.start(SCENE_KEYS.INTRO));
        };
        this.time.delayedCall(600, () => {                       // ignore the tap that started it
            this.input.on('pointerdown', leave);
            this.input.keyboard?.on('keydown', leave);
        });
    }

    /**
     * The guide fish (spec 1.4): after a stall it swims ahead to open water east and
     * waits; following it moves it on, progress sends it off. Drawn once, procedurally.
     */
    updateGuide(dt) {
        const p = this.fish.sprite;
        const { state, target } = this.guide.update(dt, p.x, p.y);
        let g = this.guideFish;
        if (state === 'away') { if (g) g.setVisible(false); return; }
        if (!g) {
            if (!this.textures.exists('guide_fish')) {
                const d = this.make.graphics({ add: false });
                d.fillStyle(0xffd23f, 1).fillEllipse(34, 22, 52, 34);          // body
                d.fillStyle(0xffb000, 1).fillTriangle(6, 22, -10, 8, -10, 36);   // tail
                d.fillStyle(0xfff3b0, 0.9).fillEllipse(36, 14, 30, 10);         // shine
                d.fillStyle(0xffffff, 1).fillCircle(48, 18, 7);
                d.fillStyle(0x10324a, 1).fillCircle(50, 18, 4);
                d.generateTexture('guide_fish', 64, 44);
                d.destroy();
            }
            g = this.guideFish = this.add.image(p.x, p.y, 'guide_fish').setDepth(4.6).setOrigin(0.4, 0.5);
            g.vx = 0; g.vy = 0;
        }
        if (!g.visible) {                              // arrives from just ahead, off to the side
            g.setPosition(p.x + 260, p.y - 160).setAlpha(0).setVisible(true);
        }
        const to = state === 'leave' ? { x: g.x + 900, y: g.y - 200 } : target;
        const dx = to.x - g.x, dy = to.y - g.y, dist = Math.hypot(dx, dy);
        const speed = state === 'leave' ? 520 : Math.min(360, dist * 1.5);
        g.vx += ((dist ? dx / dist : 0) * speed - g.vx) * Math.min(1, dt * 3);
        g.vy += ((dist ? dy / dist : 0) * speed - g.vy) * Math.min(1, dt * 3);
        g.x += g.vx * dt;
        g.y += g.vy * dt + Math.sin(this.time.now / 260) * 0.4;
        if (Math.abs(g.vx) > 8) g.setFlipX(g.vx < 0);
        g.rotation = Phaser.Math.Clamp(Math.atan2(g.vy, Math.abs(g.vx) + 1) * 0.5, -0.4, 0.4) * (g.vx < 0 ? -1 : 1);
        g.setAlpha(state === 'leave' ? Math.max(0, g.alpha - dt * 0.8) : Math.min(1, g.alpha + dt * 1.5));
        if (state === 'leave' && g.alpha <= 0) { g.setVisible(false); this.guide.gone(); }
    }

    /**
     * Reef book: whatever Lompi sees up close (friends, leftovers) and every biome he
     * enters fills in an entry; the first time, a small card pops up.
     */
    discover(delta) {
        this.seeAt = (this.seeAt || 0) - delta;
        if (this.seeAt > 0) return;
        this.seeAt = BOOK.scanMs;
        const p = this.fish.sprite, r2 = BOOK.seePx * BOOK.seePx;
        const near = o => o.img.active && (o.img.x - p.x) ** 2 + (o.img.y - p.y) ** 2 < r2;
        const ids = [BIOMES[biomeIndexAt(p.x)].id];
        for (const f of this.level.friends) if (f.key && near(f)) ids.push(f.key);
        for (const h of this.level.hazards) if (h.key && near(h)) ids.push(h.key);
        for (const id of ids) {
            const e = this.reefBook.discover(id);
            if (!e) continue;
            this.progression.set?.('reefbook', this.reefBook.toJSON());
            this.bookToast(e);
        }
    }

    /** A small card in the corner: "New in the reef book" + picture + name. */
    bookToast(e) {
        if (this.ambientMode) return;
        const de = this.lang === 'de', H = this.scale.height;
        const box = this.add.container(30, H - 170).setScrollFactor(0).setDepth(55).setAlpha(0);
        box.add(this.add.rectangle(0, 0, 420, 130, 0x0d3b5c, 0.92).setOrigin(0).setStrokeStyle(3, 0xfff3b0, 0.9));
        if (e.image && this.textures.exists(e.image)) {
            const img = this.add.image(70, 65, e.image);
            img.setScale(Math.min(100 / img.width, 100 / img.height));
            box.add(img);
        }
        box.add(this.add.text(140, 24, de ? 'Neu im Riffbuch' : 'New in the reef book', { fontFamily: 'Arial', fontSize: '24px', color: '#fff3b0', fontStyle: 'bold' }));
        box.add(this.add.text(140, 60, e.name[this.lang] || e.name.en, { fontFamily: 'Arial', fontSize: '34px', color: '#ffffff', fontStyle: 'bold' }));
        play('nest');
        this.tweens.add({ targets: box, alpha: 1, y: H - 190, duration: 300, ease: 'Back.easeOut' });
        this.tweens.add({ targets: box, alpha: 0, delay: 2600, duration: 500, onComplete: () => box.destroy() });
    }

    /** Menu: open the reef book over the paused game. */
    openBook() {
        this.scene.pause();
        this.scene.launch(BOOK_KEY, { main: this });
        this.scene.bringToTop(BOOK_KEY);
    }

    /** Coins hop on the music's beat, all together (spec ch.12, music-synced world). */
    bobCoins() {
        const lift = COIN_BOB_PX * musicClock.pulse(nowSeconds(), 4);
        for (const c of this.level.coins) if (c.img.active) c.img.y = c.y - lift;
    }

    /** A move that can link into a chain (game/chain.js). Relaxed and ambient play have no counter. */
    chainMove(verb) {
        if (this.relaxed) return;
        const r = this.chain.add(verb, this.time.now);
        if (!r) return;
        this.events.emit('chain-move', r);
        // Heard, not only shown: from the second linked move each one climbs the biome's scale.
        if (r.count >= 2) play('chain', chainNote(this.biomeId(), r));
    }

    biomeId() { return BIOMES[biomeIndexAt(this.fish.sprite.x)].id; }

    /** A chain is over: nothing is lost, a few bonus coins drift in. */
    chainEnd(done) {
        if (!done) return;
        this.events.emit('chain-end', done);
        if (!done.bonus) return;
        this.coins += done.bonus;
        play('chainEnd', chainChord(this.biomeId()));
        const p = this.fish.sprite;
        const t = this.add.text(p.x, p.y - 90, `+${done.bonus}`, {
            fontFamily: 'Arial', fontSize: '52px', color: '#fff3b0', fontStyle: 'bold', stroke: '#0a3f6e', strokeThickness: 8
        }).setOrigin(0.5).setDepth(8);
        this.tweens.add({ targets: t, y: p.y - 190, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
    }

    /** Streak feedback: "x2", "x3"... when the counter steps up, a ring of light when a phrase completes. */
    streakFx(x, y, note) {
        if (note.completed) this.chainMove('trail');
        if (note.stepped) {
            const t = this.add.text(x, y - 60, `x${note.multiplier}`, {
                fontFamily: 'Arial', fontSize: '46px', color: '#fff3b0', fontStyle: 'bold',
                stroke: '#0a3f6e', strokeThickness: 8
            }).setOrigin(0.5).setDepth(8);
            this.tweens.add({ targets: t, y: y - 140, alpha: 0, scale: 1.3, duration: 700, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
        }
        if (note.completed) {
            const ring = this.add.circle(x, y, 40, 0xfff3b0, 0).setStrokeStyle(6, 0xfff3b0, 0.9).setDepth(3);
            this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 520, ease: 'Sine.easeOut', onComplete: () => ring.destroy() });
        }
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
            const bl = biomeBlendAt(x);
            const note = this.streak.add(nowSeconds(), (bl.t < 0.5 ? bl.a : bl.b).id);
            play('coin', note);
            this.streakFx(x, y, note);
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
            if (this.hurt(h.img.x, h.img.y)) return;
        }
    }

    /** Something hurt the fish from (x, y). Returns true when it went down. */
    hurt(x, y) {
        if (!this.fish.hit(new Phaser.Math.Vector2(x, y))) return false;
        this.chainEnd(this.chain.end());
        play('hit');
        this.hitStop = WORLD.hitStopMs;
        this.fish.squash = -0.3;
        this.health = Math.max(0, this.health - (this.character.armor ?? 1));
        this.cameras.main.shake(180, 0.008);
        if (this.health <= 0 && !this.respawning) { this.goDown(); return true; }
        return false;
    }

    /**
     * Swimming in thick oil (spec 7.1): a short touch only darkens the fish; staying
     * in a dense patch for OIL.graceS costs a heart, then a pause before it can again.
     */
    oilExposure(dt) {
        if (this.relaxed || this.respawning) return;
        const p = this.fish.sprite;
        const dense = this.particles.densityAt('oil', p.x, p.y, this.fish.radius + 30) >= OIL.denseCount;
        const t = this.oilTime || 0;
        this.oilTime = dense ? t + dt : (t > 0 ? Math.max(0, t - dt * 2) : Math.min(0, t + dt));
        if (this.oilTime > OIL.graceS) {
            this.oilTime = -OIL.pauseS;
            this.hurt(p.x, p.y - 40);
        }
    }

    /** Deep vents (the trench's bubble plants) breathe dark mineral plumes and steam (spec 6.1b). */
    ventPlumes(delta) {
        this.ventAt = (this.ventAt || 0) - delta;
        if (this.ventAt > 0) return;
        this.ventAt = VENT_PLUME.everyMs;
        const cam = this.cameras.main, m = VENT_PLUME.margin;
        for (const v of this.level.vents) {
            if (v.x < cam.scrollX - m || v.x > cam.scrollX + cam.width + m || v.y < cam.scrollY - m || v.y > cam.scrollY + cam.height + m) continue;
            if (BIOMES[biomeIndexAt(v.x)].id !== 'trench') continue;
            this.particles.spawn('smoker', v.x, v.y - 40, VENT_PLUME.smoke, { radius: 16, spread: 15, vy: -90 });
            this.particles.spawn('steam', v.x, v.y - 30, VENT_PLUME.steam, { radius: 10, spread: 25, vy: -120 });
        }
    }

    /** One fixed 60 Hz simulation step: all forces + physics, display-rate independent. */
    fixedStep() {
        if (this.ambientMode) {
            const p = this.fish.sprite;
            const f = this.autopilot.step(STEP_MS / 1000, p.x, p.y);
            if (f.x || f.y) this.fish.thrust(this.autoDir.set(f.x, f.y));
        } else if (!this.downTimer) this.controller.update(STEP_MS);
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
        // Currents: the water takes the player up to its own speed and never brakes it,
        // so a stream entered fast is left faster (flow.js).
        const water = this.flow.at(fsp.x, fsp.y, this.time.now / 1000, this.flowAt);
        if (!this.fish.inAir && !this.fish.hold && (water.x || water.y)) {
            const push = carry(water.x, water.y, fsp.body.velocity.x, fsp.body.velocity.y, FLOW, this.flowPush || (this.flowPush = { x: 0, y: 0 }));
            const sail = this.fish.mode?.flow ?? 1;      // a spread fan catches the current
            fsp.setVelocity(fsp.body.velocity.x + push.x * sail, fsp.body.velocity.y + push.y * sail);
        }
        // Chain moves: riding a current, and loops flown in the air.
        const fv = fsp.body.velocity;
        if (this.fish.inAir) { if (this.spin.turn(Math.atan2(fv.y, fv.x))) this.chainMove('flip'); }
        else {
            this.spin.reset();
            if (Math.hypot(water.x, water.y) >= CHAIN.streamSpeed && fv.x * water.x + fv.y * water.y > 0) this.chainMove('stream');
        }
        this.chainEnd(this.chain.tick(this.time.now));
        // Whatever carries the fish is the water's doing, not its own swimming (it must not turn to face it).
        this.fish.flow.set(water.x, water.y + (lifted ? Math.min(0, fsp.body.velocity.y) : 0));
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

        this.leakOil(delta);
        this.ventPlumes(delta);
        // Streams show themselves: bubbles are born along the lanes in view and ride them.
        this.streamBubbles = (this.streamBubbles || 0) + delta * WORLD.streamBubbles / 1000;
        if (this.streamBubbles >= 1) {
            const wv = this.cameras.main.worldView;
            for (const st of this.flow.streamsIn(wv.x - 200, wv.right + 200)) {
                for (let n = Math.floor(this.streamBubbles); n > 0; n--) {
                    const x = Phaser.Math.Between(Math.max(st.x0, wv.x - 200), Math.min(st.x1, wv.right + 200));
                    const y = streamY(st, x) + Phaser.Math.Between(-FLOW.streamWidth, FLOW.streamWidth) * 0.8;
                    if (y > 40 && this.level.isOpen(x, y)) this.particles.spawn('bubble', x, y, 1, { radius: 9, spread: 6 });
                }
            }
            this.streamBubbles %= 1;
        }
        this.particles.update(delta / 1000);
        const pl = this.swarmPlayer;   // swarms think in px/s, the body in px per step
        pl.x = view.x; pl.y = view.y; pl.vx = v.x * 60; pl.vy = v.y * 60; pl.fright = this.character.fright || 1;
        this.swarms.update(delta / 1000, view.x, view.y, pl);
        this.oilExposure(delta / 1000);
        this.bobCoins();
        this.discover(delta);
        if (!this.ambientMode) this.updateGuide(delta / 1000);

        // Bubble trail when moving fast.
        const speed = Math.hypot(v.x, v.y);
        this.trailAt = (this.trailAt || 0) - delta;
        if (speed > 9 && this.trailAt <= 0 && !this.fish.inAir) {
            this.trailAt = 55;
            this.particles.spawn('bubble', view.x - v.x * 3, view.y - v.y * 3, 1, { radius: 20, spread: 20 });
        }

        // Contrails: at high speed the fin tips draw thin bubble streaks (vortex trails).
        if (speed > CONTRAIL.speed && !this.fish.inAir) {
            const r = this.fish.radius, f = this.fish.facing, a = view.rotation;
            const ca = Math.cos(a), sa = Math.sin(a);
            for (const [ox, oy] of CONTRAIL.tips) {
                const lx = ox * r * f, ly = oy * r;
                this.particles.spawn('contrail', view.x + lx * ca - ly * sa, view.y + lx * sa + ly * ca, 1, { spread: 4 });
            }
        }

        // Sand is kicked up when swimming fast just above the ground.
        this.sandAt = (this.sandAt || 0) - delta;
        if (speed > 4 && this.sandAt <= 0 && !this.fish.inAir) {
            const ground = this.level.groundBelow(view.x, view.y + this.fish.radius * 0.5, 130);
            if (ground) {
                this.sandAt = 70;
                // Silt from the shared particle simulation: thrown up and back, it drifts and settles.
                this.particles.spawn('silt', view.x, ground.y - 6, Math.round(2 + Math.min(4, speed / 4)),
                    { radius: 50, spread: 40, vx: -v.x * 20, vy: -60 });
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
        this.midLayers.update(this.camX, this.camY);
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
