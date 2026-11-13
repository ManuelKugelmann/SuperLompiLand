import Phaser from 'phaser';
import { makeCritter } from './critters.js';
import {
    BIOMES, WORLD_WEST, WORLD_END, ABYSS, biomeBlendAt, biomeIndexAt, mixColor, floorY, pickWeighted
} from './biomes.js';

export const LEVEL = {
    cell: 96,             // marching-squares cell size (world px) — smaller = rounder outlines
    cells: 10,            // cells per chunk side  -> chunk = 960 px
    seed: 1337,
    threshold: 0.53,      // density above this is rock
    maxDepth: 5600,       // deepest seabed (far east)
    spawn: { x: 0, y: 700 },
    margin: 1,            // extra chunks generated around the view
    hitSlack: 0.8,        // hazards hit at 80 % of their drawn size (forgiving)
    rockRes: 0.6,         // baked terrain resolution (1 = full; lower saves GPU memory)
    backRes: 0.3,         // baked back-wall / shadow layer resolution (soft anyway)
    rockTexScale: 1.6     // how large the rock texture appears
};
const CH = LEVEL.cell * LEVEL.cells;

/** How each creature / object looks and moves. Sizes are display widths in px. */
const FRIENDS = {
    friend_turtle: { size: 240, swim: 380, bob: 18, anim: 'swim', speed: 0.5 },
    friend_clownfish: { size: 170, swim: 440, bob: 10, anim: 'swim' },
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
    spikes: { size: 210, r: 62, place: 'floor', lift: 30 },
    hazard_barrel: { size: 190, r: 78, place: 'floor', lift: 80, anim: 'wobble' },
    mine: { size: 150, r: 64, place: 'water', anim: 'wobble', bob: 18 },
    hazard_buoy: { size: 130, r: 70, place: 'water', anim: 'wobble', bob: 26 },
    hazard_net: { size: 230, r: 96, place: 'water', anim: 'sway' },
    hazard_claw: { size: 230, r: 92, place: 'water', anim: 'sway', bob: 70 }
};
const BAND_DT = [0, 0.03, 0.075, 0.14, 0.22]; // density steps of the terrain colour bands
const DEEP_TINT = 0x1a3a62;

