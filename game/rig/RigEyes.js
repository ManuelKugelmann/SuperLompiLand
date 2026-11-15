import { Gaze, EYES, eyeYaws, onBall } from './eyes.js';
import { QUALITY } from '../quality.js';

const EYES_REST = EYES.restLid;

// Living eyes for the hero creatures (user: "rim around eyes, eye shape, not goggly; cut out the eyes,
// render eyeballs behind the eye rims, only hero creatures"): the painted picture is cut open along
// each eye's own outline (rig/faces.js `hole`, rig/eyeHoles.js) and the eyeball is drawn BEHIND the
// picture, so the painted rim and lids frame it and give it its shape. Per eye: a white, an iris with
// its pupil that looks around (Gaze: fixations, saccades, blinks, pupil size) and a lid in the skin's
// colour that comes down from the rim to blink. Drawn from three shared procedural textures, placed
// each frame by the rig at the eye's place on its posed body.
//   eyes: { iris: 0xRRGGBB, lid: 0xRRGGBB, pupil, at: [{ x, y, rx, ry, hole }] }   (picture px)

export const RIG_EYES = {
    tex: 128,           // px of the shared eye textures
    cover: 1.25,        // the white and the lid reach this far past the hole (the picture hides the rest)
    iris: 0.66,         // iris radius, share of the smaller half size of the hole
    pupil: 0.52,        // pupil radius, share of the iris (Gaze scales it with light and fright)
    travel: 0.36,       // how far the iris moves at full gaze, share of the half size
    lids: 8,            // frames of the lid, open .. closed (and of the smiling lower lid)
    smile: 0.62,        // a beaming eye's lower lid rises this share of the eye (its arch higher still)
    squint: 0.3,        // ... and the upper lid comes down this far
    look: 0.35          // gaze target scale: px off / eye radius px * this = eye radii (as the viewer)
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
    if (!scene.textures.exists('rig_eye_smile')) {
        // The happy squint (rig/wave.js): the lower lid rises with an upward arch, so the open eye is a smiling arc.
        const t = scene.textures.createCanvas('rig_eye_smile', S * E.lids, S), c = t.getContext();
        for (let f = 0; f < E.lids; f++) {
            const ox = f * S, rise = f / (E.lids - 1), mid = S - rise * S * E.smile, side = mid + h * 0.55 * rise;
            c.save(); c.beginPath(); c.ellipse(ox + h, h, h, h, 0, 0, Math.PI * 2); c.clip();
            c.fillStyle = '#ffffff';
            c.beginPath(); c.moveTo(ox, S); c.lineTo(ox, side); c.quadraticCurveTo(ox + h, 2 * mid - side, ox + S, side); c.lineTo(ox + S, S); c.closePath(); c.fill();
            c.strokeStyle = 'rgba(40,40,40,0.55)'; c.lineWidth = 5;
            c.beginPath(); c.moveTo(ox, side); c.quadraticCurveTo(ox + h, 2 * mid - side, ox + S, side); c.stroke();
            c.restore();
            t.add(f, 0, ox, 0, S, S);
        }
        t.refresh();
    }
}

export default class RigEyes {
    /** @param spec  the look's `eyes`; @param seed  makes each character blink at its own times */
    constructor(scene, spec, seed = 1, E = RIG_EYES) {
        ensureTextures(scene, E);
        this.scene = scene;
        this.E = E;
        this.spec = spec;
        this.depth = 0;
        // One gaze for both eyes (user 2026-11-15: "both eyes need to look, the backside one too; sync blink"):
        // they look the same way and blink together, as real eyes do.
        this.gaze = new Gaze(seed * 13);
        const yaws = eyeYaws(spec.at);      // each eye's ball is turned this far (the far one round the head a lot)
        this.eyes = spec.at.map((at, i) => ({ at, yaw: yaws[i] }));
        this.parts = null;       // made while shown, given back when not (out of view the eyes cost nothing)
    }

    make() {
        const s = this.scene, spec = this.spec;
        for (const e of this.eyes) {
            e.white = s.add.image(0, 0, 'rig_eye_white');
            e.iris = s.add.image(0, 0, 'rig_eye_iris').setTint(spec.iris);
            e.pupil = s.add.image(0, 0, 'rig_eye_white').setTint(0x05080c);
            e.shine = s.add.image(0, 0, 'rig_eye_white');
            e.lid = s.add.image(0, 0, 'rig_eye_lid', 0).setTint(spec.lid);
            e.smile = s.add.image(0, 0, 'rig_eye_smile', 0).setTint(spec.lid).setVisible(false);
        }
        this.parts = this.eyes.flatMap(e => [e.white, e.iris, e.pupil, e.shine, e.lid, e.smile]);
        for (const p of this.parts) p.noCaustics = true;
        this.setDepth(this.depth);
    }

