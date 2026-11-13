import Phaser from 'phaser';
import { createSwarm } from './boids.js';

// Swarms and shoals of small fish (spec gamedesign §6.2, §6.2b): the boids
// simulation (boids.js) drawn with one Blitter per swarm, so a swarm of a hundred
// fish is one draw call and no game objects per fish. Swarms live only around the
// camera (spec 5.0b): they are spawned just out of view in the current biome and
// dropped when far away. Fish are drawn procedurally (no art files needed).

/** Species: look, size (px), how many, how fast, where they live (biome ids). */
export const SPECIES = {
    anthias:    { count: 110, size: 26, body: 0xff8a5c, belly: 0xffc6ad, accent: 0xb36cff, speed: 85, biomes: ['reef', 'beach'] },
    tang:       { count: 14, size: 40, body: 0xffd23f, belly: 0xfff0a0, accent: 0xffffff, speed: 55, neighbourR: 120, separationR: 46, biomes: ['reef', 'kelp', 'mangrove'] },
    fry:        { count: 70, size: 14, body: 0xbfe3f0, belly: 0xffffff, accent: 0x9bd0e6, speed: 70, separationR: 16, neighbourR: 50, biomes: ['mangrove', 'beach'] },
    silverside: { count: 150, size: 20, body: 0x8fb0c4, belly: 0xeaf4fa, accent: 0x5f86a0, speed: 105, biomes: ['blue', 'kelp', 'harbour', 'wreck'] },
    lantern:    { count: 60, size: 18, body: 0x1d2b4a, belly: 0x2c4166, accent: 0x7fe9ff, speed: 75, glow: true, biomes: ['trench'] }
};
/** How many swarms around the camera, spawn and drop distances (px). */
export const SWARMS = { perView: 2, spawnMin: 700, spawnMax: 1300, dropAt: 2800, checkMs: 900, depth: 3.6 };

function fishTexture(scene, id, sp) {
    const key = `swarm_${id}`;
    if (scene.textures.exists(key)) return key;
    const w = Math.ceil(sp.size * 1.6), h = Math.ceil(sp.size * 0.8);
    const tex = scene.textures.createCanvas(key, w * 2, h);
    const c = tex.getContext();
    // Frame 0 = normal, frame 1 = the silver flash of a turning flank.
    [0, 1].forEach(f => {
        const ox = f * w, cx = ox + w * 0.55, cy = h / 2, rx = w * 0.36, ry = h * 0.36;
        const col = n => `#${(f ? lighten(n) : n).toString(16).padStart(6, '0')}`;
        c.fillStyle = col(sp.body);
        c.beginPath(); c.moveTo(ox + w * 0.18, cy); c.lineTo(ox + 2, cy - ry * 0.9); c.lineTo(ox + 2, cy + ry * 0.9); c.closePath(); c.fill();   // tail
        c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = col(sp.belly);
        c.beginPath(); c.ellipse(cx + rx * 0.1, cy + ry * 0.35, rx * 0.8, ry * 0.45, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = col(sp.accent);
        if (sp.glow) { for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(cx - rx * 0.6 + k * rx * 0.4, cy + ry * 0.55, Math.max(1, h * 0.06), 0, Math.PI * 2); c.fill(); } }
        else c.fillRect(cx - rx * 0.2, cy - ry * 0.9, Math.max(1, rx * 0.12), ry * 1.5);   // a body bar
        c.fillStyle = '#ffffff'; c.beginPath(); c.arc(cx + rx * 0.62, cy - ry * 0.15, Math.max(1.2, h * 0.11), 0, Math.PI * 2); c.fill();
        c.fillStyle = '#10243a'; c.beginPath(); c.arc(cx + rx * 0.66, cy - ry * 0.15, Math.max(0.8, h * 0.06), 0, Math.PI * 2); c.fill();
        tex.add(f, 0, ox, 0, w, h);
    });
    tex.refresh();
    return key;
}
function lighten(c) {
    const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255, k = 0.6;
    return (Math.round(r + (235 - r) * k) << 16) | (Math.round(g + (240 - g) * k) << 8) | Math.round(b + (245 - b) * k);
}

