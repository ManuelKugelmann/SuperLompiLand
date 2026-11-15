import Phaser from 'phaser';
import { CHARACTERS } from './characters.js';
import { softnessMap, SoftHalo } from './rig/soft.js';
import { CARDS, makeSpine, spineTable, spineAt } from './rig/cards.js';
import RigEyes from './rig/RigEyes.js';
import { holedTexture } from './rig/eyeHoles.js';
import { faceOf } from './rig/faces.js';
import { Breath, BREATH, instanceSeed } from './rig/breath.js';

/** Tunables of the body animation shared by every playable (local, remote, title screen). */
export const RIG = {
    alignFrom: 3,          // below this speed the body stays level
    alignFull: 8,          // from this speed it fully points along its movement
    ease: 1.6,             // effort is eased in by this power: cruising stays gentle, only real effort shows
    cycle: [0.04, 0.3],    // swim cycle per step: at rest and at full effort
    idle: 0.08,            // share of the body wave left at rest
    finFlapMin: 2,         // side fin swing in degrees when idle ...
    finFlapMore: 14,       // ... plus this much at full effort (kept small: the retouch under the fin is rough)
    cols: 14, rows: 10,    // the picture is a bendable grid of this many cells
    chains: 16, links: 5,  // soft parts: rays around the body x points per ray
    softMap: 48,           // the picture is read at this width to find its thin (soft) parts
    softDefault: 0.6,      // how loose the soft parts are when a character does not say (0 = stiff, 1 = flowing)
    softDrag: 0.16,        // share of their motion the water takes per step
    softReach: 0.3,        // furthest a soft part may leave its place, in picture sizes
    flutter: 0.022         // idle ripple of the soft parts, in picture sizes
};

/** Lompi's looks double as the fallback for any character whose art is missing. */
const DEFAULT_STATES = CHARACTERS[0].states;

// The grid as one triangle strip (rows joined by degenerate triangles): for each
// strip vertex, the grid node it shows.
const STRIDE = RIG.cols + 1, NODES = STRIDE * (RIG.rows + 1);
const STRIP = [];
for (let r = 0; r < RIG.rows; r++) {
    if (r > 0) STRIP.push(r * STRIDE + RIG.cols, r * STRIDE);
    for (let c = 0; c <= RIG.cols; c++) STRIP.push(r * STRIDE + c, (r + 1) * STRIDE + c);
}

/** Which parts of a picture are thin and soft (see rig/soft.js); read once per texture. */
const softMaps = new Map();
function softFor(scene, key) {
    if (softMaps.has(key)) return softMaps.get(key);
    let map;
    try {
        const src = scene.textures.get(key).getSourceImage();
        const w = RIG.softMap, h = Math.max(8, Math.round(w * src.height / src.width));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(src, 0, 0, w, h);
        const rgba = ctx.getImageData(0, 0, w, h).data, alpha = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) alpha[i] = rgba[i * 4 + 3];
        map = { ...softnessMap(alpha, w, h), w, h };
    } catch {
        map = { soft: new Float32Array(1), cx: 0.5, cy: 0.5, w: 1, h: 1 };   // unreadable picture: all rigid
    }
    softMaps.set(key, map);
    return map;
}

/**
 * What you see of a playable character: one bendable picture per state (plus the
 * side fin where the art has one), animated from nothing but a position, a
 * velocity and how hard the character is swimming.
 *   primary motion    procedural: tail wave, bell pump, sway, flipper strokes (`anim`)
 *   secondary motion  physical: thin parts of the picture — fins, spines, tassels,
 *                     tentacles — trail behind, swing through and settle (`soft`)
 * It has no physics body and takes no input — Player drives it from its body,
 * RemoteFish from network snapshots, the title screen from the carousel, Creature
 * (the animals of the world) from its brain.
 * Profile fields read here: states, anim (swim | paddle | pulse | sway | sit | throb), soft,
 * upright, facesLeft (art drawn nose-left), alignFrom / alignFull / pitch (how the nose follows
 * the movement; slow animals tip already at low speed, and only part of the way).
 */
