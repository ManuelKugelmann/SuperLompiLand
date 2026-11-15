import { Gaze, EYES } from './eyes.js';
import { QUALITY } from '../quality.js';

const EYES_REST = EYES.restLid;

// Living eyes over the painted ones (user: "eye movement ... rigged characters"; "wire whole rigs"):
// per painted eye a white (covering the painted iris), an iris with its pupil that looks around
// (Gaze: fixations, saccades, blinks, pupil) and a lid that closes over it. Drawn procedurally once
// (three shared textures; iris and lid take the character's colours as tints), placed each frame
// by the rig at the eye's place on its posed body. A profile lists its eyes per look:
//   eyes: { iris: 0xRRGGBB, lid: 0xRRGGBB, at: [{ x, y, rx, ry }] }   (picture px: middle, half sizes)
//   bead: 0xRRGGBB instead of iris: a glossy dark bead eye (no white), as painted on the starfish and urchin
// Only eyes that face the viewer: one on the silhouette's edge stays painted.

export const RIG_EYES = {
    tex: 128,           // px of the shared eye textures
    cover: 1.04,        // the white is this much larger than the painted eye (hides its iris)
    iris: 0.62,         // iris radius, share of the smaller half size
    pupil: 0.52,        // pupil radius, share of the iris (Gaze scales it with light and fright)
    travel: 0.42,       // how far the iris moves at full gaze, share of the half size
    lids: 8,            // frames of the lid, open .. closed
    edgeOn: [0.25, 0.55],   // |cos yaw| from which the eyes appear (hidden edge-on in a turn)
    look: 0.35,         // gaze target scale: px off / eye radius px * this = eye radii (as the viewer)
    beadTravel: 0.12,   // a bead eye looks by shifting a little within its place
    beadShine: [0.42, 0.18]   // its two highlights, share of its radius
};

/** The shared eye textures (once): rig_eye_white, rig_eye_iris (grey: tinted), rig_eye_lid (frames 0..lids-1, white: tinted). */
function ensureTextures(scene, E = RIG_EYES) {
    const S = E.tex, h = S / 2;
    if (!scene.textures.exists('rig_eye_white')) {
        const t = scene.textures.createCanvas('rig_eye_white', S, S), c = t.getContext();
        const g = c.createRadialGradient(h * 0.85, h * 0.75, h * 0.1, h, h, h);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.75, '#f1f4f6'); g.addColorStop(1, '#c9d2da');
        c.fillStyle = g; c.beginPath(); c.ellipse(h, h, h - 1, h - 1, 0, 0, Math.PI * 2); c.fill();
        // The upper lid's shadow on the eyeball: it reads round, not a white disc.
        const s = c.createLinearGradient(0, 0, 0, S * 0.45);
        s.addColorStop(0, 'rgba(60,70,90,0.45)'); s.addColorStop(1, 'rgba(60,70,90,0)');
        c.globalCompositeOperation = 'source-atop'; c.fillStyle = s; c.fillRect(0, 0, S, S);
        t.refresh();
    }
    if (!scene.textures.exists('rig_eye_iris')) {
        const t = scene.textures.createCanvas('rig_eye_iris', S, S), c = t.getContext();
        const g = c.createRadialGradient(h, h, h * 0.2, h, h, h);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#d8d8d8'); g.addColorStop(0.93, '#8a8a8a'); g.addColorStop(1, '#3a3a3a');
        c.fillStyle = g; c.beginPath(); c.arc(h, h, h - 1, 0, Math.PI * 2); c.fill();
        for (let k = 0; k < 28; k++) {         // fine radial fibres
            const a = k / 28 * Math.PI * 2;
            c.strokeStyle = `rgba(255,255,255,${0.12 + (k % 3) * 0.06})`; c.lineWidth = 2;
            c.beginPath(); c.moveTo(h + Math.cos(a) * h * 0.55, h + Math.sin(a) * h * 0.55); c.lineTo(h + Math.cos(a) * h * 0.9, h + Math.sin(a) * h * 0.9); c.stroke();
        }
        t.refresh();
    }
    if (!scene.textures.exists('rig_eye_lid')) {
        const t = scene.textures.createCanvas('rig_eye_lid', S * E.lids, S), c = t.getContext();
        for (let f = 0; f < E.lids; f++) {
            const ox = f * S, close = f / (E.lids - 1);
            c.save(); c.beginPath(); c.ellipse(ox + h, h, h, h, 0, 0, Math.PI * 2); c.clip();
            // The upper lid comes down as a curved edge (with a soft darker rim) to `close`.
            const edge = -h * 0.15 + close * (S + h * 0.3);
            c.fillStyle = '#ffffff';
            c.beginPath(); c.moveTo(ox, 0); c.lineTo(ox + S, 0); c.lineTo(ox + S, edge - h * 0.25); c.quadraticCurveTo(ox + h, edge + h * 0.25, ox, edge - h * 0.25); c.closePath(); c.fill();
            c.strokeStyle = 'rgba(40,40,40,0.55)'; c.lineWidth = 5;
            c.beginPath(); c.moveTo(ox, edge - h * 0.25); c.quadraticCurveTo(ox + h, edge + h * 0.25, ox + S, edge - h * 0.25); c.stroke();
            c.restore();
            t.add(f, 0, ox, 0, S, S);
        }
        t.refresh();
    }
}

export default class RigEyes {
    /** @param spec  the look's `eyes` ({ iris | bead, lid, at }); @param seed  makes each character blink at its own times */
    constructor(scene, spec, seed = 1, E = RIG_EYES) {
        ensureTextures(scene, E);
        this.scene = scene;
        this.E = E;
        this.spec = spec;
        this.depth = 0;
        this.eyes = spec.at.map((at, i) => ({ at, gaze: new Gaze(seed * 13 + i * 7) }));
        this.parts = null;       // made while shown, given back when not (an eye far off or out of view costs nothing)
    }

