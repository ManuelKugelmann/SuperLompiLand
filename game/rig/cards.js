// 2.5D part cards (spec 11.0c): a playable is its body card plus a card per fin, tail,
// flipper, head, fan or tentacle skirt, cut from its picture by scripts/parts/bake.py
// (public/img/parts/rig.json). Every card is a small grid placed in 3D picture space:
//   x right (nose), y down, z toward the viewer; picture px, origin = picture centre.
// The body bulges toward the viewer (thick in the middle, thin at the outline); fins are
// flat cards hinged on their root line. Each frame the cards are posed (fins scull and
// undulate about their roots, the tail beats sideways), turned with the rig's yaw and
// projected with a mild perspective, so turning shows foreshortening and parallax between
// body and fins. A turn-around is a real rotation through the edge-on view.
// Median fins (dorsal, anal, ridges) exist once, on the midline; a paired fin painted only
// on the near side gets its mirrored twin behind the body.
// Pure (no Phaser): game/CardRig.js uploads the results; tests in tests/cards.test.mjs.
import { sheenHue } from './sheen.js';

/** Every how many frames a rig at (x, y) is posed, with the view's middle at `mid`: CARDS.poseEvery, twice that far from the middle (slow tiers only). */
export function poseGap(x, y, mid, cfg = CARDS) {
    if (cfg.poseEvery <= 1) return 1;
    return Math.hypot(x - mid.x, y - mid.y) > cfg.farPose ? cfg.poseEvery * 2 : cfg.poseEvery;
}

export const CARDS = {
    steerBend: 2.4,         // how far the tail lags in a turn: picture widths per radian per frame of turning
    steerMax: 0.07,         // the turn rate (rad per frame) at which the bend is at its most
    steerEase: 0.2,         // how quickly the bend follows the turning (share per frame)
    offView: 200,           // px beyond the view (plus its own size) at which a rig is no longer posed
    farPose: 600,           // px from the view's middle beyond which a rig on a slow tier is posed half as often again (the eye is on the middle)
    poseEvery: 1,           // a rig is posed anew every so many frames, the rigs taking turns (the quality tier sets it: QUALITY.poseEvery); in between its cards only follow its place. The playable is always posed
    bodyGrid: [12, 9],      // body card grid (columns x rows of cells)
    partGrid: [6, 4],       // fin card grid along its longer side x across
    bulge: 0.17,            // how far the body's middle stands toward the viewer, in picture widths
    persp: 3.2,             // camera distance in picture widths (smaller = stronger perspective)
    light: [-0.35, -0.72, 0.6],   // toward the light (up, a little left, toward the viewer)
    shade: 0.55,            // how much a surface darkens as it turns away from the light
    shadeMin: 0.5,
    edgeFade: [0.05, 0.3],  // a fin fades out as it turns edge-on (|normal z| from .. to)
    backside: 0.78,         // a fin seen from behind (through it) is a little darker
    twin: { shift: [-0.035, -0.05], dark: 0.66, z: -0.6 },   // far twin of a paired fin
    spreadRate: 0.12,       // share per 60 Hz step by which wings open or fold
    turnMs: 300,            // a turn-around (nose swings toward the viewer, then over to the other side)
    turnMax: 1.0,           // rad: the 2.5D mesh is seen only this far from the side view (user 2026-11-15: "2.5d mesh, 3d mesh for
                            // limited viewing angles"): a turn swings the nose this far toward the viewer, the picture mirrors
                            // there (both halves show the nose toward the viewer) and it swings back; never edge-on
    turnMin: [0.3, 0.12],   // in a turn the body keeps this share of its width (user: "when turning, creatures look too flat") until |cos yaw| is under the second number: only there, at the mirror, it thins out (a frame or two)
    sway: 0.012,            // idle yaw rocking (radians) ...
    swayMore: 0.03,         // ... plus this much at full effort
    driveCurve: 1.6,        // effort is eased in: light swimming moves little, only real effort moves a lot
    cycle: [0.04, 0.3],     // swim cycle speed (radians per step) at rest and at full effort
    // A fish swims by a wave running down its spine (user: "their spine bends back and forth, that's
    // their propelling"; "3d rig should make real fish tail swings possible"). The spine bends sideways
    // (toward and away from the viewer) as a real 3D curve that keeps its length: the front is nearly
    // rigid, the bend grows steeply in the rear third, the tail fin yaws a quarter beat behind the
    // stalk. Speed changes the beat rate, hardly the size. Defaults for a tail-driven fish; a profile
    // overrides any of them with its own `spine` (a rigid body: tail 0; an eel: long wave, shape < 1).
    spine: {
        wave: 0.7,          // wave length in body lengths (shark-like 0.6-0.8, eel 1.5+)
        tail: 0.13,         // sideways swing at the tail, body lengths (0: a rigid body, no spine wave)
        shape: 2.5,         // amplitude envelope s^shape, s = 0 head .. 1 tail (eel < 1: the whole body)
        head: 0.03,         // the head's counter-yaw, share of the tail swing
        anchor: 0.3,        // the point of the spine that stays in place (about the centre of mass)
        lift: 0.22,         // a small up-and-down S in the picture plane, share of the sideways swing
        full: 0.2,          // effort from which the swing is full (cruising already swims properly)
        ease: 0.3,          // s over which the swing follows effort (gliding settles softly)
        lag: Math.PI / 2,   // the tail fin follows the stalk this far behind (a quarter beat)
        finSwing: 0.35,     // share of its own beat a tail fin keeps on top of the spine's yaw
        rate: 1,            // beat speed relative to the swim cycle
        plane: false        // also beat up and down in the picture plane by the profile's wiggle (whales, sea mammals: flukes)
    }
};

