// Hanging chains and lines as verlet ropes: pinned at the top, a weight at the bottom,
// swaying with the swell and pushed aside by whoever swims through.
//
// Pure maths, no Phaser (tests/rope.test.mjs). Positions in world px, one step per frame.

export const ROPE = {
    segment: 64,        // px between two nodes
    gravity: 0.3,       // downward pull per step
    damping: 0.94,      // velocity kept per step: water stops a swinging chain quickly
    iterations: 4,      // constraint passes per step
    tipWeight: 0.15,    // how much of a correction the weighted end takes (1 = as light as a link)
    sway: 0.05,         // sideways push of the swell at the free end
    pushRadius: 120,    // a body this close shoves the links aside ...
    push: 0.35          // ... by this share of its own speed
};

/** A straight rope hanging from (x, y0) down to (x, y1). */
export function createRope(x, y0, y1, cfg = ROPE) {
    const n = Math.max(2, Math.round((y1 - y0) / cfg.segment) + 1), seg = (y1 - y0) / (n - 1);
    const r = { n, seg, x: new Float32Array(n), y: new Float32Array(n), px: new Float32Array(n), py: new Float32Array(n) };
    for (let i = 0; i < n; i++) { r.x[i] = r.px[i] = x; r.y[i] = r.py[i] = y0 + seg * i; }
    return r;
}

/**
 * One step. `t` in seconds (swell); `body` = { x, y, vx, vy } of a swimmer or null.
 * The top node never moves.
 */
export function stepRope(r, t, body, cfg = ROPE) {
    const { n, x, y, px, py } = r, last = n - 1;
    for (let i = 1; i < n; i++) {
        const f = i / last;
        let vx = (x[i] - px[i]) * cfg.damping, vy = (y[i] - py[i]) * cfg.damping;
        vx += Math.sin(t * 0.8 + x[0] * 0.01 + f * 1.5) * cfg.sway * f;
        vy += cfg.gravity;
        if (body) {
            const dx = x[i] - body.x, dy = y[i] - body.y, d = Math.hypot(dx, dy);
            if (d < cfg.pushRadius) {
                const k = (1 - d / cfg.pushRadius) * cfg.push;
                vx += body.vx * k; vy += body.vy * k;
            }
        }
        px[i] = x[i]; py[i] = y[i];
        x[i] += vx; y[i] += vy;
    }
    for (let pass = 0; pass < cfg.iterations; pass++) {
        for (let i = 0; i < last; i++) {
            const dx = x[i + 1] - x[i], dy = y[i + 1] - y[i], d = Math.hypot(dx, dy) || 1;
            const off = (d - r.seg) / d;
            // Share of the correction each end takes: the pinned top none, the weighted tip little.
            const a = i === 0 ? 0 : 1, b = i + 1 === last ? cfg.tipWeight : 1, sum = a + b;
            x[i] += dx * off * a / sum; y[i] += dy * off * a / sum;
            x[i + 1] -= dx * off * b / sum; y[i + 1] -= dy * off * b / sum;
        }
    }
    return r;
}