export default class SwarmLayer {
    /** @param env { isOpen(x, y), flowAt(x, y, out) px/s, biomeAt(x) -> id } */
    constructor(scene, env) {
        this.scene = scene;
        this.env = env;
        this.swarms = [];
        this.checkAt = 0;
    }

    spawn(id, x, y) {
        const sp = SPECIES[id];
        const sim = createSwarm({ count: sp.count, x, y, speed: sp.speed, maxSpeed: sp.speed * 3,
            ...(sp.neighbourR ? { neighbourR: sp.neighbourR } : {}), ...(sp.separationR ? { separationR: sp.separationR } : {}) });
        const key = fishTexture(this.scene, id, sp);
        const blitter = this.scene.add.blitter(0, 0, key).setDepth(SWARMS.depth);
        if (sp.glow) blitter.setBlendMode(Phaser.BlendModes.ADD);
        const bobs = blitter.createMultiple(sp.count, 0, true);
        const w = Math.ceil(sp.size * 1.6), h = Math.ceil(sp.size * 0.8);
        this.swarms.push({ id, sim, blitter, bobs, w, h });
    }

    /** Keep a few swarms of the current biome around the view; drop far ones. */
    manage(cx, cy) {
        for (let i = this.swarms.length - 1; i >= 0; i--) {
            const s = this.swarms[i], c = s.sim.centre();
            if (Math.hypot(c.x - cx, c.y - cy) > SWARMS.dropAt) { s.blitter.destroy(); this.swarms.splice(i, 1); }
        }
        const biome = this.env.biomeAt(cx);
        const kinds = Object.keys(SPECIES).filter(id => SPECIES[id].biomes.includes(biome));
        if (!kinds.length || this.swarms.length >= SWARMS.perView) return;
        for (let tries = 0; tries < 10; tries++) {
            const a = Math.random() * Math.PI * 2, d = SWARMS.spawnMin + Math.random() * (SWARMS.spawnMax - SWARMS.spawnMin);
            const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.6;
            if (y > 150 && this.env.isOpen(x, y) && this.env.isOpen(x + 120, y) && this.env.isOpen(x - 120, y)) {
                this.spawn(kinds[Math.floor(Math.random() * kinds.length)], x, y);
                return;
            }
        }
    }

    /** dt in s; player {x, y, vx, vy} in px/s. */
    update(dt, cx, cy, player) {
        this.checkAt -= dt * 1000;
        if (this.checkAt <= 0) { this.checkAt = SWARMS.checkMs; this.manage(cx, cy); }
        const env = { isOpen: this.env.isOpen, flowAt: this.env.flowAt, player };
        for (const s of this.swarms) {
            s.sim.step(Math.min(dt, 0.05), env);
            const { x, y, vx, panic, turn } = s.sim;
            for (let i = 0; i < s.bobs.length; i++) {
                const b = s.bobs[i];
                b.x = x[i] - s.w / 2;
                b.y = y[i] - s.h / 2;
                b.flipX = vx[i] < 0;
                b.setFrame(turn[i] > 0.6 || panic[i] > 0.5 ? 1 : 0);   // silver flash when wheeling or startled
            }
        }
    }

    startle(x, y) { for (const s of this.swarms) s.sim.startle(x, y); }

    /** For the reef book and other systems: which species swim near (x, y). */
    near(x, y, r) {
        const out = [];
        for (const s of this.swarms) { const c = s.sim.centre(); if (Math.hypot(c.x - x, c.y - y) < r) out.push(s.id); }
        return out;
    }

    destroy() { for (const s of this.swarms) s.blitter.destroy(); this.swarms = []; }
}
