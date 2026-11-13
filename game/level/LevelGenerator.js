import Phaser from 'phaser';
import { makeCritter } from './critters.js';
import { eachCell as marchGrid } from './terrain.js';
import { FIELD, createField, chunkGrids, gridRows } from './density.js';
import { SHADE, shadeChunk } from './shade.js';
import {
    BIOMES, WORLD_WEST, WORLD_END, ABYSS, biomeBlendAt, floorY, pickWeighted
} from './biomes.js';

export const LEVEL = {
    cell: 96,             // marching-squares cell size (world px) — smaller = rounder outlines
    cells: 10,            // cells per chunk side  -> chunk = 960 px
    seed: 1337,
    version: 4,           // bump when generation changes what index a coin or friend gets
    threshold: FIELD.threshold,
    maxDepth: FIELD.maxDepth,
    spawn: FIELD.spawn,
    margin: 1,            // extra chunks generated around the view
    hitSlack: 0.8,        // hazards hit at 80 % of their drawn size (forgiving)
    friendSheen: 0.4,     // strength of the rainbow sheen on friends
    sheenSpeed: 0.1,      // how fast its colours travel (turns of the colour wheel per second)
    sheenSpread: 1.3,     // how much of the colour wheel lies across one friend
    wakeRadius: 300,      // how close the fish must swim to bend a plant
    coinGap: 92,          // minimum distance between two coins
    coinStep: 110,        // distance between the coins of a trail
    trailChance: 0.13     // chance of a coin trail in a chunk, per point of the biome's `coins` value
};
const CH = LEVEL.cell * LEVEL.cells;

