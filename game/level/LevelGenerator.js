import Phaser from 'phaser';
import { makeCritter } from './critters.js';
import { LINE, createRope, stepRope } from './rope.js';
import Creature from '../Creature.js';
import { MICRO, microAt, microKey } from './microScatter.js';
import { makeMicroTextures, MICRO_ORIGIN_Y } from './MicroArt.js';
import { surgeShare, surgeWave } from './surf.js';
import { JOURNEY, chapters } from '../journey.js';
import { createReach } from './reach.js';
import { createSpacing } from './spacing.js';
import { eachCell as marchGrid, hash } from './terrain.js';
import { FIELD, ROUTE, createField, chunkGrids, gridRows } from './density.js';
import { SHADE, shadeChunk } from './shade.js';
import { MAT, MATERIALS, prepareTile, setMaterials, materialTiles } from './materials.js';
import { mix } from './layerMath.js';
import {
    BIOMES, WORLD_WEST, WORLD_END, ABYSS, biomeBlendAt, floorY, pickWeighted, landmarkGroup, reefCrest, dropOffShare, wallLifeAt } from './biomes.js';

export const LEVEL = {
    cell: 96,             // marching-squares cell size (world px) — smaller = rounder outlines
    cells: 10,            // cells per chunk side  -> chunk = 960 px
    seed: 1337,
    version: 13,
    coralGap: 600,        // the same coral picture is never placed twice within this distance (px)           // bump when generation changes what index a coin or friend gets
    threshold: FIELD.threshold,
    maxDepth: FIELD.maxDepth,
    spawn: FIELD.spawn,
    margin: 1,            // extra chunks generated around the view
    hitSlack: 0.8,        // hazards hit at 80 % of their drawn size (forgiving)
    kelpMinDepth: 420,    // no kelp where the water is shallower than this
    propHeadroom: 50,     // a prop's top stays at least this far under the surface
    liveView: 0.95,       // creatures and plants within this many screen sizes of the fish (to either side) are animated
    surgeLean: 0.45,      // how far the surge bends the plants in the surf zone (share of a full bend)
    friendSheen: 0.4,     // strength of the rainbow sheen on friends
    sheenSpeed: 0.1,      // how fast its colours travel (turns of the colour wheel per second)
    sheenSpread: 1.3,     // how much of the colour wheel lies across one friend
    wakeRadius: 300,      // how close the fish must swim to bend a plant
    coinGap: 92,          // minimum distance between two coins
    coinStep: 110,        // distance between the coins of a trail
    trailChance: 0.13,    // chance of a coin trail in a chunk, per point of the biome's `coins` value
    laneBand: 260         // px: trails on the main route stay within this band around its middle
};
const CH = LEVEL.cell * LEVEL.cells;

/** How each creature / object looks and moves. Sizes are display widths in px. */
// `ai`: how a swimming creature behaves (game/ai/swimmer.js): own speed (px per step), home
// range (px), turn rate (radians per step), shy (1 = normal; bigger = scared from further away),
// breathe (goes up for air now and then), anchor (rests holding on to rock).
// The body is a Rig like the playables' (game/Creature.js): `anim` = how it moves (swim, paddle,
// pulse, sway; sit and throb for the ones on the rock), `soft` = how loose its thin parts are,
// `wiggle` = size of the body wave, `upright` = never tips along its movement.
const FRIENDS = {
    friend_turtle: { size: 240, swim: 380, bob: 18, anim: 'paddle', soft: 0.5, wiggle: 14, ai: { speed: 1.3, range: 560, turn: 0.03, shy: 0.7, breathe: true } },
    friend_jellyfish: { size: 150, bob: 60, anim: 'pulse', soft: 1, wiggle: 6, upright: true, ai: { speed: 0.45, range: 260, turn: 0.02, shy: 0.5 } },
    friend_seahorse: { size: 120, bob: 26, anim: 'sway', soft: 0.5, wiggle: 6, upright: true, ai: { speed: 0.6, range: 200, turn: 0.05, shy: 1.2, anchor: true } },
    // `crawl`: creatures on the rock move along its outline (game/ai/crawler.js): px per step, patch size.
    friend_starfish: { size: 170, ground: true, anim: 'sit', soft: 0.2, upright: true, crawl: { speed: 0.1, range: 160 } },
    friend_snail: { size: 160, ground: true, anim: 'sit', soft: 0.3, upright: true, crawl: { speed: 0.18, range: 240 } },
    friend_nudibranch: { size: 190, ground: true, anim: 'sit', soft: 0.8, upright: true, crawl: { speed: 0.26, range: 300 } },
    urchin: { size: 140, ground: true, anim: 'throb', soft: 0.2, upright: true, crawl: { speed: 0.05, range: 90 } },
    // The anglerfish art faces left (tail on the right); it lights the deep, its lure sways as a soft part.
    enemy_angler: { size: 240, swim: 460, bob: 14, anim: 'swim', soft: 0.35, wiggle: 22, facesLeft: true, glow: true,
        grumpy: { territory: 320 } }   // guards its patch of the dark: warns, then shoves (ai/grumpy.js)
};
// What grows on steep rock faces (biomes.js wallRate / wallLife): picture keys and width range
// (px) per kind; at most `max` per chunk; `dropBoost` = extra rate at an island's drop-off.
const WALL_LIFE = {
    keys: { coral: ['coral_1', 'coral_2', 'coral_3', 'coral_4', 'coral_5'], seafan: ['seafan_1'], anemone: ['anemone_1'] },
    width: { coral: [90, 170], seafan: [140, 240], anemone: [80, 140] },
    max: 7, dropBoost: 1.6
};
// `place`: floor = sits on rock, water = floats in open water. Enemy art faces left.
const HAZARDS = {
    // Keys are historical; what they show now: spikes = wreck scrap, hazard_buoy =
    // leaking oil drum, mine = lost anchor on its chain, hazard_net = ghost net.
    spikes: { size: 240, r: 62, place: 'floor', lift: 26 },
    hazard_buoy: { size: 170, r: 64, place: 'floor', lift: 38 },   // the oil comes from its crack (OIL.crack in MainScene)
    // The lost anchor hangs on its chain from a hull at the surface: the chain runs all the way up.
    // An anchor hangs on a chain of at most `reach` px (from a hull at the surface or from rock
    // above); where that is not possible there is no anchor.
    mine: { size: 135, r: 62, place: 'water', anim: 'sway', speed: 0.6, chain: true, reach: 1500 },
    // A ghost net never just hangs in the water: where the seabed is within `tether` px below,
    // it is caught on a line to a stone and tugs at it; near the surface it hangs from a float;
    // otherwise it drifts `drift` px to and fro.
    hazard_net: { size: 150, r: 84, place: 'water', anim: 'sway', bob: 34, speed: 0.7, tether: 620, drift: 300 }
};

/**
 * Scenery on the seabed, rendered from CC0 models (public/img/props/). Per group:
 * texture keys, display width range (px), how much of its height sinks into the
 * ground, how far below that rock must lie under both ends (`reach`, share of the height),
 * the steepest floor it stands on (radians), its depth (behind the rock
 * = half buried, the rock in front hides the keel; `back` = hazed toward the water: what is
 * passable must read as behind the play plane), at most how many per chunk, and
 * `sway` for plants (rooted, swaying with the water and pushed aside by the fish).
 */
export const PROPS = {
    boulder: { keys: ['boulder_1', 'boulder_2', 'boulder_3', 'boulder_4', 'boulder_5', 'boulder_6'], width: [200, 460], sink: 0.32, reach: 0.15, flat: 0.4, depth: -3, back: true, max: 2 },
    barrel: { keys: ['barrel_1', 'barrel_2'], width: [110, 170], sink: 0.24, reach: 0.15, flat: 0.45, depth: -3, back: true, max: 2 },
    crate: { keys: ['crate_1'], width: [130, 190], sink: 0.22, reach: 0.15, flat: 0.35, depth: -3, back: true, max: 1 },
    // Hulls share one slot per chunk, and only every third chunk column has one, so they never overlap.
    wreck: { keys: ['wreck_1', 'wreck_2', 'wreck_3'], width: [1300, 1900], sink: 0.3, reach: 0.5, flat: 0.3, depth: -3, max: 1, slot: 'hull', every: 3, tint: 0xb6c6cc },
    trawler: { keys: ['trawler_1', 'cutter_1'], width: [880, 1150], sink: 0.22, reach: 0.5, flat: 0.3, depth: -3, max: 1, slot: 'hull', every: 3, tint: 0xc4d0d4 },
    // Pier (generated art): stands at the surface, not on a floor spot (pierAt / drawPier).
    // `piles` = pile positions across the deck (under its own posts), `pileWidth` = post width (share of the deck),
    // `pileWood` = share of the pile art that is wood (band, seamless wood strip and foot are cut from one
    // generated pile, soft-edged), `above` = share of the deck above the waterline.
    pier: { keys: ['pier_deck', 'pier_pile_mid', 'pier_band', 'pier_foot'], width: [1300, 1600], surface: true, every: 4, chance: 0.5, max: 1,
        piles: [0.083, 0.383, 0.769, 0.928], pileWidth: 0.1, pileWood: 0.7, above: 0.2, depth: -3, tint: 0xc4d0d4 },
    rowboat: { keys: ['rowboat_1'], width: [420, 560], sink: 0.3, reach: 0.2, flat: 0.35, depth: -3, back: true, max: 1 },
    // Generated art (FLUX.2 klein, Replicate): plants between the kelp stalks.
    seagrass: { keys: ['seagrass_1'], width: [220, 340], sink: 0.12, reach: 0.2, flat: 0.6, depth: -1, max: 2, sway: 0.6 },
    seafan: { keys: ['seafan_1'], width: [200, 330], sink: 0.08, reach: 0.2, flat: 0.6, depth: -1, max: 1, sway: 0.25 },
    anemone: { keys: ['anemone_1'], width: [130, 210], sink: 0.1, reach: 0.2, flat: 0.7, depth: -1, max: 2, sway: 0.35 },
    kelpclump: { keys: ['kelp_2'], width: [170, 260], sink: 0.04, reach: 0.2, flat: 0.5, depth: -1, max: 2, sway: 0.7 }
};

