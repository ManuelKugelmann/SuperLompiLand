import Phaser from 'phaser';
import { makeCritter } from './critters.js';

export const LEVEL = {
    cell: 96,             // marching-squares cell size (world px) — smaller = rounder outlines
    cells: 10,            // cells per chunk side  -> chunk = 960 px
    seed: 1337,
    threshold: 0.53,      // density above this is rock
    maxDepth: 5600,       // solid seabed below this
    spawn: { x: 0, y: 700 },
    margin: 1             // extra chunks generated around the view
};
const CH = LEVEL.cell * LEVEL.cells;

/** How hazards move. Art of enemies faces left, so their tail is on the right. */
const HAZARD_ANIM = {
    enemy_angler: { anim: 'swim', tail: 'right', speed: 0.7 },
    urchin: { anim: 'throb' },
    mine: { anim: 'wobble' },
    hazard_barrel: { anim: 'wobble' },
    hazard_claw: { anim: 'sway' },
    hazard_net: { anim: 'sway' },
    hazard_buoy: { anim: 'wobble' }
};

/** Lompi's friends. Art faces right; `swim` = patrol distance, `ground` = sits on rock. */
const FRIENDS = [
    { key: 'friend_turtle', size: 240, swim: 380, bob: 18, anim: 'swim', speed: 0.5 },
    { key: 'friend_clownfish', size: 170, swim: 440, bob: 10, anim: 'swim' },
    { key: 'friend_jellyfish', size: 180, bob: 60, anim: 'pulse' },
    { key: 'friend_seahorse', size: 150, bob: 26, anim: 'sway' },
    { key: 'friend_starfish', size: 170, ground: true, bob: 4, anim: 'wobble' }
];

// Terrain colour bands, outer rim -> core. Each is drawn at a higher density
// threshold, giving soft layered contours instead of one flat fill.
const BANDS = [
    { dt: 0.0, color: 0xf3dba0 },
    { dt: 0.03, color: 0xd2ae6c },
    { dt: 0.075, color: 0x9c7a54 },
    { dt: 0.14, color: 0x6a5748 },
    { dt: 0.22, color: 0x4b4350 }
];
const DEEP_TINT = new Phaser.Display.Color(26, 58, 98);

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
 * Open 2D underwater world, generated on demand in every direction.
 *
 * A continuous density field (layered value noise) decides rock vs water; rock
 * outlines come from marching squares, so chunks join seamlessly and the same
 * seed always gives the same world. Water surface at y = 0, solid seabed below
 * LEVEL.maxDepth. Coral, coins, friends and hazards are placed per chunk from a
 * seeded RNG; danger grows with distance from the spawn.
 */
export default class LevelGenerator {
    constructor(scene) {
        this.scene = scene;
        this.chunks = new Map(); // "cx,cy" -> { objects[], bodies[] }
        this.coins = [];
        this.hazards = [];
        this.friends = [];
        this.animated = [];
    }

    /** Per frame: bend / pulse every creature. `t` in seconds. */
    animate(t) {
        for (const o of this.animated) if (o.active) o.animate(t);
    }

    /** Rock density at a world point (> LEVEL.threshold = solid). */
    density(x, y) {
        // Two broad octaves only: big soft blobs and winding passages, no jagged detail.
        let n = 0.72 * vnoise(x / 1000, y / 1000, LEVEL.seed) + 0.28 * vnoise(x / 420, y / 420, LEVEL.seed + 7);
        if (y < 520) n -= ((520 - y) / 520) * 0.6;                       // open water under the surface
        if (y > LEVEL.maxDepth) n += (y - LEVEL.maxDepth) / 500;         // seabed
        const ds = Math.hypot(x - LEVEL.spawn.x, y - LEVEL.spawn.y);
        if (ds < 900) n -= (1 - ds / 900) * 0.6;                         // clear spawn pool
        return n;
    }