export default class Rig {
    constructor(scene, character, x, y, depth = 5) {
        this.poseTurn = Math.floor(Math.random() * 64);      // its turn among the rigs (CARDS.poseEvery)
        this.owed = 0;            // frames not yet posed
        this.alwaysPose = false;  // the playable: posed every frame whatever the tier
        ensureFallbackTextures(scene);
        this.char = character;
        this.facing = 1;        // 1 = right, -1 = left
        this.angle = 0;         // where the nose points (smoothed)
        this.phase = 0;         // swim cycle
        this.spine = { ...CARDS.spine, ...character.spine };   // the spine wave, shared with the card rigs (CARDS.spine)
        this.spineT = makeSpine();
        this.spinePh = 0;
        this.spineAmp = 0;
        this.zoom = 1;          // extra scale on top of the character's size
        this.shown = true;
        this.views = {};
        this.scene = scene;
        this.breath = new Breath(instanceSeed());     // breathing (rig/breath.js), as the card rigs
        // Per-rig scratch for placing points on the bent picture (eyes, mouth): no closures or objects per frame.
        this.pt = {};
        this.place = (a, o) => {
            const P = this.pt, w = P.w, h = P.h;
            P.bend(a.x / w, a.y / h, P.out);
            const lx = (a.x - w / 2 + P.out.x) * P.scaleX, ly = (a.y - h / 2 + P.out.y) * P.scaleY;
            o.x = P.x + lx * P.cos - ly * P.sin; o.y = P.y + lx * P.sin + ly * P.cos; o.sx = Math.abs(P.scaleX); o.sy = Math.abs(P.scaleY);
        };
        this.eyeView = { rotation: 0, facing: 1, alpha: 1 };
        this.ahead = { x: 0, y: 0 };
        for (const [name, st] of Object.entries(character.states)) {
            const key = scene.textures.exists(st.key) ? st.key : DEFAULT_STATES.normal.key;
            // With the layered art (body without side fin + the fin on its own)
            // the fin flaps separately; otherwise the single image is used as is.
            const pivot = scene.cache.json.get('fins')?.[key];
            const layered = !!pivot && scene.textures.exists(`${key}_body`) && scene.textures.exists(`${key}_fin`);
            // A Rope is used as a free-form triangle strip: its vertices are set by hand in draw().
            // A hero's eyes are cut out of its picture; the living eyeballs are drawn behind it (rig/eyeHoles.js).
            const face = key === st.key && !layered ? faceOf(st) : null;
            const view = scene.add.rope(x, y, layered ? `${key}_body` : holedTexture(scene, key, face?.eyes), null, STRIP.length / 2, true)
                .setDepth(depth).setVisible(false);
            view.dirty = false;
            view.baseScale = st.width / view.frame.width;
            view.wiggle = st.wiggle;
            view.grid = makeGrid(view, softFor(scene, key));
            // Living eyes and the mouth (rig/faces.js): only with the painted picture they were measured on.
            view.face = face;
            if (face?.eyes) view.eyes = new RigEyes(scene, face.eyes, instanceSeed()).setDepth(depth - 0.005);
            if (layered) {
                const fin = scene.add.image(x, y, `${key}_fin`).setDepth(depth + 0.1).setVisible(false);
                fin.setOrigin((pivot.pivotX - pivot.finX) / fin.width, (pivot.pivotY - pivot.finY) / fin.height);
                // fin joint: in the picture (0..1) and relative to the body centre (texture pixels)
                fin.u = pivot.pivotX / view.frame.width;
                fin.v = pivot.pivotY / view.frame.height;
                fin.jointX = pivot.pivotX - view.frame.width / 2;
                fin.jointY = pivot.pivotY - view.frame.height / 2;
                view.fin = fin;
            }
            this.views[name] = view;
        }
        this.view = this.views.normal;
        this.setState('normal');
    }

    /** Switch the look (e.g. 'inflated'); unknown states fall back to 'normal'. */
    setState(name) {
        const old = this.view;
        this.state = this.views[name] ? name : 'normal';
        this.view = this.views[this.state];
        this.view.setPosition(old.x, old.y).setRotation(old.rotation).setAlpha(old.alpha).setVisible(this.shown);
        if (old !== this.view) { old.setVisible(false); old.fin?.setVisible(false); old.eyes?.hide(); this.view.grid.halo.fresh = true; }
        this.view.fin?.setVisible(this.shown);
    }

