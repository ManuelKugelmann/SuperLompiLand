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

export const CARDS = {
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
    turnMs: 300,            // a turn-around (nose swings toward the viewer, through edge-on)
    sway: 0.012,            // idle yaw rocking (radians) ...
    swayMore: 0.03,         // ... plus this much at full effort
    driveCurve: 1.6,        // effort is eased in: light swimming moves little, only real effort moves a lot
    cycle: [0.04, 0.3]      // swim cycle speed (radians per step) at rest and at full effort
};

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
    tail:      { swing: 0.38, sweep: 0.04, wave: 0.1, k: 2.2, speed: 1, idle: 0.04 },
    median:    { swing: 0.12, sweep: 0.03, wave: 0.07, k: 2.6, speed: 1, idle: 0.15 },
    pectoral:  { swing: 0.55, sweep: 0.08, wave: 0.06, k: 2.0, speed: 1.15, idle: 0.25, outward: true },
    wing:      { swing: 0.12, sweep: 0.03, wave: 0.03, k: 1.6, speed: 0.55, idle: 0, outward: true },
    flipper:   { swing: 0.35, sweep: 0.28, wave: 0.06, k: 1.8, speed: 0.55, idle: 0.08, outward: true },
    head:      { swing: 0.04, sweep: 0.02, wave: 0, k: 0, speed: 0.3, idle: 0.3 },
    fan:       { swing: 0.05, sweep: 0.02, wave: 0.06, k: 3.0, speed: 0.9, idle: 0.25 },
    tentacles: { swing: 0.05, sweep: 0.03, wave: 0.14, k: 3.4, speed: 0.9, idle: 0.5 },
    curl:      { swing: 0.03, sweep: 0.04, wave: 0.1, k: 2.0, speed: 0.7, idle: 0.3 },
    flap:      { swing: 0.42, sweep: 0.04, wave: 0.16, k: 1.4, speed: 0.6, idle: 0.35 }   // ray wings: slow, wide beats up and down
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
 * m: { phase, drive } of the rig; part: { role, axis:[ax,ay], amp, phase, z (px) };
 * at: [x, y] where its pivot is now (the body's bend carries it); mirror: the far twin.
 */
export function posePart(card, part, m, at, mirror, out) {
    const R = ROLES[part.role] || ROLES.median;
    const effort = (R.idle + (1 - R.idle) * m.drive) * part.amp;
    const ph = m.phase * R.speed + part.phase * Math.PI * 2;
    const beat = Math.sin(ph + 0.6);
    const swing = R.swing * effort * (R.outward ? (0.5 + 0.5 * beat) * outwardSign(card, part) : beat);
    const sweep = R.sweep * effort * Math.sin(ph);
    const [ax, ay] = part.axis;
    for (let i = 0; i < card.n; i++) {
        const t = card.t[i];
        // Swing about the hinge first (depth comes only from it, so it stays on its side),
        // then stroke and undulation in the picture plane.
        aboutAxis(card.lx[i], card.ly[i], 0, ax, ay, swing, P);
        aboutAxis(0, 0, 1, ax, ay, swing, N);
        const a = sweep + R.wave * effort * Math.sin(ph - R.k * t) * t;
        const ca = Math.cos(a), sa = Math.sin(a);
        const zs = mirror ? -1 : 1;
        out.x[i] = at[0] + P[0] * ca - P[1] * sa; out.y[i] = at[1] + P[0] * sa + P[1] * ca; out.z[i] = (part.z + P[2]) * zs;
        out.nx[i] = N[0] * ca - N[1] * sa; out.ny[i] = N[0] * sa + N[1] * ca; out.nz[i] = N[2] * zs;
        out.rz[i] = part.z * zs;        // rest depth and normal: perspective and light only show the change
        out.rnx[i] = 0; out.rny[i] = 0; out.rnz[i] = zs;
    }
}

/** Arrays a posed card is written into. */
export function posedBuffers(n) {
    const o = {};
    for (const k of ['x', 'y', 'z', 'nx', 'ny', 'nz', 'rz', 'rnx', 'rny', 'rnz']) o[k] = new Float32Array(n);
    return o;
}

/** Pose the body card: its bulge plus the style's bend (`bend(u, v, o)` in picture px). */
export function poseBody(card, bend, size, out) {
    const [W, H] = size, o = { x: 0, y: 0 };
    for (let i = 0; i < card.n; i++) {
        const x = card.pivot[0] + card.lx[i], y = card.pivot[1] + card.ly[i];
        bend(x / W + 0.5, y / H + 0.5, o);
        out.x[i] = x + o.x; out.y[i] = y + o.y; out.z[i] = card.z[i];
        out.nx[i] = card.nx[i]; out.ny[i] = card.ny[i]; out.nz[i] = card.nz[i];
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
export function project(card, posed, v, verts, bright, alpha) {
    const cy = Math.cos(v.yaw), sy = Math.sin(v.yaw), cr = Math.cos(v.rotation), sr = Math.sin(v.rotation);
    const kx = v.sx * v.facing, ky = v.sy;
    const strip = card.strip;
    for (let s = 0; s < strip.length; s++) {
        const i = strip[s];
        const X = posed.x[i], Z = posed.z[i];
        // Near edge-on the depth's share of the width fades, so the mirror at edge-on is seamless.
        const x1 = X * cy + Z * sy * Math.min(1, Math.abs(cy) * 3), z1 = -X * sy + Z * cy;
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
        alpha[s] = v.fade ? smooth(CARDS.edgeFade[0], CARDS.edgeFade[1], Math.abs(nz1)) : 1;
    }
}

function smooth(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

/**
 * Yaw (radians) and facing during a turn-around that started `t` (0..1) ago from `from`
 * facing: the nose swings toward the viewer to edge-on, the picture mirrors there, and it
 * swings on to rest on the other side, nose still leading toward the viewer. At the mirror
 * both halves agree (project() lets the depth's share of the width fade out near edge-on).
 */
export function turnPose(t, from) {
    const e = t * t * (3 - 2 * t);
    if (e < 0.5) return { yaw: -Math.PI / 2 * (e / 0.5), facing: from };
    return { yaw: -Math.PI / 2 * (1 - (e - 0.5) / 0.5), facing: -from };
}