function hash(ix, iy, seed) {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x, y, seed) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed);
    const c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

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
    constructor(scene) {
        this.scene = scene;
        this.chunks = new Map(); // "cx,cy" -> { objects[], bodies[] }
        this.coins = [];
        this.hazards = [];
        this.friends = [];
        this.animated = [];
        this.lights = [];     // glows that follow a creature
        this.vents = [];      // bubble plants: columns of rising bubbles that lift the fish
        this.makeKelpTexture();
        this.nests = this.findNests();
        const lang = scene.registry.get('currentLanguage') || 'de';
        const ground = x => { let y = floorY(x) + 260; while (y > 400 && this.density(x, y) > LEVEL.threshold) y -= 12; return y + 12; };
        const trench = BIOMES[BIOMES.length - 1];
        this.signs = [
            { x: trench.from + 620, text: lang === 'de' ? 'Marianengraben' : 'Mariana Trench', arrow: '→' },
            { x: ABYSS.x - ABYSS.halfWidth * 1.9, text: lang === 'de' ? 'Marianengraben' : 'Mariana Trench', arrow: '↘' }
        ].map(sg => ({ ...sg, y: ground(sg.x) }));
    }

    /** Rock density at a world point (> LEVEL.threshold = solid). */
    density(x, y, withNests = true) {
        // Two broad octaves only: big soft blobs and winding passages, no jagged detail.
        let n = 0.72 * vnoise(x / 1000, y / 1000, LEVEL.seed) + 0.28 * vnoise(x / 420, y / 420, LEVEL.seed + 7);
        const { a, b, t } = biomeBlendAt(x);
        n -= Phaser.Math.Linear(a.open, b.open, t);                      // lagoon / open sea have less rock
        if (y < 520) n -= ((520 - y) / 520) * 0.6;                       // open water under the surface
        const fy = floorY(x);
        if (y > fy) n += (y - fy) / 380;                                 // seabed, deeper toward the east
        // Keep the abyss shaft swimmable all the way down.
        if (y > 4200 && y < fy - 150 && Math.abs(x - ABYSS.x) < ABYSS.halfWidth * 0.75) n -= 0.3;
        if (x < WORLD_WEST + 900) n += (WORLD_WEST + 900 - x) / 500;     // western shore
        if (x > WORLD_END + 900) n += (x - WORLD_END - 900) / 500;       // wall behind the grand nest
        const ds = Math.hypot(x - LEVEL.spawn.x, y - LEVEL.spawn.y);
        if (ds < 900) n -= (1 - ds / 900) * 0.6;                         // clear start pool
        if (withNests && this.nests) {
            for (const nest of this.nests) {                             // open water above every nest
                if (Math.abs(x - nest.x) > 520 || y > nest.y - 30) continue;
                const d = Math.hypot(x - nest.x, y - (nest.y - 260));
                if (d < 480) n -= (1 - d / 480) * 0.7;
            }
        }
        return n;
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

    /** One nest per biome start (not the lagoon) plus the grand nest at the end. */
    findNests() {
        const xs = BIOMES.slice(1).map(b => b.from + 260);
        xs[0] = LEVEL.spawn.x;                // home reef: right under the start pool
        xs.push(WORLD_END - 300);
        return xs.map((x, index) => {
            // On the real seabed: start inside it and walk up to its surface.
            let y = floorY(x) + 260;
            while (y > 400 && this.density(x, y, false) > LEVEL.threshold) y -= 12;
            y += 12;
            return { x, y, index, grand: index === xs.length - 1, biome: BIOMES[Math.min(index + 1, BIOMES.length - 1)] };
        });
    }

    update(camX, camY) {
        const W = this.scene.scale.width, H = this.scene.scale.height;
        const x0 = Math.floor(camX / CH) - LEVEL.margin, x1 = Math.floor((camX + W) / CH) + LEVEL.margin;
        const y0 = Math.max(0, Math.floor(camY / CH) - LEVEL.margin), y1 = Math.floor((camY + H) / CH) + LEVEL.margin;
        for (let cy = y0; cy <= y1; cy++) {
            for (let cx = x0; cx <= x1; cx++) if (!this.chunks.has(`${cx},${cy}`)) this.build(cx, cy);
        }
        for (const key of [...this.chunks.keys()]) {
            const [cx, cy] = key.split(',').map(Number);
            if (cx < x0 - 1 || cx > x1 + 1 || cy < y0 - 1 || cy > y1 + 1) this.drop(key);
        }
    }

    /** Per frame: bend / pulse every creature and plant. `t` in seconds. */
    animate(t) {
        for (const o of this.animated) if (o.active) o.animate(t);
        for (const l of this.lights) if (l.active && l.follow.active) l.setPosition(l.follow.x, l.follow.y);
    }

    /** Upward push at this point from bubble plants (0 if none). */
    liftAt(x, y) {
        for (const v of this.vents) if (Math.abs(x - v.x) < 95 && y < v.y && y > v.y - v.height) return 1;
        return 0;
    }

    build(cx, cy) {
        const s = this.scene, C = LEVEL.cell, T = LEVEL.threshold, N = LEVEL.cells;
        const ox = cx * CH, oy = cy * CH, mid = ox + CH / 2;
        const rng = new Phaser.Math.RandomDataGenerator([`${LEVEL.seed}:${cx}:${cy}`]);
        const chunk = { objects: [], bodies: [] };
        this.chunks.set(`${cx},${cy}`, chunk);
        const keep = o => { chunk.objects.push(o); return o; };
        const has = key => s.textures.exists(key);
        const blend = biomeBlendAt(mid);
        const biome = blend.t < 0.5 ? blend.a : blend.b;

        // Density at cell corners (shared with neighbours -> seamless).
        const val = [], back = [];
        for (let j = 0; j <= N; j++) {
            val.push([]); back.push([]);
            for (let i = 0; i <= N; i++) {
                const x = ox + i * C, y = oy + j * C;
                const d = this.density(x, y);
                val[j].push(d);
                // Some caves get a rock wall behind them instead of open water.
                back[j].push(vnoise(x / 1500, y / 1500, LEVEL.seed + 31) > 0.56 && y > 600 ? d + 0.05 : -1);
            }
        }
        const eachCell = (grid, t, fn) => {
            for (let j = 0; j < N; j++) {
                for (let i = 0; i < N; i++) {
                    fn(marchCell(ox + i * C, oy + j * C, C, [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]], t));
                }
            }
        };
        const depthMix = Phaser.Math.Clamp((oy + CH / 2) / LEVEL.maxDepth, 0, 1) * 0.5;
        const bandColor = k => mixColor(mixColor(blend.a.rock[k], blend.b.rock[k], blend.t), DEEP_TINT, depthMix);

        // Terrain is drawn once into two textures per chunk and the vector shapes
        // are thrown away: re-tessellating hundreds of polygons every frame was by
        // far the biggest cost of the whole game.
        const temp = [];
        const scratch = () => { const gr = s.make.graphics({ add: false }); temp.push(gr); return gr; };
        const bake = (depth, k, layers) => {
            const size = Math.ceil(CH * k);
            const rt = keep(s.add.renderTexture(ox, oy, size, size).setOrigin(0).setScale(CH / size).setDepth(depth));
            for (const [obj, erase] of layers) {
                if (obj.type === 'Graphics') obj.setScale(k).setPosition(-ox * k, -oy * k);
                if (erase) rt.erase(obj); else rt.draw(obj);
            }
            return rt;
        };

        // --- Back layer: cave back walls + ambient occlusion in the water ------
        const wall = scratch();
        wall.fillStyle(mixColor(bandColor(2), 0x0a2a44, 0.4), 0.42);
        eachCell(back, T, shape => { if (shape.poly.length >= 3) wall.fillPoints(shape.poly, true); });
        const ao = scratch();
        for (const [dt, alpha] of [[-0.05, 0.06], [-0.03, 0.07], [-0.014, 0.09]]) {
            ao.fillStyle(0x04162a, alpha);
            eachCell(val, T + dt, c => { if (c.poly.length >= 3) ao.fillPoints(c.poly, true); });
        }
        bake(-6, LEVEL.backRes, [[wall], [ao]]);

        // --- Rock layer ---------------------------------------------------------
        const textured = has('tex_rock');
        const floors = [];
        const layers = [];
        if (textured) {
            // Rock texture over the whole chunk; everything that is water is erased below.
            const k = LEVEL.rockRes;
            const tile = s.make.tileSprite({ x: 0, y: 0, width: Math.ceil(CH * k), height: Math.ceil(CH * k), key: 'tex_rock', add: false }).setOrigin(0);
            tile.setTileScale(k * LEVEL.rockTexScale).setTilePosition(ox / LEVEL.rockTexScale, oy / LEVEL.rockTexScale);
            tile.setTint(mixColor(0xffffff, DEEP_TINT, depthMix));
            temp.push(tile);
            layers.push([tile]);
        }
        // Light comes from above: upward faces get a bright rim, undersides a dark one.
        const rim = {
            g: scratch(),
            lit: mixColor(bandColor(0), 0xffffff, 0.4),
            side: bandColor(0),
            shade: mixColor(bandColor(3), 0x02101e, 0.45)
        };
        const bands = scratch();
        BAND_DT.forEach((dt, k) => {
            bands.fillStyle(bandColor(k), textured ? [0.42, 0.46, 0.62, 0.74, 0.84][k] : 1);
            eachCell(val, T + dt, c => {
                if (c.poly.length >= 3) bands.fillPoints(c.poly, true);
                if (k === 0) for (const [p, q] of c.edges) this.addEdge(chunk, p, q, floors, rim);
            });
        });
        layers.push([bands]);
        if (textured) {
            const water = scratch();
            water.fillStyle(0xffffff, 1);
            const neg = val.map(row => row.map(v => -v));
            eachCell(neg, -T, c => { if (c.poly.length >= 3) water.fillPoints(c.poly, true); });
            layers.push([water, true]);
        }
        layers.push([rim.g]);
        bake(-2, LEVEL.rockRes, layers);
        for (const obj of temp) obj.destroy();

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

        // --- Coin trails through open water ----------------------------------
        for (let trails = rng.between(Math.max(0, biome.coins - 2), biome.coins); trails > 0; trails--) {
            let x = ox + rng.between(80, CH - 80), y = oy + rng.between(80, CH - 80);
            let heading = rng.realInRange(0, Math.PI * 2);
            const bend = rng.realInRange(-0.35, 0.35);
            for (let k = rng.between(4, 7); k > 0; k--) {
                if (this.isOpen(x, y, 0.09)) this.addCoin(chunk, x, y);
                heading += bend;
                x += Math.cos(heading) * 100;
                y += Math.sin(heading) * 100;
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
    addEdge(chunk, a, b, floors, rim) {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        let nx = -Math.sin(ang), ny = Math.cos(ang);
        if (this.density(mx + nx * 24, my + ny * 24) < this.density(mx - nx * 24, my - ny * 24)) { nx = -nx; ny = -ny; }
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        chunk.bodies.push(this.scene.matter.add.rectangle(mx + nx * 26, my + ny * 26, len + 8, 52,
            { isStatic: true, angle: ang, friction: 0.05 }));
        if (rim) {
            // ny > 0: rock is below this edge = a floor facing the light.
            const color = ny > 0.35 ? rim.lit : ny < -0.35 ? rim.shade : rim.side;
            rim.g.lineStyle(ny > 0.35 ? 16 : 12, color, 0.95);
            rim.g.lineBetween(a.x, a.y, b.x, b.y);
            rim.g.fillStyle(color, 0.95).fillCircle(a.x, a.y, ny > 0.35 ? 8 : 6);
        }
        if (ny > 0.8 && len > 45) floors.push({ x: mx, y: my, angle: b.x > a.x ? ang : ang + Math.PI });
    }

    addCoin(chunk, x, y) {
        const s = this.scene;
        const img = s.textures.exists('coin')
            ? s.add.image(x, y, 'coin').setDisplaySize(72, 72)
            : s.add.circle(x, y, 32, 0xffd23f).setStrokeStyle(5, 0xfff3b0);
        img.setDepth(2);
        s.tweens.add({ targets: img, y: y - 14, duration: 1100 + (Math.abs(x) % 400), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        chunk.objects.push(img);
        this.coins.push({ img, r: 40 });
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
        } else if (h.bob) {
            s.tweens.add({ targets: img, y: y - h.bob, duration: rng.between(1700, 2600), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        this.hazards.push({ img, r: h.r * LEVEL.hitSlack });
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
        if (!f.ground) s.tweens.add({ targets: img, y: y - f.bob, duration: rng.between(1400, 2200), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        chunk.objects.push(img);
        this.friends.push({ img, r: f.size * 0.38, greeted: false });
        return img;
    }

    /** The pufferfish sand circle: concentric ridges, radial grooves, a ring of shells. */
    drawNest(chunk, nest) {
        const s = this.scene, R = nest.grand ? 300 : 210;
        const g = s.add.graphics().setDepth(-1);
        const cy = nest.y + 6;
        [[1, 0xcfa565], [0.86, 0xf6e3ae], [0.7, 0xd9b877], [0.52, 0xf9ecc4], [0.32, 0xe2c488], [0.14, 0xfff6d8]].forEach(([k, col]) => {
            g.fillStyle(col, 1).fillEllipse(nest.x, cy, R * 2 * k, R * 0.62 * k);
        });
        g.lineStyle(4, 0xb98f55, 0.55);
        for (let i = 0; i < 22; i++) {
            const a = (i / 22) * Math.PI * 2;
            g.lineBetween(nest.x + Math.cos(a) * R * 0.2, cy + Math.sin(a) * R * 0.062,
                nest.x + Math.cos(a) * R * 0.96, cy + Math.sin(a) * R * 0.3);
        }
        const shells = [0xff8fb1, 0xfff1a8, 0x9be9ef, 0xc9a0ff, 0xffb26b];
        const count = nest.grand ? 18 : 10;
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2;
            g.fillStyle(shells[i % shells.length], 1).fillCircle(nest.x + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.28, nest.grand ? 15 : 11);
        }
        chunk.objects.push(g);
        // A soft beacon so the nest can be found from a distance.
        const beam = s.add.triangle(nest.x, nest.y - 420, -R * 0.5, 840, R * 0.5, 840, 0, 0, 0xfff3b0, 0.1).setDepth(-5)
            .setBlendMode(Phaser.BlendModes.ADD);
        s.tweens.add({ targets: beam, alpha: 0.04, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
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

    drop(key) {
        const chunk = this.chunks.get(key);
        for (const b of chunk.bodies) this.scene.matter.world.remove(b);
        for (const o of chunk.objects) { this.scene.tweens.killTweensOf(o); o.destroy(); }
        this.chunks.delete(key);
        this.coins = this.coins.filter(c => c.img.active);
        this.hazards = this.hazards.filter(h => h.img.active);
        this.friends = this.friends.filter(f => f.img.active);
        this.animated = this.animated.filter(o => o.active);
        this.lights = this.lights.filter(o => o.active);
        this.vents = this.vents.filter(v => v.chunk !== key);
    }
}

export { biomeIndexAt };

/**
 * Marching squares for one cell. `v` = densities at tl, tr, br, bl.
 * Returns the solid polygon and its outline segments (edges between two
 * interpolated crossing points).
 */
function marchCell(x, y, size, v, t) {
    const corners = [[x, y], [x + size, y], [x + size, y + size], [x, y + size]];
    const poly = [], cut = [];
    for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        const a = corners[i], b = corners[j];
        if (v[i] > t) { poly.push(new Phaser.Math.Vector2(a[0], a[1])); cut.push(false); }
        if ((v[i] > t) !== (v[j] > t)) {
            const k = (t - v[i]) / (v[j] - v[i]);
            poly.push(new Phaser.Math.Vector2(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k));
            cut.push(true);
        }
    }
    const edges = [];
    for (let i = 0; i < poly.length; i++) {
        const j = (i + 1) % poly.length;
        if (cut[i] && cut[j] && poly.length > 2) edges.push([poly[i], poly[j]]);
    }
    return { poly, edges };
}