    setVisible(on) {
        this.shown = on;
        this.view.setVisible(on);
        this.view.fin?.setVisible(on);
        this.overlay?.setVisible(on && !this.overlayOff);
        if (!on) this.view.eyes?.hide();
        return this;
    }

    setAlpha(a) { this.view.setAlpha(a); return this; }

    setDepth(d) {
        for (const v of Object.values(this.views)) { v.setDepth(d); v.fin?.setDepth(d + 0.1); v.eyes?.setDepth(d - 0.005); }
        return this;
    }

    /**
     * Draw one frame.
     * @param p.x,p.y    where
     * @param p.vx,p.vy  velocity the body should follow (relative to the water; 0 = hold the pose)
     * @param p.frames   elapsed time in 60 Hz steps
     * @param p.effort   0..1 how hard it is swimming right now
     * @param p.squash   >0 stretched along the travel direction, <0 squashed
     * @param p.turn     radians per step the nose may turn
     * @param p.facing   force the facing (1 / -1) instead of deriving it from vx
     * @param p.flowX,p.flowY  velocity of the water around it (soft parts drift with it)
     * @param p.lean     extra turn of the whole picture (a sitter lying on sloping ground)
     * @param p.beat     -1..1: a pulsing body pumps on this instead of its own swim cycle
     */
    draw({ x, y, vx = 0, vy = 0, frames = 1, effort = 0, squash = 0, turn = 0.2, facing, flowX = 0, flowY = 0, lean = 0, beat }) {
        const view = this.view, grid = view.grid, halo = grid.halo;
        view.setPosition(x, y);
        // On the slow tiers a rig is bent anew only every few frames, the rigs taking turns (CARDS.poseEvery): in between
        // it moves as it is, fin, overlay and eyes along, and the next pose catches up the frames it skipped.
        const dx = x - (this.lastX ?? x), dy = y - (this.lastY ?? y);
        this.lastX = x; this.lastY = y;
        const wantFacing = facing ?? (Math.abs(vx) > 0.8 ? (vx < 0 ? -1 : 1) : this.facing);
        if (CARDS.poseEvery > 1 && !this.alwaysPose && wantFacing === this.facing && ++this.poseTurn % CARDS.poseEvery) {
            if (view.fin) { view.fin.x += dx; view.fin.y += dy; }
            this.overlay?.setPosition(x, y);
            view.eyes?.shift(dx, dy);
            this.owed += frames;
            return;
        }
        frames += this.owed; this.owed = 0;

        // Orientation depends on speed: slow = level, just hovering; faster = the
        // nose follows the movement. The art faces right; heading left it is
        // mirrored vertically so it never swims belly-up.
        const speed = Math.hypot(vx, vy);
        const want = facing ?? (Math.abs(vx) > 0.8 ? (vx < 0 ? -1 : 1) : this.facing);
        if (want !== this.facing) {
            // Turning round mirrors the body; mirror its angle too so it flips
            // in place instead of rolling over its back.
            this.facing = want;
            this.angle = Phaser.Math.Angle.Wrap(Math.PI - this.angle);
            halo.fresh = true;
        }
        const flip = this.facing < 0 ? -1 : 1;
        const level = flip < 0 ? Math.PI : 0;
        const from = this.char.alignFrom ?? RIG.alignFrom, full = this.char.alignFull ?? RIG.alignFull;
        const follow = this.char.upright ? 0 : Phaser.Math.Clamp((speed - from) / (full - from), 0, 1) * (this.char.pitch ?? 1);
        const target = Phaser.Math.Angle.Wrap(level + Phaser.Math.Angle.Wrap(Math.atan2(vy, vx) - level) * follow);
        this.angle = Phaser.Math.Angle.RotateTo(this.angle, target, turn * frames);
        const sq = Phaser.Math.Clamp(squash, -0.35, 0.35);
        const sc = view.baseScale * this.zoom;
        // Art drawn nose-left is mirrored once, so everything below sees a nose on the right.
        const left = !!this.char.facesLeft;
        let scaleX = sc * (1 + sq) * (left ? -1 : 1), scaleY = sc * (1 - sq) * flip, rotation = this.angle + lean;

        // --- Primary motion (procedural), driven by how hard the character swims
        // and how fast it moves (being carried is not swimming). Idle = a slow,
        // small flutter. Each style bends the picture as a function of where a
        // point lies in it: u = 0 tail .. 1 nose, v = 0 top .. 1 bottom.
        // Calm by default: a body at rest is nearly still, and it only works as hard as it swims
        // (eased in, so gentle cruising stays gentle).
        const raw = Phaser.Math.Clamp(Math.max(effort, speed / 14), 0, 1), drive = Math.pow(raw, RIG.ease);
        const step = (RIG.cycle[0] + drive * (RIG.cycle[1] - RIG.cycle[0])) * frames;
        this.phase += step;
        this.spinePh += step * this.spine.rate;
        const ph = this.phase, amp = view.wiggle * (RIG.idle + drive * (1 - RIG.idle)), w = view.frame.width;
        const style = this.char.anim || 'swim';
        // Breathing: always; the body swells a little with each breath.
        const br = this.breath.update(frames / 60, raw), swell = style === 'paddle' ? 0 : BREATH.swell * (br.gill - 0.3);      // a paddler's shell is rigid
        scaleX *= 1 - swell * 0.4; scaleY *= 1 + swell;
        let bend;
        if (style === 'pulse') {
            // Jellyfish: the bell pumps (harder when swimming), the tentacles trail
            // behind the movement and ripple.
            const push = beat ?? Math.sin(ph * 0.9), pump = 0.03 + drive * 0.11;
            scaleX *= 1 + push * pump; scaleY *= 1 - push * pump * 1.3;
            const trail = Phaser.Math.Clamp(-vx * 0.012, -0.35, 0.35) * flip;
            bend = (u, v, out) => { out.x = (Math.sin(ph * 0.9 - v * 3.4) * 0.06 + trail * v) * w * v * v * 2.2; out.y = 0; };
        } else if (style === 'sway') {
            // Seahorse: upright, the body curls gently from the head down; the tail swings behind.
            const trail = Phaser.Math.Clamp(-vx * 0.01, -0.3, 0.3) * flip, k = 0.05 * (0.15 + drive * 1.35);
            bend = (u, v, out) => { out.x = (Math.sin(ph * 0.7 - v * 2.2) * k + trail * v) * w * v; out.y = 0; };
        } else if (style === 'paddle') {
            // Turtle: the shell is rigid (user: "shell rigid, not part of the flipper anim"): the whole picture
            // only rocks a little with each stroke; nothing of it stretches or bends.
            rotation += Math.sin(ph * 0.55) * 0.05 * (0.08 + drive * 1.2) * flip;
            bend = still;
        } else if (style === 'sit') {
            // Sitters (starfish, snail, slug): they rock a little and breathe; the thin parts do the rest.
            rotation += Math.sin(ph * 0.45) * 0.018;
            scaleY *= 1 + Math.sin(ph * 0.6) * 0.015;
            bend = still;
        } else if (style === 'throb') {
            // Urchin: the spines swell in and out.
            const swell = 1 + Math.sin(ph * 0.8) * 0.03;
            scaleX *= swell; scaleY *= swell;
            bend = still;
        } else {
            // Fish: the spine wave (CARDS.spine). A flat picture cannot turn in depth, so it shows what
            // the side view keeps of the 3D bend: the rear reads shorter as far as it turns, and the small
            // S in the picture plane. Sea mammals (spine.plane) beat up and down: the picture-plane wave.
            const T = this.spineT, sp = this.spine, spine = sp.tail > 0, k = left ? -1 : 1;
            this.spineAmp += (Math.min(1, raw / sp.full) - this.spineAmp) * (1 - Math.exp(-frames / 60 / sp.ease));
            if (spine) spineTable(this.spinePh, this.spineAmp, sp, T);
            bend = (u, v, out) => {
                const t = left ? u : 1 - u;
                if (spine) { spineAt(T, t, SPINE); out.x = SPINE.dx * w * k; out.y = SPINE.z * w * sp.lift; } else { out.x = 0; out.y = 0; }
                if (sp.plane) out.y += Math.sin(ph - t * 2.6) * amp * t * t;
            };
        }
        view.setScale(scaleX, scaleY);
        view.rotation = rotation;

        // --- Secondary motion (physical): the rays of the soft halo are simulated
        // in world space, pulled toward where the bent picture wants them.
        const soft = this.char.soft ?? RIG.softDefault;
        const cos = Math.cos(rotation), sin = Math.sin(rotation);
        const size = Math.max(view.frame.width, view.frame.height);
        const ripple = RIG.flutter * size * soft * (0.12 + drive * 1.28);      // the soft parts ripple when it swims, hardly at rest
        const out = TMP, links = RIG.links, n = RIG.chains * links;
        for (let k = 0; k < n; k++) {
            const c = (k / links) | 0, f = (k % links) / (links - 1);
            bend(grid.haloU[k], grid.haloV[k], out);
            const lx = grid.haloX[k] + out.x, ly = grid.haloY[k] + out.y;
            grid.baseX[k] = x + lx * scaleX * cos - ly * scaleY * sin;      // where the picture is, without ripple
            grid.baseY[k] = y + lx * scaleX * sin + ly * scaleY * cos;
            // Ripple: a small wave running outward along each ray, across it.
            const r = Math.sin(ph * 1.3 - f * 4 + c * 2.1) * ripple * f;
            const rx = lx - grid.dirY[c] * r, ry = ly + grid.dirX[c] * r;
            halo.tx[k] = x + rx * scaleX * cos - ry * scaleY * sin;
            halo.ty[k] = y + rx * scaleX * sin + ry * scaleY * cos;
        }
        halo.step({
            stiffness: 0.34 - 0.27 * soft, drag: RIG.softDrag, flowX, flowY, frames,
            reach: size * Math.abs(sc) * 1.2
        });
        // How far each ray point has left its place, in picture pixels.
        const reach = RIG.softReach * size * soft;
        for (let k = 0; k < n; k++) {
            const wx = halo.x[k] - grid.baseX[k], wy = halo.y[k] - grid.baseY[k];
            let dx = (wx * cos + wy * sin) / scaleX, dy = (-wx * sin + wy * cos) / scaleY;
            const len = Math.hypot(dx, dy);
            if (len > reach) { dx *= reach / len; dy *= reach / len; }
            grid.dispX[k] = dx; grid.dispY[k] = dy;
        }

        // --- The grid: every node = its place + the bend + its share of the soft motion.
        const px = grid.px, py = grid.py;
        for (let i = 0; i < NODES; i++) {
            bend(grid.u[i], grid.v[i], out);
            let dx = out.x, dy = out.y;
            const s = grid.soft[i];
            if (s > 0) {
                const c0 = grid.ray[i] | 0, a = grid.ray[i] - c0, c1 = (c0 + 1) % RIG.chains;
                const j0 = grid.along[i] | 0, b = grid.along[i] - j0, j1 = Math.min(links - 1, j0 + 1);
                const k00 = c0 * links + j0, k01 = c0 * links + j1, k10 = c1 * links + j0, k11 = c1 * links + j1;
                const w00 = (1 - a) * (1 - b), w01 = (1 - a) * b, w10 = a * (1 - b), w11 = a * b;
                dx += s * (grid.dispX[k00] * w00 + grid.dispX[k01] * w01 + grid.dispX[k10] * w10 + grid.dispX[k11] * w11);
                dy += s * (grid.dispY[k00] * w00 + grid.dispY[k01] * w01 + grid.dispY[k10] * w10 + grid.dispY[k11] * w11);
            }
            px[i] = grid.x[i] + dx; py[i] = grid.y[i] + dy;
        }
        const verts = view.vertices;
        for (let s = 0; s < STRIP.length; s++) {
            verts[s * 2] = px[STRIP[s]];
            verts[s * 2 + 1] = py[STRIP[s]];
        }

        // Side fin: paddles around its joint, faster and wider the harder the
        // character swims. It rides on the body (position, turn, mirroring, bend).
        const fin = view.fin;
        if (fin) {
            bend(fin.u, fin.v, out);
            const lx = (fin.jointX + out.x) * scaleX, ly = (fin.jointY + out.y) * scaleY;
            fin.setPosition(x + lx * cos - ly * sin, y + lx * sin + ly * cos);
            fin.setScale(scaleX, scaleY);
            const flap = Math.sin(ph * 1.15) * Phaser.Math.DegToRad(RIG.finFlapMin + drive * RIG.finFlapMore);
            fin.rotation = rotation + flap * flip;
            fin.setAlpha(view.alpha);
        }

        // Eyes and mouth ride the bent picture where they are painted.
        const face = view.face;
        if (face) {
            const P = this.pt;
            P.w = view.frame.width; P.h = view.frame.height; P.bend = bend; P.out = out; P.scaleX = scaleX; P.scaleY = scaleY;
            P.x = x; P.y = y; P.cos = cos; P.sin = sin;
            if (view.eyes) {
                if (!this.shown) view.eyes.hide();
                else {
                    // Mirrored upside down when heading left (see above): seen upright, that is a left-facing eye.
                    const V = this.eyeView; V.rotation = flip < 0 ? rotation - Math.PI : rotation; V.facing = flip; V.alpha = view.alpha;
                    const ahead = this.ahead; ahead.x = x + flip * 400 + vx * 30; ahead.y = y + vy * 30;
                    view.eyes.update(this.place, V, this.look || ahead, frames / 60, { scared: this.scared || 0 });
                }
            }
            if (br.blub && face.mouth && this.shown && y > 0) { this.place(face.mouth, MOUTH); this.scene.particles?.spawn('bubble', MOUTH.x, MOUTH.y, 1); }
        }

        const over = this.overlay;
        if (over) {
            over.setPosition(x, y).setScale(scaleX, scaleY);
            over.rotation = rotation;
            over.vertices.set(verts);
        }
    }

