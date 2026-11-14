// The eel meadow (pure, no Phaser; spec 5.0i/5.0j world map): near the lagoon's east end a
// colony of garden eels stands in the sand, swaying like grass. Come close and they slip back
// into their burrows, one after the other; wait, and they rise again. Beside them a ray rests
// half buried; it lifts off and glides away over the sand when the fish comes near, and settles
// again further on. Nothing here can hurt or be hurt: it is there to be watched.

import { BIOMES } from './biomes.js';

export const MEADOW = {
    biome: 'beach',
    at: 0.91,            // where in the biome its middle lies (share of the width): the quiet stretch before the mangroves
    width: 2600,         // px the colony is long
    eels: 28,
    eelHeight: [150, 250],   // px an eel stands out of the sand
    shy: 430,            // px: a fish this close makes an eel slip into its burrow ...
    hide: 0.35,          // ... within this many seconds ...
    rise: 2.6,           // ... and it comes out again over this many seconds once the fish is away
    sway: 0.16,          // radians it sways in the current
    seen: 700,           // px from an eel at which the colony counts as seen (reef book)
    trail: 6,            // coins that lead from the calm route down to the colony's west end ...
    row: 7,              // ... and coins in a row over the eels
    over: 330,           // px over the sand at which that row runs
    ray: {
        from: -700,      // px from the colony's middle where it rests at first
        width: 520,      // px across as drawn
        wake: 480,       // px: a fish this close makes it lift off
        glide: 1500,     // px it glides before it settles again
        speed: 300,      // px per second at the middle of its glide
        lift: 150        // px it rises over the sand at the top of its glide
    }
};

let SPOT = null;

/** Where the meadow is: { x (middle), x0, x1 }. */
export function meadowSpot(cfg = MEADOW) {
    if (cfg === MEADOW && SPOT) return SPOT;
    const b = BIOMES.find(bi => bi.id === cfg.biome), x = b.from + b.width * cfg.at, spot = { x, x0: x - cfg.width / 2, x1: x + cfg.width / 2 };
    if (cfg === MEADOW) SPOT = spot;
    return spot;
}

const hash = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };

/** Eel `i` of the colony: { x (world), height (px out of the sand when fully out), phase }. Evenly spread, a little uneven. */
export function eelAt(i, cfg = MEADOW) {
    const s = meadowSpot(cfg), step = cfg.width / cfg.eels;
    return { x: s.x0 + (i + 0.2 + 0.6 * hash(i, 1)) * step, height: cfg.eelHeight[0] + (cfg.eelHeight[1] - cfg.eelHeight[0]) * hash(i, 2), phase: hash(i, 3) * 6.283 };
}

/**
 * How far an eel is out of its burrow (0 hidden .. 1 fully out) one step later: it slips in
 * fast while the fish is within `shy`, and comes out slowly otherwise. `out` = how far it was.
 */
export function eelOut(out, fishDist, dt, cfg = MEADOW) {
    return fishDist < cfg.shy ? Math.max(0, out - dt / cfg.hide) : Math.min(1, out + dt / cfg.rise);
}

/** A ray at rest at world x: { x, from, t (0..1 along its glide, 0 = at rest), dir }. */
export function createRay(x) {
    return { x, from: x, t: 0, dir: 1 };
}

/**
 * One step of the ray: at rest until the fish comes within `wake`, then one glide of `glide` px
 * away from the fish (never out of [x0, x1]: it turns back at the colony's ends), easing off
 * and settling. Writes the ray's x and returns how high it is over the sand (px, 0 at rest).
 */
export function stepRay(ray, fishDist, fishSide, dt, x0, x1, cfg = MEADOW) {
    const r = cfg.ray;
    if (ray.t === 0) {
        if (fishDist >= r.wake) return 0;
        ray.from = ray.x; ray.dir = fishSide > 0 ? -1 : 1;      // away from the fish
        if (ray.from + ray.dir * r.glide < x0 || ray.from + ray.dir * r.glide > x1) ray.dir = -ray.dir;
        ray.t = 1e-6;
    }
    // A glide: speed is highest in the middle (a sine in and out), so the whole glide takes glide * (pi / 2) / speed seconds.
    ray.t = Math.min(1, ray.t + dt * r.speed / (r.glide * Math.PI / 2));
    const u = 0.5 - 0.5 * Math.cos(ray.t * Math.PI);
    ray.x = ray.from + ray.dir * r.glide * u;
    const lift = Math.sin(ray.t * Math.PI) * r.lift;
    if (ray.t >= 1) ray.t = 0;
    return lift;
}

/**
 * The meadow's coins: a trail from the calm route down to the colony's west end, then a row
 * over the eels: [{ x, y }]. `routeY(x)` = depth of the route, `groundY(x)` = the seabed under
 * it (or null where there is none in reach: then no coins).
 */
export function meadowCoins(routeY, groundY, cfg = MEADOW) {
    const s = meadowSpot(cfg), g0 = groundY(s.x0), out = [];
    if (g0 === null) return out;
    const top = { x: s.x0 - 700, y: routeY(s.x0 - 700) + 130 }, low = { x: s.x0, y: g0 - cfg.over };
    for (let i = 0; i < cfg.trail; i++) { const u = i / cfg.trail; out.push({ x: top.x + (low.x - top.x) * u, y: top.y + (low.y - top.y) * u }); }
    for (let i = 0; i < cfg.row; i++) {
        const x = s.x0 + (s.x1 - s.x0) * i / (cfg.row - 1), g = groundY(x);
        if (g !== null) out.push({ x, y: g - cfg.over });
    }
    return out;
}
