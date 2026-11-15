// Nothing that swims is ever in rock (pure, no Phaser; playtest: "a repulsing force on all
// creatures", "no creature in or under the terrain"). The terrain's density field is used as
// a distance field: inside rock, or closer to it than its own size, a thing is pushed out along
// the field's slope, the shortest way to open water. Cheap: a few density reads, and none at all
// while it is well clear.

export const KEEP_OUT = {
    probe: 18,        // px between the density reads that give the slope
    step: 22,         // px a thing is moved out per try
    tries: 8          // tries at most (a thing deep in rock comes out over a few frames)
};

/**
 * Where a thing at (x, y) of radius `r` may be: itself if it and its rim are in open water, else moved
 * out of rock along the density's slope. `rock(x, y)` = density minus the threshold (> 0 = rock).
 * Writes and returns `out` = { x, y }.
 */
export function keepOut(x, y, r, rock, out = { x: 0, y: 0 }, cfg = KEEP_OUT) {
    out.x = x; out.y = y;
    for (let k = 0; k < cfg.tries; k++) {
        const p = cfg.probe, gx = rock(out.x + p, out.y) - rock(out.x - p, out.y), gy = rock(out.x, out.y + p) - rock(out.x, out.y - p);
        const gl = Math.hypot(gx, gy);
        // How far into rock the rim reaches: the density at the rim point nearest the rock.
        const rx = gl > 1e-9 ? out.x + gx / gl * r : out.x, ry = gl > 1e-9 ? out.y + gy / gl * r : out.y;
        if (rock(out.x, out.y) <= 0 && rock(rx, ry) <= 0) return out;
        if (gl <= 1e-9) { out.y -= cfg.step; continue; }      // flat inside rock: up is the likeliest way out
        out.x -= gx / gl * cfg.step; out.y -= gy / gl * cfg.step;
    }
    return out;
}
