// The bait ball's place (pure, no Phaser; spec 5.0i open sea, 5.0j world map): near the end of
// the open blue the calm route passes through a great ball of small fish. This module only
// reserves the slot (where it is and how big) and moves the ball in it: a swirl of silver
// sardines that hides Lompi, and gannets that plunge in from the sky, each plunge leaving a short
// coin trail (open-sea idea #1, 5.0k). BaitBallLayer.js only draws.

import { BIOMES } from './biomes.js';

export const BAITBALL = {
    biome: 'blue',
    at: 0.92,          // where in the biome its centre lies (share of the width): the quiet stretch before the kelp island
    radius: 900        // px: the ball and everything that belongs to it stays inside this circle
};

let SLOT = null;

/**
 * The slot: { x (centre), x0, x1, radius }. Its depth is the calm route's there: the centre is
 * (x, routeY(x)), so the route passes through the ball's middle.
 */
export function baitballSlot(cfg = BAITBALL) {
    if (cfg === BAITBALL && SLOT) return SLOT;
    const b = BIOMES.find(bi => bi.id === cfg.biome), x = b.from + b.width * cfg.at;
    const slot = { x, x0: x - cfg.radius, x1: x + cfg.radius, radius: cfg.radius };
    if (cfg === BAITBALL) SLOT = slot;
    return slot;
}

/** Is world point (x, y) inside the slot, given the route's depth at its centre? */
export function inBaitball(x, y, routeY, cfg = BAITBALL) {
    const s = baitballSlot(cfg);
    return Math.hypot(x - s.x, y - routeY(s.x)) < s.radius;
}

/** The ball inside the slot: its swirl and the gannets' plunges. */
export const SWIRL = {
    radius: 500,         // px: the ball's size (it breathes a little; slot radius minus drift and a margin)
    squash: 0.72,        // height / width of the swirl
    below: 0,            // px under the calm route its middle lies (the route runs through it)
    drift: 160,          // px it wanders to and fro
    count: 560,          // fish in the ball (a dense, filled sphere)
    spin: 0.9,           // radians per second at the rim (faster inside)
    hide: 0.7,           // share of the radius within which Lompi is hidden in it
    plunge: {
        every: 4.6,      // s between gannet plunges
        // one plunge, in phases (s): a flash on the surface (look up!), the dive through the air,
        // on under water as a white arrow with a bubble jet into the top of the ball, then the
        // bird bobs back up while the sardines it scattered close in again
        cue: 0.6, air: 0.45, water: 0.7, rise: 1.6,
        sky: 420,        // px above the surface a dive starts
        scatter: { reach: 190, push: 150, fade: 1.2 },   // the puff of sardines where it hits: px, px, s
        into: 180,       // px the bird drives into the ball past its top
        gap: 80,         // px between the coins in its trail (from just under the surface down)
        reach: 0.6,      // share of the ball's width over which plunges spread
        coins: 3,        // coins left in each bubble trail
        life: 4.4        // s the coins stay before they fade (less than `every`: one trail at a time)
    }
};

const hash = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };

/** The ball's middle at time t (s): it wanders a little inside its slot. `routeY(x)` = depth of the calm route. */
export function ballCentre(t, routeY, out = {}, cfg = SWIRL) {
    const x = baitballSlot().x;
    out.x = x + Math.sin(t * 0.11) * cfg.drift;
    out.y = routeY(x) + cfg.below + Math.sin(t * 0.17) * cfg.drift * 0.3;
    return out;
}

/**
 * Fish i of a ball at time t, relative to the ball's middle: { x, y, dir (-1 / 1, the way it
 * swims), front (drawn in front of Lompi), turn (0..1, how edge-on: its flank flashes), core (0 rim .. 1 middle) }.
 */
export function fishAt(i, t, out = {}, cfg = SWIRL) {
    // A filled ball: shells from the core to the rim (even cover: r ~ sqrt), the inner ones
    // swirling faster; `core` is how deep inside a fish is (the core reads darker and bluer).
    const u = hash(i, 1), r = cfg.radius * Math.sqrt(0.02 + 0.98 * u) * (1 + 0.05 * Math.sin(t * 1.3 + i));
    const a = hash(i, 2) * Math.PI * 2 + t * cfg.spin * (0.6 + 0.9 * (1 - u));
    out.x = Math.cos(a) * r;
    out.y = Math.sin(a) * r * cfg.squash;
    out.dir = Math.sin(a) > 0 ? -1 : 1;           // the swirl turns one way: along the top east, along the bottom west
    out.front = hash(i, 4) < 0.5;
    out.turn = 1 - Math.min(1, Math.abs(Math.sin(a)) * 3);
    out.core = 1 - r / cfg.radius;
    return out;
}

/** Is a point (relative to the ball's middle) hidden in the swirl? */
export function hiddenIn(dx, dy, cfg = SWIRL) {
    return Math.hypot(dx, dy / cfg.squash) < cfg.radius * cfg.hide;
}

const PHASES = ['cue', 'air', 'water', 'rise'];

/**
 * The gannet plunge going on at time t: { n (which plunge), dx (from the ball's middle), phase
 * ('cue' | 'air' | 'water' | 'rise' | 'rest'), k (0..1 through it), since (s since it hit the ball;
 * < 0 before) }.
 */
export function plungeAt(t, out = {}, cfg = SWIRL) {
    const P = cfg.plunge, n = Math.floor(t / P.every);
    let s = t - n * P.every;
    out.n = n;
    out.dx = (hash(n, 7) - 0.5) * cfg.radius * 2 * P.reach;
    out.since = s - P.cue - P.air - P.water;
    out.phase = 'rest'; out.k = 1;
    for (const ph of PHASES) {
        if (s < P[ph]) { out.phase = ph; out.k = s / P[ph]; break; }
        s -= P[ph];
    }
    return out;
}

/** How deep a plunge reaches (relative to the ball's middle): into the ball, past its top. */
export const plungeDepth = (cfg = SWIRL) => -cfg.radius * cfg.squash + cfg.plunge.into;

/**
 * Where a plunge leaves its coins (relative to the ball's middle; `surface` = the surface's y minus
 * the middle's): spaced down its trail from just under the surface, never past where it reached.
 */
export function plungeCoins(p, surface, cfg = SWIRL) {
    const P = cfg.plunge, end = plungeDepth(cfg), out = [];
    for (let k = 0; k < P.coins; k++) {
        const y = Math.min(end, surface + P.gap * (k + 0.8));
        out.push({ x: p.dx + Math.sin(k * 2.1 + p.n) * 22, y });
    }
    return out;
}
