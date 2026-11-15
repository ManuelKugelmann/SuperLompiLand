// The way Lompi has swum, kept as a trail of points: the flock of friends (friendFlock.js) aims at a point
// on it behind him, so after a turn they swing round along his path instead of cutting through him.
// Pure, no Phaser.

export const TRAIL = {
    spacing: 40,      // px between two kept points of the path
    keep: 160         // points kept (160 x 40 = 6 400 px of path: enough for a long chain)
};

/** A trail of the head's path. push(x, y) every frame; at(d) = the point d px back along the path. */
export function createTrail(cfg = TRAIL) {
    const xs = new Float64Array(cfg.keep), ys = new Float64Array(cfg.keep);
    let head = -1, count = 0, hx = 0, hy = 0;
    return {
        push(x, y) {
            hx = x; hy = y;
            if (count && Math.hypot(x - xs[head], y - ys[head]) < cfg.spacing) return;
            head = (head + 1) % cfg.keep; xs[head] = x; ys[head] = y; count = Math.min(cfg.keep, count + 1);
        },
        /** The point `d` px back along the path from the head (the oldest kept point if the path is shorter). */
        at(d, out = { x: 0, y: 0 }) {
            if (!count) { out.x = hx; out.y = hy; return out; }
            let px = hx, py = hy, left = d;
            for (let n = 0; n < count; n++) {
                const i = (head - n + cfg.keep) % cfg.keep, seg = Math.hypot(xs[i] - px, ys[i] - py);
                if (seg >= left && seg > 0) { const k = left / seg; out.x = px + (xs[i] - px) * k; out.y = py + (ys[i] - py) * k; return out; }
                left -= seg; px = xs[i]; py = ys[i];
            }
            out.x = px; out.y = py; return out;
        },
        get length() { return count; }
    };
}