/** Painted kelp stalks (generated art, public/img/plants/); the procedural 'kelp' strip is the fallback. */
export const KELP_STALKS = ['kelp_stalk_1', 'kelp_stalk_2', 'kelp_stalk_3'];
const KELP_BACK_TINT = 0x5f8f86;   // stalks behind the play plane: hazier, toward the water colour
const PROP_BACK_HAZE = 0.5;        // how far passable seabed props shift toward the water colour

// One turn of the colour wheel, saturated and bright, looked up instead of converted every frame.
const RAINBOW = Array.from({ length: 96 }, (_, i) => Phaser.Display.Color.HSVToRGB(i / 96, 0.75, 1).color);

/**
 * The ocean, generated on demand in every direction from one seed.
 *
 * A continuous density field (layered value noise) decides rock vs water; rock
 * outlines come from marching squares, so chunks join seamlessly. The journey
 * runs west -> east through the biomes in biomes.js: a shallow lagoon in the
 * west, then deeper and wilder. A nest (checkpoint) sits on the seabed at the
 * start of every biome, the grand nest at the end.
 */
export default class LevelGenerator {
    /** @param state WorldState: what has already been collected (optional) */
    constructor(scene, state = null) {
        this.scene = scene;
        this.state = state;
        this.chunks = new Map(); // "cx,cy" -> { objects[], bodies[] }
        this.coins = [];
        this.hazards = [];
        this.friends = [];
        this.animated = [];
        this.creatures = [];
        this.lights = [];     // glows that follow a creature
        this.vents = [];      // bubble plants: columns of rising bubbles that lift the fish
        this.buildMs = { last: 0, max: 0, count: 0 };   // cost of building chunks, shown by ?debug=perf
        this.makeKelpTexture();
        this.makeRootTextures();
        // Painted once here, at start-up, so no chunk has to pay for them while playing.
        makeNestTextures(scene);
        makeLineTexture(scene);
        makeMicroTextures(scene);
        this.field = createField(LEVEL.seed);
        this.storySpots = chapters().filter(c => c.friend).map(c => ({ x: c.x, y: this.field.routeY(c.x) }));
        this.storyStretches = chapters().filter(c => c.event).map(c => ({ x0: c.event.x - JOURNEY.eventClear, x1: c.event.endX + JOURNEY.eventClear }));
        // Never out of reach: coins and friends are not placed in sealed pockets of water (reach.js).
        this.reachable = createReach(this.field.density, LEVEL.threshold, this.field.routeY, ROUTE.halfWidth * 0.75);
        this.nests = this.field.nests.map(n => ({ ...n, biome: BIOMES[n.biome] }));
        // Density grids are computed in a Web Worker when available; the chunk is
        // then drawn on the main thread, one per frame.
        this.pending = new Set();   // chunk keys requested from the worker
        this.early = new Map();     // chunk key -> collision bodies laid down while the worker is busy
        this.chainBody = { active: false, x: 0, y: 0, vx: 0, vy: 0 };   // the swimmer, as the ropes see it
        this.chains = [];           // hanging chains: verlet ropes (rope.js) with the hazard as the weight at the end
        this.coralSpacing = createSpacing(LEVEL.coralGap);
        this.allPlayers = [];
        this.lineEnd = { x: 0, y: 0 };
        // Open water for a creature reaches right up to the waterline (isOpen stops 60 px under it,
        // which is for placing things): a turtle must be able to put its head up for a breath.
        this.brainEnv = { isOpen: (x, y) => y > 24 && this.density(x, y) < LEVEL.threshold - 0.05, t: 0, player: null, alarm: null };
        this.crawlEnv = { density: (x, y) => this.density(x, y), threshold: LEVEL.threshold, player: null };
        this.alarm = { x: 0, y: 0 };   // where something sudden just happened (a special): creatures nearby take fright
        this.alarmLeft = 0;
        this.tethers = [];          // lines that hold drifting things: stretched between them and their anchor every frame
        this.ready = [];            // grids that came back, waiting to be drawn
        const mats = this.loadMaterials();
        try {
            this.worker = new Worker(new URL('./terrainWorker.js', import.meta.url), { type: 'module' });
            this.worker.onmessage = e => { this.pending.delete(e.data.key); this.ready.push(e.data); };
            this.worker.onerror = () => { this.worker = null; this.pending.clear(); };   // fall back to the main thread
            if (mats) this.worker.postMessage({ materials: mats });
        } catch { this.worker = null; }
        const lang = scene.registry.get('currentLanguage') || 'de';
        const ground = x => { let y = floorY(x) + 260; while (y > 400 && this.density(x, y) > LEVEL.threshold) y -= 12; return y + 12; };
        const trench = BIOMES[BIOMES.length - 1];
        this.signs = [
            { x: trench.from + 620, text: lang === 'de' ? 'Marianengraben' : 'Mariana Trench', arrow: '→' },
            { x: ABYSS.x - ABYSS.halfWidth * 1.9, text: lang === 'de' ? 'Marianengraben' : 'Mariana Trench', arrow: '↘' }
        ].map(sg => ({ ...sg, y: ground(sg.x) }));
    }

    /**
     * Rock material tiles from the loaded stone images (materials.js); they stay
     * module state, so this runs once per game. Missing images: procedural grain.
     */
    loadMaterials() {
        if (materialTiles()) return materialTiles();
        const tex = this.scene.textures, N = MAT.size;
        if (!MATERIALS.every(m => tex.exists(`mat_${m}`) && tex.exists(`mat_${m}_h`))) return null;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = N;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const pixels = key => { ctx.clearRect(0, 0, N, N); ctx.drawImage(tex.get(key).getSourceImage(), 0, 0, N, N); return ctx.getImageData(0, 0, N, N).data; };
        setMaterials(MATERIALS.map(m => prepareTile(pixels(`mat_${m}`), pixels(`mat_${m}_h`))));
        return materialTiles();
    }

    /** Rock density at a world point (> LEVEL.threshold = solid). See density.js. */
    density(x, y, withNests = true) {
        return this.field.density(x, y, withNests);
    }

    /** Is there ground within `reach` px below this point? Returns its colour, else null. */
    groundBelow(x, y, reach) {
        for (let d = 20; d <= reach; d += 20) {
            if (this.density(x, y + d) > LEVEL.threshold) return { y: y + d, color: biomeBlendAt(x).a.rock[0] };
        }
        return null;
    }

    /** The underside of the first rock straight above (x, y), or null when the water is open up to the surface. */
    ceilingAbove(x, y) {
        for (let at = y - 30; at > 0; at -= 30) {
            if (this.density(x, at) > LEVEL.threshold) return { y: at + 30 };
        }
        return null;
    }

    /** Something sudden happened at (x, y): creatures nearby dart away. */
    startle(x, y) {
        this.alarm.x = x; this.alarm.y = y; this.alarmLeft = 0.25;
    }

    isOpen(x, y, slack = 0.07) {
        return y > 60 && this.density(x, y) < LEVEL.threshold - slack;
    }