/** Samples along the spine for spineTable / spineAt. */
const SPINE_N = 24;

/** A spine table to fill each frame: per sample the sideways offset, the body's yaw there, and how far it moved toward the head. */
export function makeSpine() { return { z: new Float32Array(SPINE_N + 1), a: new Float32Array(SPINE_N + 1), dx: new Float32Array(SPINE_N + 1) }; }

/**
 * The bent spine at phase `ph` and swing `amp` (0..1) for a spine config (CARDS.spine), along
 * s = 0 (head) .. 1 (tail), in body lengths: the bend angle follows the travelling wave, the curve
 * is integrated from it (so it keeps its length: it only looks shorter as far as it turns), and it
 * is shifted so the anchor point stays put. Per sample: z sideways (toward the viewer), a the yaw
 * of the body there (radians about the vertical; x points to the head), dx how far that point
 * moved toward the head.
 */
export function spineTable(ph, amp, cfg, t) {
    const k = 2 * Math.PI / cfg.wave, ds = 1 / SPINE_N, A = cfg.tail * amp;
    // Slope of the wanted sideways shape, z(s) = A (s^shape sin(ph - k s) - head (1 - s)^2 sin(ph - k)).
    for (let i = 0; i <= SPINE_N; i++) {
        const s = i * ds, e = Math.pow(s, cfg.shape), de = s > 0 ? cfg.shape * e / s : 0;
        const slope = A * (de * Math.sin(ph - k * s) - e * k * Math.cos(ph - k * s) + cfg.head * 2 * (1 - s) * Math.sin(ph - k));
        t.a[i] = Math.atan(slope);                       // the spine's angle away from straight (toward the tail)
    }
    // Integrate: z and how far along the rest axis each point lies.
    let z = 0, x = 0;
    t.z[0] = 0; t.dx[0] = 0;
    for (let i = 1; i <= SPINE_N; i++) {
        const m = (t.a[i] + t.a[i - 1]) / 2;
        z += Math.sin(m) * ds; x += Math.cos(m) * ds;
        t.z[i] = z; t.dx[i] = i * ds - x;                // dx: how much shorter the spine reads up to here
    }
    const f = cfg.anchor * SPINE_N, j = Math.min(SPINE_N - 1, Math.floor(f)), r = f - j;
    const z0 = t.z[j] + (t.z[j + 1] - t.z[j]) * r, d0 = t.dx[j] + (t.dx[j + 1] - t.dx[j]) * r;
    for (let i = 0; i <= SPINE_N; i++) { t.z[i] -= z0; t.dx[i] -= d0; t.a[i] = -t.a[i]; }   // a: yaw with x toward the head
}

