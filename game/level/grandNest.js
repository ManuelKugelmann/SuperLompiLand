// The friends at the grand nest (pure, no Phaser; spec 5.0m "the arrival"): the friends the child
// freed are already there, swimming circles in the nest's warm light; when the fish arrives they
// gather round it. Only freed friends are shown.

export const GRAND_NEST = {
    near: 3200, far: 5000,    // px from the nest at which the friends are built, and beyond which they are removed
    above: 330,               // px over the nest the circle's middle lies (inside the coral arch, in the warm pool)
    radius: [300, 150],       // px across and up-down of the circle they swim
    lap: 9,                   // s for one round
    bob: 16,                  // px each one bobs
    gather: [150, 90],        // the circle round the fish once it has arrived
    gatherS: 1.6,             // s over which they close in
    holdMs: 2800,             // the camera holds this long on the arrival before the end screen ...
    zoom: 1.12,               // ... zooming in gently to this
    depth: 4.6                // just behind the fish
};

const smooth = v => { const t = v <= 0 ? 0 : v >= 1 ? 1 : v; return t * t * (3 - 2 * t); };

/**
 * Where friend `i` of `n` is at time `t` (s): on a circle over the nest, evenly spaced, each bobbing
 * a little; with `gather` (0..1) the circle moves to the fish and tightens round it.
 * Returns { x, y, vx, vy } (px, px/s) into `out`.
 */
export function friendAt(i, n, t, nest, fish, gather = 0, out = {}, cfg = GRAND_NEST) {
    const g = smooth(gather), a = (t / cfg.lap + i / Math.max(1, n)) * Math.PI * 2, w = Math.PI * 2 / cfg.lap;
    const cx = nest.x + (fish.x - nest.x) * g, cy = nest.y - cfg.above + (fish.y - (nest.y - cfg.above)) * g;
    const rx = cfg.radius[0] + (cfg.gather[0] - cfg.radius[0]) * g, ry = cfg.radius[1] + (cfg.gather[1] - cfg.radius[1]) * g;
    out.x = cx + Math.cos(a) * rx;
    out.y = cy + Math.sin(a) * ry + Math.sin(t * 1.3 + i * 2.1) * cfg.bob;
    out.vx = -Math.sin(a) * rx * w;
    out.vy = Math.cos(a) * ry * w;
    return out;
}
