import Phaser from 'phaser';
import { createSwarm } from './boids.js';
import { mixColor } from '../level/biomes.js';

// Swarms and shoals of small fish (spec gamedesign §6.2, §6.2b): the boids
// simulation (boids.js) drawn with one Blitter per swarm, so a swarm of a hundred
// fish is one draw call and no game objects per fish. Swarms live only around the
// camera (spec 5.0b): they are spawned just out of view in the current biome and
// dropped when far away. Fish are drawn procedurally (no art files needed).

/** Species: look, size (px), how many, how fast, flock overrides (boids.js SWARM), where they live (biome ids). */
export const SPECIES = {
    anthias:    { count: 110, size: 26, body: 0xff8a5c, belly: 0xffc6ad, accent: 0xb36cff, speed: 85, flock: { separationR: 38, neighbourR: 95, weights: { cohesion: 0.35 } }, biomes: ['reef', 'beach'] },
    tang:       { count: 14, size: 40, body: 0xffd23f, belly: 0xfff0a0, accent: 0xffffff, speed: 55, tall: true, flock: { neighbourR: 140, separationR: 60, weights: { cohesion: 0.4 } }, biomes: ['reef', 'kelp', 'mangrove'] },
    fry:        { count: 70, size: 14, body: 0xbfe3f0, belly: 0xffffff, accent: 0x9bd0e6, speed: 70, stripe: true, flock: { separationR: 16, neighbourR: 50 }, biomes: ['mangrove', 'beach'] },
    silverside: { count: 150, size: 20, body: 0x8fb0c4, belly: 0xeaf4fa, accent: 0xdff2ff, speed: 105, stripe: true, biomes: ['blue', 'kelp', 'harbour', 'wreck'] },
    lantern:    { count: 60, size: 18, body: 0x1d2b4a, belly: 0x2c4166, accent: 0x7fe9ff, speed: 75, glow: true, biomes: ['trench'] }
};
/** How many swarms around the camera, spawn and drop distances (px). */
export const SWARMS = { perView: 2, spawnMin: 700, spawnMax: 1300, dropAt: 2800, checkMs: 900, depth: 3.6,
    haze: 0.6,    // how far the farthest fish of a shoal blends into the water colour
    fade: 0.3,    // and how much it fades
    deepCount: 80 };  // shoals of this many fish or more get the full depth; smaller ones less

/** Texture size of one frame (px) for a species. */
const frameSize = sp => ({ w: Math.ceil(sp.size * 1.6), h: Math.ceil(sp.size * (sp.tall ? 1.25 : 0.8)) });
/** Frames: TAIL tail beats (left, mid, right) and FLASH, the bright flank of a turning fish. */
const TAIL = [-1, 0, 1], FLASH = TAIL.length;

/** Painted art (optional): `public/img/school/<id>.webp`, loaded as `school_<id>`. */
export const schoolArt = id => ({ key: `school_${id}`, file: `img/school/${id}.webp` });

/**
 * Frames from a painted side view (facing right, tail at the left): the back third is
 * bent up and down in thin vertical strips for the tail beat; the flash frame is the
 * same image washed toward silver.
 */
function paintedFrames(c, img, w, h) {
    const strips = 12, sw = img.width / strips;
    [...TAIL, 0].forEach((beat, f) => {
        const ox = f * w;
        for (let k = 0; k < strips; k++) {
            const tail = Math.max(0, 1 - k / (strips * 0.4));          // 1 at the tail tip, 0 from 40 % on
            const dy = beat * tail * tail * h * 0.14;
            c.drawImage(img, k * sw, 0, sw + 0.5, img.height, ox + k * w / strips, dy, w / strips + 0.5, h);
        }
        if (f === FLASH) {
            c.save(); c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(235,240,245,0.5)';
            c.fillRect(ox, 0, w, h); c.restore();
        }
    });
}