    update(camX, camY) {
        const W = this.scene.scale.width, H = this.scene.scale.height;
        const x0 = Math.floor(camX / CH) - LEVEL.margin, x1 = Math.floor((camX + W) / CH) + LEVEL.margin;
        const y0 = Math.max(0, Math.floor(camY / CH) - LEVEL.margin), y1 = Math.floor((camY + H) / CH) + LEVEL.margin;
        const wanted = (cx, cy) => cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
        const missing = [];
        for (let cy = y0; cy <= y1; cy++) {
            for (let cx = x0; cx <= x1; cx++) if (!this.chunks.has(`${cx},${cy}`)) missing.push([cx, cy]);
        }
        const timed = (cx, cy, grids) => {
            const t0 = performance.now();
            this.build(cx, cy, grids);
            const ms = performance.now() - t0;
            this.buildMs.last = ms; this.buildMs.count++;
            if (ms > this.buildMs.max) this.buildMs.max = ms;
        };
        if (missing.length) {
            const mx = (camX + W / 2) / CH - 0.5, my = (camY + H / 2) / CH - 0.5;
            missing.sort((p, q) => Math.hypot(p[0] - mx, p[1] - my) - Math.hypot(q[0] - mx, q[1] - my));
            const onScreen = ([cx, cy]) => cx * CH < camX + W && (cx + 1) * CH > camX && cy * CH < camY + H && (cy + 1) * CH > camY;
            if (this.chunks.size === 0) {
                // Very first frame: what is on screen is built right away.
                for (const [cx, cy] of missing.filter(onScreen)) timed(cx, cy);
            } else if (!this.worker) {
                timed(missing[0][0], missing[0][1]);          // no worker: one per frame on the main thread
            } else {
                for (const [cx, cy] of missing) {             // ask the worker for the maths
                    const key = `${cx},${cy}`;
                    if (!this.early.has(key)) this.solidNow(cx, cy, key);      // solid at once, whatever the worker's state
                    if (this.pending.has(key) || this.ready.some(r => r.key === key)) continue;
                    this.pending.add(key);
                    this.worker.postMessage({ seed: LEVEL.seed, key, ox: cx * CH, oy: cy * CH, span: CH, n: LEVEL.cells });
                }
            }
        }
        // Draw at most one finished chunk per frame; results nobody needs any more are dropped.
        while (this.ready.length) {
            const r = this.ready.shift();
            const [cx, cy] = r.key.split(',').map(Number);
            if (!wanted(cx, cy) || this.chunks.has(r.key)) { this.dropEarly(r.key); continue; }
            timed(cx, cy, r);
            break;
        }
        for (const key of [...this.chunks.keys()]) {
            const [cx, cy] = key.split(',').map(Number);
            if (cx < x0 - 1 || cx > x1 + 1 || cy < y0 - 1 || cy > y1 + 1) this.drop(key);
        }
        // Early collision of chunks nobody waits for any more goes at once, not only when the
        // worker gets round to them: after a long fast trip its queue is long, and hundreds of
        // idle collision strips would slow the physics down in the meantime.
        for (const key of this.early.keys()) {
            const [cx, cy] = key.split(',').map(Number);
            if (!wanted(cx, cy)) this.dropEarly(key);
        }
    }

    /**
     * Rock is solid from the moment a chunk is asked for: its collision strips are
     * laid down at once (cheap: the coarse grid only), while the pictures are still
     * being shaded in the worker. They are replaced when the chunk is built.
     */
    solidNow(cx, cy, key) {
        const early = { bodies: [] };
        const grid = gridRows(chunkGrids(this.field, LEVEL.seed, cx * CH, cy * CH, CH, LEVEL.cells).fine, LEVEL.cells + 1);
        marchGrid(grid, cx * CH, cy * CH, CH, LEVEL.threshold, c => { for (const [p, q] of c.edges) this.addEdge(early, p, q, []); });
        this.early.set(key, early.bodies);
    }

    dropEarly(key) {
        for (const b of this.early.get(key) || []) this.scene.matter.world.remove(b);
        this.early.delete(key);
    }

    /** Per frame: bend / pulse every creature and plant. `t` in seconds; `others` = the other players in the room; `waves` = time in waves (surf.js). */
    animate(t, fish, speed = 0, others = null, waves = 0) {
        // Only what can be on screen is bent and drawn: chunks are loaded well beyond the view.
        const vw = this.scene.scale.width * LEVEL.liveView, vh = this.scene.scale.height * LEVEL.liveView;
        const inView = o => !fish || (Math.abs(o.x - fish.x) < vw && Math.abs(o.y - fish.y) < vh);
        for (const o of this.animated) {
            if (!o.active || !inView(o)) continue;
            if (o.isPlant && fish) {
                // In the surf zone the plants lean with every push of the surge and swing back with the backwash.
                const surge = o.surf ? -surgeWave(o.x, waves) * o.surf * LEVEL.surgeLean : 0;
                // Swimming past pushes plants aside; they swing back when it is calm.
                const dx = o.x - fish.x, d = Math.hypot(dx, o.y - fish.y);
                const push = d < LEVEL.wakeRadius ? Math.sign(dx || 1) * (1 - d / LEVEL.wakeRadius) * Math.min(1, speed / 9) : 0;
                o.bend += (push + surge - o.bend) * 0.1;
            }
            o.animate(t, o.bend || 0);
        }
        // Chains swing as ropes; the hazard on the end hangs from the last link and turns with it.
        this.chainBody.active = !!fish;
        if (fish) {
            // A jump of more than a body length in one frame is a respawn or a teleport, not a rush.
            const jx = fish.x - this.chainBody.x, jy = fish.y - this.chainBody.y, moved = Math.hypot(jx, jy) < 90;
            this.chainBody.vx = moved ? jx : 0; this.chainBody.vy = moved ? jy : 0;
            this.chainBody.x = fish.x; this.chainBody.y = fish.y;
        }
        for (const c of this.chains) {
            if (!c.active) continue;
            const r = stepRope(c.sim, t, this.chainBody.active ? this.chainBody : null), last = r.n - 1, pts = c.points;
            for (let i = 0; i <= last; i++) { pts[i].x = r.x[i] - c.x; pts[i].y = r.y[i] - c.y; }
            c.setDirty();
            if (c.weight.active) {
                const lean = Math.atan2(r.x[last] - r.x[last - 1], r.y[last] - r.y[last - 1]);
                c.weight.setPosition(r.x[last] + Math.sin(lean) * c.hang, r.y[last] + Math.cos(lean) * c.hang).setRotation(-lean);
            }
        }
        // Lines: held at the stone or float, tied to the drifting net at the other end.
        for (const l of this.tethers) {
            if (!l.active || !l.follow.active) continue;
            this.lineEnd.x = l.follow.x; this.lineEnd.y = l.follow.y + l.hang;
            const r = stepRope(l.sim, t, this.chainBody.active ? this.chainBody : null, LINE, this.lineEnd), pts = l.points;
            for (let i = 0; i < r.n; i++) { pts[i].x = r.x[i] - l.x; pts[i].y = r.y[i] - l.y; }
            l.setDirty();
        }
        // Creatures with a mind of their own (ai/swimmer.js).
        const dt = Math.min(0.05, Math.max(0, t - (this.brainT ?? t)));
        this.brainT = t;
        const env = this.brainEnv;
        env.t = t; env.player = this.chainBody.active ? this.chainBody : null;
        // Playing together, friends are players for the creatures too (each device simulates its own).
        const all = this.allPlayers; all.length = 0;
        if (env.player) all.push(env.player);
        if (others) for (const o of others) all.push(o);
        env.players = all;
        env.alarm = this.alarmLeft > 0 ? this.alarm : null;
        this.alarmLeft -= dt;
        const ground = this.crawlEnv;
        ground.player = env.player; ground.players = all;
        for (const c of this.creatures) {
            if (c.active && c.step(t, dt, env, ground, inView(c)) === 'hit') this.scene.events.emit('grumpy-hit', { x: c.x, y: c.y });
        }
        for (const l of this.lights) {
            if (!l.active || !l.follow.active) continue;
            if (l.hue === undefined) { l.setPosition(l.follow.x, l.follow.y); continue; }
            // Rainbow sheen: colours run across the body and shimmer a little.
            l.setAlpha(LEVEL.friendSheen * (0.75 + 0.25 * Math.sin(t * 2 + l.hue * 20)));
            const n = l.colors.length, base = l.hue + t * LEVEL.sheenSpeed;
            for (let i = 0; i < n; i++) l.colors[i] = RAINBOW[Math.floor(((base + (i / n) * LEVEL.sheenSpread) % 1) * RAINBOW.length)];
        }
    }

    /** Upward push at this point from bubble plants (0 if none). */
    liftAt(x, y) {
        for (const v of this.vents) if (Math.abs(x - v.x) < 95 && y < v.y && y > v.y - v.height) return 1;
        return 0;
    }

