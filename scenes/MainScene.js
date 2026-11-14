import Phaser from 'phaser';
import ProgressionManager from '../systems/ProgressionManager.js';
import { savepoint, addSavepoint, fromCookie, toCookie } from '../systems/savepoints.js';
import WorldState from '../systems/worldState.js';
import Player from '../game/Player.js';
import Multiplayer from '../game/Multiplayer.js';
import LevelGenerator, { LEVEL } from '../game/level/LevelGenerator.js';
import { BIOMES, biomeIndexAt, biomeBlendAt, mixColor, spotFor, dropOffView, REEF_CREST , waterHue, WATER_LIGHT, atLuma } from '../game/level/biomes.js';
import { UNSTICK, popOut, wedged, Stillness } from '../game/level/unstick.js';
import Backdrop from '../game/level/Backdrop.js';
import WaterLight from '../game/fx/WaterLight.js';
import ParticleLayer from '../game/fx/ParticleLayer.js';
import SwarmLayer from '../game/ai/SwarmLayer.js';
import SeabirdLayer from '../game/ai/SeabirdLayer.js';
import { ghostShip } from '../game/level/setPieces.js';
import { CLEANER } from '../game/ai/cleaner.js';
import DeepGlowLayer from '../game/level/DeepGlowLayer.js';
import CleanerLayer from '../game/ai/CleanerLayer.js';
import { glowShare } from '../game/level/deepGlow.js';
import FarLayers from '../game/level/FarLayers.js';
import RockLayers from '../game/level/RockLayers.js';
import { makeController, CONTROL_SCHEMES } from '../game/controls/index.js';
import { getCharacter, loadSelectedId } from '../game/characters.js';
import { WaterSurface } from '../game/level/surface.js';
import { FLOW, createFlow, streamY, carry } from '../game/level/flow.js';
import { play, nowSeconds, musicClock, updateMusic, updateWeatherSound } from '../game/audio.js';
import { createStreak, chainNote, chainChord } from '../game/music/melody.js';
import { CHAIN, createChain, createSpin, coinWorth } from '../game/chain.js';
import BoosterLayer from '../game/level/BoosterLayer.js';
import SpeedLines from '../game/fx/SpeedLines.js';
import { createAutopilot } from '../game/ambient/autopilot.js';
import { createGuide } from '../game/guide.js';
import { createBook } from '../game/reefbook.js';
import { JOURNEY, createJourney } from '../game/journey.js';
import StoryBeats from '../game/StoryBeats.js';
import SetPieceLayer from '../game/level/SetPieceLayer.js';
import BranchLayer from '../game/level/BranchLayer.js';
import DocksLayer from '../game/level/DocksLayer.js';
import MantaLayer from '../game/ai/MantaLayer.js';
import SeaArchLayer from '../game/level/SeaArchLayer.js';
import RescueLayer, { RESCUES } from '../game/RescueLayer.js';
import BloomLayer from '../game/level/BloomLayer.js';
import BaitBallLayer from '../game/level/BaitBallLayer.js';
import RaftLayer from '../game/level/RaftLayer.js';
import MeadowLayer from '../game/level/MeadowLayer.js';
import VentFieldLayer from '../game/level/VentFieldLayer.js';
import ContainerLayer from '../game/level/ContainerLayer.js';
import { seaArch } from '../game/level/seaArch.js';
import { DOCKS, docksSpot } from '../game/level/docks.js';
import { BRANCH, caveFlow } from '../game/level/branches.js';
import { createPerfTour, perfReport } from '../game/perfTour.js';
import { updateCaustics } from '../game/fx/CausticsPipeline.js';
import { surgeAt, breakerAt, ripAt, surfZones } from '../game/level/surf.js';
import SurfLayer from '../game/fx/SurfLayer.js';
import { lightAt, murkAt, nightShare, sunAt } from '../game/level/light.js';
import { WEATHER, stormShare, stormAt, downAt, weatherNear, weatherZones } from '../game/level/weather.js';
import StormLayer from '../game/fx/StormLayer.js';
import Whale, { WHALE_SCENE } from '../game/Whale.js';
import { FOREGROUND, boxHitsCircle, fadeStep } from '../game/level/occluders.js';
import { ROUTE, nestReached } from '../game/level/density.js';
import { BOOK_KEY, placeBadge } from './ReefBookScene.js';
import { STYLE_KEY } from './PlayStyleScene.js';
import { HUD_KEY } from './HudScene.js';
import { SCENE_KEYS } from './keys.js';
import { fitToWindow, misfit } from '../game/orientation.js';

const STEP_MS = 1000 / 60;

/** World tunables. */
/** Leaking oil drums (spec 7.1): how often they puff and how much. */
// `crack`: where the oil leaves the drum, in shares of its displayed size from its centre.
const OIL = { pulseMs: 450, perPulse: 2, margin: 600, denseCount: 6, graceS: 1.2, pauseS: 2.5, crack: [0.19, -0.34] };
/** Plumes at the trench's vents: how often, how many smoke and steam particles. */
const VENT_PLUME = { everyMs: 900, smoke: 3, steam: 2, margin: 500 };
/** Margin below the rock threshold that counts as open water for the guide and the autopilot. */
const OPEN_SLACK = 0.04;
const GRUMPY_HIT = 0.5;      // hearts a grumpy's shove costs (spec 7.1)
const STYLE_ASK_MS = 1600;   // after the nest cheer, ask how to play (once)
/** Fin-tip contrails: from this speed (px per step), at these tips (× body radius, nose = +x). */
const CONTRAIL = { speed: 11, tips: [[-0.35, -0.55], [-0.35, 0.55]] };
/** Glowing plankton in the wake at night and in the deep (spec 5.0k): from this speed (px per step), one spark per `everyMs` at full glow. */
/** `?sky=<seconds>` starts the sky cycle there (checking sunset and night without waiting). */
const SKY_START = Number(new URLSearchParams(window.location.search).get('sky')) || 0;
const PLANKTON = { speed: 3, everyMs: 30, from: 0.25 };
/** Reef book: how often to look around, and how close counts as seen up close (px). */
const BOOK = { scanMs: 300, seePx: 420 };
/** How high coins hop on each beat (px). */
const COIN_BOB_PX = 12;

const WORLD = {
    gravity: 0.12,         // gentle sink
    cameraEase: 0.88,     // per-step camera lag (lower = snappier)
    lookAhead: 9,         // camera leads the fish by velocity * this
    refitAt: 0.03,        // the picture fills AND fits the screen (user 2026-11-14): a settled shape change beyond this share lays the game out again
    caveDepth01: 0.8,     // how deep the music is played inside the side cave (0 surface .. 1 deepest)
    nightDepth01: 0.7,    // at night the score plays as if this deep: sparser and softer
    wakeS: 1.6,           // s the whale's wake carries the fish on after her send-off
    weatherRange: 7000,   // px from the storm or the downwelling at which their looks are built
    wallLook: 0.26,       // at a drop-off the camera looks down by this share of the screen height
    doubleTapMs: 320,
    doubleTapDist: 110,
    maxHealth: 5,
    hitStopMs: 70,
    ventLift: 0.0026,     // upward force per unit mass inside a bubble column
    puffSail: 1.5,        // a puffed fish is big and light: the water pushes it this much harder (spec 5.0d)
    tumbleAt: 4,          // px/step of breaker push that tumbles the fish (squash, bubbles)
    tumbleMs: 900,        // at most one tumble per this long
    rushFull: 9,          // px/step of moving water (surge, breaker, downwelling) heard at full rush
    creakR: 1800,         // px: the ghost ship is heard creaking this close ...
    creakMs: 5000,        // ... about this often
    friendBonus: 5,
    schoolRadius: 420,    // friends (other players) this close swim as a school ...
    schoolBoost: 0.1,     // ... each of up to two makes you this much faster
    streamBubbles: 45,    // bubbles per second that mark each stream in view
    laneGlints: 22,       // light motes per second along the calm main route in view (spec 5.2c)
    roomReach: 320,       // a pose that needs more room may move the player this far to find it
    downedMs: 5000,       // playing together: how long friends have to revive you before the nest respawn
    reviveHealth: 2
};

