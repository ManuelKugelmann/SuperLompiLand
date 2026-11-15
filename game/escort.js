// The freed friends swim along (pure, no Phaser; tester feedback: "why do the freed fish swim after
// me for a while and then disappear?", then: "rescued friends should follow indefinitely"). Every
// friend the child frees joins a loose little school behind the fish, the newest closest, and
// stays with it all the way to the grand nest. Nobody fades away, nobody is left behind: set
// somewhere else (a respawn), the fish is caught up with from just outside the view.

export const ESCORT = {
    behind: 190,         // px behind the fish (against its direction of travel) the nearest friend swims ...
    spacing: 125,        // ... and px further back each next one
    above: [70, -40, 115, 5, 150, -85],   // px above the fish, friend by friend (staggered: a school, not a queue)
    max: 6,              // friends in the school at most
    catchS: 0.45,        // s the nearest friend takes to close most of the way to its place (a soft trail, not a leash) ...
    lagS: 0.12,          // ... and s more for each friend further back
    bob: 14,             // px each bobs up and down on its own
    far: 2200,           // px: further from the fish than this (the fish was set somewhere else), a friend comes in again from just outside the view
    reenter: 1100,       // ... this far behind the fish
    hudClear: 90         // px under the view's top edge that those who follow keep clear of (the HUD's band: counter, hearts, depth)
};

/** The lowest y (world) a follower may take: below the HUD's band at the top of the view (`viewTop` = the camera's world y). */
export function belowHud(y, viewTop, cfg = ESCORT) {
    return Math.max(y, viewTop + cfg.hudClear);
}

/**
 * Where friend number `k` of the school (0 = the newest, nearest) wants to be at time `t` (s):
 * behind a fish at (fx, fy) that travels `dir` (+1 east), staggered up and down. Into `out`.
 */
export function schoolPlace(k, fx, fy, dir, t, out = {}, cfg = ESCORT) {
    out.x = fx - dir * (cfg.behind + k * cfg.spacing);
    out.y = fy - cfg.above[k % cfg.above.length] + Math.sin(t * 1.1 + k * 1.9) * cfg.bob;
    return out;
}

/**
 * One step of `dt` s for friend number `k` at `p` ({ x, y }, changed in place) toward its place
 * (tx, ty): it closes the gap smoothly, those further back a little later; a friend left far
 * behind comes in again from just outside the view. Returns p.
 */
export function escortStep(p, k, tx, ty, fx, dir, dt, cfg = ESCORT) {
    if (Math.abs(p.x - fx) > cfg.far) { p.x = fx - dir * (cfg.reenter + k * cfg.spacing); p.y = ty; }
    const a = 1 - Math.exp(-dt / (cfg.catchS + k * cfg.lagS));
    p.x += (tx - p.x) * a; p.y += (ty - p.y) * a;
    return p;
}
