import Phaser from 'phaser';

export const LEVEL = {
    chunk: 960,          // world px per generated chunk
    step: 80,            // terrain sample spacing
    ahead: 3,            // chunks kept generated in front of the camera
    behind: 1,           // chunks kept behind it
    seed: 'lompi'
};

/**
 * Endless procedural seabed. The terrain height is a continuous function of x,
 * so chunks join seamlessly; everything else (coral, rocks, coins, hazards) is
 * placed per chunk from a seeded RNG, so a given seed always yields the same
 * level. Difficulty ramps with distance.
 */
export default class LevelGenerator {
    constructor(scene) {
        this.scene = scene;
        this.H = scene.scale.height;
        this.chunks = new Map(); // index -> { objects[], bodies[] }
        this.coins = [];
        this.hazards = [];
    }

    /** Seabed surface y at world x. */
    groundY(x) {
        const ramp = Phaser.Math.Clamp(x / 12000, 0, 1);
        const y = this.H - 190
            - 75 * Math.sin(x / 530)
            - 45 * Math.sin(x / 211 + 1.3)
            - ramp * 110 * Math.sin(x / 137 + 0.4) * Math.sin(x / 900);
        return Phaser.Math.Clamp(y, this.H - 520, this.H - 70);
    }

    update(cameraX) {
        const first = Math.floor(cameraX / LEVEL.chunk) - LEVEL.behind;
        const last = Math.floor((cameraX + this.scene.scale.width) / LEVEL.chunk) + LEVEL.ahead;
        for (let i = Math.max(0, first); i <= last; i++) if (!this.chunks.has(i)) this.build(i);
        for (const i of [...this.chunks.keys()]) if (i < first) this.drop(i);
    }