export default class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: SCENE_KEYS.MAIN });
    }

    create(data) {
        fitToWindow(this.game);     // the picture fills the screen, whatever its shape
        // The window got a clearly different shape while playing: lay everything out again for it
        // and carry on where the fish was; until then the picture covers the screen (a sliver cropped).
        this.resume = data?.resume || null;
        this.resumed = !!this.resume;     // carrying on after a reshape: no fresh biome banner
        const refit = () => {
            if (this.refitting || this.mp || !misfit(this.game, WORLD.refitAt)) return;
            this.refitting = this.time.delayedCall(600, () => {
                this.refitting = null;
                if (!misfit(this.game, WORLD.refitAt)) return;
                const sp = this.fish.sprite;
                this.scene.restart({ resume: { x: sp.x, y: sp.y, coins: this.coins, health: this.health } });
            });
        };
        this.scale.on('resize', refit);
        this.events.once('shutdown', () => this.scale.off('resize', refit));
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
        this.storm = null;                                 // dark sky, rain, and the look of the downwelling (spec 5.0c): built when one of them is near
        this.surf = null;                                  // surge foam on the beach, breakers on the reef's edge (spec 5.0d): built when the coast they belong to is near
        this.hitStop = 0;                    // ms the action freezes after a hit (impact feel)
        this.chain = createChain();          // linked moves (game/chain.js); shown by the HUD, not in relaxed play
        this.spin = createSpin();            // loops flown in the air
        this.airAt = 0;
        this.streak = createStreak();        // coins in a row play a melody (game/music/melody.js)
        this.backdrop = new Backdrop(this, LEVEL.maxDepth);
        this.farLayers = new FarLayers(this);     // far scenery: single objects, each at its own parallax depth
        this.waterLight = new WaterLight(this);   // light shafts, caustics, depth grade
        // What has been collected stays collected (per chunk bitfields, see worldState.js).
        // Playing together, the room has its own memory, separate from the solo journey.
        this.world = new WorldState(window.localStorage, Multiplayer.worldKey(this.registry) || 'sll_world', `${LEVEL.seed}.${LEVEL.version}`);
        this.level = new LevelGenerator(this, this.world);
        this.rockLayers = new RockLayers(this);   // near and mid-range rock behind the play plane (needs the level's materials)
        this.density = (x, y) => this.level.density(x, y);
        // Currents and swell: one field for player and particles. Streams lose their pull at the calm route.
        this.flow = createFlow(LEVEL.seed, FLOW, x => this.level.field.routeY(x), (x, y) => y > 60 && this.level.density(x, y) < LEVEL.threshold);
        this.flowAt = { x: 0, y: 0 };
        this.particles = new ParticleLayer(this, this.particleEnv());   // silt, bubbles, oil... (spec 6.1b)
        this.swarms = new SwarmLayer(this, {   // shoals of small fish around the view (spec 6.2)
            isOpen: (x, y) => this.level.isOpen(x, y, OPEN_SLACK),
            flowAt: this.particles.env.flowAt,
            biomeAt: x => BIOMES[biomeIndexAt(x)].id,
            waterAt: x => { const bl = biomeBlendAt(x); return mixColor(bl.a.water[0], bl.b.water[0], bl.t); },
            homes: [{ ...ghostShip(), id: 'silverside' }]   // a shoal shelters in the ghost ship's hull (spec 5.0e)
        });
        this.swarmPlayer = { x: 0, y: 0, vx: 0, vy: 0 };
        // Gannets over the island coasts dive after shoals and after a fish near the surface (spec 5.0d).
        // Light of its own in the deep: glowing jellies, strings and plankton sparks (spec 5.0e).
        this.deepGlow = new DeepGlowLayer(this, (x, y) => this.level.isOpen(x, y, OPEN_SLACK));
        // The cleaner station on the reef: float in calmly to be cleaned (spec 5.0f).
        this.cleaner = new CleanerLayer(this, x => this.level.field.routeY(x), (x, y) => this.level.isOpen(x, y, OPEN_SLACK), (ev, x, y) => this.cleanerEvent(ev, x, y));
        this.seabirds = new SeabirdLayer(this, {
            surfaceY: x => this.surface.heightAt(x, this.time.now / 1000),
            // Rock between the fish and the surface hides it (the air above is not "open" water).
            covered: (x, y) => {
                const top = this.surface.heightAt(x, this.time.now / 1000) + 20;
                for (let k = y - 50; k > top; k -= 60) if (!this.level.isOpen(x, k)) return true;
                return false;
            }
        }, (ev, x, y) => this.seabirdEvent(ev, x, y));
        this.reefBook = createBook(this.progression.get?.('reefbook', []) || []);   // discovery journal (spec 5.2d)
        // The story path: a friend to free in every chapter, right on the calm route (spec ch.9).
        this.journey = createJourney(this.progression.get?.('journey', []) || []);
        this.beats = this.ambientMode ? null : new StoryBeats(this, this.journey, x => this.level.field.routeY(x), (ch, x, y) => this.freeFriend(ch, x, y));
        // The great whale of the open blue: free her from the net and she carries you east (spec 9.0).
        const whaleAt = this.journey.event(WHALE_SCENE.id);
        this.whale = this.ambientMode || !whaleAt ? null
            : new Whale(this, this.journey, whaleAt.x, whaleAt.endX, x => this.level.field.routeY(x), (ev, x, y) => this.whaleEvent(ev, x, y));
        // The set pieces of the long sea stretches (spec 5.0e): the ghost ship, and the beacon over the grand nest.
        this.setPieces = new SetPieceLayer(this, this.level.nests[this.level.nests.length - 1], this.level.nests.slice(0, -1));
        // A danger branch (spec 5.2c): the side cave under the route on the kelp island, with its clam and pearl.
        this.pearls = this.progression.get?.('pearls', []) || [];
        this.branch = new BranchLayer(this, this.level.field.cave, this.pearls.includes('kelp_cave'), (x, y) => this.takePearl('kelp_cave', x, y));
        // ... and the docks under the harbour's pier, with the hermit crab stuck in a bottle cap.
        this.docks = new DocksLayer(this, docksSpot(), this.pearls.includes('docks_crab'), (x, y) => this.freeCrab(x, y));
        // The reef's wonder beat (spec 9.1): a manta glides to and fro high over the reef.
        this.manta = new MantaLayer(this, x => this.level.field.routeY(x), () => this.bookEntry('manta'));
        // The rocky shore's set piece (spec 5.0g): the sea arch, with its arc of coins for a jump through it.
        this.arch = new SeaArchLayer(this, seaArch(), inAir => this.throughArch(inAir), (x, y) => this.coinTaken(x, y));
        // Small rescues between the chapters (spec 5.0i): an animal in a bit of net every so often on the route.
        this.rescues = this.ambientMode ? null : new RescueLayer(this, x => this.level.field.routeY(x), (x, y) => this.seabedBelow(x, y), this.progression.get?.('rescues', []) || [], (spot, x, y) => this.smallRescue(spot, x, y), (x, y) => this.coinTaken(x, y));
        // Moon jelly blooms drift across the route in the open seas (spec 5.0i).
        this.blooms = new BloomLayer(this, x => this.level.field.routeY(x), () => this.bookEntry('friend_jellyfish'));
        // The bait ball in the open blue: hide in the swirl, gannets plunge and leave coins (5.0k).
        this.baitBalls = new BaitBallLayer(this, x => this.level.field.routeY(x), x => this.surface.heightAt(x, this.time.now / 1000),
            (x, y) => this.coinTaken(x, y), x => this.seabirdEvent('splash', x, this.surface.heightAt(x, this.time.now / 1000)),
            () => this.bookEntry('school_silverside'));
        // ... and at their surface float sargassum rafts; a skip off a wave sends flying fish out of the water.
        this.rafts = new RaftLayer(this, x => this.surface.heightAt(x, this.time.now / 1000), () => this.bookEntry('sargassum'));
        // The lagoon's eel meadow: garden eels that slip into the sand, and a ray that glides off.
        // The vent field at the trench's end: glowing black smokers whose warm water lifts the fish toward the grand nest.
        this.ventField = new VentFieldLayer(this, x => this.seabedBelow(x, this.level.field.routeY(x)), x => this.level.field.routeY(x), (x, y) => this.coinTaken(x, y), kind => this.bookEntry(kind));
        this.meadow = new MeadowLayer(this, x => this.level.field.routeY(x), x => this.seabedBelow(x, this.level.field.routeY(x)), (x, y) => this.coinTaken(x, y), kind => this.bookEntry(kind));
        // Lost shipping containers drifting half sunk off the harbour; the route runs through two of them.
        this.containers = new ContainerLayer(this, x => this.level.field.routeY(x), (x, y) => this.coinTaken(x, y), () => this.bookEntry('container_field'));
        this.guide = createGuide({ isOpen: (x, y) => this.level.isOpen(x, y, OPEN_SLACK), routeY: x => this.level.field.routeY(x) });   // shows the way when stuck (spec 1.4)

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
        if (this.resume) { this.coins = this.resume.coins; this.health = this.resume.health; this.resume = null; }      // once: a respawn goes to the nest as always
        this.biomeIndex = -1;
        this.best = this.progression.get?.('best_coins', 0) || 0;

        // HUD (menu, scheme switcher, puff button, counters) runs as its own
        // scene on top — see HudScene.
        if (this.ambientMode) this.startAmbient();
        if (new URLSearchParams(window.location.search).get('perftest')) {
            this.relaxed = true;
            this.perfTour = createPerfTour(LEVEL.spawn.x, this.level.nests[this.level.nests.length - 1].x, x => BIOMES[biomeIndexAt(x)].id);
        }
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

        // Bubble cannons and bounce pads along the streams (game/level/boosters.js).
        // Cannons and pads are optional: none inside the calm route.
        this.boosters = new BoosterLayer(this, this.flow, (x, y) => y > 60 && this.density(x, y) <= LEVEL.threshold
            && Math.abs(y - this.level.field.routeY(x)) > ROUTE.halfWidth);

        this.speedLines = new SpeedLines(this);     // streaks rushing past while in flow
        // ?debug=flow: arrows show where the water moves and how fast (also with the Debug button).
        this.flowDebug = new URLSearchParams(window.location.search).get('debug') === 'flow';
        // ?debug=ai: every creature shows what it is doing right now (spec 6.2 readability guard).
        this.aiDebug = new URLSearchParams(window.location.search).get('debug') === 'ai';
        this.aiLabels = new Map();

        // A special (fan, pulse...) is sudden: nearby shoals scatter in a panic wave.
        // A grumpy's shove (ai/grumpy.js, spec 7.1): half a heart, never the last half; relaxed play only gets the push.
        this.events.on('grumpy-hit', ({ x, y }) => this.softHit(x, y));
        this.events.on('fish-special', ({ x, y }) => { this.docks.special(x, y); this.beats?.special(x, y); this.rescues?.special(x, y); this.swarms.startle(x, y); this.level.startle(x, y); this.mp?.alarm(x, y); this.chainMove('special'); });

        // Splash when the fish breaks the surface in either direction.
        this.events.on('fish-splash', ({ x, y, speed, entering, skim }) => {
            // Chain moves: a fast jump out, a landing after real air time, a skip off a wave.
            if (skim) { this.chainMove('skim'); this.rafts.skim(x, this.fish.sprite.body.velocity.x, this.time.now / 1000); }
            else if (!entering && speed >= CHAIN.minLeap) {
                this.airAt = this.time.now; this.chainMove('leap');
                // Any fast leap out at sea startles flying fish too (not only a glider's skip): every character sees them.
                this.rafts.skim(x, this.fish.sprite.body.velocity.x, this.time.now / 1000);
            }
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
            this.seabirds.destroy();
            this.deepGlow.destroy();
            this.cleaner.destroy();
            this.boosters.destroy();
            this.speedLines.destroy();
            this.events.off('fish-special');
            this.events.off('grumpy-hit');
            document.removeEventListener('visibilitychange', saveNow);
            window.removeEventListener('pagehide', saveNow);
            this.scene.stop(HUD_KEY);
            this.level.worker?.terminate();
            this.rockLayers.destroy();
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
        if (this.resume) return this.safeSpot(this.resume.x, this.resume.y);      // carrying on after the window changed shape
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

    /** A friend is out of its net (StoryBeats): thanks, coins, a heart, and the journey remembers. */
    freeFriend(ch, x, y) {
        const de = this.lang === 'de', name = ch.friend.name;
        this.progression.set?.('journey', this.journey.toJSON());
        this.coins += JOURNEY.coins;
        this.health = Math.min(this.maxHealth, this.health + 1);
        play('friend'); play('nest');
        this.announce(de ? `${name} ist frei!` : `${name} is free!`,
            de ? `${this.journey.count} von ${this.journey.total} Freunden gefunden` : `${this.journey.count} of ${this.journey.total} friends found`);
        for (let i = 0; i < 9; i++) {
            const a = (i / 9) * Math.PI * 2;
            const heart = this.add.text(x, y, '♥', { fontFamily: 'Arial', fontSize: '60px', color: '#ff6b9a', stroke: '#ffffff', strokeThickness: 8 }).setOrigin(0.5).setDepth(8);
            this.tweens.add({ targets: heart, x: x + Math.cos(a) * 230, y: y + Math.sin(a) * 180 - 60, alpha: 0, duration: 1300, ease: 'Sine.easeOut', onComplete: () => heart.destroy() });
        }
        this.events.emit('journey-free', ch);
    }

    /** An animal's shove or peck (grumpy, seabird): half a heart, never the last half; relaxed play only gets the push. */
    softHit(x, y) {
        if (this.relaxed || this.health <= GRUMPY_HIT) { this.fish.hit(new Phaser.Math.Vector2(x, y)); return; }
        this.hurt(x, y, GRUMPY_HIT);
    }

    /** The cleaner station (spec 5.0f): the wrasse come over, clean, and give half a heart back. */
    cleanerEvent(ev, x, y) {
        const p = this.fish.sprite;
        if (ev === 'clean') { play('tap'); this.particles.spawn('bubble', p.x, p.y, 6, { radius: 10, spread: 40 }); }
        else if (ev === 'heal') {
            this.health = Math.min(this.maxHealth, this.health + CLEANER.heal);
            play('friend'); this.particles.spawn('glint', p.x, p.y, 14, { radius: 12, spread: 60 });
            this.bookEntry('cleaner_station');
        } else if (ev === 'scatter') this.swarms.startle(x, y);
    }

    /** A seabird's hunt, as it happens (game/ai/SeabirdLayer.js, spec 5.0d). */
    seabirdEvent(ev, x, y) {
        const near = Math.abs(x - this.fish.sprite.x) < 1400;
        if (ev === 'aim' && near) play('cry');
        else if (ev === 'splash') {
            this.surface.splash(x, 4, 2.5);
            if (near) play('splash', 1.4);
            this.particles.spawn('bubble', x, y + 30, 10, { radius: 14, spread: 30 });
        } else if (ev === 'strike') this.swarms.startle(x, y);
        else if (ev === 'hit') { this.softHit(x, y); this.particles.spawn('bubble', x, y, 8, { radius: 12, spread: 40 }); }
        else if (ev === 'bounce') { play('boing'); this.swarms.startle(x, y); }
    }

    /** The great whale's story, as it happens (game/Whale.js). */
    whaleEvent(ev, x, y) {
        const de = this.lang === 'de';
        if (ev === 'cut') {
            play('grab');
            this.announce('', de ? 'Noch ein Stück Netz!' : 'One more piece of net!');
        } else if (ev === 'freed') {
            this.journey.free(WHALE_SCENE.id);
            this.progression.set?.('journey', this.journey.toJSON());
            this.coins += JOURNEY.coins * 2;
            this.health = this.maxHealth;
            play('whale'); play('nest');
            this.announce(de ? 'Der Wal ist frei!' : 'The whale is free!', de ? 'Bleib an ihrem Rücken: sie trägt dich!' : 'Stay at her back: she will carry you!');
            for (let i = 0; i < 12; i++) {
                const a = (i / 12) * Math.PI * 2;
                const heart = this.add.text(x, y, '♥', { fontFamily: 'Arial', fontSize: '72px', color: '#ff6b9a', stroke: '#ffffff', strokeThickness: 8 }).setOrigin(0.5).setDepth(8);
                this.tweens.add({ targets: heart, x: x + Math.cos(a) * 520, y: y + Math.sin(a) * 300 - 80, alpha: 0, duration: 1700, ease: 'Sine.easeOut', onComplete: () => heart.destroy() });
            }
        } else if (ev === 'ride') {
            play('whale');
        } else if (ev === 'send') {
            // The ride ends with a flick of her fluke: her rider shoots on, up toward the route.
            const sp = this.fish.sprite, go = this.whale.sendOff(sp);
            if (!go) return;
            sp.setVelocity(go.x, go.y);
            this.wake = { x: go.x, y: go.y, left: WORLD.wakeS };      // her wake carries the fish on for a moment (fixedStep)
            play('whale'); play('leap');
            this.particles.spawn('bubble', sp.x, sp.y, 16, { radius: 14, spread: 80 });
            this.announce('', de ? `Danke, ${this.character.name}!` : `Thank you, ${this.character.name}!`);
        }
    }

    /** `?perftest=1`: hop along the whole calm route and report the worst numbers per biome (game/perfTour.js). */
    runPerfTour(delta, logicMs) {
        const tour = this.perfTour;
        if (tour.done) return;
        // A chunk build counts in the frame it happened in, under its own budget: its time is taken
        // out of that frame's logic (the builds right after a hop fall into the tour's skipped frames).
        const built = this.level.buildMs.count !== this.perfBuilds;
        this.perfBuilds = this.level.buildMs.count;
        const chunkMs = built ? this.level.buildMs.last : 0;
        tour.sample({ logicMs: Math.max(0, logicMs - chunkMs), chunkMs, objects: this.children.list.length, tweens: this.tweens.getTweens().length });
        if (tour.step(delta)) {
            const p = this.safeSpot(tour.x, this.level.field.routeY(tour.x));
            this.fish.place(p.x, p.y);
            this.fish.sprite.setVelocity(0, 0);
            this.camX = p.x - this.scale.width / 2; this.camY = p.y - this.scale.height / 2;
        }
        if (!tour.done) return;
        const rows = tour.rows(), lines = perfReport(rows);
        window.__perftest = rows;      // for automated runs
        const text = lines.join(String.fromCharCode(10));
        console.log(text);
        this.add.text(40, 120, text, { fontFamily: 'monospace', fontSize: '26px', color: '#b6ffb0', backgroundColor: '#000000cc', padding: { x: 14, y: 12 } })
            .setScrollFactor(0).setDepth(99);
    }

    /** The seabed straight below (x, y) within a rescue's reach, or null (open water all the way). */
    seabedBelow(x, y) {
        for (let at = y; at < y + RESCUES.groundReach; at += 20) if (!this.level.isOpen(x, at, 0)) return at;
        return null;
    }

    /** A small animal is out of its bit of net (RescueLayer): a few coins, a cheer, its stamp in the reef book. */
    smallRescue(spot, x, y) {
        this.progression.set?.('rescues', this.rescues.toJSON());
        this.coins += RESCUES.coins;
        play('friend');
        this.chainMove('special');
        this.bookEntry(spot.kind);
        this.announce(this.lang === 'de' ? 'Befreit!' : 'Set free!', `+${RESCUES.coins}`);
        this.particles.spawn('bubble', x, y, 8, { radius: 9, spread: 46 });
    }

    /**
     * May a layer build its scene now? Only one lazy build per frame (a rescue, a bloom, a raft,
     * the manta ...): arriving somewhere never stacks several builds into one frame. A layer that
     * is told no simply asks again next frame.
     */
    buildSlot() {
        const frame = this.game.loop.frame;
        if (this.lastBuildFrame === frame) return false;
        this.lastBuildFrame = frame;
        return true;
    }

    /** Through the sea arch: a chain move, the first time an entry in the reef book; flown through, a cheer. */
    throughArch(inAir) {
        this.chainMove('arch');
        this.bookEntry('sea_arch');
        if (!inAir) return;
        play('friend');
        this.announce(this.lang === 'de' ? 'Durchs Felsentor!' : 'Through the sea arch!');
    }

    /** The hermit crab under the docks is out of its bottle cap: coins, a cheer, an entry in the reef book. Once per save. */
    freeCrab(x, y) {
        const de = this.lang === 'de';
        this.pearls.push('docks_crab');
        this.progression.set?.('pearls', this.pearls);
        this.coins += DOCKS.coins;
        play('friend');
        this.bookEntry('hermit_crab');
        this.announce(de ? 'Der Krebs ist frei!' : 'The crab is free!', `+${DOCKS.coins}`);
        this.particles.spawn('bubble', x, y, 10, { radius: 10, spread: 50 });
    }

    /** The pearl of a giant clam at the end of a side way: coins, a cheer, an entry in the reef book. Once per save. */
    takePearl(id, x, y) {
        const de = this.lang === 'de';
        this.pearls.push(id);
        this.progression.set?.('pearls', this.pearls);
        this.coins += BRANCH.coins;
        play('nest'); play('friend');
        this.chainMove('special');
        this.bookEntry('giant_clam');
        this.announce(de ? 'Eine Perle!' : 'A pearl!', `+${BRANCH.coins}`);
        this.particles.spawn('glint', x, y, 14, { spread: 90 });
    }

    /** Time counted in waves: the sea breathes with the music, one wave every two bars. */
    wavePhase() {
        return musicClock.phase(nowSeconds()).beat / (musicClock.beatsPerBar * 2);
    }

    /** Swam into a nest: coins are safe, this is the new restart point. */
    reachNest(nest) {
        if (this.perfTour) return;      // the perf tour only measures: no cheers, questions or end screen
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
        // Every nest is a savepoint, kept in a cookie and offered on the title screen.
        if (!nest.grand && !this.mp && !this.ambientMode) {
            try {
                const list = addSavepoint(fromCookie(document.cookie), savepoint({ nest: this.nestIndex, coins: this.banked,
                    character: this.character.id, journey: this.journey.toJSON(), relaxed: this.relaxed, biome: BIOMES[biomeIndexAt(nest.x)].id }));
                document.cookie = toCookie(list);
            } catch { /* cookies blocked: the localStorage progress still works */ }
        }
        if (nest.grand) {
            this.progression.set?.('nest', 0);
            this.progression.set?.('banked', 0);
            this.progression.set?.('journey', []);
            const friends = this.journey.toJSON();      // for the end screen: who came along
            this.time.delayedCall(900, () => this.scene.start(SCENE_KEYS.END, { score: this.coins, distance: this.maxDepth, won: true, friends }));
            this.announce(de ? 'Das große Nest!' : 'The Grand Nest!', de ? 'Du hast es geschafft!' : 'You made it!');
        } else if (first) {
            this.announce(de ? 'Nest erreicht!' : 'Nest reached!', de ? 'Münzen gesichert · hier geht es weiter' : 'Coins saved · you restart here');
            // The first nest asks once how to play (spec 1.4): relaxed or adventure.
            if (!this.mp && !this.ambientMode && !this.perfTour && !this.progression.get?.('style_asked', false)) {
                this.progression.set?.('style_asked', true);
                this.time.delayedCall(STYLE_ASK_MS, () => {
                    this.scene.pause();
                    this.scene.launch(STYLE_KEY, { main: this });
                    this.scene.bringToTop(STYLE_KEY);
                });
            }
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
            this.swarms.arrive(p.x, p.y);      // back at the nest the water is not empty: a shoal swims into the picture
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
        this.progression.set?.('journey', []);
        this.progression.set?.('pearls', []);
        this.world.reset();
        this.scene.restart();
    }

    finish() {
        if (this.coins > this.best) this.progression.set?.('best_coins', this.coins);
        this.scene.start(SCENE_KEYS.END, { score: this.coins, distance: this.maxDepth, friends: this.journey.toJSON() });
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

    /** Debug only: a label over every creature with a mind, naming its state. */
    drawAi() {
        for (const f of this.level.friends) {
            const mind = f.img.mind;
            if (!mind || !f.img.active || this.aiLabels.has(f.img)) continue;
            this.aiLabels.set(f.img, this.add.text(0, 0, '', { fontFamily: 'Arial', fontSize: '26px', color: '#ffffff', stroke: '#0a3f6e', strokeThickness: 6 }).setOrigin(0.5).setDepth(9.6));
        }
        for (const [img, label] of this.aiLabels) {
            if (!img.active) { label.destroy(); this.aiLabels.delete(img); continue; }
            label.setText(img.mind.state).setPosition(img.x, img.y - img.height * 0.5 - 24);
        }
    }

    /** Debug only: the flow field as arrows on a grid, redrawn a few times a second. */
    drawFlow(delta) {
        const on = this.flowDebug || this.debugOn;
        if (!on && !this.flowArrows) return;
        if (!this.flowArrows) this.flowArrows = this.add.graphics().setDepth(9.5);
        this.flowArrows.setVisible(on);
        this.flowDrawAt = (this.flowDrawAt || 0) - delta;
        if (!on || this.flowDrawAt > 0) return;
        this.flowDrawAt = 200;
        const g = this.flowArrows.clear(), wv = this.cameras.main.worldView, t = this.time.now / 1000, out = this.flowProbe || (this.flowProbe = { x: 0, y: 0 });
        // The calm main route: its middle and the band hazards keep out of.
        g.lineStyle(4, 0x7dffb0, 0.8);
        for (let x = Math.floor(wv.x / 60) * 60; x < wv.right; x += 60) g.lineBetween(x, this.level.field.routeY(x), x + 60, this.level.field.routeY(x + 60));
        const cell = 90;
        for (let x = Math.floor(wv.x / cell) * cell; x < wv.right; x += cell) {
            for (let y = Math.max(cell, Math.floor(wv.y / cell) * cell); y < wv.bottom; y += cell) {
                this.flow.at(x, y, t, out);
                const speed = Math.hypot(out.x, out.y);
                if (speed < 0.15) continue;
                // Colour by speed: pale = swell, yellow = a stream slower than the player, red = faster.
                g.lineStyle(3, speed < 2 ? 0xbfe8ff : speed < 14 ? 0xffe066 : 0xff6b4a, 0.85);
                const len = Math.min(cell * 0.8, 10 + speed * 3.2), ux = out.x / speed, uy = out.y / speed;
                const x2 = x + ux * len, y2 = y + uy * len;
                g.lineBetween(x, y, x2, y2);
                g.lineBetween(x2, y2, x2 - ux * 10 - uy * 6, y2 - uy * 10 + ux * 6);
                g.lineBetween(x2, y2, x2 - ux * 10 + uy * 6, y2 - uy * 10 - ux * 6);
            }
        }
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
    /**
     * The water's velocity at (x, y) in px per physics step: currents and swell (flow.js), the
     * coast's surge and breakers (surf.js), the storm's churned top and the downwelling
     * (weather.js). One field for the fish, particles and shoals, so everything sways together.
     */
    waterAt(x, y, out) {
        this.flow.at(x, y, this.time.now / 1000, out);
        if (this.waveT !== this.time.now) { this.waveT = this.time.now; this.waves = this.wavePhase(); }   // once per frame: particles ask often
        const waves = this.waves, add = this.waterAdd || (this.waterAdd = { x: 0, y: 0 });
        // Asked hundreds of times a frame (every shoal fish, every particle): each force is only
        // looked at inside its own stretch of the world.
        const z = this.waterZones || (this.waterZones = { ...surfZones(), ...weatherZones() });
        if (x < z.surge[1]) { surgeAt(x, y, waves, add); out.x += add.x; out.y += add.y; }
        if (x > z.reef[0] && x < z.reef[1]) {
            breakerAt(x, y, waves, add); out.x += add.x; out.y += add.y;
            ripAt(x, y, waves, REEF_CREST.passY, add); out.x += add.x;      // the drawback runs out through the reef pass
        }
        if (x > z.storm[0] && x < z.storm[1]) { stormAt(x, y, this.time.now / 1000, add); out.x += add.x; out.y += add.y; }
        if (z.downs.some(d => x > d[0] && x < d[1])) { downAt(x, y, add); out.x += add.x; out.y += add.y; }
        const cave = this.level.field.cave;
        if (x > cave.x0 && x < cave.x1) { caveFlow(cave, x, y, add); out.x += add.x; }      // the current in the side cave
        if (this.ventField?.live) { this.ventField.flowAt(x, y, add); out.y += add.y; }      // warm water rising over the smokers
        return out;
    }

    particleEnv() {
        const cache = new Map();
        let cacheAt = 0;
        return {
            // Particles want px per second; the field speaks px per physics step.
            flowAt: (x, y, out) => {
                this.waterAt(x, y, out);
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
            const ox = OIL.crack[0] * h.img.displayWidth, oy = OIL.crack[1] * h.img.displayWidth;
            const c = Math.cos(h.img.rotation), s = Math.sin(h.img.rotation);
            this.particles.spawn('oil', x + ox * c - oy * s, y + ox * s + oy * c, OIL.perPulse, { radius: 12, spread: 8, vy: -40 });
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
        for (const s of this.swarms.near(p.x, p.y, BOOK.seePx)) ids.push(`school_${s}`);
        // The big encounters of the journey (spec 5.0d, 5.0e, 9.0).
        const w = this.whale?.mind;
        if (w && Math.hypot(w.x - p.x, w.y - p.y) < BOOK.seePx * 3) ids.push('whale');
        if (this.seabirds.coasts.some(c => c.birds?.some(b => Math.hypot(b.mind.x - p.x, b.mind.y - p.y) < BOOK.seePx * 2))) ids.push('gannet');
        if (glowShare(p.y) > 0.5) ids.push('glow_jelly');
        const ship = ghostShip();
        if (Math.hypot(ship.x - p.x, ship.y - p.y) < BOOK.seePx * 3) ids.push('ghost_ship');
        for (const id of ids) this.bookEntry(id);
    }

    /** Fill in one reef book entry; the first time, a small card pops up. */
    bookEntry(id) {
        const e = this.reefBook.discover(id);
        if (!e) return;
        this.progression.set?.('reefbook', this.reefBook.toJSON());
        this.bookToast(e);
    }

    /** A faint note in the corner (spec 5.0j: faint and minimal): picture + "New in the reef book" + name, no box. */
    bookToast(e) {
        if (this.ambientMode) return;
        // One at a time: a second discovery waits until the first note has faded.
        const now = this.time.now, wait = Math.max(0, (this.toastFree || 0) - now);
        this.toastFree = now + wait + 3400;
        if (wait > 0) { this.time.delayedCall(wait, () => this.showBookToast(e)); return; }
        this.showBookToast(e);
    }

    showBookToast(e) {
        const de = this.lang === 'de', H = this.scale.height, shadow = { offsetY: 2, color: '#06243d', blur: 10, fill: true };
        const box = this.add.container(36, H - 150).setScrollFactor(0).setDepth(55).setAlpha(0);
        if (e.image && this.textures.exists(e.image)) {
            const img = this.add.image(40, 40, e.image);
            img.setScale(Math.min(72 / img.width, 72 / img.height));
            box.add(img);
        } else if (e.kind === 'place') box.add(placeBadge(this, 40, 40, 30, e.id));
        box.add(this.add.text(92, 10, de ? 'Neu im Riffbuch' : 'New in the reef book', { fontFamily: 'Arial', fontSize: '20px', color: '#fff3b0', shadow }));
        box.add(this.add.text(92, 36, e.name[this.lang] || e.name.en, { fontFamily: 'Arial', fontSize: '30px', color: '#ffffff', shadow }));
        play('nest');
        this.tweens.add({ targets: box, alpha: 0.85, y: H - 160, duration: 500 });
        this.tweens.add({ targets: box, alpha: 0, delay: 2800, duration: 800, onComplete: () => box.destroy() });
    }

    /** Menu: open the reef book over the paused game. */
    openBook() {
        this.scene.pause();
        this.scene.launch(BOOK_KEY, { main: this });
        this.scene.bringToTop(BOOK_KEY);
    }

    /** The calm main route shows itself: warm motes of light drift along it (spec 5.2c, 1.4). */
    laneGlints(delta) {
        this.glintAcc = (this.glintAcc || 0) + delta * WORLD.laneGlints / 1000;
        if (this.glintAcc < 1) return;
        const wv = this.cameras.main.worldView, field = this.level.field;
        for (let n = Math.floor(this.glintAcc); n > 0; n--) {
            const x = wv.x - 100 + Math.random() * (wv.width + 200);
            const y = field.routeY(x) + (Math.random() - 0.5) * ROUTE.halfWidth * 0.8;
            if (y > 40 && this.level.isOpen(x, y)) this.particles.spawn('glint', x, y, 1, { spread: 10 });
        }
        this.glintAcc %= 1;
    }

    /** Coins hop on the music's beat, all together (spec ch.12, music-synced world). */
    /**
     * The player is never hidden (spec 10.10a): foreground objects (FOREGROUND depth band)
     * fade while Lompi or a friend overlaps them, and come back when clear.
     */
    revealPlayers(dt, view) {
        const r = this.fish.radius * FOREGROUND.pad;
        const players = [view];
        for (const g of this.mp?.ghosts.values() ?? []) if (g.pos) players.push(g.pos);
        const box = this.fgBox || (this.fgBox = new Phaser.Geom.Rectangle());
        const edges = { x0: 0, y0: 0, x1: 0, y1: 0 };
        for (const o of this.children.list) {
            if (o.depth < FOREGROUND.minDepth || o.depth >= FOREGROUND.maxDepth || !o.visible) continue;
            if (o.getBounds) {
                o.getBounds(box);
                edges.x0 = box.x; edges.y0 = box.y; edges.x1 = box.right; edges.y1 = box.bottom;
            } else if (o.points?.length) {            // a Rope (swaying plants): box of its points
                edges.x0 = edges.y0 = Infinity; edges.x1 = edges.y1 = -Infinity;
                for (const q of o.points) {
                    const x = o.x + q.x * o.scaleX, y = o.y + q.y * o.scaleY;
                    if (x < edges.x0) edges.x0 = x; if (x > edges.x1) edges.x1 = x;
                    if (y < edges.y0) edges.y0 = y; if (y > edges.y1) edges.y1 = y;
                }
                const half = (o.frame?.height || 0) * Math.abs(o.scaleY) / 2;   // the strip's own width
                edges.x0 -= half; edges.x1 += half; edges.y0 -= half; edges.y1 += half;
            } else continue;
            if (o.fgBase === undefined) { o.fgBase = o.alpha; o.fgAlpha = o.alpha; }
            const covering = players.some(p => boxHitsCircle(edges, p.x, p.y, r));
            if (!covering && o.fgAlpha === o.fgBase) continue;
            o.fgAlpha = fadeStep(o.fgAlpha, o.fgBase, covering, dt);
            o.setAlpha(o.fgAlpha);
        }
    }

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
            this.coinTaken(x, y);
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
            if (nestReached(nest, p.x, p.y)) this.reachNest(nest);
        }
        for (const h of this.level.hazards) {
            if (this.relaxed) break;
            if (!h.img.active || p.distance(h.img) > fr * LEVEL.hitSlack + h.r) continue;
            if (this.hurt(h.img.x, h.img.y)) return;
        }
    }

    /** A coin was taken at (x, y): it counts, sounds in the melody and sparkles. */
    coinTaken(x, y) {
        const bl = biomeBlendAt(x);
        const note = this.streak.add(nowSeconds(), (bl.t < 0.5 ? bl.a : bl.b).id);
        // A coin in a streak (x2, x3) or collected in flow really counts more (chain.js).
        this.coins += coinWorth(note.multiplier, !this.relaxed && this.chain.flow);
        play('coin', note);
        this.streakFx(x, y, note);
        this.particles.spawn('glint', x, y, 6, { spread: 70 });      // pooled sparkle: nothing of a taken coin stays behind
    }

    /** Something hurt the fish from (x, y). Returns true when it went down. */
    hurt(x, y, amount = this.character.armor ?? 1) {
        if (!this.fish.hit(new Phaser.Math.Vector2(x, y))) return false;
        this.chainEnd(this.chain.end());
        play('hit');
        this.hitStop = WORLD.hitStopMs;
        this.fish.squash = -0.3;
        this.health = Math.max(0, this.health - amount);
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
        const water = this.waterAt(fsp.x, fsp.y, this.flowAt);
        // A breaking wave tumbles the fish: a squash and a burst of bubbles (spec 5.0d).
        const br = breakerAt(fsp.x, fsp.y, this.wavePhase(), this.coastPush || (this.coastPush = { x: 0, y: 0 }));
        if (Math.hypot(br.x, br.y) > WORLD.tumbleAt && this.time.now > (this.tumbleUntil || 0)) {
            this.tumbleUntil = this.time.now + WORLD.tumbleMs;
            this.fish.squash = -0.45;
            this.particles.spawn('bubble', fsp.x, fsp.y, 10, { radius: 16, spread: 50 });
            play('splash', 0.8);
        }
        // In the storm the wind takes whatever jumps out of the water back west.
        if (this.fish.inAir) { const gale = stormShare(fsp.x); if (gale > 0) fsp.setVelocity(fsp.body.velocity.x - WEATHER.storm.wind * gale, fsp.body.velocity.y); }
        if (!this.fish.inAir && !this.fish.hold && (water.x || water.y)) {
            const push = carry(water.x, water.y, fsp.body.velocity.x, fsp.body.velocity.y, FLOW, this.flowPush || (this.flowPush = { x: 0, y: 0 }));
            const sail = (this.fish.mode?.flow ?? 1) * (this.fish.posed ? WORLD.puffSail : 1);   // a spread fan or a puffed ball catches the water
            fsp.setVelocity(fsp.body.velocity.x + push.x * sail, fsp.body.velocity.y + push.y * sail);
        }
        // The whale's wake after her send-off: water that runs on with the fish and dies away.
        if (this.wake) {
            const k = this.wake.left / WORLD.wakeS;
            const push = carry(this.wake.x * k, this.wake.y * k, fsp.body.velocity.x, fsp.body.velocity.y, FLOW, this.flowPush || (this.flowPush = { x: 0, y: 0 }));
            fsp.setVelocity(fsp.body.velocity.x + push.x, fsp.body.velocity.y + push.y);
            if ((this.wake.left -= STEP_MS / 1000) <= 0) this.wake = null;
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
        // At a drop-off the view tips down: the wall and the blue below it come into the picture. The same for the whale below the route.
        this.camY = Phaser.Math.Linear(this.camY, view.y + v.y * WORLD.lookAhead - H / 2 + WORLD.wallLook * H * Math.max(dropOffView(view.x), this.whale?.look(view.x) ?? 0), k);
        this.camY = Math.max(this.camY, -760); // room for a jump, not the whole sky
        this.cameras.main.setScroll(this.camX, this.camY);

        this.leakOil(delta);
        this.ventPlumes(delta);
        // Streams show themselves: bubbles are born along the lanes in view and ride them.
        this.laneGlints(delta);
        this.streamBubbles = (this.streamBubbles || 0) + delta * WORLD.streamBubbles / 1000;
        if (this.streamBubbles >= 1) {
            const wv = this.cameras.main.worldView;
            for (const st of this.flow.streamsIn(wv.x - 200, wv.right + 200)) {
                for (let n = Math.floor(this.streamBubbles); n > 0; n--) {
                    const x = Phaser.Math.Between(Math.max(st.x0, wv.x - 200), Math.min(st.x1, wv.right + 200));
                    const y = streamY(st, x) + Phaser.Math.Between(-FLOW.streamWidth, FLOW.streamWidth) * 0.8;
                    // Only where the water really moves (a stream is muted where it meets the calm route).
                    if (y > 40 && this.level.isOpen(x, y) && this.flow.at(x, y, 0, this.bubbleProbe || (this.bubbleProbe = { x: 0, y: 0 })).x > FLOW.streamSpeed * 0.3) this.particles.spawn('bubble', x, y, 1, { radius: 9, spread: 6 });
                }
            }
            // Eddies show themselves the same way: a few bubbles ride round the ring.
            for (const e of this.flow.eddiesIn(wv.x - 200, wv.right + 200)) {
                const ang = Math.random() * Math.PI * 2, r = FLOW.eddyRadius * (0.6 + Math.random() * 0.7);
                const x = e.x + Math.cos(ang) * r, y = e.y + Math.sin(ang) * r, probe = this.bubbleProbe || (this.bubbleProbe = { x: 0, y: 0 });
                this.flow.at(x, y, 0, probe);
                if (y > 40 && this.level.isOpen(x, y) && Math.hypot(probe.x, probe.y) > FLOW.eddySpeed * 0.4) this.particles.spawn('bubble', x, y, 1, { radius: 8, spread: 4 });
            }
            this.streamBubbles %= 1;
        }
        this.speedLines.update(delta, v.x, v.y, !this.relaxed && this.chain.flow);
        this.drawFlow(delta);
        if (this.aiDebug) this.drawAi();
        const shot = this.boosters.update(this.cameras.main.worldView, this.fish, this.time.now);
        if (shot) {
            play(shot === 'cannon' ? 'cannon' : 'boing');
            this.chainMove(shot);
            if (shot === 'pad') this.bookEntry('friend_jellyfish');     // the pad is a big moon jelly
            this.fish.squash = shot === 'cannon' ? 0.3 : -0.3;
            this.particles.spawn('bubble', this.fish.sprite.x, this.fish.sprite.y, shot === 'cannon' ? 14 : 6, { radius: 10, spread: 60 });
        }
        this.particles.update(delta / 1000);
        const pl = this.swarmPlayer;   // swarms think in px/s, the body in px per step
        pl.x = view.x; pl.y = view.y; pl.vx = v.x * 60; pl.vy = v.y * 60; pl.fright = this.character.fright || 1;
        // In a room, friends are players for the shoals too (spec ch.13 "Creatures in a room").
        const players = this.swarmPlayers || (this.swarmPlayers = []);
        players.length = 0; players.push(pl);
        for (const g of this.mp?.ghosts.values() ?? []) if (g.pos) players.push({ x: g.pos.x, y: g.pos.y, vx: g.pos.vx * 60, vy: g.pos.vy * 60 });
        this.swarms.update(delta / 1000, view.x, view.y, players);
        const bird = this.birdPlayer || (this.birdPlayer = { x: 0, y: 0, puffed: false, big: false });
        bird.x = view.x; bird.y = view.y; bird.puffed = this.fish.posed; bird.big = (this.character.fright || 1) > 1.5;
        const shoals = this.shoalSpots || (this.shoalSpots = []);
        shoals.length = 0;
        for (const s of this.swarms.swarms) shoals.push(s.sim.centre());
        const local = this.ambientMode ? null : bird;
        this.seabirds.update(delta / 1000, view.x, local, local ? [local, ...players.slice(1)] : [], shoals);
        this.deepGlow.update(this.cameras.main.worldView, this.time.now / 1000);
        const fv = this.fish.sprite.body.velocity;
        this.cleaner.update(delta / 1000, this.time.now / 1000, this.ambientMode ? null : { x: view.x, y: view.y, speed: Math.hypot(fv.x, fv.y) * 60 }, view.x);
        // The ghost ship groans now and then when you are near it (spec 5.0e).
        const ship = ghostShip(), shipD = Math.hypot(view.x - ship.x, view.y - ship.y);
        if (shipD < WORLD.creakR && this.time.now > (this.creakAt || 0)) {
            this.creakAt = this.time.now + WORLD.creakMs * (0.6 + Math.random() * 0.8);
            play('creak', 1 - shipD / WORLD.creakR);
        }
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
        // Darkness only by depth (spec 5.0h): the biome gives the light its hue at one brightness.
        // ... and depth darkens toward a deep version of that same hue, so a deep wreck stays rusty and the trench indigo.
        // Spec 5.0j: skylight (a slow day/sunset/night cycle, storms), the biome's hue, its sediment,
        // the seabed's colour bouncing up close above it, and depth (game/level/light.js).
        const hue = waterHue(view.x), deep = mixColor(0x0c1436, atLuma(hue, WATER_LIGHT.deepLuma), WATER_LIGHT.deepHue);
        this.lightTick = ((this.lightTick || 0) + 1) % 8;
        if (!this.lightTick) this.floorNear = this.level.groundBelow(view.x, view.y, 700);
        const fl = this.floorNear;
        // Night or the deep: a swimmer stirs up glowing plankton, more the faster it goes.
        const skyT = SKY_START + this.time.now / 1000, glow = Math.max(nightShare(skyT), depth01);
        this.planktonAt = (this.planktonAt || 0) - delta;
        if (glow > PLANKTON.from && !this.fish.inAir && this.planktonAt <= 0) {
            const fv = this.fish.sprite.body.velocity, sp2 = Math.hypot(fv.x, fv.y);
            if (sp2 > PLANKTON.speed) {
                this.planktonAt = PLANKTON.everyMs / glow;
                const n = sp2 > 9 ? 2 : 1, r = this.fish.radius;
                this.particles.spawn('plankton', view.x - fv.x * 2.5, view.y - fv.y * 2.5, n, { radius: r * 0.8, spread: 25, vx: -fv.x * 6, vy: -fv.y * 6 });
            }
        }
        this.ambient.setFillStyle(lightAt({ depth01, y: view.y, t: skyT, storm: stormShare(view.x), hue, deepHue: deep,
            floorGap: fl ? fl.y - view.y : Infinity, ground: fl ? fl.color : undefined, murk: murkAt(bl) }), 1);
        // Inside the side cave the score closes in: it is played as if much deeper down.
        const cv = this.level.field.cave, inCave = sp.x > cv.x0 - BRANCH.mouth && sp.x < cv.x1 + BRANCH.mouth && sp.y > cv.top;
        // The score plays as if deeper inside the cave, and partway at night (sparser, softer; spec 5.0k).
        const musicDepth = Math.max(depth01, inCave ? WORLD.caveDepth01 : 0, nightShare(skyT) * WORLD.nightDepth01);
        updateMusic(biomeBlendAt(this.fish.sprite.x), musicDepth);   // background score + sea hum (spec ch.12)
        // The storm rumbles overhead (loudest near the surface); strong moving water rushes past the fish.
        const p = this.soundProbe || (this.soundProbe = { x: 0, y: 0 }), waves = this.waves ?? this.wavePhase();
        let moving = Math.hypot(surgeAt(view.x, view.y, waves, p).x, p.y);
        moving += Math.hypot(breakerAt(view.x, view.y, waves, p).x, p.y) + Math.abs(downAt(view.x, view.y, p).y);
        updateWeatherSound(stormShare(view.x) * (1 - 0.6 * Phaser.Math.Clamp(view.y / 1500, 0, 1)), moving / WORLD.rushFull);
        // In the dark the fish carries a little light of its own.
        this.glow.setPosition(view.x, view.y).setAlpha(depth01 * 0.5);

        this.level.update(this.camX, this.camY);
        // A frame that built a chunk has spent its build budget: no layer builds its scene in the same frame.
        if (this.level.buildMs.count !== this.chunkBuilds) { this.chunkBuilds = this.level.buildMs.count; this.lastBuildFrame = this.game.loop.frame; }
        this.level.animate(time / 1000, view, speed, this.mp?.others(this.roomPlayers || (this.roomPlayers = [])), this.wavePhase());
        this.revealPlayers(delta / 1000, view);
        this.backdrop.update(this.camX, this.camY, this.camX - prevX, this.camY - prevY, this.surface);
        this.farLayers.update(this.camX);
        this.rockLayers.update(this.camX, this.camY);
        const sun = sunAt(SKY_START + this.time.now / 1000, stormShare(this.fish.sprite.x));      // the sky's share of light: day 1, night little, less under the storm
        this.waterLight.update(sun);
        // The net of light on rock, sand and props: in world space, as strong as the sun, in the water's hue.
        updateCaustics(this.game, this.cameras.main.scrollX, this.cameras.main.scrollY, time / 1000, sun, biomeBlendAt(view.x).a.water[0]);
        if (!this.surf) {
            const z = surfZones();
            if (sp.x < z.surge[1] + WORLD.weatherRange || (sp.x > z.reef[0] - WORLD.weatherRange && sp.x < z.reef[1] + WORLD.weatherRange)) this.surf = new SurfLayer(this, this.surface);
        }
        this.surf?.update(this.camX, this.scale.width, this.wavePhase(), time / 1000, sp.x);
        if (!this.storm && weatherNear(sp.x, WORLD.weatherRange)) this.storm = new StormLayer(this);
        this.storm?.update(this.camX, this.camY, time / 1000, delta, this.particles);
        this.setPieces.update(time / 1000, sp, this.fish.radius, delta / 1000);
        this.branch.update(sp, time / 1000, delta, this.particles);
        this.docks.update(sp, time / 1000);
        this.manta.update(sp, time / 1000, delta);
        this.arch.update(sp, this.fish.radius, time / 1000, this.fish.inAir);
        this.beats?.update(sp, time / 1000, delta);
        if (!this.creaturesWarm && this.buildSlot()) this.creaturesWarm = !this.level.prewarm();      // one creature kind per frame, right after the start
        this.rescues?.update(sp, this.fish.radius, time / 1000, delta);
        this.blooms.update(sp, time / 1000, delta);
        this.baitBalls.update(sp, this.fish.view, this.fish.radius, time / 1000);
        this.rafts.update(sp, time / 1000);
        this.meadow.update(sp, this.fish.radius, time / 1000, delta);
        this.ventField.update({ x: sp.x, y: sp.y, radius: this.fish.radius }, time / 1000, delta);
        this.containers.update(sp, this.fish.radius, time / 1000);
        if (this.whale) {
            this.whale.update(sp, time / 1000, delta);
            const pull = this.whale.carry(sp, sp.body.velocity.x, sp.body.velocity.y);
            if (pull) sp.setVelocity(pull.x, pull.y);
        }
        this.collect();
        this.maxDepth = Math.max(this.maxDepth, this.depthMeters());
        const t2 = performance.now();
        for (const [k, ms] of [['physics', t1 - t0], ['world', t2 - t1]]) {
            const a = this.perf[k]; a.sum += ms; a.n++; if (ms > a.max) a.max = ms;
        }
        if (this.perfTour) this.runPerfTour(delta, t2 - t0);

        // Announce a biome when the fish swims into it.
        const bi = biomeIndexAt(sp.x);
        if (bi !== this.biomeIndex) {
            if (this.biomeIndex !== -1 || (time > 0 && !this.resumed)) this.announce(BIOMES[bi].name[this.lang] || BIOMES[bi].name.en, this.journey.goalAt(sp.x, this.lang));
            this.biomeIndex = bi;
        }
    }
}