/** Read the spine table at s (0 head .. 1 tail) into o.z, o.a, o.dx (body lengths, radians). */
export function spineAt(t, s, o) {
    const f = Math.min(1, Math.max(0, s)) * SPINE_N, i = Math.min(SPINE_N - 1, Math.floor(f)), r = f - i;
    o.z = t.z[i] + (t.z[i + 1] - t.z[i]) * r;
    o.a = t.a[i] + (t.a[i + 1] - t.a[i]) * r;
    o.dx = t.dx[i] + (t.dx[i + 1] - t.dx[i]) * r;
}

/** Turn a posed part about the vertical axis through (px, pz) by `a` (the spine's yaw at its root), shifted by dz in depth. */
export function yawPart(card, out, px, a, dz) {
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let i = 0; i < card.n; i++) {
        const X = out.x[i] - px, Z = out.z[i];
        out.x[i] = px + X * ca - Z * sa; out.z[i] = X * sa + Z * ca + dz;
        const nx = out.nx[i], nz = out.nz[i];
        out.nx[i] = nx * ca - nz * sa; out.nz[i] = nx * sa + nz * ca;
    }
}

/**
 * How each kind of part moves, as amplitudes in radians at full effort. Calm by default (user,
 * 2026-11-14: "less hyperactive wiggling, sedate, natural; wiggle only if warranted"):
 *   idle   share of the motion left while hovering (pectorals keep sculling gently, a tail rests)
 *   swing  about the root line (out of the picture plane: sculling, beating, leaning)
 *   sweep  in the picture plane about the root (a stroke)
 *   wave   bend that runs out along the part (k = waves along it)
 *   speed  cycle speed relative to the swim cycle
 *   outward  paired fins and flippers swing only away from the body (a near fin toward the
 *            viewer, a far one away), so a card never passes through the body; median fins,
 *            tails and skirts lie beyond the body and swing both ways.
 */
export const ROLES = {
    tail:      { swing: 0.38, sweep: 0.06, wave: 0.26, k: 2.2, speed: 1, idle: 0.04 },      // a visible beat in the picture: the bend (wave) grows toward the tip, the root stays put
    median:    { swing: 0.12, sweep: 0.03, wave: 0.07, k: 2.6, speed: 1, idle: 0.15 },
    pectoral:  { swing: 0.55, sweep: 0.08, wave: 0.06, k: 2.0, speed: 1.15, idle: 0.25, outward: true },
    // fold: the wing is painted spread; folded (m.fold 1, under water) it turns `angle` of the way
    // back along the body, closes across its width like a fan (`narrow`) and only a little in length
    // (`shrink`), trailing along the body; in the air it spreads again (user: not just rescaled).
    wing:      { swing: 0.12, sweep: 0.03, wave: 0.03, k: 1.6, speed: 0.55, idle: 0, outward: true, fold: { angle: 0.95, shrink: 0.12, narrow: 0.62 } },
    flipper:   { swing: 0.35, sweep: 0.28, wave: 0.06, k: 1.8, speed: 0.55, idle: 0.08, outward: true },
    head:      { swing: 0.015, sweep: 0.008, wave: 0, k: 0, speed: 0.3, idle: 0.15 },   // steady (user: "less wobbly head")
    fan:       { swing: 0.05, sweep: 0.02, wave: 0.06, k: 3.0, speed: 0.9, idle: 0.25 },
    tentacles: { swing: 0.05, sweep: 0.03, wave: 0.14, k: 3.4, speed: 0.9, idle: 0.5 },
    curl:      { swing: 0.03, sweep: 0.04, wave: 0.1, k: 2.0, speed: 0.7, idle: 0.3 },
    // Ray wings seen from the side beat up and down in the picture plane. The beat is a bend that grows
    // from root to tip (wave; the tips lag) with only a little turn of the whole wing (sweep), so the
    // root stays attached to the body (user: no gap at the wing roots); about 0.4 Hz at a manta's effort.
    flap:      { swing: 0.1, sweep: 0, wave: 0.58, k: 1.0, speed: 0.32, idle: 0.85 }      // no sweep: turning the whole wing in the plane moved its root and bared the body under it (torn shards at the manta's head); the wave bends it from a still root
};

