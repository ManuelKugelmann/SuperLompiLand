import Phaser from 'phaser';
import { CHARACTERS } from './characters.js';
import { softnessMap, SoftHalo } from './rig/soft.js';

/** Tunables of the body animation shared by every playable (local, remote, title screen). */
export const RIG = {
    alignFrom: 3,          // below this speed the body stays level
    alignFull: 8,          // from this speed it fully points along its movement
    finFlapMin: 7,         // side fin swing in degrees when idle ...
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
 * RemoteFish from network snapshots, the title screen from the carousel.
 */
export default class Rig {
    constructor(scene, character, x, y, depth = 5) {
        ensureFallbackTextures(scene);
        this.char = character;
        this.facing = 1;        // 1 = right, -1 = left
        this.angle = 0;         // where the nose points (smoothed)
        this.phase = 0;         // swim cycle
        this.zoom = 1;          // extra scale on top of the character's size
        this.shown = true;
        this.views = {};
        for (const [name, st] of Object.entries(character.states)) {
            const key = scene.textures.exists(st.key) ? st.key : DEFAULT_STATES.normal.key;
            // With the layered art (body without side fin + the fin on its own)
            // the fin flaps separately; otherwise the single image is used as is.
            const pivot = scene.cache.json.get('fins')?.[key];
            const layered = !!pivot && scene.textures.exists(`${key}_body`) && scene.textures.exists(`${key}_fin`);
            // A Rope is used as a free-form triangle strip: its vertices are set by hand in draw().
            const view = scene.add.rope(x, y, layered ? `${key}_body` : key, null, STRIP.length / 2, true)
                .setDepth(depth).setVisible(false);
            view.dirty = false;
            view.baseScale = st.width / view.frame.width;
            view.wiggle = st.wiggle;
            view.grid = makeGrid(view, softFor(scene, key));
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
        if (old !== this.view) { old.setVisible(false); old.fin?.setVisible(false); this.view.grid.halo.fresh = true; }
        this.view.fin?.setVisible(this.shown);
    }

    setVisible(on) {
        this.shown = on;
        this.view.setVisible(on);
        this.view.fin?.setVisible(on);
        return this;
    }

    setAlpha(a) { this.view.setAlpha(a); return this; }

    setDepth(d) {
        for (const v of Object.values(this.views)) { v.setDepth(d); v.fin?.setDepth(d + 0.1); }
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
     */
    draw({ x, y, vx = 0, vy = 0, frames = 1, effort = 0, squash = 0, turn = 0.2, facing, flowX = 0, flowY = 0 }) {
        const view = this.view, grid = view.grid, halo = grid.halo;
        view.setPosition(x, y);

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
        const follow = this.char.upright ? 0 : Phaser.Math.Clamp((speed - RIG.alignFrom) / (RIG.alignFull - RIG.alignFrom), 0, 1);
        const target = Phaser.Math.Angle.Wrap(level + Phaser.Math.Angle.Wrap(Math.atan2(vy, vx) - level) * follow);
        this.angle = Phaser.Math.Angle.RotateTo(this.angle, target, turn * frames);
        const sq = Phaser.Math.Clamp(squash, -0.35, 0.35);
        const sc = view.baseScale * this.zoom;
        let scaleX = sc * (1 + sq), scaleY = sc * (1 - sq) * flip, rotation = this.angle;

        // --- Primary motion (procedural), driven by how hard the character swims
        // and how fast it moves (being carried is not swimming). Idle = a slow,
        // small flutter. Each style bends the picture as a function of where a
        // point lies in it: u = 0 tail .. 1 nose, v = 0 top .. 1 bottom.
        const drive = Phaser.Math.Clamp(Math.max(effort, speed / 14), 0.12, 1);
        this.phase += (0.1 + drive * 0.42) * frames;
        const ph = this.phase, amp = view.wiggle * (0.25 + drive * 0.75), w = view.frame.width;
        const style = this.char.anim || 'swim';
        let bend;
        if (style === 'pulse') {
            // Jellyfish: the bell pumps (harder when swimming), the tentacles trail
            // behind the movement and ripple.
            const beat = Math.sin(ph * 0.9), pump = 0.05 + drive * 0.09;
            scaleX *= 1 + beat * pump; scaleY *= 1 - beat * pump * 1.3;
            const trail = Phaser.Math.Clamp(-vx * 0.012, -0.35, 0.35) * flip;
            bend = (u, v, out) => { out.x = (Math.sin(ph * 0.9 - v * 3.4) * 0.06 + trail * v) * w * v * v * 2.2; out.y = 0; };
        } else if (style === 'sway') {
            // Seahorse: upright, the body curls gently from the head down; the tail swings behind.
            const trail = Phaser.Math.Clamp(-vx * 0.01, -0.3, 0.3) * flip, k = 0.05 * (0.5 + drive);
            bend = (u, v, out) => { out.x = (Math.sin(ph * 0.7 - v * 2.2) * k + trail * v) * w * v; out.y = 0; };
        } else if (style === 'paddle') {
            // Turtle: a stiff shell that rocks with each flipper stroke and stretches forward a little.
            const stroke = Math.sin(ph * 0.55);
            rotation += stroke * 0.07 * (0.3 + drive) * flip;
            scaleX *= 1 + stroke * 0.03 * drive; scaleY *= 1 - stroke * 0.045 * (0.4 + drive);
            bend = (u, v, out) => { const t = 1 - u; out.x = 0; out.y = Math.sin(ph * 0.55 - t * 1.5) * amp * 0.5 * t * t * t; };
        } else {
            // Fish: a wave runs down the body, strongest at the tail.
            bend = (u, v, out) => { const t = 1 - u; out.x = 0; out.y = Math.sin(ph - t * 2.6) * amp * t * t; };
        }
        view.setScale(scaleX, scaleY);
        view.rotation = rotation;

        // --- Secondary motion (physical): the rays of the soft halo are simulated
        // in world space, pulled toward where the bent picture wants them.
        const soft = this.char.soft ?? RIG.softDefault;
        const cos = Math.cos(rotation), sin = Math.sin(rotation);
        const size = Math.max(view.frame.width, view.frame.height);
        const ripple = RIG.flutter * size * soft * (0.6 + drive * 0.8);
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
    }

    destroy() {
        for (const v of Object.values(this.views)) { v.fin?.destroy(); v.destroy(); }
    }
}

const TMP = { x: 0, y: 0 };

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
