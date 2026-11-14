import { SHEEN, sheenFor, sheenTint } from './rig/sheen.js';
import Phaser from 'phaser';
import Rig from './Rig.js';
import { CARDS, makeCard, posedBuffers, poseBody, posePart, project, turnPose } from './rig/cards.js';

/** Where the part cards come from (scripts/parts/bake.py). */
export const PARTS = { json: 'parts', url: 'img/parts/', texture: key => `parts_${key}` };

/** Queue the part atlases once the part table has loaded (call in a scene's preload). */
export function loadParts(scene) {
    scene.load.once(`filecomplete-json-${PARTS.json}`, (key, type, data) => {
        for (const k of Object.keys(data || {})) scene.load.image(PARTS.texture(k), `${PARTS.url}${k}.webp`);
    });
    scene.load.json(PARTS.json, `${PARTS.url}rig.json`);
}

function partsFor(scene, key) {
    const r = scene.cache.json.get(PARTS.json)?.[key];
    return r && scene.textures.exists(PARTS.texture(key)) ? r : null;
}

/** A card rig where every look of the character has its part cards; otherwise the bendable picture (Rig). */
export function createRig(scene, character, x, y, depth) {
    const cards = Object.values(character.states).every(st => partsFor(scene, st.key));
    return cards ? new CardRig(scene, character, x, y, depth) : new Rig(scene, character, x, y, depth);
}

/** What callers read of a look: where it is, its alpha (tweened), its picture's size and key. */
class CardView {
    constructor(scene, key, size, baseScale) {
        this.x = 0; this.y = 0; this.alpha = 1;
        this.texture = scene.textures.get(scene.textures.exists(key) ? key : PARTS.texture(key));
        this.frame = { width: size[0], height: size[1] };
        this.baseScale = baseScale;
        this.grid = { halo: { fresh: false } };     // the bendable Rig's soft halo; cards need no reset
    }
    setAlpha(a) { this.alpha = a; return this; }
    get displayHeight() { return this.frame.height * this.baseScale; }
}

const BEND = { x: 0, y: 0 };

/**
 * A playable drawn as 2.5D part cards (game/rig/cards.js): the same API as Rig, so Player,
 * RemoteFish and the title carousel use either. The body bulges toward the viewer, fins
 * scull and undulate about their roots, the tail beats sideways, and a turn-around swings
 * the nose toward the viewer through the edge-on view instead of flipping the picture.
 */
export default class CardRig {
    constructor(scene, character, x, y, depth = 5) {
        this.clock = scene.time;     // the sheen drifts with game time
        this.char = character;
        this.facing = 1;
        this.angle = 0;
        this.phase = 0;
        this.spread = 0;
        this.zoom = 1;
        this.shown = true;
        this.turning = null;
        this.depth = depth;
        this.views = {};
        this.sets = {};
        for (const [name, st] of Object.entries(character.states)) this.sets[name] = this.buildSet(scene, st, x, y);
        this.state = 'normal';
        this.view = this.views.normal;
        this.setState('normal');
        this.setDepth(depth);
    }