/** Triangle strip over a (cols x rows)-cell grid (rows joined by degenerate triangles): node index per strip vertex. */
export function gridStrip(cols, rows) {
    const S = cols + 1, out = [];
    for (let r = 0; r < rows; r++) {
        if (r > 0) out.push(r * S + cols, r * S);
        for (let c = 0; c <= cols; c++) out.push(r * S + c, (r + 1) * S + c);
    }
    return out;
}

/** Bilinear sample of the bulge map (0..1) at picture u, v (0..1). */
export function heightAt(map, u, v) {
    const { cols, rows, data } = map;
    const x = Math.min(cols - 1, Math.max(0, u * cols - 0.5)), y = Math.min(rows - 1, Math.max(0, v * rows - 0.5));
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(cols - 1, x0 + 1), y1 = Math.min(rows - 1, y0 + 1);
    const a = x - x0, b = y - y0;
    return (data[y0 * cols + x0] * (1 - a) + data[y0 * cols + x1] * a) * (1 - b) + (data[y1 * cols + x0] * (1 - a) + data[y1 * cols + x1] * a) * b;
}

/**
 * The fixed geometry of one card: grid nodes in the card (u, v 0..1 over its rect), their
 * place relative to the pivot (picture px), rest depth and normal, and t = how far out from
 * the pivot (0 at the root .. 1 at the farthest node).
 */
export function makeCard({ rect, pivot, size, height, bulgePx, cols, rows }) {
    const [x0, y0, w, h] = rect, [W, H] = size, n = (cols + 1) * (rows + 1);
    const c = { cols, rows, n, strip: gridStrip(cols, rows), pivot: [pivot[0] - W / 2, pivot[1] - H / 2] };
    for (const k of ['u', 'v', 'lx', 'ly', 'z', 'nx', 'ny', 'nz', 't']) c[k] = new Float32Array(n);
    let far = 1e-6;
    for (let r = 0; r <= rows; r++) for (let q = 0; q <= cols; q++) {
        const i = r * (cols + 1) + q, u = q / cols, v = r / rows;
        const px = x0 + u * w, py = y0 + v * h;
        c.u[i] = u; c.v[i] = v;
        c.lx[i] = px - pivot[0]; c.ly[i] = py - pivot[1];
        if (height) {
            const pu = px / W, pv = py / H, e = 1 / height.cols;
            c.z[i] = heightAt(height, pu, pv) * bulgePx;
            // Normal of the bulge: from its slope (per picture px).
            const dx = (heightAt(height, pu + e, pv) - heightAt(height, pu - e, pv)) * bulgePx / (2 * e * W);
            const dy = (heightAt(height, pu, pv + e) - heightAt(height, pu, pv - e)) * bulgePx / (2 * e * H);
            const L = Math.hypot(dx, dy, 1);
            c.nx[i] = -dx / L; c.ny[i] = -dy / L; c.nz[i] = 1 / L;
        } else c.nz[i] = 1;
        far = Math.max(far, Math.hypot(c.lx[i], c.ly[i]));
    }
    for (let i = 0; i < n; i++) c.t[i] = Math.hypot(c.lx[i], c.ly[i]) / far;
    return c;
}