    /** The eye pictures, made when the eyes are first shown again. */
    make() {
        const s = this.scene, spec = this.spec, bead = spec.bead !== undefined;
        for (const e of this.eyes) {
            e.white = s.add.image(0, 0, 'rig_eye_white');
            if (bead) e.white.setTint(spec.bead);
            else {
                e.iris = s.add.image(0, 0, 'rig_eye_iris').setTint(spec.iris);
                e.pupil = s.add.image(0, 0, 'rig_eye_white').setTint(0x05080c);
            }
            e.shine = s.add.image(0, 0, 'rig_eye_white');
            if (bead) e.shine2 = s.add.image(0, 0, 'rig_eye_white');
            e.lid = s.add.image(0, 0, 'rig_eye_lid', 0).setTint(spec.lid);
        }
        this.parts = this.eyes.flatMap(e => [e.white, e.iris, e.pupil, e.shine, e.shine2, e.lid].filter(Boolean));
        for (const p of this.parts) p.noCaustics = true;      // the body around them carries the net; on an eye it reads as a stain
        this.setDepth(this.depth);
    }

    setDepth(d) { this.depth = d; this.parts?.forEach((p, i) => p.setDepth(d + i * 0.00001)); return this; }

    /** The whole eye moved by (dx, dy) px as it is: a rig that is not posed this frame (CARDS.poseEvery) carries its eyes along. */
    shift(dx, dy) { if (this.parts) for (const p of this.parts) { p.x += dx; p.y += dy; } }

    /** Not shown: the pictures go (the gaze and blinking keep their state). */
    hide() {
        if (!this.parts) return;
        for (const p of this.parts) p.destroy();
        this.parts = null;
    }

    /**
     * Place and animate the eyes. `place(at, out)` writes where the eye's middle is on screen
     * (out.x, out.y) and its scale there (out.s); `view` = { rotation, facing, alpha, edge (|cos yaw|) },
     * `look` = the world point to look at (or null: straight ahead), `dt` seconds. The quality tier
     * decides how far from the view's middle eyes live (QUALITY eyes) and whether lids blink (lids).
     */
    update(place, view, look, dt, opts) {
        const E = this.E, show = smooth(E.edgeOn[0], E.edgeOn[1], view.edge) * view.alpha;
        const q = QUALITY[this.scene.quality?.tier ?? 'high'], mid = this.scene.cameras.main.midPoint;
        place(this.eyes[0].at, P);
        if (show <= 0.01 || Math.hypot(P.x - mid.x, P.y - mid.y) > q.eyes) { this.hide(); return; }
        if (!this.parts) this.make();
        const cr = Math.cos(view.rotation), sr = Math.sin(view.rotation), W = E.tex, bead = this.spec.bead !== undefined;
        for (const e of this.eyes) {
            place(e.at, P);
            const rx = e.at.rx * P.s * Math.max(view.edge, 0.3), ry = e.at.ry * P.s, r = Math.min(rx, ry);      // narrows with the body in a turn
            // Where to look, in eye radii in the eye's own frame (x toward the nose, y up).
            let tx = 1, ty = 0;
            if (look) {
                const dx = look.x - P.x, dy = look.y - P.y;
                const ax = dx * cr + dy * sr, ay = -dx * sr + dy * cr;      // into the body's frame
                tx = ax * view.facing / r * E.look; ty = -ay / r * E.look;
            }
            const g = e.gaze.update(dt, { x: tx, y: ty }, opts);
            // Lids blink; without them (lowest tier) the white squeezes shut instead.
            const shut = q.lids ? 1 : 1 - Math.max(0, (g.lid - EYES_REST) / (1 - EYES_REST));
            const cover = bead ? 1 : E.cover;
            const travel = bead ? E.beadTravel : E.travel;
            const ox = g.x * travel * rx * view.facing, oy = -g.y * travel * ry;
            const ex = bead ? P.x + ox * cr - oy * sr : P.x, ey = bead ? P.y + ox * sr + oy * cr : P.y;
            e.white.setPosition(ex, ey).setRotation(view.rotation).setScale(rx * 2 * cover / W, ry * 2 * cover * shut / W);
            if (bead) {
                // A bead eye: dark and glossy, it looks by shifting a little; two highlights.
                e.shine.setPosition(ex - r * 0.3 * view.facing, ey - r * 0.32).setScale(r * E.beadShine[0] * 2 * shut / W);
                e.shine2.setPosition(ex + r * 0.28 * view.facing, ey + r * 0.25).setScale(r * E.beadShine[1] * 2 * shut / W);
            } else {
                const ix = P.x + ox * cr - oy * sr, iy = P.y + ox * sr + oy * cr;
                const ir = r * E.iris, pr = ir * E.pupil * g.pupil * (this.spec.pupil ?? 1);
                e.iris.setPosition(ix, iy).setRotation(view.rotation).setScale(ir * 2 / W, ir * 2 * shut / W);
                e.pupil.setPosition(ix, iy).setScale(pr * 2 / W, pr * 2 * shut / W);
                e.shine.setPosition(ix - ir * 0.35 * view.facing, iy - ir * 0.4).setScale(ir * 0.55 * shut / W);
            }
            e.lid.setVisible(!!q.lids);
            if (q.lids) e.lid.setFrame(Math.round(g.lid * (E.lids - 1))).setPosition(P.x, P.y).setRotation(view.rotation).setScale(rx * 2 * E.cover / W, ry * 2 * E.cover / W);
        }
        for (const p of this.parts) p.setAlpha(show);
    }

    destroy() { this.hide(); }
}

const P = { x: 0, y: 0, s: 1 };
function smooth(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