function fishTexture(scene, id, sp) {
    const key = `swarm_${id}`;
    if (scene.textures.exists(key)) return key;
    const { w, h } = frameSize(sp);
    const tex = scene.textures.createCanvas(key, w * (TAIL.length + 1), h);
    const c = tex.getContext();
    const art = schoolArt(id).key;
    if (scene.textures.exists(art)) {
        paintedFrames(c, scene.textures.get(art).getSourceImage(), w, h);
        [...TAIL, 0].forEach((_, f) => tex.add(f, 0, f * w, 0, w, h));
        tex.refresh();
        return key;
    }
    [...TAIL, 0].forEach((beat, f) => {
        const flash = f === FLASH, ox = f * w, cx = ox + w * 0.56, cy = h / 2;
        const rx = w * (sp.tall ? 0.3 : 0.36), ry = h * (sp.tall ? 0.4 : 0.34);
        const hex = n => `#${(flash ? lighten(n) : n).toString(16).padStart(6, '0')}`;
        // Tail and fins first, a shade darker, so the body overlaps them.
        c.fillStyle = hex(shade(sp.body, 0.75));
        const tx = cx - rx * 0.92, tail = ry * (sp.tall ? 0.75 : 0.9), sway = beat * ry * 0.35;
        c.beginPath(); c.moveTo(tx + rx * 0.15, cy); c.lineTo(ox + 1, cy - tail + sway); c.quadraticCurveTo(ox + w * 0.08, cy + sway, ox + 1, cy + tail + sway); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(cx - rx * 0.6, cy - ry * 0.7); c.quadraticCurveTo(cx - rx * 0.1, cy - ry * (sp.tall ? 1.35 : 1.15), cx + rx * 0.35, cy - ry * 0.85); c.closePath(); c.fill();   // dorsal
        if (sp.tall) { c.beginPath(); c.moveTo(cx - rx * 0.6, cy + ry * 0.7); c.quadraticCurveTo(cx - rx * 0.1, cy + ry * 1.3, cx + rx * 0.25, cy + ry * 0.85); c.closePath(); c.fill(); }   // anal fin
        // Body: lit from above, darker back, pale belly (reads round, not a flat sticker).
        const g = c.createLinearGradient(0, cy - ry, 0, cy + ry);
        g.addColorStop(0, hex(shade(sp.body, 0.7))); g.addColorStop(0.45, hex(sp.body)); g.addColorStop(1, hex(sp.belly));
        c.fillStyle = g;
        c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = hex(sp.accent);
        if (sp.glow) { for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(cx - rx * 0.6 + k * rx * 0.4, cy + ry * 0.55, Math.max(1, h * 0.06), 0, Math.PI * 2); c.fill(); } }
        else if (sp.stripe) { c.globalAlpha = 0.85; c.fillRect(cx - rx * 0.8, cy - ry * 0.12, rx * 1.6, Math.max(1, ry * 0.22)); c.globalAlpha = 1; }   // a silver side line
        else if (!sp.tall) { c.globalAlpha = 0.7; c.fillRect(cx - rx * 0.15, cy - ry * 0.9, Math.max(1, rx * 0.12), ry * 1.6); c.globalAlpha = 1; }   // a body bar
        // Tang: the white spine at the tail root.
        if (sp.tall) { c.fillStyle = '#ffffff'; c.fillRect(cx - rx * 0.95, cy - 1, Math.max(2, rx * 0.18), 2); }
        c.fillStyle = 'rgba(255,255,255,0.35)';
        c.beginPath(); c.ellipse(cx + rx * 0.1, cy - ry * 0.5, rx * 0.55, ry * 0.18, 0, 0, Math.PI * 2); c.fill();   // sheen
        c.fillStyle = '#ffffff'; c.beginPath(); c.arc(cx + rx * 0.62, cy - ry * 0.18, Math.max(1.2, h * 0.09), 0, Math.PI * 2); c.fill();
        c.fillStyle = '#10243a'; c.beginPath(); c.arc(cx + rx * 0.66, cy - ry * 0.18, Math.max(0.8, h * 0.055), 0, Math.PI * 2); c.fill();
        tex.add(f, 0, ox, 0, w, h);
    });
    tex.refresh();
    return key;
}
function lighten(c) { return mix(c, 0xebf0f5, 0.6); }
function shade(c, k) { return mix(c, 0x0a1a30, 1 - k); }
function mix(a, b, k) {
    const ch = (s) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * k);
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

export default class SwarmLayer {
    /**
     * @param env { isOpen(x, y), flowAt(x, y, out) px/s, biomeAt(x) -> id, waterAt(x) -> water colour,
     *   homes: [{ x, y, id }] (optional): places that always have a shoal of that species around them,
     *   like the one sheltering in the ghost ship (spec 5.0e); they come on top of the roaming ones }
     */
    constructor(scene, env) {
        this.scene = scene;
        this.env = env;
        this.swarms = [];
        this.checkAt = 0;
    }