/**
 * Which way a positive swing about the hinge moves the card's middle in z, times where the
 * card should go (+1 a near part toward the viewer, -1 a far one away).
 */
export function outwardSign(card, part) {
    if (card.out === undefined) {
        let cx = 0, cy = 0;
        for (let i = 0; i < card.n; i++) { cx += card.lx[i]; cy += card.ly[i]; }
        const [ax, ay] = part.axis;
        card.out = Math.sign(ax * cy - ay * cx) || 1;
    }
    return card.out * (part.z >= 0 ? 1 : -1);
}

/** The in-plane turn (radians) that lays a card back along the body: its middle toward the tail (-x). */
function foldTurn(card) {
    if (card.foldTo === undefined) {
        let cx = 0, cy = 0;
        for (let i = 0; i < card.n; i++) { cx += card.lx[i]; cy += card.ly[i]; }
        const a = Math.atan2(cy, cx), back = a >= 0 ? Math.PI : -Math.PI;
        card.foldTo = back - a;
    }
    return card.foldTo;
}

/** The unit direction from a card's pivot to its middle (cached): the axis a folding wing closes across. */
function mainDir(card) {
    if (card.dir === undefined) {
        let cx = 0, cy = 0;
        for (let i = 0; i < card.n; i++) { cx += card.lx[i]; cy += card.ly[i]; }
        const l = Math.hypot(cx, cy) || 1;
        card.dir = [cx / l, cy / l];
    }
    return card.dir;
}

/** A folded point: closed across the card's main direction (q.nw), shortened along it (q.fl), then turned (q.fa); writes [x, y] into o. */
function foldPoint(card, lx, ly, q, o) {
    if (!q.nw && q.fl === 1 && !q.fa) { o[0] = lx; o[1] = ly; return o; }
    const [dx, dy] = mainDir(card), u = (lx * dx + ly * dy) * q.fl, v = (-lx * dy + ly * dx) * (1 - q.nw);
    const x = u * dx - v * dy, y = u * dy + v * dx, c = Math.cos(q.fa), sn = Math.sin(q.fa);
    o[0] = x * c - y * sn; o[1] = x * sn + y * c;
    return o;
}
const FP = [0, 0];

/** Rotate (x, y, z) about the unit axis (ax, ay, 0) by angle a; writes into o. */
function aboutAxis(x, y, z, ax, ay, a, o) {
    const c = Math.cos(a), s = Math.sin(a), d = (ax * x + ay * y) * (1 - c);
    o[0] = x * c + ay * z * s + ax * d;
    o[1] = y * c - ax * z * s + ay * d;
    o[2] = z * c + (ax * y - ay * x) * s;
}

const P = [0, 0, 0], N = [0, 0, 0];

/**
 * Pose a part card for this frame into out.{x,y,z,nx,ny,nz} (picture space, centre origin).
 * m: { phase, drive, fold (0 spread .. 1 folded) } of the rig; part: { role, axis:[ax,ay], amp, phase, z (px) };
 * at: [x, y] where its pivot is now (the body's bend carries it); mirror: the far twin.
 */
export function posePart(card, part, m, at, mirror, out, turn = 0) {
    const q = motion(card, part, m, MOTION), { R, effort, ph, swing } = q, [ax, ay] = part.axis;
    for (let i = 0; i < card.n; i++) {
        const t = card.t[i];
        // Fold first (in the picture plane, about the root), then swing about the hinge (depth
        // comes only from it, so it stays on its side), then stroke and undulation in the plane
        // (plus `turn`: the in-plane angle of the part it hangs on, see carryPoint).
        foldPoint(card, card.lx[i], card.ly[i], q, FP);
        aboutAxis(FP[0], FP[1], 0, ax, ay, swing, P);
        aboutAxis(0, 0, 1, ax, ay, swing, N);
        const a = q.sweep + turn + R.wave * effort * Math.sin(ph - R.k * t) * t;
        const ca = Math.cos(a), sa = Math.sin(a);
        const zs = mirror ? -1 : 1;
        out.x[i] = at[0] + P[0] * ca - P[1] * sa; out.y[i] = at[1] + P[0] * sa + P[1] * ca; out.z[i] = (part.z + P[2]) * zs;
        out.nx[i] = N[0] * ca - N[1] * sa; out.ny[i] = N[0] * sa + N[1] * ca; out.nz[i] = N[2] * zs;
        out.rz[i] = part.z * zs;        // rest depth and normal: perspective and light only show the change
        out.rnx[i] = 0; out.rny[i] = 0; out.rnz[i] = zs;
    }
}

