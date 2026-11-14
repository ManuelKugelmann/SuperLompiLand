// A freed friend swims along (pure, no Phaser; tester feedback: "why do the freed fish swim after
// me for a while and then disappear?"). After its dance of joy the friend keeps swimming with the
// fish, a little behind and above it, until the next nest. There it settles in and swims circles
// over the nest while the fish passes on: it is on its way to the grand nest, where it will be
// waiting. It never fades away in open water.

export const ESCORT = {
    behind: 190,         // px behind the fish (against its direction of travel) the friend swims ...
    above: 70,           // ... and px above it
    catchS: 0.45,        // s it takes to close most of the way to its place (a soft trail, not a leash)
    far: 2200,           // px: further from the fish than this (the fish was set somewhere else), it comes in again from just outside the view
    reenter: 1100,       // ... this far behind the fish
    home: 520,           // px before a nest at which the friend leaves the fish for it
    circle: [150, 70],   // px half width and half height of its circle over the nest ...
    over: 250,           // ... px over the nest
    lapS: 5,             // ... s a round
    gone: 2600           // px the fish is away from the nest when the circling friend (long out of the picture) is taken away
};

/** Where an escorting friend wants to be: behind and above a fish at (fx, fy) travelling `dir` (+1 east). Into `out`. */
export function escortPlace(fx, fy, dir, out = {}, cfg = ESCORT) {
    out.x = fx - dir * cfg.behind; out.y = fy - cfg.above;
    return out;
}

/**
 * One step of `dt` s for a friend at `p` ({ x, y }, changed in place) toward the place (tx, ty):
 * it closes the gap smoothly; a friend left far behind comes in again from just outside the view.
 * Returns p.
 */
export function escortStep(p, tx, ty, fx, dir, dt, cfg = ESCORT) {
    if (Math.abs(p.x - fx) > cfg.far) { p.x = fx - dir * cfg.reenter; p.y = ty; }
    const k = 1 - Math.exp(-dt / cfg.catchS);
    p.x += (tx - p.x) * k; p.y += (ty - p.y) * k;
    return p;
}

/** Whether a friend escorting a fish at `fx` leaves it for the nest at `nestX` now (the fish has come up to it, or is past it). */
export function reachesHome(fx, nestX, cfg = ESCORT) {
    return fx > nestX - cfg.home;
}

/** Where a friend at home circles at time `t` (s), over a nest at (nx, ny). Into `out`. */
export function homePlace(nx, ny, t, out = {}, cfg = ESCORT) {
    const a = t / cfg.lapS * Math.PI * 2;
    out.x = nx + Math.cos(a) * cfg.circle[0]; out.y = ny - cfg.over + Math.sin(a) * cfg.circle[1];
    return out;
}