    isOpen(x, y, slack = 0.07) {
        return y > 60 && this.density(x, y) < LEVEL.threshold - slack;
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

    build(cx, cy) {
        const s = this.scene, C = LEVEL.cell, T = LEVEL.threshold;
        const ox = cx * CH, oy = cy * CH;
        const rng = new Phaser.Math.RandomDataGenerator([`${LEVEL.seed}:${cx}:${cy}`]);
        const chunk = { objects: [], bodies: [] };
        this.chunks.set(`${cx},${cy}`, chunk);
        const keep = o => { chunk.objects.push(o); return o; };

        // Density at cell corners (shared with neighbours -> seamless).
        const N = LEVEL.cells;
        const val = [];
        for (let j = 0; j <= N; j++) {
            val.push([]);
            for (let i = 0; i <= N; i++) val[j].push(this.density(ox + i * C, oy + j * C));
        }

        // --- Terrain --------------------------------------------------------
        const depthMix = Phaser.Math.Clamp((oy + CH / 2) / LEVEL.maxDepth, 0, 1) * 0.55;
        const g = keep(s.add.graphics().setDepth(-2));
        const floors = [];
        for (const [bi, band] of BANDS.entries()) {
            const base = Phaser.Display.Color.IntegerToColor(band.color);
            const col = Phaser.Display.Color.Interpolate.ColorWithColor(base, DEEP_TINT, 100, depthMix * 100);
            g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1);
            for (let j = 0; j < N; j++) {
                for (let i = 0; i < N; i++) {
                    const shape = marchCell(ox + i * C, oy + j * C, C,
                        [val[j][i], val[j][i + 1], val[j + 1][i + 1], val[j + 1][i]], T + band.dt);
                    if (shape.poly.length >= 3) g.fillPoints(shape.poly, true);
                    if (bi === 0) for (const [a, b] of shape.edges) this.addEdge(chunk, a, b, floors);
                }
            }
        }

        // --- Decor on upward-facing rock ------------------------------------
        const safe = Math.hypot(ox + CH / 2 - LEVEL.spawn.x, oy + CH / 2 - LEVEL.spawn.y) < CH * 1.6;
        const danger = Phaser.Math.Clamp(Math.hypot(cx, cy) / 9, 0, 1);
        rng.shuffle(floors);
        let corals = 0;
        for (const f of floors) {
            const roll = rng.frac();
            if (roll < 0.5 && corals < 4) {
                const key = rng.pick(['coral_1', 'coral_2']);
                if (!s.textures.exists(key)) continue;
                const img = keep(s.add.image(f.x, f.y, key).setOrigin(0.5, 0.9)
                    .setScale(rng.realInRange(0.28, 0.55)).setRotation(f.angle).setDepth(rng.frac() < 0.3 ? 7 : -1));
                if (rng.frac() < 0.5) img.setFlipX(true);
                corals++;
            } else if (!safe && roll > 0.93 - danger * 0.12) {
                const up = { x: Math.sin(f.angle), y: -Math.cos(f.angle) };
                if (s.textures.exists('spikes') && rng.frac() < 0.4) {
                    this.addHazard(chunk, 'spikes', f.x + up.x * 34, f.y + up.y * 34, 200, 62).setRotation(f.angle);
                } else {
                    this.addHazard(chunk, 'urchin', f.x + up.x * 40, f.y + up.y * 40, 130, 54);
                }
            } else if (roll > 0.5 && roll < 0.56 && s.textures.exists('friend_starfish')) {
                this.addFriend(chunk, { ...FRIENDS[4], rotation: f.angle }, f.x + Math.sin(f.angle) * 40, f.y - Math.cos(f.angle) * 40, rng);
            }
        }

        // --- Coin trails through open water ---------------------------------
        for (let trails = rng.between(1, 2); trails > 0; trails--) {
            let x = ox + rng.between(80, CH - 80), y = oy + rng.between(80, CH - 80);
            let heading = rng.realInRange(0, Math.PI * 2);
            const bend = rng.realInRange(-0.35, 0.35);
            for (let k = rng.between(5, 9); k > 0; k--) {
                if (this.isOpen(x, y, 0.09)) this.addCoin(chunk, x, y);
                heading += bend;
                x += Math.cos(heading) * 96;
                y += Math.sin(heading) * 96;
            }
        }

        // --- Swimmers: friends and foes -------------------------------------
        const openSpot = (span = 0) => {
            for (let tries = 6; tries > 0; tries--) {
                const x = ox + rng.between(120, CH - 120), y = oy + rng.between(120, CH - 120);
                if (this.isOpen(x, y, 0.1) && this.isOpen(x - span, y, 0.08) && this.isOpen(x + span, y, 0.08)) return { x, y };
            }
            return null;
        };
        if (rng.frac() < 0.3) {
            const f = rng.pick(FRIENDS.filter(d => !d.ground && s.textures.exists(d.key)));
            const p = f && openSpot(f.swim || 0);
            if (p) this.addFriend(chunk, f, p.x, p.y, rng);
        }
        if (!safe && rng.frac() < 0.12 + danger * 0.3) {
            const p = openSpot();
            if (p) {
                const mine = this.addHazard(chunk, 'mine', p.x, p.y, 150, 62);
                s.tweens.add({ targets: mine, y: p.y - 18, angle: 6, duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            }
        }
        if (!safe && s.textures.exists('enemy_angler') && rng.frac() < 0.06 + danger * 0.3) {
            const p = openSpot(300);
            if (p) {
                const angler = this.addHazard(chunk, 'enemy_angler', p.x + 260, p.y, 230, 78);
                s.tweens.add({
                    targets: angler, x: p.x - 260, duration: rng.between(3800, 5200), yoyo: true, repeat: -1,
                    ease: 'Sine.easeInOut', onYoyo: () => angler.face?.(-1), onRepeat: () => angler.face?.(1)
                });
            }
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

    addHazard(chunk, key, x, y, size, r) {
        const s = this.scene;
        let img;
        if (s.textures.exists(key)) {
            const anim = HAZARD_ANIM[key];
            if (anim) {
                img = makeCritter(s, key, x, y, size, anim.anim, anim);
                this.animated.push(img);
            } else {
                img = s.add.image(x, y, key);
                img.setDisplaySize(size, size * (img.height / img.width));
            }
        } else {
            img = s.add.star(x, y, 12, r * 0.6, r, key === 'mine' ? 0x33414a : 0x6a2d86);
        }
        img.setDepth(3);
        chunk.objects.push(img);
        this.hazards.push({ img, r });
        return img;
    }

    addFriend(chunk, f, x, y, rng) {
        const s = this.scene;
        const img = makeCritter(s, f.key, x, y, f.size, f.anim, f).setDepth(f.ground ? 1 : 4);
        this.animated.push(img);
        if (f.swim) {
            const dir = rng.sign();
            img.face(dir);
            img.setX(x - dir * f.swim / 2);
            s.tweens.add({
                targets: img, x: x + dir * f.swim / 2, duration: rng.between(5000, 8000), yoyo: true, repeat: -1,
                ease: 'Sine.easeInOut', onYoyo: () => img.face(-dir), onRepeat: () => img.face(dir)
            });
        }
        if (!f.ground) s.tweens.add({ targets: img, y: y - f.bob, duration: rng.between(1400, 2200), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        chunk.objects.push(img);
        this.friends.push({ img, r: f.size * 0.38, greeted: false });
        return img;
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
    }
}

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