    buildSet(scene, st, x, y) {
        const R = partsFor(scene, st.key), texKey = PARTS.texture(st.key), tex = scene.textures.get(texKey);
        const [W, H] = R.size, bulgePx = CARDS.bulge * W;
        const frame = (name, f) => tex.has(name) ? tex.get(name) : tex.add(name, 0, f[0], f[1], f[2], f[3]);
        const entries = [];
        const add = (card, fr, extra) => {
            const rope = scene.add.rope(x, y, texKey, fr.name, card.strip.length / 2, true).setVisible(false);
            rope.dirty = false;
            for (let s = 0; s < card.strip.length; s++) {
                rope.uv[s * 2] = fr.u0 + (fr.u1 - fr.u0) * card.u[card.strip[s]];
                rope.uv[s * 2 + 1] = fr.v0 + (fr.v1 - fr.v0) * card.v[card.strip[s]];
            }
            entries.push({ card, rope, posed: posedBuffers(card.n), bright: new Float32Array(card.strip.length), hue: new Float32Array(card.strip.length), ...extra });
        };
        const [bc, br] = CARDS.bodyGrid;
        add(makeCard({ rect: R.body.rect, pivot: [W / 2, H / 2], size: R.size, height: R.height, bulgePx, cols: bc, rows: br }),
            frame('body', R.body.frame), { body: true, order: 0 });
        R.parts.forEach((p, i) => {
            const [, , w, h] = p.rect, [a, b] = CARDS.partGrid, long = w >= h;
            const card = makeCard({ rect: p.rect, pivot: p.pivot, size: R.size, cols: long ? a : b, rows: long ? b : a });
            const part = { role: p.role, axis: hingeAxis(p), amp: p.amp ?? 1, phase: p.phase ?? 0, z: (p.z ?? 0) * bulgePx };
            const fr = frame(p.name || `p${i}`, p.frame);
            add(card, fr, { part, order: p.front ? 1 + i * 0.01 : -1 + (p.z ?? 0) * 0.1 + i * 0.001 });
            if (p.pair) {
                const t = CARDS.twin;
                const twin = { ...part, z: Math.abs(part.z) * -t.z, phase: part.phase + 0.08 };
                add(card, fr, { part: twin, mirror: true, shift: [t.shift[0] * W, t.shift[1] * H], dark: t.dark, order: -2 });
            }
        });
        entries.sort((a, b) => a.order - b.order);
        const view = new CardView(scene, st.key, R.size, st.width / W);
        view.wiggle = st.wiggle;
        this.views[Object.keys(this.char.states).find(k => this.char.states[k] === st)] = view;
        return { entries, size: R.size, view };
    }

    /** Switch the look (e.g. 'inflated'); unknown states fall back to 'normal'. */
    setState(name) {
        const old = this.view;
        this.state = this.sets[name] ? name : 'normal';
        this.view = this.views[this.state];
        if (old !== this.view) { this.view.x = old.x; this.view.y = old.y; this.view.alpha = old.alpha; }
        for (const [k, set] of Object.entries(this.sets)) for (const e of set.entries) e.rope.setVisible(this.shown && k === this.state && e.drawn);
        return this;
    }

    setVisible(on) {
        this.shown = on;
        for (const e of this.sets[this.state].entries) e.rope.setVisible(on && e.drawn);
        return this;
    }

    setAlpha(a) { this.view.setAlpha(a); return this; }

    setDepth(d) {
        this.depth = d;
        for (const set of Object.values(this.sets)) set.entries.forEach((e, i) => e.rope.setDepth(d + i * 0.001));
        return this;
    }

