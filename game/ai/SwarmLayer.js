import Phaser from 'phaser';
import { SWARM, createSwarm } from './boids.js';
import { mixColor } from '../level/biomes.js';
import { CARDS, makeSpine, spineTable, spineAt } from '../rig/cards.js';

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
    juvenile:   { count: 45, size: 18, body: 0xffd84a, belly: 0xfff3b0, accent: 0x2f5d8a, speed: 60, flock: { separationR: 22, neighbourR: 70, weights: { cohesion: 0.4 } }, biomes: ['beach'] },   // young yellow reef fish growing up in the lagoon
    silverside: { count: 150, size: 20, body: 0x8fb0c4, belly: 0xeaf4fa, accent: 0xdff2ff, speed: 105, stripe: true, biomes: ['blue', 'kelp', 'harbour', 'wreck'] },
    lantern:    { count: 60, size: 18, body: 0x1d2b4a, belly: 0x2c4166, accent: 0x7fe9ff, speed: 75, glow: true, biomes: ['trench'] }
};
/** How many swarms around the camera, spawn and drop distances (px). */
export const SWARMS = { perView: 2,
    // A new shoal starts outside the picture, beyond `farPad` past the camera's view, and swims in already formed (playtest:
    // "start sim in a buffer zone outside view"); `spread`: px further out it may start; `warmS`: s a shoal set right by the view is pre-swum.
    spread: 300, warmS: 1.2, dropAt: 2800, checkMs: 900, depth: 3.6,
    haze: 0.6,    // how far the farthest fish of a shoal blends into the water colour
    fade: 0.3,    // and how much it fades
    deepCount: 80,    // shoals of this many fish or more get the full depth; smaller ones less
    farPad: 450,      // px beyond the camera's view from which a shoal counts as out of sight ...
    farEvery: 3,      // ... and is then simulated only every so many frames (with the time that passed), its pictures left alone
    simEvery: 2,      // a fish of a shoal in sight decides every so many frames times boids' thinkEvery (the fish take turns); it moves every frame
    midEvery: 3,      // ... every so many when its middle is further than `mid` px from the view's middle (still in sight, but not where the child looks)
    mid: 620,
    minCount: 10,     // a shoal has at least this many fish, whatever the quality tier's share
    maxStep: 0.1 };   // s: the longest time one simulation step covers (three frames at 30 a second)

/** Texture size of one frame (px) for a species. */
const frameSize = sp => ({ w: Math.ceil(sp.size * 1.6), h: Math.ceil(sp.size * (sp.tall ? 1.25 : 0.8)) });
/** Frames: the tail beats (left, mid, right). A fish keeps its colours whatever it does (playtest: shoals must not change colour when they turn or flee). */
const TAIL = [-1, 0, 1];

/** Painted art (optional): `public/img/school/<id>.webp`, loaded as `school_<id>`. */
export const schoolArt = id => ({ key: `school_${id}`, file: `img/school/${id}.webp` });

/**
 * Frames from a painted side view (facing right, tail at the left), drawn in thin vertical
 * strips posed by the spine wave the rigs use (CARDS.spine): the rear swings along the body
 * (seen a little from behind) with a small up-and-down S on top. The picture fills `fill` of
 * the frame, so the swing stays inside it.
 */
const STRIP_POSE = { fill: 0.88, lift: 0.07 };
function paintedFrames(c, img, w, h) {
    const strips = 16, sw = img.width / strips, sp = CARDS.spine, T = makeSpine(), o = {}, k0 = 2 * Math.PI / sp.wave;
    const pw = w * STRIP_POSE.fill, left = w - pw;
    TAIL.forEach((beat, f) => {
        spineTable(k0 + beat * Math.PI / 2, 1, sp, T);               // beat 0: the tail passes the middle; -1 / 1: at either side
        const ox = f * w;
        for (let k = 0; k < strips; k++) {
            const s = 1 - (k + 0.5) / strips;                          // 0 at the head .. 1 at the tail
            spineAt(T, s, o);
            const dx = (o.dx + o.z * sp.tilt) * pw, dy = beat * s * s * h * STRIP_POSE.lift;
            c.drawImage(img, k * sw, 0, sw + 0.5, img.height, ox + left * 0.6 + k * pw / strips + dx, dy, pw / strips + 0.6, h);
        }
    });
}