    spawn(id, x, y, home = null) {
        const sp = SPECIES[id];
        const sim = createSwarm({ count: sp.count, x, y, speed: sp.speed, maxSpeed: sp.speed * 3, ...sp.flock });
        const key = fishTexture(this.scene, id, sp);
        const blitter = this.scene.add.blitter(0, 0, key).setDepth(SWARMS.depth);
        if (sp.glow) blitter.setBlendMode(Phaser.BlendModes.ADD);
        const bobs = blitter.createMultiple(sp.count, 0, true);
        const { w, h } = frameSize(sp);
        // Per fish: a tail-beat phase and a slow sway, so a shoal never reads as a grid.
        const phase = Float32Array.from({ length: sp.count }, () => Math.random() * Math.PI * 2);
        // Depth inside the shoal (fake 3D, spec 10.10b): bobs draw in index order, so
        // the first are the farthest; they take on the water colour and fade a little.
        const water = sp.glow ? 0x000000 : this.env.waterAt(x);
        const deep = Math.min(1, sp.count / SWARMS.deepCount);   // a handful of fish has little depth
        bobs.forEach((b, i) => {
            const z = (1 - (i + 0.5) / sp.count) * deep;
            b.setTint(mixColor(0xffffff, water, z * SWARMS.haze)).setAlpha(1 - z * SWARMS.fade);
        });
        this.swarms.push({ id, sim, blitter, bobs, w, h, phase, home });
    }

    /** Keep a few swarms of the current biome around the view; drop far ones. */
    manage(cx, cy) {
        for (let i = this.swarms.length - 1; i >= 0; i--) {
            const s = this.swarms[i], c = s.sim.centre();
            if (Math.hypot(c.x - cx, c.y - cy) > SWARMS.dropAt) { s.blitter.destroy(); this.swarms.splice(i, 1); }
        }
        for (const home of this.env.homes || []) {
            if (Math.hypot(home.x - cx, home.y - cy) < SWARMS.dropAt * 0.8 && !this.swarms.some(s => s.home === home)) this.spawn(home.id, home.x, home.y, home);
        }
        const biome = this.env.biomeAt(cx);
        const native = Object.keys(SPECIES).filter(id => SPECIES[id].biomes.includes(biome));
        if (!native.length || this.swarms.filter(s => !s.home).length >= SWARMS.perView) return;
        // Prefer a species not already around: variety over repeats.
        const fresh = native.filter(id => !this.swarms.some(s => s.id === id));
        const kinds = fresh.length ? fresh : native;
        for (let tries = 0; tries < 10; tries++) {
            const a = Math.random() * Math.PI * 2, d = SWARMS.spawnMin + Math.random() * (SWARMS.spawnMax - SWARMS.spawnMin);
            const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.6;
            if (y > 150 && this.env.isOpen(x, y) && this.env.isOpen(x + 120, y) && this.env.isOpen(x - 120, y)) {
                this.spawn(kinds[Math.floor(Math.random() * kinds.length)], x, y);
                return;
            }
        }
    }

    /** dt in s; players: [{x, y, vx, vy, fright?}] in px/s (the local fish and, in a room, its friends). */
    update(dt, cx, cy, players) {
        this.checkAt -= dt * 1000;
        if (this.checkAt <= 0) { this.checkAt = SWARMS.checkMs; this.manage(cx, cy); }
        const env = { isOpen: this.env.isOpen, flowAt: this.env.flowAt, players };
        this.time = (this.time || 0) + dt;
        for (const s of this.swarms) {
            s.sim.step(Math.min(dt, 0.05), env);
            const { x, y, vx, vy, panic, turn } = s.sim;
            for (let i = 0; i < s.bobs.length; i++) {
                const b = s.bobs[i], ph = s.phase[i];
                // Tail beats faster the faster the fish swims.
                const beat = Math.sin(ph + this.time * (6 + Math.hypot(vx[i], vy[i]) * 0.06));
                b.x = x[i] - s.w / 2;
                b.y = y[i] - s.h / 2 + Math.sin(ph * 1.7 + this.time * 1.3) * s.h * 0.12;
                b.flipX = vx[i] < 0;
                b.setFrame(turn[i] > 0.6 || panic[i] > 0.5 ? FLASH : beat < -0.33 ? 0 : beat > 0.33 ? 2 : 1);   // flash when wheeling or startled
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