    /**
     * A second copy of the picture that lies exactly on the body and bends with it (a sheen,
     * a glow). The caller sets blend mode, colours and alpha; it follows the 'normal' look.
     */
    /** Where the eyes look (a world point; null: ahead), and how frightened they are (0..1). */
    lookAt(point, scared = 0) { this.look = point; this.scared = scared; return this; }

    /** The overlay off or on again (a quality tier without the sheen), whatever culling does with the body. */
    setOverlay(on) { this.overlayOff = !on; this.overlay?.setVisible(on && this.shown !== false); return this; }

    addOverlay(scene, depth) {
        const v = this.views.normal;
        const over = scene.add.rope(v.x, v.y, v.texture.key, null, STRIP.length / 2, true).setDepth(depth);
        over.dirty = false;
        over.uv.set(v.uv);
        this.overlay = over;
        return over;
    }

    destroy() {
        for (const v of Object.values(this.views)) { v.fin?.destroy(); v.eyes?.destroy(); v.destroy(); }
        this.overlay?.destroy();
    }
}

const TMP = { x: 0, y: 0 }, SPINE = { z: 0, a: 0, dx: 0 }, MOUTH = { x: 0, y: 0, sx: 1, sy: 1 };
const still = (u, v, out) => { out.x = 0; out.y = 0; };