    /** Same parameters as Rig.draw (position, velocity, effort, squash, turn rate, facing, lean, beat). */
    draw({ x, y, vx = 0, vy = 0, frames = 1, effort = 0, squash = 0, turn = 0.2, facing, lean = 0, beat, spread = 0 }) {
        const view = this.view, set = this.sets[this.state], [W, H] = set.size;
        view.x = x; view.y = y;
        const speed = Math.hypot(vx, vy);
        const want = facing ?? (Math.abs(vx) > 0.8 ? (vx < 0 ? -1 : 1) : this.facing);
        // Turn-around: the nose swings toward the viewer, through edge-on, onto the other side.
        if (!this.turning && want !== this.facing) this.turning = { t: 0, from: this.facing };
        let yaw = 0;
        if (this.turning) {
            this.turning.t = Math.min(1, this.turning.t + frames * (1000 / 60) / CARDS.turnMs);
            const tp = turnPose(this.turning.t, this.turning.from);
            yaw = tp.yaw;
            if (tp.facing !== this.facing) { this.facing = tp.facing; this.angle = Phaser.Math.Angle.Wrap(Math.PI - this.angle); }
            if (this.turning.t >= 1) this.turning = null;
        }
        const flip = this.facing;
        const level = flip < 0 ? Math.PI : 0;
        const follow = this.char.upright ? 0 : Phaser.Math.Clamp((speed - 3) / 5, 0, 1) * (this.char.pitch ?? 1);
        const target = Phaser.Math.Angle.Wrap(level + Phaser.Math.Angle.Wrap(Math.atan2(vy, vx) - level) * follow);
        this.angle = Phaser.Math.Angle.RotateTo(this.angle, target, turn * frames);

        // How hard it really swims: eased in, so drifting and hovering stay calm.
        const raw = Phaser.Math.Clamp(Math.max(effort, speed / 14), 0, 1), drive = Math.pow(raw, CARDS.driveCurve);
        this.phase += (CARDS.cycle[0] + raw * (CARDS.cycle[1] - CARDS.cycle[0])) * frames;
        const ph = this.phase, sq = Phaser.Math.Clamp(squash, -0.35, 0.35), sc = view.baseScale * this.zoom;
        let sx = sc * (1 + sq), sy = sc * (1 - sq), rotation = Phaser.Math.Angle.Wrap(this.angle - level) + lean;
        // Idle rocking about the vertical axis keeps the volume visible, not only in turns.
        if (!this.turning) yaw = (CARDS.sway + CARDS.swayMore * drive) * Math.sin(ph * 0.31);

        // Body motion per style (the same styles as Rig): bend in picture px, plus pumping and rocking.
        const amp = view.wiggle * drive, style = this.char.anim || 'swim';
        let bend;
        if (style === 'pulse') {
            const push = beat ?? Math.sin(ph * 0.9), pump = 0.02 + drive * 0.07;
            sx *= 1 + push * pump; sy *= 1 - push * pump * 1.3;
            bend = (u, v, o) => { o.x = Math.sin(ph * 0.9 - v * 3.4) * 0.03 * W * v * v; o.y = 0; };
        } else if (style === 'sway') {
            const k = 0.02 + 0.03 * drive;
            bend = (u, v, o) => { o.x = Math.sin(ph * 0.7 - v * 2.2) * k * W * v; o.y = 0; };
        } else if (style === 'paddle') {
            const stroke = Math.sin(ph * 0.55);
            rotation += stroke * 0.04 * (0.1 + drive);
            sy *= 1 - stroke * 0.025 * (0.1 + drive);
            bend = (u, v, o) => { o.x = 0; o.y = 0; };
        } else {
            bend = (u, v, o) => { const t = 1 - u; o.x = 0; o.y = Math.sin(ph - t * 2.6) * amp * 0.35 * t * t; };
        }

        // Wings open in the air and fold back in the water, over a few frames (CARDS.spreadRate).
        this.spread += (spread - this.spread) * Math.min(1, CARDS.spreadRate * frames);
        const m = { phase: ph, drive, fold: 1 - this.spread };
        const pv = { yaw, facing: flip, rotation, sx, sy, x: 0, y: 0, dist: CARDS.persp * W, fade: false, dark: 1 };   // vertices are relative to the rope
        const at = [0, 0];
        for (const e of set.entries) {
            if (e.body) poseBody(e.card, bend, set.size, e.posed);
            else {
                const [px, py] = e.card.pivot;
                bend(px / W + 0.5, py / H + 0.5, BEND);
                at[0] = px + BEND.x + (e.shift?.[0] || 0); at[1] = py + BEND.y + (e.shift?.[1] || 0);
                posePart(e.card, e.part, m, at, !!e.mirror, e.posed);
            }
            pv.fade = !e.body; pv.dark = e.dark ?? 1;
            const r = e.rope;
            project(e.card, e.posed, pv, r.vertices, e.bright, r.alphas, e.hue);
            const k = sheenFor(e.body ? null : e.part?.role), drift = this.clock.now / 1000 * SHEEN.drift;
            for (let s = 0; s < e.bright.length; s++) r.colors[s] = sheenTint(e.bright[s], e.hue[s] + drift, k);
            r.setPosition(x, y).setAlpha(view.alpha);
            e.drawn = true;
            r.setVisible(this.shown);
        }
    }

    destroy() {
        for (const set of Object.values(this.sets)) for (const e of set.entries) e.rope.destroy();
    }
}

/** The hinge of a part: along its root line, or (a part without one) across the line from its pivot to its middle. */
function hingeAxis(p) {
    let ax, ay;
    if (p.root) { ax = p.root[1][0] - p.root[0][0]; ay = p.root[1][1] - p.root[0][1]; }
    else { const [x, y, w, h] = p.rect; ax = -(y + h / 2 - p.pivot[1]); ay = x + w / 2 - p.pivot[0]; }
    const L = Math.hypot(ax, ay) || 1;
    return [ax / L, ay / L];
}