    /** @param baked { coarse, rock, back } from the worker; computed here when omitted */
    build(cx, cy, baked = null) {
        const s = this.scene, T = LEVEL.threshold, N = LEVEL.cells;
        const ox = cx * CH, oy = cy * CH, mid = ox + CH / 2;
        const rng = new Phaser.Math.RandomDataGenerator([`${LEVEL.seed}:${cx}:${cy}`]);
        const chunk = { objects: [], bodies: [], textures: [], key: `${cx},${cy}` };
        this.chunks.set(chunk.key, chunk);
        this.dropEarly(chunk.key);
        const keep = o => { chunk.objects.push(o); return o; };
        const has = key => s.textures.exists(key);
        const blend = biomeBlendAt(mid);
        const biome = blend.t < 0.5 ? blend.a : blend.b;

        // The terrain pictures are shaded per pixel (shade.js, normally in the
        // worker) and shown as two plain images per chunk: nothing about the
        // terrain is redrawn while playing.
        const pics = baked || { coarse: chunkGrids(this.field, LEVEL.seed, ox, oy, CH, N).fine, ...shadeChunk(this.field, LEVEL.seed, ox, oy, CH) };
        const show = (name, data, size, depth) => {
            const key = `chunk:${chunk.key}:${name}`;
            if (s.textures.exists(key)) s.textures.remove(key);
            const tex = s.textures.createCanvas(key, size, size);
            tex.context.putImageData(new ImageData(data, size, size), 0, 0);
            tex.refresh();
            chunk.textures.push(key);
            keep(s.add.image(ox, oy, key).setOrigin(0).setScale(CH / size).setDepth(depth));
        };
        show('back', pics.back, SHADE.backSize, -6);
        show('rock', pics.rock, SHADE.rockSize, -2);

        // Collision strips and floor spots come from the coarse grid (corners
        // shared with the neighbours -> seamless).
        const val = gridRows(pics.coarse, N + 1);
        const floors = [], walls = [];
        marchGrid(val, ox, oy, CH, T, c => { for (const [p, q] of c.edges) this.addEdge(chunk, p, q, floors, walls); });

        // --- Nest ------------------------------------------------------------
        for (const nest of this.nests) {
            if (nest.x >= ox && nest.x < ox + CH && nest.y >= oy && nest.y < oy + CH) this.drawNest(chunk, nest);
        }
        const nearNest = this.nests.some(n => Math.abs(n.x - mid) < 800 && Math.abs(n.y - (oy + CH / 2)) < 1100);
        const safe = nearNest || Math.hypot(mid - LEVEL.spawn.x, oy + CH / 2 - LEVEL.spawn.y) < CH * 1.6;

        // --- Life on the rock: coral, kelp, sitters, floor hazards -----------
        rng.shuffle(floors);
        let corals = 0, stalks = 0, sitters = 0;
        const only = (table, test) => Object.fromEntries(Object.entries(table).filter(([k]) => test(k)));
        const floorHazards = only(biome.hazards, k => HAZARDS[k]?.place === 'floor');
        const groundFriends = only(biome.friends, k => FRIENDS[k]?.ground);
        for (const f of floors) {
            const up = { x: Math.sin(f.angle), y: -Math.cos(f.angle) };
            const roll = rng.frac();
            if (roll < biome.coral && corals < 5) {
                // Never the same coral twice within sight of each other (spacing.js). The random
                // draws are taken either way, so everything placed after stays where it was.
                const all = ['coral_1', 'coral_2', 'coral_3', 'coral_4', 'coral_5'].filter(has), fresh = this.coralSpacing.options(all, f.x, f.y);
                const at = rng.frac(), scale = rng.realInRange(0.22, 0.42), front = rng.frac() < 0.3, flip = rng.frac() < 0.5;
                if (!fresh.length) continue;
                const key = fresh[Math.floor(at * fresh.length)];
                this.coralSpacing.add(key, f.x, f.y);
                keep(s.add.image(f.x, f.y, key).setOrigin(0.5, 0.92).setScale(scale).setRotation(f.angle).setDepth(front ? 7 : -1)).setFlipX(flip);
                corals++;
            } else if (roll < biome.coral + biome.kelp && stalks < 6) {
                this.addKelp(chunk, f, rng.between(300, 680), rng.frac() < 0.25 ? 7 : -4, rng);
                // Kelp forests stand in depth: a taller, hazier stalk behind the play plane.
                if (biome.kelp > 0.5 && rng.frac() < 0.6) {
                    this.addKelp(chunk, { ...f, x: f.x + rng.between(-160, 160) }, rng.between(700, 1100), -5, rng, KELP_BACK_TINT);
                }
                stalks++;
            } else if (!safe && roll > 1 - biome.hazardRate * 0.25) {
                const key = pickWeighted(rng, floorHazards, has);
                if (key) this.addHazard(chunk, key, f.x + up.x * HAZARDS[key].lift, f.y + up.y * HAZARDS[key].lift, rng, f.angle);
            } else if (sitters < 1 && roll > 0.5 && roll < 0.5 + biome.friendRate * 0.12) {
                const key = pickWeighted(rng, groundFriends, has);
                if (key) { this.addFriend(chunk, key, f.x + up.x * 46, f.y + up.y * 46, rng, f.angle); sitters++; }
            }
        }

        // --- Life on the walls: corals, sea fans and anemones grow out of steep rock faces,
        // thickest where an island drops off into the open sea (spec 5.0c). Own random stream.
        const wallLife = walls.length ? wallLifeAt(mid) : null;
        if (wallLife) {
            const wrng = new Phaser.Math.RandomDataGenerator([`${LEVEL.seed}:${cx}:${cy}:walls`]);
            const rate = wallLife.rate * (1 + WALL_LIFE.dropBoost * dropOffShare(mid));
            const kinds = only(wallLife.life, k => WALL_LIFE.keys[k]?.some(has));
            wrng.shuffle(walls);
            let grown = 0;
            for (const w of walls) {
                if (grown >= WALL_LIFE.max || wrng.frac() > rate) continue;
                const kind = pickWeighted(wrng, kinds, () => true);
                if (!kind) break;
                const key = wrng.pick(WALL_LIFE.keys[kind].filter(has)), tex = s.textures.get(key).getSourceImage();
                const width = wrng.realInRange(WALL_LIFE.width[kind][0], WALL_LIFE.width[kind][1]);
                keep(s.add.image(w.x, w.y, key).setOrigin(0.5, 0.9).setScale(width / tex.width).setRotation(w.angle).setDepth(-1)).setFlipX(wrng.frac() < 0.5);
                grown++;
            }
        }

        // --- Scenery props on the seabed --------------------------------------
        if (biome.props) {
            // Own random stream: props never shift which index a coin or friend gets.
            const rng = new Phaser.Math.RandomDataGenerator([`${LEVEL.seed}:${cx}:${cy}:props`]);
            const count = Math.floor(biome.propRate) + (rng.frac() < biome.propRate % 1 ? 1 : 0);
            const used = {};
            const slot = g => PROPS[g].slot || g;
            // The biome's landmark comes first where the player arrives (biomes.js), on any floor
            // that can carry it; the every-third-column rule is for the random ones.
            const must = landmarkGroup(cx, CH);
            const exists = g => PROPS[g] && !PROPS[g].surface && (used[slot(g)] || 0) < PROPS[g].max && cx % (PROPS[g].every || 1) === 0 && PROPS[g].keys.some(has);
            for (let k = must && !PROPS[must]?.surface ? -1 : 0; k < count; k++) {
                const forced = k < 0;
                if (forced && !PROPS[must].keys.some(has)) continue;
                const group = forced ? must : pickWeighted(rng, biome.props, exists);
                if (!group) break;
                const p = PROPS[group];
                const key = rng.pick(p.keys.filter(has));
                const tex = s.textures.get(key).getSourceImage();
                const w = rng.realInRange(p.width[0], p.width[1]), h = w * tex.height / tex.width;
                // Never floating: rock must lie under both ends, below the buried part.
                const rockUnder = (x, y) => { for (let d = 0; d <= h * p.reach; d += 20) if (this.density(x, y + d) > T) return true; return false; };
                const below = f => f.y + h * p.sink * 0.8;
                // Nothing stands out of the water, and the reef crest carries corals only.
                const spot = floors.find(f => !f.prop && Math.abs(f.angle) < p.flat * (forced ? 2 : 1)
                    && f.y - h * (1 - p.sink) > LEVEL.propHeadroom && reefCrest(f.x) === 0
                    && rockUnder(f.x - w * 0.45, below(f)) && rockUnder(f.x + w * 0.45, below(f)));
                if (!spot) continue;
                spot.prop = true;
                used[slot(group)] = (used[slot(group)] || 0) + 1;
                const angle = spot.angle * 0.6;
                if (p.sway) {
                    // Rooted mesh: the middle sits half the visible height above the ground.
                    const lift = h * (0.5 - p.sink);
                    const plant = makeCritter(s, key, spot.x + Math.sin(angle) * lift, spot.y - Math.cos(angle) * lift, w, 'sway',
                        { root: 'bottom', amp: p.sway, speed: rng.realInRange(0.5, 0.8), scaleY: h / tex.height });
                    plant.setRotation(angle).setDepth(p.depth);
                    plant.isPlant = true;
                    plant.surf = surgeShare(plant.x, 0);
                    plant.bend = 0;
                    keep(plant);
                    this.animated.push(plant);
                    continue;
                }
                const img = keep(s.add.image(spot.x, spot.y, key).setOrigin(0.5, 1 - p.sink));
                img.setScale(w / tex.width).setRotation(angle).setDepth(p.depth);
                if (rng.frac() < 0.5) img.setFlipX(true);
                if (p.tint) img.setTint(p.tint);
                // Passable things read as behind the play plane: hazed toward the biome's water.
                else if (p.back) img.setTint(mix(0xffffff, mix(biome.water[0], 0x8fb4c0, 0.5), PROP_BACK_HAZE));
            }
        }

        // --- Small ground cover: pebbles, shells, mussels, tufts (spec 5.5c) -----
        {
            // Own random stream, like the props: nothing else shifts.
            const r = new Phaser.Math.RandomDataGenerator([`${LEVEL.seed}:${cx}:${cy}:micro`]), next = () => r.frac();
            let placed = 0;
            for (const f of floors) {
                if (placed >= MICRO.max) break;
                if (f.prop || reefCrest(f.x) > 0 && f.y < 400) continue;      // not under a prop; the crest's top belongs to the corals
                const m = microAt(biome.id, f.angle, next);
                if (!m) continue;
                const img = keep(s.add.image(f.x, f.y + 4, microKey(m.kind, m.variant)).setOrigin(0.5, MICRO_ORIGIN_Y)
                    .setRotation(f.angle).setDepth(0.9).setFlipX(m.flip));
                img.setScale(m.width / img.width);
                placed++;
            }
        }

        // --- Pier: deck at the surface, piles down to the rock (spans chunks) --
        const pier = this.pierAt(cx, biome);
        if (pier) this.drawPier(chunk, pier, oy, keep);

        // --- Bubble plants: a column of bubbles that carries the fish upward --
        const abyssFloor = Math.abs(mid - ABYSS.x) < CH && oy + CH > floorY(ABYSS.x) - 400;
        const ventSpot = floors.find(f => this.isOpen(f.x, f.y - 300, 0.05));
        if (ventSpot && (abyssFloor || rng.frac() < 0.14)) this.addVent(chunk, `${cx},${cy}`, ventSpot, abyssFloor ? 2600 : rng.between(700, 1300), rng);

        // --- Signposts --------------------------------------------------------
        for (const sign of this.signs) {
            if (sign.x >= ox && sign.x < ox + CH && sign.y >= oy && sign.y < oy + CH) this.drawSign(chunk, sign);
        }

        // --- Mangrove roots hanging from the surface --------------------------
        // Most stand behind the fish, a few in front (a place to hide). They are
        // scenery only, and front ones are kept away from where hazards float.
        if (biome.roots && cy === 0) {
            for (let k = 0; k < biome.roots; k++) {
                const x = ox + rng.between(40, CH - 40);
                const front = rng.frac() < 0.25;
                // Sized by height (615-1230 px) with only a slight stretch, so painted roots keep
                // their proportions. Two draws, as before: the coins after them keep their numbers.
                const root = keep(s.add.image(x, -40, `root_${rng.between(1, 3)}`).setOrigin(0.5, 0));
                const stretch = 0.9 + (rng.realInRange(1.1, 2.1) - 1.1) * 0.2;
                const scale = rng.realInRange(1.2, 2.4) * 512 * (front ? 1.15 : 1) / root.height;
                root.setScale(scale * stretch, scale).setDepth(front ? 7.5 : -7).setAlpha(front ? 0.9 : 0.8);
                if (rng.frac() < 0.5) root.setFlipX(true);
                if (!front) root.setTint(0x6f8f86);
                // Roots belong to a tree: its trunk and canopy stand above the waterline
                // (painted art `root_top_1..2` when loaded, else the procedural one).
                const tree = s.textures.exists('root_top_1') ? `root_top_${1 + (k % 2)}` : 'root_top';
                const top = keep(s.add.image(x, -34, tree).setOrigin(0.5, 1)
                    .setScale(root.scaleX * 1.25).setDepth(front ? 7.4 : -7.1).setFlipX(root.flipX));
                if (!front) top.setTint(0xa9c4b4);
            }
        }

        // --- Coin trails through open water ----------------------------------
        // Every coin has a stable number within its chunk (order of generation,
        // decided by the chunk's own seed only), so a collected coin stays gone.
        const chunkKey = `${cx},${cy}`;
        const placed = [];
        let coinIndex = 0;
        // Coins are accents, not filling: at most one trail per chunk, and not in
        // every chunk. A trail is a gentle arc leading east, the way the journey
        // goes, so following coins always means making progress.
        if (rng.frac() < biome.coins * LEVEL.trailChance) {
            let x = ox + rng.between(80, CH * 0.4), y = oy + rng.between(140, CH - 140);
            let heading = rng.realInRange(-0.45, 0.45);
            const bend = rng.realInRange(-0.12, 0.12);
            // Where the calm main route crosses this chunk, the trail rides it (spec 5.2c: the
            // bright, inviting way). Same random draws, so coin indices do not move.
            const lane = this.field.routeY(x);
            const onLane = lane > oy && lane < oy + CH;
            const laneOffset = (y - oy) / CH - 0.5;   // reuse the draw: -0.5..0.5 of a gentle band
            for (let k = rng.between(5, 8); k > 0; k--) {
                if (onLane) y = this.field.routeY(x) + laneOffset * LEVEL.laneBand;
                if (this.isOpen(x, y, 0.09) && coinIndex < 64
                    && !placed.some(q => Math.abs(q.x - x) < LEVEL.coinGap && Math.abs(q.y - y) < LEVEL.coinGap)) {
                    placed.push({ x, y });
                    const index = coinIndex++;
                    if (!this.state?.has(chunkKey, 'coin', index)) this.addCoin(chunk, x, y, chunkKey, index);
                }
                heading += bend;
                x += Math.cos(heading) * LEVEL.coinStep;
                y += Math.sin(heading) * LEVEL.coinStep;
            }
        }

        // --- Swimmers ---------------------------------------------------------
        const openSpot = (span = 0) => {
            for (let tries = 6; tries > 0; tries--) {
                const x = ox + rng.between(120, CH - 120), y = oy + rng.between(120, CH - 120);
                if (this.isOpen(x, y, 0.1) && this.isOpen(x - span, y, 0.08) && this.isOpen(x + span, y, 0.08) && this.reachable(x, y)) return { x, y };
            }
            return null;
        };
        if (rng.frac() < biome.friendRate) {
            const key = pickWeighted(rng, only(biome.friends, k => FRIENDS[k] && !FRIENDS[k].ground), has);
            const p = key && openSpot(FRIENDS[key].swim || 0);
            // Grumpies never live on the calm main route (spec 5.2c): stress stays optional.
            const onRoute = p && FRIENDS[key].grumpy && Math.abs(p.y - this.field.routeY(p.x)) < ROUTE.clear + FRIENDS[key].grumpy.territory * 0.5;
            if (p && !onRoute) this.addFriend(chunk, key, p.x, p.y, rng);
        }
        if (!safe && rng.frac() < biome.hazardRate) {
            const key = pickWeighted(rng, only(biome.hazards, k => HAZARDS[k]?.place === 'water'), has);
            const p = key && openSpot((HAZARDS[key].patrol || 0) / 2 + 60);
            if (p) this.addHazard(chunk, key, p.x, p.y, rng);
        }
    }

