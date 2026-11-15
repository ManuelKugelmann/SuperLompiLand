// A flock of friends (user 2026-11-15: "Boid / flock of friends"): every friend aims at its place along
// Lompi's path (followTrail.js chainAt) but moves like a schooling fish: a soft spring to that place,
// keeping its distance from the other friends, and swimming the way Lompi swims. No friend overlaps
// another, the group stays loose and alive, and it still trails Lompi. Pure, no Phaser.

export const FLOCK = {
    seek: 5,          // 1/s^2: pull toward its place along the path (a spring) ...
    damp: 3.6,        // 1/s: ... damped toward Lompi's velocity, so it settles without overshooting or lagging
    sepR: 160,        // px: another friend closer than this pushes it away ...
    sep: 2200,        // px/s^2 at contact, falling to 0 at sepR
    align: 1.4,       // 1/s: how strongly it takes on Lompi's swimming velocity
    maxSpeed: 1100,   // px/s: the fastest a friend swims (it can always catch a sprinting Lompi)
    maxDt: 0.05       // s: a long frame is taken in steps of at most this
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