/** The frames of one species (tail beats 0..2), painted or drawn; baked once as swarm_<id>. Returns the texture key. */
export function fishTexture(scene, id, sp) {
    const key = `swarm_${id}`;
    if (scene.textures.exists(key)) return key;
    const { w, h } = frameSize(sp);
    const tex = scene.textures.createCanvas(key, w * TAIL.length, h);
    const c = tex.getContext();
    const art = schoolArt(sp.art || id).key;      // `art`: another species' painting at this size
    if (scene.textures.exists(art)) {
        paintedFrames(c, scene.textures.get(art).getSourceImage(), w, h);
        TAIL.forEach((_, f) => tex.add(f, 0, f * w, 0, w, h));
        tex.refresh();
        return key;
    }
    TAIL.forEach((beat, f) => {
        const ox = f * w, cx = ox + w * 0.56, cy = h / 2;
        const rx = w * (sp.tall ? 0.3 : 0.36), ry = h * (sp.tall ? 0.4 : 0.34);
        const hex = n => `#${n.toString(16).padStart(6, '0')}`;
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
        this.share = 1;      // share of each new shoal's fish (quality tier)
        this.scene = scene;
        this.env = env;
        this.swarms = [];
        this.checkAt = 0;
    }

    /** The camera's view: its middle and half size (px), the one measure of what is in the picture. */
    view() {
        const v = this.scene.cameras.main.worldView, o = this.viewBox || (this.viewBox = {});
        o.cx = v.centerX; o.cy = v.centerY; o.hw = v.width / 2; o.hh = v.height / 2;
        return o;
    }

    /** Whether any fish of shoal `s` may be within `pad` px of the view. */
    inSight(s, v, pad) {
        const c = s.sim.centre();
        return Math.abs(c.x - v.cx) - c.rx < v.hw + pad && Math.abs(c.y - v.cy) - c.ry < v.hh + pad;
    }

    /** A place for a new shoal just beyond the out-of-sight ring, on side `dir` (+1 east, -1 west) of the view, or null. */
    startPlace(v, dir) {
        for (let tries = 0; tries < 10; tries++) {
            const x = v.cx + dir * (v.hw + SWARMS.farPad + 150 + Math.random() * SWARMS.spread), y = v.cy + (Math.random() - 0.5) * v.hh * 1.6;
            if (y > 150 && this.env.isOpen(x, y) && this.env.isOpen(x + 120, y) && this.env.isOpen(x - 120, y)) return { x, y };
        }
        return null;
    }

    spawn(id, x, y, home = null) {
        const sp = SPECIES[id];
        const count = Math.max(SWARMS.minCount, Math.round(sp.count * this.share));      // the quality tier's share of the shoal
        const sim = createSwarm({ count, x, y, speed: sp.speed, maxSpeed: sp.speed * 3, ...sp.flock });
        const key = fishTexture(this.scene, id, sp);
        const blitter = this.scene.add.blitter(0, 0, key).setDepth(SWARMS.depth);
        if (sp.glow) blitter.setBlendMode(Phaser.BlendModes.ADD);
        const bobs = blitter.createMultiple(count, 0, true);
        const { w, h } = frameSize(sp);
        // Per fish: a tail-beat phase and a slow sway, so a shoal never reads as a grid.
        const phase = Float32Array.from({ length: count }, () => Math.random() * Math.PI * 2);
        // Depth inside the shoal (fake 3D, spec 10.10b): bobs draw in index order, so
        // the first are the farthest; they take on the water colour and fade a little.
        const water = sp.glow ? 0x000000 : this.env.waterAt(x);
        const deep = Math.min(1, count / SWARMS.deepCount);   // a handful of fish has little depth
        bobs.forEach((b, i) => {
            const z = (1 - (i + 0.5) / count) * deep;
            b.setTint(mixColor(0xffffff, water, z * SWARMS.haze)).setAlpha(1 - z * SWARMS.fade);
        });
        const sw = { id, sim, blitter, bobs, w, h, phase, home, turnN: this.swarms.length, born: this.scene.game.loop.frame };      // turnN: shoals take turns at simulating
        this.swarms.push(sw);
        return sw;
    }

    /**
     * The fish has just been put somewhere (back at a nest): one shoal of that place is set inside
     * the view near its edge, so the water is not empty and the shoal swims into the picture.
     */
    arrive(cx, cy) {
        const native = Object.keys(SPECIES).filter(id => SPECIES[id].biomes.includes(this.env.biomeAt(cx))), v = this.view();
        // Not when a shoal is in view already, and never more than the usual number plus one: coming back to the same nest again and again must not pile them up.
        if (!native.length || this.swarms.some(s => this.inSight(s, v, 0)) || this.swarms.filter(s => !s.home).length > SWARMS.perView) return;
        // Just beyond the view's edge (it swims in at once), and already swum for a moment, so it comes in as a shoal and not as a heap.
        for (let tries = 0; tries < 12; tries++) {
            const dir = tries % 2 ? -1 : 1, x = v.cx + dir * (v.hw + 200), y = v.cy + (Math.random() - 0.5) * v.hh * 1.2;
            if (y > 150 && this.env.isOpen(x, y) && this.env.isOpen(x + 120, y) && this.env.isOpen(x - 120, y)) {
                const sw = this.spawn(native[Math.floor(Math.random() * native.length)], x, y);
                for (let t = 0; t < SWARMS.warmS; t += SWARMS.maxStep) sw.sim.step(SWARMS.maxStep, { isOpen: this.env.isOpen, flowAt: this.env.flowAt });
                return;
            }
        }
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
        const native = Object.keys(SPECIES).filter(id => SPECIES[id].biomes.includes(biome)), v = this.view();
        // One shoal should be in view most of the time: when none is, one more starts just beyond the view ahead of the fish, so it swims into it.
        const seen = this.swarms.some(s => this.inSight(s, v, 0));
        const roaming = this.swarms.filter(s => !s.home).length;
        if (!native.length || roaming >= SWARMS.perView + (seen ? 0 : 1)) return;
        // Prefer a species not already around: variety over repeats.
        const fresh = native.filter(id => !this.swarms.some(s => s.id === id));
        const kinds = fresh.length ? fresh : native;
        const at = this.startPlace(v, seen ? (Math.random() < 0.5 ? -1 : 1) : (this.heading || 1));
        if (at) this.spawn(kinds[Math.floor(Math.random() * kinds.length)], at.x, at.y);
    }

    /** dt in s; players: [{x, y, vx, vy, fright?}] in px/s (the local fish and, in a room, its friends). */
    update(dt, cx, cy, players) {
        this.checkAt -= dt * 1000;
        if (this.checkAt <= 0) { this.checkAt = SWARMS.checkMs; this.manage(cx, cy); }
        if (players?.[0] && Math.abs(players[0].vx) > 40) this.heading = Math.sign(players[0].vx);      // which way the fish travels
        const env = { isOpen: this.env.isOpen, flowAt: this.env.flowAt, players }, v = this.view();
        this.time = (this.time || 0) + dt;
        for (const s of this.swarms) {
            // A shoal out of sight costs a third: it swims on in bigger steps and nothing is drawn of it.
            // (Out of sight = all of it, by the camera's view: a wide shoal with fish in the picture never stands still.)
            const c = s.sim.centre(), far = !this.inSight(s, v, SWARMS.farPad);
            s.owed = (s.owed || 0) + dt;
            s.turnN = (s.turnN || 0) + 1;
            if (far && s.turnN % SWARMS.farEvery) continue;
            // In sight every fish moves every frame (playtest: "move smoothly, every frame; just recalculate direction throttled"):
            // only its deciding is spread out, more thinly away from the middle of the view. Out of sight the whole shoal skips frames.
            const every = Math.hypot(c.x - cx, c.y - cy) > SWARMS.mid ? SWARMS.midEvery : SWARMS.simEvery;
            s.sim.step(Math.min(s.owed, SWARMS.maxStep), env, far ? undefined : every * SWARM.thinkEvery);
            s.owed = 0;
            if (far) continue;
            const { x, y, vx, vy } = s.sim;
            for (let i = 0; i < s.bobs.length; i++) {
                const b = s.bobs[i], ph = s.phase[i];
                // Tail beats faster the faster the fish swims.
                const beat = Math.sin(ph + this.time * (6 + Math.hypot(vx[i], vy[i]) * 0.06));
                b.x = x[i] - s.w / 2;
                b.y = y[i] - s.h / 2 + Math.sin(ph * 1.7 + this.time * 1.3) * s.h * 0.12;
                b.flipX = vx[i] < 0;
                b.setFrame(beat < -0.33 ? 0 : beat > 0.33 ? 2 : 1);
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
