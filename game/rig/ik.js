// Inverse kinematics for parts that touch or grab the world: walking legs,
// fin-feet, tentacle tips, grabbing tails. Everything else stays forward
// animation + springs (Rig, rig/soft.js).
// Pure maths, no Phaser (tests/ik.test.mjs).
//
// The level is only seen through a ground probe:
//   probe(x, y) -> { x, y } the spot on the terrain contour for a foot aimed at
//                  (x, y), or null when there is no ground in reach.

/**
 * Two-bone leg: hip at (ax, ay), foot wanted at (tx, ty), bone lengths l1, l2.
 * `bend` = 1 or -1 picks the side the knee points to.
 * An unreachable target gives a fully stretched (or fully folded) leg toward it.
 * @returns { jx, jy, ex, ey, reached }  knee, foot, and whether the foot is on the target
 */
export function twoBone(ax, ay, tx, ty, l1, l2, bend = 1) {
    const dx = tx - ax, dy = ty - ay, dist = Math.hypot(dx, dy);
    const far = l1 + l2, near = Math.abs(l1 - l2);
    const d = Math.min(far - 1e-6, Math.max(near + 1e-6, dist));
    const base = dist > 1e-9 ? Math.atan2(dy, dx) : 0;
    // Law of cosines: angle at the hip between the target direction and the first bone.
    const hip = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
    const a = base + hip * bend;
    const jx = ax + Math.cos(a) * l1, jy = ay + Math.sin(a) * l1;
    const ex = ax + Math.cos(base) * d, ey = ay + Math.sin(base) * d;
    return { jx, jy, ex, ey, reached: dist <= far && dist >= near };
}

/**
 * FABRIK for a chain (tentacle, arm, tail): `xs`/`ys` are the joints, the first
 * one is the fixed root; they are moved in place so the tip reaches (tx, ty)
 * while every link keeps its length. An unreachable target stretches the chain
 * straight toward it.
 * @returns true when the tip ended within `tolerance` of the target
 */
export function fabrik(xs, ys, tx, ty, iterations = 6, tolerance = 0.5) {
    const n = xs.length - 1;
    if (n < 1) return false;
    const len = new Float32Array(n);
    let total = 0;
    for (let i = 0; i < n; i++) { len[i] = Math.hypot(xs[i + 1] - xs[i], ys[i + 1] - ys[i]); total += len[i]; }
    const rx = xs[0], ry = ys[0], dist = Math.hypot(tx - rx, ty - ry);
    if (dist >= total) {                       // out of reach: a straight line toward the target
        const ux = dist > 1e-9 ? (tx - rx) / dist : 1, uy = dist > 1e-9 ? (ty - ry) / dist : 0;
        for (let i = 0, run = 0; i < n; i++) { run += len[i]; xs[i + 1] = rx + ux * run; ys[i + 1] = ry + uy * run; }
        return dist - total <= tolerance;
    }
    const place = (i, j, l) => {               // put joint i at distance l from joint j, keeping its direction
        const dx = xs[i] - xs[j], dy = ys[i] - ys[j], d = Math.hypot(dx, dy) || 1e-9;
        xs[i] = xs[j] + dx / d * l; ys[i] = ys[j] + dy / d * l;
    };
    for (let it = 0; it < iterations; it++) {
        xs[n] = tx; ys[n] = ty;
        for (let i = n - 1; i >= 0; i--) place(i, i + 1, len[i]);       // backward: from the tip
        xs[0] = rx; ys[0] = ry;
        for (let i = 1; i <= n; i++) place(i, i - 1, len[i - 1]);       // forward: from the root
        if (Math.hypot(xs[n] - tx, ys[n] - ty) <= tolerance) return true;
    }
    return Math.hypot(xs[n] - tx, ys[n] - ty) <= tolerance;
}

/** A foot that stays planted on the ground until the body has moved too far from it. */
export function makeFoot(x, y) {
    return { x, y, planted: true, fromX: x, fromY: y, toX: x, toY: y, t: 0 };
}

/**
 * Advance one foot.
 * @param home   { x, y } where the foot would rest right now (under its hip)
 * @param o.reach     the foot steps when it is farther than this from home
 *                    (o.reachY for a flatter ellipse: feet tolerate less height error)
 * @param o.lead      { x, y } added to home for the landing spot (walk velocity x step time)
 * @param o.stepTime  seconds one step takes       @param o.lift  how high the foot arcs
 * @param o.dt        seconds since the last call
 * @param o.mayStep   false while the other leg group is in the air
 * @param o.probe     ground probe (see top); null result = keep the foot where it is
 * @returns true while the foot is in the air
 */
export function stepFoot(foot, home, { reach, reachY = reach, lead = { x: 0, y: 0 }, stepTime = 0.18, lift = 12, dt, mayStep = true, probe }) {
    if (foot.planted) {
        const ex = (foot.x - home.x) / reach, ey = (foot.y - home.y) / reachY;
        if (ex * ex + ey * ey <= 1 || !mayStep) return false;
        const spot = probe(home.x + lead.x, home.y + lead.y);
        if (!spot) return false;
        foot.planted = false;
        foot.fromX = foot.x; foot.fromY = foot.y;
        foot.toX = spot.x; foot.toY = spot.y;
        foot.t = 0;
    }
    foot.t = Math.min(1, foot.t + dt / stepTime);
    const s = foot.t * foot.t * (3 - 2 * foot.t);
    foot.x = foot.fromX + (foot.toX - foot.fromX) * s;
    foot.y = foot.fromY + (foot.toY - foot.fromY) * s - Math.sin(Math.PI * foot.t) * lift;
    if (foot.t >= 1) { foot.planted = true; foot.x = foot.toX; foot.y = foot.toY; }
    return !foot.planted;
}