/** Everything about one picture's grid that never changes: places, texture coordinates, soft weights, rays. */
function makeGrid(view, map) {
    const f = view.frame, w = f.width, h = f.height;
    const grid = {
        u: new Float32Array(NODES), v: new Float32Array(NODES),       // place in the picture, 0..1
        x: new Float32Array(NODES), y: new Float32Array(NODES),       // place relative to the centre, texture px
        px: new Float32Array(NODES), py: new Float32Array(NODES),     // this frame's place
        soft: new Float32Array(NODES),                                // 0 = rigid body .. 1 = fully soft
        ray: new Float32Array(NODES), along: new Float32Array(NODES), // which ray (fractional) and how far out along it
        halo: new SoftHalo(RIG.chains, RIG.links)
    };
    const n = RIG.chains * RIG.links;
    for (const name of ['haloX', 'haloY', 'haloU', 'haloV', 'baseX', 'baseY', 'dispX', 'dispY']) grid[name] = new Float32Array(n);
    grid.dirX = new Float32Array(RIG.chains); grid.dirY = new Float32Array(RIG.chains);

    // The rays start at the body's centre and end at the picture's edge.
    const cx = (map.cx - 0.5) * w, cy = (map.cy - 0.5) * h;
    const toEdge = (dx, dy) => Math.min(
        dx > 1e-6 ? (w / 2 - cx) / dx : dx < -1e-6 ? (-w / 2 - cx) / dx : Infinity,
        dy > 1e-6 ? (h / 2 - cy) / dy : dy < -1e-6 ? (-h / 2 - cy) / dy : Infinity);
    for (let c = 0; c < RIG.chains; c++) {
        const a = (c / RIG.chains) * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a), len = toEdge(dx, dy);
        grid.dirX[c] = dx; grid.dirY[c] = dy;
        for (let j = 0; j < RIG.links; j++) {
            const k = c * RIG.links + j, r = len * j / (RIG.links - 1);
            grid.haloX[k] = cx + dx * r; grid.haloY[k] = cy + dy * r;
            grid.haloU[k] = grid.haloX[k] / w + 0.5; grid.haloV[k] = grid.haloY[k] / h + 0.5;
        }
    }
    for (let r = 0; r <= RIG.rows; r++) {
        for (let c = 0; c <= RIG.cols; c++) {
            const i = r * STRIDE + c, u = c / RIG.cols, v = r / RIG.rows;
            grid.u[i] = u; grid.v[i] = v;
            grid.x[i] = (u - 0.5) * w; grid.y[i] = (v - 0.5) * h;
            const mx = Math.min(map.w - 1, Math.floor(u * map.w)), my = Math.min(map.h - 1, Math.floor(v * map.h));
            grid.soft[i] = map.soft[my * map.w + mx] ?? 0;
            const dx = grid.x[i] - cx, dy = grid.y[i] - cy, dist = Math.hypot(dx, dy);
            const turn = (Math.atan2(dy, dx) / (Math.PI * 2) + 1) % 1;
            grid.ray[i] = Math.min(RIG.chains - 1e-4, turn * RIG.chains);
            grid.along[i] = dist < 1e-3 ? 0 : Math.min(1, dist / toEdge(dx / dist, dy / dist)) * (RIG.links - 1);
        }
    }
    // Texture coordinates never change.
    const uv = view.uv;
    for (let s = 0; s < STRIP.length; s++) {
        uv[s * 2] = f.u0 + (f.u1 - f.u0) * grid.u[STRIP[s]];
        uv[s * 2 + 1] = f.v0 + (f.v1 - f.v0) * grid.v[STRIP[s]];
    }
    return grid;
}