const MOTION = {};

/** This frame's motion of a part (shared by posePart and carryPoint); written into o. */
function motion(card, part, m, o) {
    const R = ROLES[part.role] || ROLES.median;
    const effort = (R.idle + (1 - R.idle) * m.drive) * part.amp;
    const ph = m.phase * R.speed + part.phase * Math.PI * 2;
    const beat = Math.sin(ph + 0.6);
    const f = R.fold && m.fold ? m.fold : 0;
    o.fa = f ? R.fold.angle * f * foldTurn(card) : 0; o.fl = 1 - (f ? R.fold.shrink * f : 0); o.nw = f ? (R.fold.narrow || 0) * f : 0;
    o.R = R; o.effort = effort; o.ph = ph;
    o.swing = R.swing * effort * (R.outward ? (0.5 + 0.5 * beat) * outwardSign(card, part) : beat);
    o.sweep = R.sweep * effort * Math.sin(ph);
    return o;
}

/**
 * Where a point fixed to a part (lx, ly: picture px from its pivot, e.g. the pivot of a part that
 * hangs on it) is this frame, and the part's in-plane angle there: o.{x, y, a}. A child part
 * (spec `parent`) is posed at that point and turned by that angle, so a head rides on its neck.
 */
export function carryPoint(card, part, m, at, lx, ly, turn, o) {
    const q = motion(card, part, m, MOTION), [ax, ay] = part.axis;
    foldPoint(card, lx, ly, q, FP);
    aboutAxis(FP[0], FP[1], 0, ax, ay, q.swing, P);
    const a = q.sweep + turn + q.R.wave * q.effort * Math.sin(q.ph - q.R.k);
    const ca = Math.cos(a), sa = Math.sin(a);
    o.x = at[0] + P[0] * ca - P[1] * sa; o.y = at[1] + P[0] * sa + P[1] * ca; o.a = a;
    return o;
}

/** Arrays a posed card is written into. */
export function posedBuffers(n) {
    const o = {};
    for (const k of ['x', 'y', 'z', 'nx', 'ny', 'nz', 'rz', 'rnx', 'rny', 'rnz']) o[k] = new Float32Array(n);
    return o;
}

/** Pose the body card: its bulge plus the style's bend (`bend(u, v, o)` in picture px). */
export function poseBody(card, bend, size, out) {
    const [W, H] = size, o = { x: 0, y: 0, z: 0, a: 0 };
    for (let i = 0; i < card.n; i++) {
        const x = card.pivot[0] + card.lx[i], y = card.pivot[1] + card.ly[i];
        bend(x / W + 0.5, y / H + 0.5, o);
        // A sideways bend (o.z, o.a: the spine wave) moves the point in depth and turns its cross-section.
        const ca = Math.cos(o.a), sa = Math.sin(o.a), nx = card.nx[i], nz = card.nz[i], zb = card.z[i];
        out.x[i] = x + o.x - zb * sa; out.y[i] = y + o.y; out.z[i] = zb * ca + o.z;
        out.nx[i] = nx * ca - nz * sa; out.ny[i] = card.ny[i]; out.nz[i] = nx * sa + nz * ca;
        out.rz[i] = card.z[i];
        out.rnx[i] = card.nx[i]; out.rny[i] = card.ny[i]; out.rnz[i] = card.nz[i];
    }
}