    /** One rock outline segment: collision strip + remember upward-facing ones (floors) and steep ones (walls). */
    addEdge(chunk, a, b, floors, walls) {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        let nx = -Math.sin(ang), ny = Math.cos(ang);
        if (this.density(mx + nx * 24, my + ny * 24) < this.density(mx - nx * 24, my - ny * 24)) { nx = -nx; ny = -ny; }
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        chunk.bodies.push(this.scene.matter.add.rectangle(mx + nx * 26, my + ny * 26, len + 8, 52,
            { isStatic: true, angle: ang, friction: 0.05 }));
        if (ny > 0.8 && len > 45) floors.push({ x: mx, y: my, angle: b.x > a.x ? ang : ang + Math.PI });
        else if (walls && Math.abs(nx) > 0.7 && len > 40) walls.push({ x: mx, y: my, angle: Math.atan2(-nx, ny) });   // grows out along the face's normal
    }

    addCoin(chunk, x, y, chunkKey, index) {
        if (!this.reachable(x, y)) return;      // its number stays taken, so the others keep theirs
        // The story's net scenes stand free: no coins in front of a friend who waits for help.
        for (const c of this.storySpots) if ((c.x - x) ** 2 + (c.y - y) ** 2 < JOURNEY.clear ** 2) return;
        const s = this.scene;
        const img = s.textures.exists('coin')
            ? s.add.image(x, y, 'coin').setDisplaySize(72, 72)
            : s.add.circle(x, y, 32, 0xffd23f).setStrokeStyle(5, 0xfff3b0);
        img.setDepth(2);   // bobs on the music's beat: MainScene.bobCoins()
        chunk.objects.push(img);
        this.coins.push({ img, r: 40, x, y, chunkKey, index });
    }

