// Bait balls in the open blue (pure, no Phaser; open-sea idea #1, gamedesign 5.0k): a swirling
// ball of silver sardines just under the calm route. Lompi can swim into it and is hidden in
// the swirl; gannets plunge in from the sky now and then, and each plunge leaves a short trail
// of coins in its bubbles. Where the balls are, how each fish circles and when a bird dives are
// worked out here; BaitBallLayer.js only draws.

import { BIOMES } from './biomes.js';
import { busyStretches, slideClear } from './openSea.js';
import { bloomFields } from './blooms.js';

export const BAITBALL = {
    seas: ['blue'],
    first: 26000,        // px into the sea where the first ball is ...
    every: 40000,        // ... and again every so many px
    keep: 1500,          // px a ball stays away from anything else that happens in the sea
    radius: 230,         // px: the ball's size (it breathes a little)
    squash: 0.72,        // height / width of the swirl
    below: 160,          // px under the calm route its middle lies
    drift: 160,          // px it wanders to and fro
    count: 200,          // fish in a ball
    spin: 0.9,           // radians per second at the rim (faster inside)
    hide: 0.7,           // share of the radius within which Lompi is hidden in it
    plunge: {
        every: 3.4,      // s between gannet plunges
        fall: 1.1,       // s from the sky to the ball
        sky: 420,        // px above the surface a dive starts
        reach: 0.6,      // share of the ball's width over which plunges spread
        coins: 3,        // coins left in each bubble trail
        life: 9          // s the coins stay before they fade
    }
};

const hash = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };

let BALLS = null;

/** Every bait ball: [{ id, x }] (its depth follows the calm route). */
export function baitBalls(cfg = BAITBALL) {
    if (cfg === BAITBALL && BALLS) return BALLS;
    const taken = [...busyStretches(), ...bloomFields().map(f => [f.x0, f.x1])], out = [], w = cfg.radius * 2 + cfg.drift * 2;
    for (const id of cfg.seas) {
        const b = BIOMES.find(bi => bi.id === id);
        for (let x0 = b.from + cfg.first; x0 + w < b.from + b.width - cfg.first / 2; x0 += cfg.every) {
            const at = slideClear(x0, w, taken, cfg.keep);
            if (at + w < b.from + b.width) out.push({ id: `bait${out.length}`, x: at + w / 2 });
        }
    }
    if (cfg === BAITBALL) BALLS = out;
    return out;
}

/** The ball's middle at time t (s): it wanders slowly. `routeY(x)` = depth of the calm route. */
export function ballCentre(ball, t, routeY, out = {}, cfg = BAITBALL) {
    out.x = ball.x + Math.sin(t * 0.11 + ball.x * 0.001) * cfg.drift;
    out.y = routeY(ball.x) + cfg.below + Math.sin(t * 0.17) * cfg.drift * 0.3;
    return out;
}

/**
 * Fish i of a ball at time t, relative to the ball's middle: { x, y, dir (-1 / 1, the way it
 * swims), front (drawn in front of Lompi), turn (0..1, how edge-on: its flank flashes) }.
 */
export function fishAt(i, t, out = {}, cfg = BAITBALL) {
    const u = hash(i, 1), r = cfg.radius * (0.3 + 0.7 * Math.sqrt(u)) * (1 + 0.06 * Math.sin(t * 1.3 + i));
    const a = hash(i, 2) * Math.PI * 2 + t * cfg.spin * (0.7 + 0.6 * (1 - u)) * (hash(i, 3) < 0.85 ? 1 : 1.15);
    out.x = Math.cos(a) * r;
    out.y = Math.sin(a) * r * cfg.squash;
    out.dir = Math.sin(a) > 0 ? -1 : 1;           // the swirl turns one way: along the top east, along the bottom west
    out.front = hash(i, 4) < 0.5;
    out.turn = 1 - Math.min(1, Math.abs(Math.sin(a)) * 3);
    return out;
}

/** Is a point (relative to the ball's middle) hidden in the swirl? */
export function hiddenIn(dx, dy, cfg = BAITBALL) {
    return Math.hypot(dx, dy / cfg.squash) < cfg.radius * cfg.hide;
}

/**
 * The gannet plunge going on at time t: { n (which plunge), dx (from the ball's middle), u (0..1
 * of its fall; > 1 once it has reached the ball) }.
 */
export function plungeAt(t, out = {}, cfg = BAITBALL) {
    const P = cfg.plunge, n = Math.floor(t / P.every);
    out.n = n;
    out.dx = (hash(n, 7) - 0.5) * cfg.radius * 2 * P.reach;
    out.u = (t - n * P.every) / P.fall;
    return out;
}

/** Where a plunge leaves its coins (relative to the ball's middle; `surface` = the surface's y minus the middle's). */
export function plungeCoins(p, surface, cfg = BAITBALL) {
    const top = -cfg.radius * cfg.squash, out = [];
    for (let k = 0; k < cfg.plunge.coins; k++) {
        const s = (k + 1) / (cfg.plunge.coins + 1);
        out.push({ x: p.dx + Math.sin(k * 2.1 + p.n) * 26, y: surface + (top - surface) * s });
    }
    return out;
}