    build(i) {
        const s = this.scene;
        const x0 = i * LEVEL.chunk, x1 = x0 + LEVEL.chunk;
        const rng = new Phaser.Math.RandomDataGenerator([`${LEVEL.seed}-${i}`]);
        const chunk = { objects: [], bodies: [] };
        this.chunks.set(i, chunk);
        const keep = o => { chunk.objects.push(o); return o; };
        const difficulty = Phaser.Math.Clamp((i - 1) / 14, 0, 1);

        // --- Terrain: sand polygon + highlight + collision strip -----------
        const pts = [];
        for (let x = x0; x <= x1; x += LEVEL.step) pts.push(new Phaser.Math.Vector2(x, this.groundY(x)));
        const g = keep(s.add.graphics().setDepth(-2));
        const fill = (color, offset) => {
            g.fillStyle(color, 1).beginPath().moveTo(x0, this.H + 300);
            for (const p of pts) g.lineTo(p.x, p.y + offset);
            g.lineTo(x1, this.H + 300).closePath().fillPath();
        };
        fill(0xf3dba0, 0);
        fill(0xdcb872, 22);
        fill(0xb98f55, 90);
        fill(0x7d6247, 210);
        for (let k = 0; k < 14; k++) { // pebbles / speckles
            const px = rng.between(x0, x1);
            g.fillStyle(rng.pick([0xc9a56a, 0xfff0c4, 0xa98050]), 0.8)
                .fillEllipse(px, this.groundY(px) + rng.between(34, 190), rng.between(10, 34), rng.between(6, 16));
        }
        for (let k = 0; k < pts.length - 1; k++) {
            const a = pts[k], b = pts[k + 1];
            const ang = Math.atan2(b.y - a.y, b.x - a.x);
            const len = a.distance(b) + 6;
            const mx = (a.x + b.x) / 2 - Math.sin(ang) * 30;
            const my = (a.y + b.y) / 2 + Math.cos(ang) * 30;
            chunk.bodies.push(s.matter.add.rectangle(mx, my, len, 60, { isStatic: true, angle: ang, friction: 0.05 }));
        }
        // Water surface: a soft ceiling.
        chunk.bodies.push(s.matter.add.rectangle(x0 + LEVEL.chunk / 2, -50, LEVEL.chunk, 100, { isStatic: true }));

        // --- Decor ----------------------------------------------------------
        const plant = (key, x, scale, depth, sink = 14) => {
            if (!s.textures.exists(key)) return null;
            return keep(s.add.image(x, this.groundY(x) + sink, key).setOrigin(0.5, 1).setScale(scale).setDepth(depth));
        };
        for (let k = rng.between(2, 4); k > 0; k--) {
            const front = rng.frac() < 0.35;
            const img = plant(rng.pick(['coral_1', 'coral_2']), rng.between(x0 + 60, x1 - 60),
                rng.realInRange(0.3, 0.62), front ? 7 : -3, front ? 40 : 14);
            if (img && rng.frac() < 0.5) img.setFlipX(true);
            if (img && !front) img.setTint(0xd8eef2);
        }
        if (i > 0 && rng.frac() < 0.55) {
            const x = rng.between(x0 + 200, x1 - 200);
            const sc = rng.realInRange(0.45, 0.8);
            const rock = plant('rock_1', x, sc, -1, 30);
            if (rock) {
                const r = rock.displayWidth * 0.36;
                chunk.bodies.push(s.matter.add.circle(x, this.groundY(x) + 30 - rock.displayHeight * 0.45, r, { isStatic: true }));
            }
        }

        // --- Coins: arcs through open water --------------------------------
        if (i > 0) {
            for (let arcs = rng.between(1, 2); arcs > 0; arcs--) {
                const n = rng.between(5, 8);
                const ax = rng.between(x0 + 80, x1 - 80 - n * 95);
                const base = rng.between(260, this.H - 520);
                const amp = rng.between(60, 170) * rng.sign();
                for (let k = 0; k < n; k++) {
                    const x = ax + k * 95;
                    const y = Math.min(base + Math.sin((k / (n - 1)) * Math.PI) * amp, this.groundY(x) - 110);
                    this.addCoin(chunk, x, y);
                }
            }
        }

        // --- Hazards --------------------------------------------------------
        if (i > 1) {
            if (rng.frac() < 0.35 + difficulty * 0.45) {
                const x = rng.between(x0 + 120, x1 - 120);
                this.addHazard(chunk, 'urchin', x, this.groundY(x) - 38, 130, 54);
            }
            for (let m = rng.frac() < 0.3 + difficulty * 0.5 ? (difficulty > 0.6 ? 2 : 1) : 0; m > 0; m--) {
                const x = rng.between(x0 + 150, x1 - 150);
                const y = rng.between(240, Math.max(260, this.groundY(x) - 330));
                const chain = keep(s.add.graphics().setDepth(-1));
                chain.lineStyle(7, 0x33414a, 0.85).lineBetween(x, y, x, this.groundY(x) + 20);
                this.addHazard(chunk, 'mine', x, y, 150, 62, true);
            }
        }
    }

    addCoin(chunk, x, y) {
        const s = this.scene;
        const img = s.textures.exists('coin')
            ? s.add.image(x, y, 'coin').setDisplaySize(72, 72)
            : s.add.circle(x, y, 32, 0xffd23f).setStrokeStyle(5, 0xfff3b0);
        img.setDepth(2);
        s.tweens.add({ targets: img, y: y - 14, duration: 1100 + (x % 400), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        chunk.objects.push(img);
        this.coins.push({ img, r: 40 });
    }

    addHazard(chunk, key, x, y, size, r, bob = false) {
        const s = this.scene;
        const img = s.textures.exists(key)
            ? s.add.image(x, y, key).setDisplaySize(size, size * 0.95)
            : s.add.star(x, y, 12, r * 0.6, r, key === 'mine' ? 0x33414a : 0x6a2d86);
        img.setDepth(3);
        if (bob) s.tweens.add({ targets: img, y: y - 18, angle: 6, duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        chunk.objects.push(img);
        this.hazards.push({ img, r });
    }

    drop(i) {
        const chunk = this.chunks.get(i);
        for (const b of chunk.bodies) this.scene.matter.world.remove(b);
        for (const o of chunk.objects) { this.scene.tweens.killTweensOf(o); o.destroy(); }
        this.chunks.delete(i);
        this.coins = this.coins.filter(c => c.img.active);
        this.hazards = this.hazards.filter(h => h.img.active);
    }
}