const LIGHT = (() => { const [x, y, z] = CARDS.light, L = Math.hypot(x, y, z); return [x / L, y / L, z / L]; })();

/**
 * Project a posed card to the screen: yaw about the vertical axis, a perspective that only
 * shows the change from rest, the facing mirror, squash, rotation, scale and position.
 * Writes strip vertices (x, y pairs), and per strip vertex a brightness (0..1) and alpha.
 *   v: { yaw, facing, rotation, sx, sy (scale along / across, squash included), x, y,
 *        dist (camera distance, px), fade (fins fade edge-on), dark (brightness factor) }
 */
export function project(card, posed, v, verts, bright, alpha, hue = null) {
    const cy = Math.cos(v.yaw), sy = Math.sin(v.yaw), cr = Math.cos(v.rotation), sr = Math.sin(v.rotation);
    const wide = turnWidth(v.yaw);      // never paper-thin, except right at the mirror
    const kx = v.sx * v.facing, ky = v.sy;
    const strip = card.strip;
    for (let s = 0; s < strip.length; s++) {
        const i = strip[s];
        const X = posed.x[i], Z = posed.z[i];
        // Near edge-on the depth's share of the width fades, so the mirror at edge-on is seamless.
        const x1 = X * wide + Z * sy * Math.min(1, Math.abs(cy) * 3), z1 = -X * sy + Z * cy;
        const rest = posed.rz[i];
        const p = v.dist / (v.dist - (z1 - rest));
        const lx = x1 * p * kx, ly = posed.y[i] * p * ky;
        verts[s * 2] = v.x + lx * cr - ly * sr;
        verts[s * 2 + 1] = v.y + lx * sr + ly * cr;
        // Light: the normal turns with the yaw; only the change from rest shades (the art is lit already).
        const nx = posed.nx[i], nz = posed.nz[i];
        const nx1 = (nx * cy + nz * sy) * v.facing, nz1 = -nx * sy + nz * cy;
        const now = nx1 * LIGHT[0] + posed.ny[i] * LIGHT[1] + nz1 * LIGHT[2];
        const was = posed.rnx[i] * v.facing * LIGHT[0] + posed.rny[i] * LIGHT[1] + posed.rnz[i] * LIGHT[2];
        let b = Math.min(1, Math.max(CARDS.shadeMin, 1 - CARDS.shade * (was - now)));
        if (nz1 < 0) b *= CARDS.backside;
        bright[s] = b * v.dark;
        if (hue) hue[s] = sheenHue(nx1, posed.ny[i], X, posed.y[i], 0);   // rainbow sheen (game/rig/sheen.js)
        alpha[s] = v.fade ? smooth(CARDS.edgeFade[0], CARDS.edgeFade[1], Math.abs(nz1)) : 1;
    }
}

/** How wide a card reads at yaw (share of its width): its cosine, but never paper-thin except right at the mirror (CARDS.turnMin). */
export function turnWidth(yaw) {
    const cy = Math.cos(yaw);
    return Math.max(cy, CARDS.turnMin[0] * smooth(0, CARDS.turnMin[1], Math.abs(cy)));
}

function smooth(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

/**
 * Yaw (radians) and facing during a turn-around that started `t` (0..1) ago from `from`
 * facing: the nose swings toward the viewer up to CARDS.turnMax, the picture mirrors there
 * (the 2.5D mesh only holds up for limited angles, so it is never seen edge-on), and it
 * swings back to rest on the other side, nose still leading toward the viewer.
 */
export function turnPose(t, from, max = CARDS.turnMax) {
    const e = t * t * (3 - 2 * t);
    if (e < 0.5) return { yaw: -max * (e / 0.5), facing: from };
    return { yaw: -max * (1 - (e - 0.5) / 0.5), facing: -from };
}