/** Procedural stand-ins so the game runs even if the art files are missing. */
function ensureFallbackTextures(scene) {
    for (const [name, s] of Object.entries(DEFAULT_STATES)) {
        if (scene.textures.exists(s.key)) continue;
        const R = 100, pad = name === 'inflated' ? 30 : 6, c = R + pad;
        const g = scene.make.graphics({ add: false });
        if (name === 'inflated') {
            g.fillStyle(0xef8a4b, 1);
            for (let i = 0; i < 16; i++) {
                const a = (i / 16) * Math.PI * 2;
                const px = Math.cos(a + 1.57) * 12, py = Math.sin(a + 1.57) * 12;
                g.fillTriangle(c + Math.cos(a) * (R + pad), c + Math.sin(a) * (R + pad),
                    c + Math.cos(a) * R + px, c + Math.sin(a) * R + py,
                    c + Math.cos(a) * R - px, c + Math.sin(a) * R - py);
            }
        }
        for (let i = 0; i < 28; i++) {
            const t = i / 27;
            const col = Phaser.Display.Color.Interpolate.ColorWithColor(
                new Phaser.Display.Color(217, 150, 31), new Phaser.Display.Color(255, 226, 120), 27, i);
            g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1);
            g.fillCircle(c - t * 18, c - t * 20, R * (1 - t));
        }
        g.fillStyle(0xffffff, 1).fillCircle(c + 45, c - 22, 24);
        g.fillStyle(0x1b2c5c, 1).fillCircle(c + 52, c - 20, 13);
        g.generateTexture(s.key, c * 2, c * 2);
        g.destroy();
    }
}
