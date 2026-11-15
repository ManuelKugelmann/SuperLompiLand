// A flock of friends as boids (user 2026-11-15: "Boid / flock of friends", then "Chain => boids"): no
// fixed places. All friends are drawn to one point on Lompi's path a little behind him (cohesion), keep
// apart from each other (separation) and swim the way that point moves (alignment), so the group stays a
// loose, living school that swings round after him when he turns. Lompi himself is swum round, sideways.
// Pure, no Phaser.

export const FLOCK = {
    behind: 330,      // px back along Lompi's path: the point the flock gathers round
    sway: 22,         // px each friend sways up and down, one wave per bar of the music travelling through the flock (spec 5.0z)
    seek: 5,          // 1/s^2: pull toward the flock's point (a spring) ...
    damp: 3.6,        // 1/s: ... damped toward that point's velocity, so it settles without overshooting or lagging
    sepR: 320,        // px: another friend closer than this pushes it away (about a friend's body width) ...
    sep: 2200,        // px/s^2 at contact, falling to 0 at sepR
    align: 1.4,       // 1/s: how strongly it takes on that point's velocity
    maxSpeed: 1100,   // px/s: the fastest a friend swims (it can always catch a sprinting Lompi)
    maxDt: 0.05,      // s: a long frame is taken in steps of at most this
    minGap: 210,      // px (about a friend's width): closer than this two friends are eased apart (firm limit, e.g. in a sharp U-turn) ...
    share: 0.4,       // ... this share of the overlap per step ...
    floor: 0.8,       // ... and never closer than this x minGap
    fixedGap: 170     // px friends keep from Lompi himself (they never cover him)
};

/**
 * One step for friend `a` ({ x, y, vx, vy }, px and px/s): toward `target` ({ x, y }), apart from
 * `others` (the other friends, [{ x, y }]; `a` itself may be in the list), along `lead`'s velocity
 * ({ vx, vy } px/s). `dt` in s. Moves `a` and returns it.
 */
export function flockStep(a, target, others, lead, dt, cfg = FLOCK) {
    for (let left = Math.max(0, dt); left > 1e-6; left -= cfg.maxDt) {
        const h = Math.min(cfg.maxDt, left);
        // Damped toward the lead's velocity (not toward standing still): a moving flock does not fall behind.
        let ax = cfg.seek * (target.x - a.x) + (cfg.damp + cfg.align) * (lead.vx - a.vx);
        let ay = cfg.seek * (target.y - a.y) + (cfg.damp + cfg.align) * (lead.vy - a.vy);
        for (const o of others) {
            if (o === a) continue;
            const dx = a.x - o.x, dy = a.y - o.y, d = Math.hypot(dx, dy);
            if (d >= cfg.sepR) continue;
            const push = cfg.sep * (1 - d / cfg.sepR), nx = d > 1e-6 ? dx / d : 1, ny = d > 1e-6 ? dy / d : 0;
            ax += nx * push; ay += ny * push;
        }
        a.vx += ax * h; a.vy += ay * h;
        const sp = Math.hypot(a.vx, a.vy);
        if (sp > cfg.maxSpeed) { a.vx *= cfg.maxSpeed / sp; a.vy *= cfg.maxSpeed / sp; }
        a.x += a.vx * h; a.y += a.vy * h;
    }
    return a;
}

/**
 * The firm limit under the soft separation (techartist review: in a sharp U-turn friends on the same side
 * met head-on). For every other friend closer than `minGap` to `a`: their approach along the line between
 * them stops (an inelastic touch, so the spring cannot push them back in) and `share` of the overlap is
 * taken out this step, but never closer than `floor` x minGap. Smooth: no one-frame pops. `fixed` ({ x, y, vx, vy })
 * is Lompi: friends keep `fixedGap` from him, stepping aside out of his way, and he is never moved. Moves `a` (and the others); returns `a`.
 */
export function keepApart(a, others, fixed = null, cfg = FLOCK) {
    for (const o of others) {
        if (o === a) continue;
        const dx = a.x - o.x, dy = a.y - o.y, d = Math.hypot(dx, dy);
        if (d >= cfg.minGap) continue;
        const nx = d > 1e-6 ? dx / d : 0, ny = d > 1e-6 ? dy / d : 1;
        const closing = ((a.vx || 0) - (o.vx || 0)) * nx + ((a.vy || 0) - (o.vy || 0)) * ny;
        if (closing < 0) { a.vx -= nx * closing / 2; a.vy -= ny * closing / 2; o.vx += nx * closing / 2; o.vy += ny * closing / 2; }
        const half = Math.max((cfg.minGap - d) * cfg.share, cfg.minGap * cfg.floor - d, 0) / 2;
        a.x += nx * half; a.y += ny * half; o.x -= nx * half; o.y -= ny * half;
    }
    if (fixed) {
        const dx = a.x - fixed.x, dy = a.y - fixed.y, d = Math.hypot(dx, dy);
        if (d < cfg.fixedGap) {
            // Out of his way to the side it is already on (techartist: pushed straight away, friends were
            // bulldozed ahead of him and turned back); standing still, simply away from him.
            const fv = Math.hypot(fixed.vx || 0, fixed.vy || 0);
            let nx = d > 1e-6 ? dx / d : 0, ny = d > 1e-6 ? dy / d : 1;
            if (fv > 1e-6) {
                const px = -(fixed.vy || 0) / fv, py = (fixed.vx || 0) / fv, side = dx * px + dy * py >= 0 ? 1 : -1;
                nx = px * side; ny = py * side;
            }
            const closing = (a.vx || 0) * nx + (a.vy || 0) * ny;
            if (closing < 0) { a.vx -= nx * closing; a.vy -= ny * closing; }
            const move = Math.max((cfg.fixedGap - d) * cfg.share, cfg.fixedGap * cfg.floor - d, 0);
            a.x += nx * move; a.y += ny * move;
        }
    }
    return a;
}