    /** Depth: just behind the picture that is cut open for them. */
    setDepth(d) { this.depth = d; this.parts?.forEach((p, i) => p.setDepth(d + i * 0.00001)); return this; }

    /** Not shown: the pictures are kept (made once) and hidden; the gaze and blinking keep their state. */
    hide() { if (this.parts) for (const p of this.parts) p.setVisible(false); }

    /** The rig moved without being posed (slow tiers): the eyes move with it. */
    shift(dx, dy) { if (this.parts) for (const p of this.parts) { p.x += dx; p.y += dy; } }

    /**
     * Place and animate the eyes. `place(at, out)` writes where the eye's middle is on screen (out.x,
     * out.y) and the body's scale there across and along (out.sx with the turn's narrowing, out.sy);
     * `view` = { rotation, facing, alpha }, `look` = the world point to look at (or null: ahead), `dt`
     * seconds, `opts` = { scared, happy } (0..1; happy: squinted into smiling arcs, rig/wave.js).
     * While the picture shows, the eyes always do (its holes would show the water); the lowest tier
     * blinks and beams by squeezing (no lids).
     */
    update(place, view, look, dt, opts) {
        const E = this.E, q = QUALITY[this.scene.quality?.tier ?? 'high'];
        if (view.alpha <= 0.01) { this.hide(); return; }
        if (!this.parts) this.make();
        const cr = Math.cos(view.rotation), sr = Math.sin(view.rotation), W = E.tex;
        // Where to look, from the first (nearest) eye, in its radii; every eye then follows the one gaze.
        place(this.eyes[0].at, P);
        let tx = 1, ty = 0;
        if (look) {
            const r0 = Math.min(this.eyes[0].at.rx, this.eyes[0].at.ry), dx = look.x - P.x, dy = look.y - P.y;
            const ax = dx * cr + dy * sr, ay = -dx * sr + dy * cr;      // into the body's frame
            tx = ax * view.facing / (r0 * P.sy) * E.look; ty = -ay / (r0 * P.sy) * E.look;
        }
        const g = this.gaze.update(dt, { x: tx, y: ty }, opts);
        for (const e of this.eyes) {
            place(e.at, P);
            // The ball's own size: a turned eye's outline is narrow, its ball is not (iris as big as the front eye's).
            const kx = P.sx, ky = P.sy, rx = e.at.rx * kx, ry = e.at.ry * ky, r = Math.min(e.at.rx / Math.max(0.3, Math.cos(e.yaw)), e.at.ry);
            const ball = onBall(g.x, e.yaw);
            const happy = opts?.happy || 0, lid = Math.max(g.lid, happy * E.squint);
            const shut = q.lids ? 1 : (1 - Math.max(0, (lid - EYES_REST) / (1 - EYES_REST))) * (1 - happy * E.smile * 0.6);
            const ox = ball.dx / Math.sin(EYES.reach * 0.7) * E.travel * r * kx * view.facing, oy = -g.y * E.travel * ry;
            const ix = P.x + ox * cr - oy * sr, iy = P.y + ox * sr + oy * cr;
            const ir = r * E.iris, pr = ir * E.pupil * g.pupil * (this.spec.pupil ?? 1);
            e.white.setPosition(P.x, P.y).setRotation(view.rotation).setScale(rx * 2 * E.cover / W, ry * 2 * E.cover / W);
            e.iris.setPosition(ix, iy).setRotation(view.rotation).setScale(ir * 2 * kx * ball.squash / W, ir * 2 * ky * shut / W);
            e.pupil.setPosition(ix, iy).setRotation(view.rotation).setScale(pr * 2 * kx * ball.squash / W, pr * 2 * ky * shut / W);
            e.shine.setPosition(ix - ir * 0.35 * view.facing * kx * ball.squash, iy - ir * 0.4 * ky).setScale(ir * 0.55 * kx * ball.squash / W, ir * 0.55 * ky * shut / W);
            e.lid.setVisible(!!q.lids);
            if (q.lids) e.lid.setFrame(Math.round(lid * (E.lids - 1))).setPosition(P.x, P.y).setRotation(view.rotation).setScale(rx * 2 * E.cover / W, ry * 2 * E.cover / W);
            const smiling = !!q.lids && happy > 0.02;
            e.smile.setVisible(smiling);
            if (smiling) e.smile.setFrame(Math.round(happy * (E.lids - 1))).setPosition(P.x, P.y).setRotation(view.rotation).setScale(rx * 2 * E.cover / W, ry * 2 * E.cover / W);
        }
        for (const e of this.eyes) for (const p of [e.white, e.iris, e.pupil, e.shine]) p.setVisible(true);      // (each lid follows the tier, above)
        for (const p of this.parts) p.setAlpha(view.alpha);
    }

    destroy() { if (this.parts) for (const p of this.parts) p.destroy(); this.parts = null; }
}

const P = { x: 0, y: 0, sx: 1, sy: 1 };