/** How each creature / object looks and moves. Sizes are display widths in px. */
const FRIENDS = {
    friend_turtle: { size: 240, swim: 380, bob: 18, anim: 'swim', speed: 0.5 },
    friend_jellyfish: { size: 150, bob: 60, anim: 'pulse' },
    friend_seahorse: { size: 120, bob: 26, anim: 'sway' },
    friend_starfish: { size: 170, ground: true, anim: 'wobble' },
    friend_snail: { size: 160, ground: true, anim: 'wobble' },
    friend_nudibranch: { size: 190, ground: true, anim: 'wobble' },
    urchin: { size: 140, ground: true, anim: 'throb' },
    // The anglerfish art faces left (tail on the right); it lights the deep.
    enemy_angler: { size: 240, swim: 460, bob: 14, anim: 'swim', tail: 'right', speed: 0.7, facesLeft: true, glow: true }
};
// `place`: floor = sits on rock, water = floats in open water. Enemy art faces left.
const HAZARDS = {
    // Keys are historical; what they show now: spikes = wreck scrap, hazard_buoy =
    // leaking oil drum, mine = lost anchor on its chain, hazard_net = ghost net.
    spikes: { size: 240, r: 62, place: 'floor', lift: 26 },
    hazard_buoy: { size: 170, r: 74, place: 'floor', lift: 104 },
    mine: { size: 135, r: 62, place: 'water', anim: 'sway', speed: 0.6 },
    // A ghost net never just hangs in the water: where the seabed is within `tether` px below,
    // it is caught on a line to a stone and tugs at it; near the surface it hangs from a float;
    // otherwise it drifts `drift` px to and fro.
    hazard_net: { size: 150, r: 84, place: 'water', anim: 'sway', bob: 34, speed: 0.7, tether: 620, drift: 300 }
};

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
        this.lights = [];     // glows that follow a creature
        this.vents = [];      // bubble plants: columns of rising bubbles that lift the fish
        this.buildMs = { last: 0, max: 0, count: 0 };   // cost of building chunks, shown by ?debug=perf
        this.makeKelpTexture();
        this.makeRootTextures();
        this.field = createField(LEVEL.seed);
        this.nests = this.field.nests.map(n => ({ ...n, biome: BIOMES[Math.min(n.index + 1, BIOMES.length - 1)] }));
        // Density grids are computed in a Web Worker when available; the chunk is
        // then drawn on the main thread, one per frame.
        this.pending = new Set();   // chunk keys requested from the worker
        this.early = new Map();     // chunk key -> collision bodies laid down while the worker is busy
        this.tethers = [];          // lines that hold drifting things: stretched between them and their anchor every frame
        this.ready = [];            // grids that came back, waiting to be drawn
        try {
            this.worker = new Worker(new URL('./terrainWorker.js', import.meta.url), { type: 'module' });
            this.worker.onmessage = e => { this.pending.delete(e.data.key); this.ready.push(e.data); };
            this.worker.onerror = () => { this.worker = null; this.pending.clear(); };   // fall back to the main thread
        } catch { this.worker = null; }
        const lang = scene.registry.get('currentLanguage') || 'de';
        const ground = x => { let y = floorY(x) + 260; while (y > 400 && this.density(x, y) > LEVEL.threshold) y -= 12; return y + 12; };
        const trench = BIOMES[BIOMES.length - 1];
        this.signs = [
            { x: trench.from + 620, text: lang === 'de' ? 'Marianengraben' : 'Mariana Trench', arrow: '→' },
            { x: ABYSS.x - ABYSS.halfWidth * 1.9, text: lang === 'de' ? 'Marianengraben' : 'Mariana Trench', arrow: '↘' }
        ].map(sg => ({ ...sg, y: ground(sg.x) }));
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

    /** Per frame: bend / pulse every creature and plant. `t` in seconds. */
    animate(t, fish, speed = 0) {
        for (const o of this.animated) {
            if (!o.active) continue;
            if (o.isPlant && fish) {
                // Swimming past pushes plants aside; they swing back when it is calm.
                const dx = o.x - fish.x, d = Math.hypot(dx, o.y - fish.y);
                const push = d < LEVEL.wakeRadius ? Math.sign(dx || 1) * (1 - d / LEVEL.wakeRadius) * Math.min(1, speed / 9) : 0;
                o.bend += (push - o.bend) * 0.1;
            }
            o.animate(t, o.bend || 0);
        }
        for (const line of this.tethers) {
            if (!line.active || !line.follow.active) continue;
            const fx = line.follow.x, fy = line.follow.y + line.hang, dx = line.toX - fx, dy = line.toY - fy;
            line.setPosition(fx, fy).setRotation(-Math.atan2(dx, dy));
            line.setDisplaySize(7, Math.hypot(dx, dy));
        }
        for (const l of this.lights) {
            if (!l.active || !l.follow.active) continue;
            l.setPosition(l.follow.x, l.follow.y);
            if (l.hue !== undefined) {
                // Rainbow sheen: colours run across the body and shimmer a little.
                l.face(l.follow.facing());
                l.setAlpha(LEVEL.friendSheen * (0.75 + 0.25 * Math.sin(t * 2 + l.hue * 20)));
                const at = k => RAINBOW[Math.floor(((l.hue + t * LEVEL.sheenSpeed + k * LEVEL.sheenSpread) % 1) * RAINBOW.length)];
                if (l.colors) { for (let i = 0, n = l.colors.length; i < n; i++) l.colors[i] = at((i >> 1) / (n / 2)); }
                else if (Phaser.TintModes) l.setTint(at(0), at(0.5), at(0.5), at(1));        // the fill mode set at creation stays
                else l.setTintFill(at(0), at(0.5), at(0.5), at(1));
            }
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
        const floors = [];
        marchGrid(val, ox, oy, CH, T, c => { for (const [p, q] of c.edges) this.addEdge(chunk, p, q, floors); });

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
                const key = rng.pick(['coral_1', 'coral_2', 'coral_3'].filter(has));
                if (!key) continue;
                const img = keep(s.add.image(f.x, f.y, key).setOrigin(0.5, 0.92)
                    .setScale(rng.realInRange(0.22, 0.42)).setRotation(f.angle).setDepth(rng.frac() < 0.3 ? 7 : -1));
                if (rng.frac() < 0.5) img.setFlipX(true);
                corals++;
            } else if (roll < biome.coral + biome.kelp && stalks < 6) {
                const h = rng.between(260, 620);
                const stalk = makeCritter(s, 'kelp', f.x + up.x * h * 0.48, f.y + up.y * h * 0.48, h * 0.19, 'sway',
                    { root: 'bottom', speed: rng.realInRange(0.5, 0.9), scaleY: h / 512 });
                stalk.setDepth(rng.frac() < 0.25 ? 7 : -4);
                stalk.isPlant = true;
                stalk.bend = 0;
                keep(stalk);
                this.animated.push(stalk);
                stalks++;
            } else if (!safe && roll > 1 - biome.hazardRate * 0.25) {
                const key = pickWeighted(rng, floorHazards, has);
                if (key) this.addHazard(chunk, key, f.x + up.x * HAZARDS[key].lift, f.y + up.y * HAZARDS[key].lift, rng, f.angle);
            } else if (sitters < 1 && roll > 0.5 && roll < 0.5 + biome.friendRate * 0.12) {
                const key = pickWeighted(rng, groundFriends, has);
                if (key) { this.addFriend(chunk, key, f.x + up.x * 46, f.y + up.y * 46, rng, f.angle); sitters++; }
            }
        }

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
                const root = keep(s.add.image(x, -40, `root_${rng.between(1, 3)}`).setOrigin(0.5, 0)
                    .setScale(rng.realInRange(1.1, 2.1) * (front ? 1.25 : 1), rng.realInRange(1.2, 2.4))
                    .setDepth(front ? 7.5 : -7).setAlpha(front ? 0.9 : 0.8));
                if (rng.frac() < 0.5) root.setFlipX(true);
                if (!front) root.setTint(0x6f8f86);
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
            for (let k = rng.between(5, 8); k > 0; k--) {
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
                if (this.isOpen(x, y, 0.1) && this.isOpen(x - span, y, 0.08) && this.isOpen(x + span, y, 0.08)) return { x, y };
            }
            return null;
        };
        if (rng.frac() < biome.friendRate) {
            const key = pickWeighted(rng, only(biome.friends, k => FRIENDS[k] && !FRIENDS[k].ground), has);
            const p = key && openSpot(FRIENDS[key].swim || 0);
            if (p) this.addFriend(chunk, key, p.x, p.y, rng);
        }
        if (!safe && rng.frac() < biome.hazardRate) {
            const key = pickWeighted(rng, only(biome.hazards, k => HAZARDS[k]?.place === 'water'), has);
            const p = key && openSpot((HAZARDS[key].patrol || 0) / 2 + 60);
            if (p) this.addHazard(chunk, key, p.x, p.y, rng);
        }
    }

    /** One rock outline segment: collision strip + remember upward-facing ones. */
    addEdge(chunk, a, b, floors) {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        let nx = -Math.sin(ang), ny = Math.cos(ang);
        if (this.density(mx + nx * 24, my + ny * 24) < this.density(mx - nx * 24, my - ny * 24)) { nx = -nx; ny = -ny; }
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        chunk.bodies.push(this.scene.matter.add.rectangle(mx + nx * 26, my + ny * 26, len + 8, 52,
            { isStatic: true, angle: ang, friction: 0.05 }));
        if (ny > 0.8 && len > 45) floors.push({ x: mx, y: my, angle: b.x > a.x ? ang : ang + Math.PI });
    }

    addCoin(chunk, x, y, chunkKey, index) {
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
        const img = makeCritter(s, key, x, y, h.size, h.anim || 'still', { ...h, rotation: angle }).setDepth(3);
        this.animated.push(img);
        chunk.objects.push(img);
        if (h.patrol) {
            img.setX(x + h.patrol / 2);
            s.tweens.add({
                targets: img, x: x - h.patrol / 2, duration: rng.between(3800, 5200), yoyo: true, repeat: -1,
                ease: 'Sine.easeInOut', onYoyo: () => img.face(-1), onRepeat: () => img.face(1)
            });
        } else if (h.tether || h.drift) {
            const ground = h.tether ? this.groundBelow(x, y, h.tether) : null;
            if (ground) {
                // Caught: a line runs from the net down to a stone on the seabed. The net
                // tugs at it from side to side and bobs only a little.
                makeLineTexture(s);
                const stone = s.add.ellipse(x, ground.y - 4, 46, 26, 0x4d4a48).setDepth(2.8);
                const line = s.add.image(x, y, 'hz_line').setOrigin(0.5, 0).setDepth(2.9);
                line.follow = img; line.hang = h.size * 0.32; line.toX = x; line.toY = ground.y - 10;
                chunk.objects.push(stone, line);
                this.tethers.push(line);
                img.setX(x - 46);
                s.tweens.add({ targets: img, x: x + 46, duration: rng.between(2600, 3600), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                s.tweens.add({ targets: img, y: y - h.bob * 0.4, duration: rng.between(1700, 2400), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            } else if (h.tether && y < h.tether * 1.6) {
                // Near the surface: the net hangs on a line from a float that rides on the water.
                makeLineTexture(s);
                const float = s.add.ellipse(x, 4, 54, 30, 0xd9642b).setStrokeStyle(4, 0x8f3d17).setDepth(5.9);
                const line = s.add.image(x, y, 'hz_line').setOrigin(0.5, 0).setDepth(2.9);
                line.follow = img; line.hang = -h.size * 0.32; line.toX = x; line.toY = 14;
                chunk.objects.push(float, line);
                this.tethers.push(line);
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

    addFriend(chunk, key, x, y, rng, angle = 0) {
        const s = this.scene, f = FRIENDS[key];
        const img = makeCritter(s, key, x, y, f.size, f.anim, { ...f, rotation: angle }).setDepth(f.ground ? 1 : 4);
        this.animated.push(img);
        if (f.swim) {
            const dir = rng.sign();
            const look = f.facesLeft ? -1 : 1; // which way the art is drawn
            img.face(dir * look);
            img.setX(x - dir * f.swim / 2);
            s.tweens.add({
                targets: img, x: x + dir * f.swim / 2, duration: rng.between(5000, 8000), yoyo: true, repeat: -1,
                ease: 'Sine.easeInOut', onYoyo: () => img.face(-dir * look), onRepeat: () => img.face(dir * look)
            });
        }
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
        const sheen = makeCritter(s, key, x, y, f.size, f.anim, { ...f, rotation: angle })
            .setDepth(f.ground ? 1.05 : 4.05).setBlendMode(Phaser.BlendModes.ADD).setAlpha(LEVEL.friendSheen);
        // Pure colour inside the picture's outline (a tint would only multiply with the body colour).
        if (Phaser.TintModes) sheen.setTintMode?.(Phaser.TintModes.FILL); else sheen.tintFill = true;
        sheen.follow = img;
        sheen.hue = rng.frac();
        this.animated.push(sheen);
        chunk.objects.push(sheen);
        this.lights.push(sheen);
        if (!f.ground) s.tweens.add({ targets: img, y: y - f.bob, duration: rng.between(1400, 2200), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        chunk.objects.push(img);
        // Friends are numbered per chunk too. They greet you every time you come
        // back; only the coin bonus is given once per friend, for good.
        const index = chunk.friendCount = (chunk.friendCount ?? -1) + 1;
        this.friends.push({ img, r: f.size * 0.38, chunkKey: chunk.key, index, greeted: false, rewarded: !!this.state?.has(chunk.key, 'friend', index) });
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
        this.lights = this.lights.filter(o => o.active);
        this.tethers = this.tethers.filter(o => o.active);
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
            const light = Math.max(0.55, Math.min(1.25, 0.92 + slope * 0.55 - Math.max(0, ny) * 0.1));
            // Fine pale sand in the middle, warmer toward the rim.
            const t = Math.min(1, r / 0.9);
            img.data[i] = (250 - 28 * t) * light;
            img.data[i + 1] = (236 - 44 * t) * light;
            img.data[i + 2] = (196 - 70 * t) * light;
            img.data[i + 3] = 255 * Math.min(1, (1 - r) / 0.1);
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
}