    addHazard(chunk, key, x, y, rng, angle = 0) {
        const s = this.scene, h = HAZARDS[key];
        // Danger is optional (spec 5.2c): nothing harmful on or near the calm main route.
        if (Math.abs(y - this.field.routeY(x)) < ROUTE.clear + h.r) return null;
        // Wonder first: nothing harmful along the stretch where a big story event passes (the whale and her ride).
        for (const e of this.storyStretches) if (x > e.x0 && x < e.x1) return null;
        const top = y - h.size * 0.46, rock = h.chain ? this.ceilingAbove(x, top) : null;
        if (h.chain && top - (rock ? rock.y : 16) > h.reach) return null;
        const img = makeCritter(s, key, x, y, h.size, h.anim || 'still', { ...h, rotation: angle }).setDepth(3);
        this.animated.push(img);
        chunk.objects.push(img);
        if (h.patrol) {
            img.setX(x + h.patrol / 2);
            s.tweens.add({
                targets: img, x: x - h.patrol / 2, duration: rng.between(3800, 5200), yoyo: true, repeat: -1,
                ease: 'Sine.easeInOut', onYoyo: () => img.face(-1), onRepeat: () => img.face(1)
            });
        } else if (h.chain) {
            // Nothing hangs from nowhere, and no chain passes through rock: in open water it runs
            // up to the dark hull of a boat lying at the surface; under an overhang it ends where
            // it is caught on the rock above, around a wedged shackle.
            makeLineTexture(s);
            if (rock && top - rock.y > 8) {
                this.addChain(chunk, x, rock.y - 6, top, img, h.size * 0.46);
                chunk.objects.push(s.add.ellipse(x, rock.y - 2, 34, 22, 0x3b3a3d).setStrokeStyle(4, 0x23222a).setDepth(2.92));
            } else if (!rock && top > 40) {
                this.addChain(chunk, x, 16, top, img, h.size * 0.46);
                // The painted hull hangs with its keel (where the chain is made fast) at the fallback's depth.
                chunk.objects.push(s.textures.exists('hull_bottom')
                    ? s.add.image(x, 104, 'hull_bottom').setOrigin(0.5, 330 / 364).setDepth(2.95)
                    : s.add.image(x, 6, 'hz_hull').setOrigin(0.5, 0.35).setDepth(2.95));
            }
        } else if (h.tether || h.drift) {
            const ground = h.tether ? this.groundBelow(x, y, h.tether) : null;
            if (ground) {
                // Caught: a line runs from the net down to a stone on the seabed. The net
                // tugs at it from side to side and bobs only a little.
                makeLineTexture(s);
                chunk.objects.push(s.add.ellipse(x, ground.y - 4, 46, 26, 0x4d4a48).setDepth(2.8));
                this.addLine(chunk, x, ground.y - 10, img, h.size * 0.32);
                img.setX(x - 46);
                s.tweens.add({ targets: img, x: x + 46, duration: rng.between(2600, 3600), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                s.tweens.add({ targets: img, y: y - h.bob * 0.4, duration: rng.between(1700, 2400), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            } else if (h.tether && y < h.tether * 1.6) {
                // Near the surface: the net hangs on a line from a float that rides on the water.
                makeLineTexture(s);
                chunk.objects.push(s.add.ellipse(x, 4, 54, 30, 0xd9642b).setStrokeStyle(4, 0x8f3d17).setDepth(5.9));
                this.addLine(chunk, x, 14, img, -h.size * 0.32);
                img.setX(x - 60);
                s.tweens.add({ targets: img, x: x + 60, duration: rng.between(3200, 4600), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                s.tweens.add({ targets: img, y: y - h.bob * 0.5, duration: rng.between(1900, 2700), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            } else {
                // Adrift: carried slowly to and fro by the water, rising and sinking, turning a little.
                const reach = h.drift / 2, dir = rng.sign();
                img.setX(x - dir * reach);
                s.tweens.add({ targets: img, x: x + dir * reach, duration: rng.between(9000, 14000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                s.tweens.add({ targets: img, y: y - h.bob, duration: rng.between(2600, 3800), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            }
        } else if (h.bob) {
            s.tweens.add({ targets: img, y: y - h.bob, duration: rng.between(1700, 2600), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        this.hazards.push({ img, r: h.r * LEVEL.hitSlack, key });
        return img;
    }

    /**
     * A chain hanging from (x, y0) to y1 with `weight` (a hazard) on its end, `hang` px below
     * the last link. It is a rope (rope.js): it sways, and whoever swims through shoves it.
     */
    addChain(chunk, x, y0, y1, weight, hang) {
        const s = this.scene, r = createRope(x, y0, y1);
        // The frame is as long as the chain, so the links keep their size.
        const tex = s.textures.get('hz_chain_long'), links = Math.min(46, Math.ceil((y1 - y0) / 44)), frame = `links${links}`;
        if (!tex.has(frame)) tex.add(frame, 0, 0, 0, 16, links * 44);
        const points = [];
        for (let i = 0; i < r.n; i++) points.push(new Phaser.Math.Vector2(0, r.y[i] - y0));
        const rope = s.add.rope(x, y0, 'hz_chain_long', frame, points, false).setDepth(2.9);
        rope.sim = r; rope.weight = weight; rope.hang = hang;
        chunk.objects.push(rope);
        this.chains.push(rope);
    }

    /**
     * A line held at (x, y) and tied to `follow` (a drifting net), `hang` px from its middle.
     * A rope with both ends held (rope.js): it curves, sways and gives way to a swimmer.
     */
    addLine(chunk, x, y, follow, hang) {
        const s = this.scene, r = createRope(x, y, follow.y + hang, LINE), points = [];
        for (let i = 0; i < r.n; i++) points.push(new Phaser.Math.Vector2(0, r.y[i] - y));
        const line = s.add.rope(x, y, 'hz_line', null, points, false).setDepth(2.9);
        line.sim = r; line.follow = follow; line.hang = hang;
        chunk.objects.push(line);
        this.tethers.push(line);
    }

    addFriend(chunk, key, x, y, rng, angle = 0) {
        const s = this.scene, f = FRIENDS[key];
        // A Rig body with a mind of its own (game/Creature.js): it roams, crawls or guards, per its row.
        const img = new Creature(s, key, f, x, y, this.crawlEnv, rng.frac() * 1000, angle);
        this.creatures.push(img);
        if (f.glow) {
            const light = s.add.circle(x, y, 150, 0xfff3b0, 0.16).setDepth(42).setBlendMode(Phaser.BlendModes.ADD);
            light.follow = img;
            chunk.objects.push(light);
            this.lights.push(light);
        }
        // Friends shimmer faintly in changing colours; hazards stay matte, so the
        // two can be told apart at a glance.
        // The sheen is the friend's own picture once more, added on top in travelling
        // rainbow colours: it lies exactly on the body and bends with it.
        const sheen = img.addOverlay(s, f.ground ? 1.05 : 4.05);
        if (sheen) {
            sheen.setBlendMode(Phaser.BlendModes.ADD).setAlpha(LEVEL.friendSheen);
            // Pure colour inside the picture's outline (a tint would only multiply with the body colour).
            if (Phaser.TintModes) sheen.setTintMode?.(Phaser.TintModes.FILL); else sheen.tintFill = true;
            sheen.follow = img;
            sheen.hue = rng.frac();
            this.lights.push(sheen);
        }
        chunk.objects.push(img);
        // Friends are numbered per chunk too. They greet you every time you come
        // back; only the coin bonus is given once per friend, for good.
        const index = chunk.friendCount = (chunk.friendCount ?? -1) + 1;
        this.friends.push({ img, key, r: f.size * 0.38, chunkKey: chunk.key, index, greeted: false, rewarded: !!this.state?.has(chunk.key, 'friend', index) });
        return img;
    }

    /** The pufferfish sand circle: concentric ridges, radial grooves, a ring of shells. */
    drawNest(chunk, nest) {
        const s = this.scene, R = nest.grand ? 300 : 210;
        makeNestTextures(s);
        // Raked sand: a shaded relief seen at the game's low camera angle, lying in the
        // basin the terrain keeps level for it (density.js).
        const disc = s.add.image(nest.x, nest.y - FIELD.nestRim * 0.4, 'nest_sand').setDisplaySize(R * 2.1, R * 0.66).setDepth(-1);
        chunk.objects.push(disc);
        // Shells on the ridge: small shaded things, the far ones behind the near ones.
        const tints = [0xffb3c8, 0xfff1c0, 0xbdeff2, 0xd9c2ff, 0xffcf9e];
        const count = nest.grand ? 16 : 9;
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2 + 0.3, far = Math.sin(a) < 0;
            const size = (nest.grand ? 50 : 40) * (far ? 0.8 : 1) * (0.85 + ((i * 37) % 10) / 30);
            const shell = s.add.image(nest.x + Math.cos(a) * R * 0.9, nest.y - FIELD.nestRim * 0.4 + Math.sin(a) * R * 0.27 - size * 0.25, 'nest_shell')
                .setDisplaySize(size, size * 0.8).setTint(tints[i % tints.length]).setRotation(((i * 53) % 7 - 3) * 0.12).setDepth(far ? -0.9 : -0.8);
            chunk.objects.push(shell);
        }
        // A soft column of light so the nest can be found from a distance.
        const beam = s.add.image(nest.x, nest.y - 880, s.textures.exists('bd_ray') ? 'bd_ray' : 'nest_shell').setOrigin(0.5, 0)
            .setDisplaySize(R * 1.5, 900).setFlipY(true).setTint(0xfff3b0).setAlpha(0.42).setDepth(-5).setBlendMode(Phaser.BlendModes.ADD);
        s.tweens.add({ targets: beam, alpha: 0.14, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        chunk.objects.push(beam);
    }

    addVent(chunk, key, f, height, rng) {
        const s = this.scene;
        // The plant: a cluster of round pods.
        const g = s.add.graphics().setDepth(1);
        [[0, 0, 44, 0x7be0c8], [-46, 10, 30, 0x58c9b0], [44, 12, 32, 0x58c9b0], [-14, -34, 26, 0xa6f2df], [22, -30, 22, 0xa6f2df]]
            .forEach(([dx, dy, r, col]) => {
                g.fillStyle(col, 1).fillCircle(f.x + dx, f.y - 26 + dy, r);
                g.fillStyle(0xffffff, 0.45).fillCircle(f.x + dx - r * 0.3, f.y - 26 + dy - r * 0.3, r * 0.3);
            });
        chunk.objects.push(g);
        // The bubbles: purely visual, looping up the column.
        for (let i = 0; i < Math.round(height / 110); i++) {
            const b = s.textures.exists('bubble') ? s.add.image(f.x, f.y, 'bubble') : s.add.circle(f.x, f.y, 16, 0xffffff, 0.4);
            const size = rng.between(22, 52);
            b.setDisplaySize(size, size).setDepth(6).setAlpha(0.75);
            const drift = rng.between(-60, 60);
            s.tweens.add({
                targets: b, y: f.y - height, x: f.x + drift, alpha: 0, duration: height * rng.realInRange(2.6, 3.4),
                delay: i * 330, repeat: -1, ease: 'Sine.easeIn'
            });
            chunk.objects.push(b);
        }
        this.vents.push({ x: f.x, y: f.y, height, chunk: key });
    }

    /** Wooden signpost standing on the seabed. */
    drawSign(chunk, sign) {
        const s = this.scene, x = sign.x, y = sign.y;
        const g = s.add.graphics().setDepth(0);
        g.fillStyle(0x6b4a2b, 1).fillRect(x - 12, y - 250, 24, 260);
        g.fillStyle(0x8a6239, 1).fillRoundedRect(x - 230, y - 330, 460, 120, 18);
        g.lineStyle(6, 0x4f361f, 1).strokeRoundedRect(x - 230, y - 330, 460, 120, 18);
        const t = s.add.text(x, y - 270, `${sign.text}  ${sign.arrow}`, {
            fontFamily: 'Arial', fontSize: '46px', color: '#fff3d0', fontStyle: 'bold', stroke: '#3a2713', strokeThickness: 6
        }).setOrigin(0.5).setDepth(0.1);
        chunk.objects.push(g, t);
    }

    /** Three branching mangrove root shapes, drawn once (procedural, seeded). */
    makeRootTextures() {
        const s = this.scene;
        for (let n = 1; n <= 3; n++) {
            const key = `root_${n}`;
            if (s.textures.exists(key)) continue;
            const w = 256, h = 512;
            const tex = s.textures.createCanvas(key, w, h);
            const ctx = tex.getContext();
            let seed = n * 7919;
            const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
            ctx.lineCap = 'round';
            const branch = (x, y, angle, len, width, depth) => {
                const x2 = x + Math.sin(angle) * len, y2 = y + Math.cos(angle) * len;
                const grad = ctx.createLinearGradient(x, y, x2, y2);
                grad.addColorStop(0, '#7a5a3a'); grad.addColorStop(1, '#4e3a28');
                ctx.strokeStyle = grad; ctx.lineWidth = width;
                ctx.beginPath(); ctx.moveTo(x, y);
                ctx.quadraticCurveTo(x + Math.sin(angle + 0.5) * len * 0.5, y + Math.cos(angle + 0.5) * len * 0.5, x2, y2);
                ctx.stroke();
                if (depth <= 0 || y2 > h - 30) return;
                const kids = 2 + (rnd() < 0.35 ? 1 : 0);
                for (let k = 0; k < kids; k++) {
                    branch(x2, y2, angle + (rnd() - 0.5) * 1.1, len * (0.62 + rnd() * 0.25), Math.max(4, width * 0.66), depth - 1);
                }
            };
            branch(w / 2, 0, (rnd() - 0.5) * 0.2, 150, 26, 4);
            tex.refresh();
        }
        // The tree above the water: prop roots gathering into a trunk, and a canopy of leaf clumps.
        if (!s.textures.exists('root_top')) {
            const w = 420, h = 440, tex = s.textures.createCanvas('root_top', w, h), ctx = tex.getContext();
            let seed = 4177;
            const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
            ctx.lineCap = 'round';
            for (let i = -2; i <= 2; i++) {                        // prop roots arching into the trunk
                const g = ctx.createLinearGradient(0, h, 0, h - 220);
                g.addColorStop(0, '#6d5136'); g.addColorStop(1, '#8a6a48');
                ctx.strokeStyle = g; ctx.lineWidth = 15 - Math.abs(i) * 2;
                ctx.beginPath(); ctx.moveTo(w / 2 + i * 34, h);
                ctx.quadraticCurveTo(w / 2 + i * 30, h - 110, w / 2 + i * 5, h - 200); ctx.stroke();
            }
            ctx.strokeStyle = '#7d5f40'; ctx.lineWidth = 30;
            ctx.beginPath(); ctx.moveTo(w / 2, h - 180); ctx.quadraticCurveTo(w / 2 + 14, h - 250, w / 2 - 6, h - 310); ctx.stroke();
            for (let i = 0; i < 46; i++) {                         // leaf clumps, dark below, sunlit above
                const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
                const x = w / 2 + Math.cos(a) * r * 170, y = 150 + Math.sin(a) * r * 110, size = 34 + rnd() * 30;
                const light = 1 - (y - 40) / 220;
                const g = ctx.createRadialGradient(x - size * 0.3, y - size * 0.4, 2, x, y, size);
                g.addColorStop(0, `rgb(${90 + light * 80 | 0},${150 + light * 60 | 0},${70 + light * 30 | 0})`);
                g.addColorStop(1, `rgb(${30 + light * 30 | 0},${88 + light * 40 | 0},${52 + light * 14 | 0})`);
                ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, size, size * 0.72, rnd() - 0.5, 0, Math.PI * 2); ctx.fill();
            }
            tex.refresh();
        }
    }

    /**
     * The pier standing in chunk column `cx`, or null: decided per column (its own random
     * stream), so every chunk of the column draws its share of the same pier. It stands
     * only where every pile reaches rock.
     */
    pierAt(cx, biome) {
        this.piers ??= new Map();
        if (this.piers.has(cx)) return this.piers.get(cx);
        const p = PROPS.pier, s = this.scene;
        let pier = null;
        if (biome.props?.pier && p.keys.every(k => s.textures.exists(k))) {
            const rng = new Phaser.Math.RandomDataGenerator([`${LEVEL.seed}:${cx}:pier`]);
            const chosen = landmarkGroup(cx, CH) === 'pier' || (cx % p.every === 0 && rng.frac() < p.chance);
            if (chosen) {
                const w = rng.realInRange(p.width[0], p.width[1]), x0 = cx * CH + CH / 2;
                const deck = s.textures.getFrame('pier_deck');
                const deckH = w * deck.height / deck.width, deckTop = -deckH * p.above;
                const ground = x => { for (let y = 0; y < LEVEL.maxDepth; y += 24) if (this.density(x, y) > LEVEL.threshold) return y; return null; };
                const piles = p.piles.map(f => ({ x: x0 + (f - 0.5) * w, ground: ground(x0 + (f - 0.5) * w) }));
                if (piles.every(q => q.ground !== null)) pier = { x0, w, deckTop, deckH, piles };
            }
        }
        this.piers.set(cx, pier);
        return pier;
    }

    /**
     * This chunk's share of a pier: the deck where it lies in the chunk, and each pile as a
     * seamless wood strip tiled down through the chunks, a barnacle band in the tidal zone
     * (varied per pile) and the overgrown foot sunk into the rock.
     */
    drawPier(chunk, pier, oy, keep) {
        const s = this.scene, p = PROPS.pier, y1 = oy + CH;
        const frame = key => s.textures.getFrame(key);
        // The pile art is wider than its wood (growth sticks out): size it so the wood
        // matches the deck's own posts, which fade into the piles at their bottom.
        const fw = frame('pier_pile_mid').width, pw = pier.w * p.pileWidth / p.pileWood, k = pw / fw;
        const piece = (key, x, y, h) => keep(s.add.image(x, y, key).setOrigin(0.5, 0)
            .setDisplaySize(pw, h).setDepth(p.depth).setTint(p.tint));
        if (Math.max(0, pier.deckTop) >= oy && Math.max(0, pier.deckTop) < y1) {      // the deck pokes above the surface
            keep(s.add.image(pier.x0, pier.deckTop, 'pier_deck').setOrigin(0.5, 0)
                .setDisplaySize(pier.w, pier.deckH).setDepth(p.depth + 0.01).setTint(p.tint));
        }
        const top = pier.deckTop + pier.deckH * 0.8;                   // hidden behind the posts' opaque part
        for (const q of pier.piles) {
            const footH = frame('pier_foot').height * k, foot = q.ground + pw * 0.5 - footH;
            if (foot >= oy && foot < y1) piece('pier_foot', q.x, foot, footH);
            // Seamless wood strip, tiled by world y; one pixel of overlap at chunk joins.
            const m0 = Math.max(oy, top), m1 = Math.min(y1 + 1, foot + 2);
            if (m1 > m0) {
                const mid = keep(s.add.tileSprite(q.x, m0, fw, (m1 - m0) / k, 'pier_pile_mid')
                    .setOrigin(0.5, 0).setScale(k).setDepth(p.depth - 0.01).setTint(p.tint));
                mid.tilePositionY = m0 / k;
            }
            // Barnacle and mussel band in the tidal zone: its own height, size and side per pile.
            const r = Math.abs(Math.sin(q.x * 12.9898) * 43758.5453) % 1, r2 = (r * 7.31) % 1;
            const bandH = frame('pier_band').height * k * (0.75 + 0.5 * r2);
            const by = pier.deckTop + pier.deckH * (1.05 + 0.6 * r);
            if (by >= oy && by < y1 && by + bandH < foot) piece('pier_band', q.x, by, bandH).setFlipX(r2 < 0.5);
        }
    }

    /**
     * A swaying kelp stalk rooted at floor spot `f`, `h` px tall: painted art
     * (kelp_stalk_*) when loaded, else the procedural strip.
     */
    addKelp(chunk, f, h, depth, rng, tint = null) {
        const s = this.scene;
        // Kelp never reaches out of the water, and none grows in the shallows or on the reef crest.
        if (f.y < LEVEL.kelpMinDepth || reefCrest(f.x) > 0) return;
        h = Math.min(h, f.y * 0.85);
        const key = rng.pick(KELP_STALKS.filter(k => s.textures.exists(k))) || 'kelp';
        const frame = s.textures.getFrame(key);
        const up = { x: Math.sin(f.angle), y: -Math.cos(f.angle) };
        const stalk = makeCritter(s, key, f.x + up.x * h * 0.48, f.y + up.y * h * 0.48, h * frame.width / frame.height, 'sway',
            { root: 'bottom', speed: rng.realInRange(0.5, 0.9), scaleY: h / frame.height });
        stalk.setDepth(depth);
        if (rng.frac() < 0.5) stalk.setFlipX?.(true);
        if (tint !== null) stalk.setColors?.(tint) ?? stalk.setTint?.(tint);
        stalk.isPlant = depth > -5;      // only stalks in the play plane bend away from the fish
        stalk.bend = 0;
        chunk.objects.push(stalk);
        this.animated.push(stalk);
    }

    /** Kelp leaf strip, drawn once; bent every frame like the creatures. */
    makeKelpTexture() {
        const s = this.scene;
        if (s.textures.exists('kelp')) return;
        const w = 96, h = 512;
        const tex = s.textures.createCanvas('kelp', w, h);
        const ctx = tex.getContext();
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#b6e86a'); grad.addColorStop(0.5, '#4fae4a'); grad.addColorStop(1, '#1f6b3c');
        ctx.strokeStyle = grad; ctx.lineWidth = 12; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(w / 2, h - 4); ctx.lineTo(w / 2, 14); ctx.stroke();
        ctx.fillStyle = grad;
        for (let y = h - 50, side = 1; y > 40; y -= 46, side = -side) {
            ctx.beginPath();
            ctx.moveTo(w / 2, y);
            ctx.quadraticCurveTo(w / 2 + side * 46, y - 18, w / 2 + side * 34, y - 58);
            ctx.quadraticCurveTo(w / 2 + side * 12, y - 34, w / 2, y - 16);
            ctx.fill();
        }
        tex.refresh();
    }

    /** Someone else collected this (playing together): take it out of the world if it is on stage. */
    take(chunkKey, kind, index) {
        if (kind === 'coin') {
            const c = this.coins.find(o => o.chunkKey === chunkKey && o.index === index && o.img.active);
            if (!c) return;
            this.scene.tweens.killTweensOf(c.img);
            this.scene.tweens.add({ targets: c.img, scale: c.img.scale * 0.2, alpha: 0, duration: 220, onComplete: () => c.img.destroy() });
            c.r = -1e6;                                   // out of reach while it fades
        } else if (kind === 'friend') {
            const f = this.friends.find(o => o.chunkKey === chunkKey && o.index === index);
            if (f) f.rewarded = true;                     // still greets, the bonus is already the team's
        }
    }

    drop(key) {
        const chunk = this.chunks.get(key);
        for (const b of chunk.bodies) this.scene.matter.world.remove(b);
        for (const o of chunk.objects) { this.scene.tweens.killTweensOf(o); o.destroy(); }
        for (const key of chunk.textures) this.scene.textures.remove(key);
        this.chunks.delete(key);
        this.coins = this.coins.filter(c => c.img.active);
        this.hazards = this.hazards.filter(h => h.img.active);
        this.friends = this.friends.filter(f => f.img.active);
        this.animated = this.animated.filter(o => o.active);
        this.creatures = this.creatures.filter(o => o.active);
        this.lights = this.lights.filter(o => o.active);
        this.tethers = this.tethers.filter(o => o.active);
        this.chains = this.chains.filter(o => o.active);
        this.vents = this.vents.filter(v => v.chunk !== key);
    }
}

/** Nest pictures, made once: a disc of raked sand as a shaded relief, and a little shell. */
function makeNestTextures(scene) {
    if (scene.textures.exists('nest_sand')) return;
    const W = 512, H = 160, tex = scene.textures.createCanvas('nest_sand', W, H), ctx = tex.getContext();
    const img = ctx.createImageData(W, H);
    // Height of the sand at a point of the disc (nx, ny in -1..1): ridges radiating from
    // the middle, crossed by rings, a raised rim, a smooth fine middle.
    const height = (nx, ny) => {
        const r = Math.hypot(nx, ny), a = Math.atan2(ny, nx);
        const out = r < 0.2 ? 0 : Math.min(1, (r - 0.2) / 0.15);
        const rays = Math.cos(a * 24 + Math.sin(r * 7) * 0.8) * 0.5 * out * Math.min(1, (1 - r) / 0.12 + 0.35);
        const rings = Math.cos(r * 30) * 0.28 * out;
        const rim = Math.exp(-((r - 0.9) ** 2) / 0.004) * 0.9;
        const middle = (1 - out) * Math.cos(r * 60) * 0.12;
        return rays + rings + rim + middle;
    };
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const nx = (x + 0.5) / W * 2 - 1, ny = (y + 0.5) / H * 2 - 1, r = Math.hypot(nx, ny);
            const i = (y * W + x) * 4;
            if (r >= 1) continue;
            // Light from above and a little from the left: slopes facing up-left are bright.
            const e = 0.02;
            const slope = (height(nx, ny + e) - height(nx, ny - e)) * 0.9 + (height(nx + e, ny) - height(nx - e, ny)) * 0.35;
            // Soft relief (a real pufferfish nest is subtle sand, not a printed pattern), sand grain,
            // and an outer edge that blends into the seabed.
            const light = Math.max(0.74, Math.min(1.14, 0.95 + slope * 0.3 - Math.max(0, ny) * 0.08));
            const grain = 0.92 + 0.16 * hash(x, y, 7);
            const t = Math.min(1, r / 0.9);
            img.data[i] = (226 - 26 * t) * light * grain;
            img.data[i + 1] = (208 - 36 * t) * light * grain;
            img.data[i + 2] = (168 - 52 * t) * light * grain;
            img.data[i + 3] = 255 * Math.min(1, (1 - r) / 0.28);
        }
    }
    ctx.putImageData(img, 0, 0);
    tex.refresh();

    const shell = scene.textures.createCanvas('nest_shell', 64, 52), sc = shell.getContext();
    const body = sc.createRadialGradient(26, 20, 2, 32, 30, 30);
    body.addColorStop(0, '#ffffff'); body.addColorStop(0.55, '#e9e4dc'); body.addColorStop(1, '#a89f95');
    sc.fillStyle = body;
    sc.beginPath(); sc.moveTo(32, 50); sc.bezierCurveTo(-4, 44, 2, 2, 32, 4); sc.bezierCurveTo(62, 2, 68, 44, 32, 50); sc.fill();
    sc.strokeStyle = 'rgba(120, 100, 90, 0.35)'; sc.lineWidth = 1.5;
    for (let k = -3; k <= 3; k++) { sc.beginPath(); sc.moveTo(32, 49); sc.quadraticCurveTo(32 + k * 9, 26, 32 + k * 7.5, 8 + Math.abs(k) * 3); sc.stroke(); }
    shell.refresh();
}

/** A piece of old fishing line, soft-edged, stretched to any length. */
function makeLineTexture(scene) {
    if (scene.textures.exists('hz_line')) return;
    const tex = scene.textures.createCanvas('hz_line', 8, 32), ctx = tex.getContext();
    const across = ctx.createLinearGradient(0, 0, 8, 0);
    across.addColorStop(0, 'rgba(60, 70, 60, 0)'); across.addColorStop(0.35, 'rgba(92, 104, 84, 0.95)');
    across.addColorStop(0.65, 'rgba(58, 66, 56, 0.95)'); across.addColorStop(1, 'rgba(60, 70, 60, 0)');
    ctx.fillStyle = across;
    ctx.fillRect(0, 0, 8, 32);
    tex.refresh();

    // Chain: oval links, seen alternately from the front and from the side, tiling downward.
    const chain = scene.textures.createCanvas('hz_chain', 16, 44), cc = chain.getContext();
    cc.lineWidth = 3.2; cc.strokeStyle = '#5d5f5c';
    cc.beginPath(); cc.ellipse(8, 11, 5.2, 9.5, 0, 0, Math.PI * 2); cc.stroke();
    cc.strokeStyle = '#3f423f'; cc.lineWidth = 3.6;
    cc.beginPath(); cc.moveTo(8, 21); cc.lineTo(8, 45); cc.moveTo(8, -1); cc.lineTo(8, 1); cc.stroke();
    cc.strokeStyle = 'rgba(190, 200, 190, 0.35)'; cc.lineWidth = 1;
    cc.beginPath(); cc.moveTo(4.6, 6); cc.lineTo(4.6, 16); cc.stroke();
    chain.refresh();
    // The same links 46 times over: ropes cut frames of the length they need from it.
    const long = scene.textures.createCanvas('hz_chain_long', 16, 2024), lc = long.getContext();
    for (let k = 0; k < 46; k++) lc.drawImage(chain.getSourceImage(), 0, k * 44);
    long.refresh();

    // The underside of a boat at the surface: a dark, soft-edged hull seen from below.
    const hull = scene.textures.createCanvas('hz_hull', 560, 150), hc = hull.getContext();
    hc.filter = 'blur(5px)';
    const shade = hc.createLinearGradient(0, 10, 0, 140);
    shade.addColorStop(0, '#16242c'); shade.addColorStop(1, '#2c444e');
    hc.fillStyle = shade;
    hc.beginPath(); hc.moveTo(14, 26); hc.quadraticCurveTo(280, 4, 546, 26);
    hc.quadraticCurveTo(470, 132, 280, 138); hc.quadraticCurveTo(90, 132, 14, 26); hc.fill();
    hull.refresh();
}
