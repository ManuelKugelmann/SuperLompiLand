// A chain of friends (user 2026-11-15: "Chain of friends"): the way Lompi has swum, kept as a trail of points,
// so followers can swim in a line along his actual path instead of hanging at a fixed place beside him.
// Pure, no Phaser.

export const TRAIL = {
    spacing: 40,      // px between two kept points of the path
    keep: 160         // points kept (160 x 40 = 6 400 px of path: enough for a long chain)
};

/** The chain behind the fish: chapter friends first (FriendSchool), then rescued animals (RescueLayer). */
export const CHAIN = {
    start: 230,      // px back along the path where the first friend swims
    gap: 170,        // px along the path between two friends ...
    side: 110,       // px ... every other one this far to the side of the path: neighbours sit diagonally, about 280 px
                     // apart, more than a body is wide (~250 px; techartist review: they overlapped), and the chain stays short
    sway: 22         // px they sway across the path, one wave per bar of the music (spec 5.0z)
};

const back = { x: 0, y: 0 };

/** Where friend number `slot` (0 = first) swims: that far back along the trail, every other one off to alternate sides. */
export function chainAt(trail, slot, out, cfg = CHAIN) {
    const d = cfg.start + cfg.gap * slot;
    trail.at(d, out);
    trail.at(d + 40, back);
    const dx = out.x - back.x, dy = out.y - back.y, len = Math.hypot(dx, dy);
    if (len < 1e-6) return out;
    const side = (slot % 2 ? 1 : -1) * cfg.side;
    out.x += (-dy / len) * side; out.y += (dx / len) * side;
    return out;
}

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
