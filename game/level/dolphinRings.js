// Dolphins at play (pure, no Phaser; spec 5.0k, world map): early in the lagoon two dolphins
// circle over the sand and blow bubble rings, as real dolphins do for fun. A ring wobbles slowly
// up and forward, growing as it goes; swim through one and it bursts into sparkles: a coin and a
// move for the chain. Nothing here can hurt: it is a first, friendly toy.

import { BIOMES } from './biomes.js';

export const DOLPHIN_RINGS = {
    biome: 'beach',
    x: 22500,            // world x of the play spot (the quiet stretch after the first nest)
    below: 260,          // px under the calm route where the dolphins circle
    circle: [520, 120],  // px half width and half height of their loop
    lap: 9,              // s for one loop
    every: 2.6,          // s between rings (they take turns)
    life: 7,             // s a ring lasts
    rise: 34,            // px/s it rises ...
    drift: 30,           // ... and drifts the way its dolphin swam
    radius: [46, 96],    // px: born small, grows
    through: 0.8,        // share of the radius that counts as "through"
    max: 6               // rings at once at most
};

/** Where they play: { x, x0, x1 }. */
export function dolphinSpot(cfg = DOLPHIN_RINGS) {
    const half = cfg.circle[0] + 400;
    return { x: cfg.x, x0: cfg.x - half, x1: cfg.x + half };
}

/** Dolphin k (0 or 1) at time t (s), around the spot centre (cx, cy): { x, y, dir (+1 east), angle }. */
export function dolphinAt(k, t, cx, cy, cfg = DOLPHIN_RINGS) {
    const a = (t / cfg.lap) * Math.PI * 2 + k * Math.PI;
    const x = cx + Math.cos(a) * cfg.circle[0], y = cy + Math.sin(a) * cfg.circle[1];
    const vx = -Math.sin(a), vy = Math.cos(a) * cfg.circle[1] / cfg.circle[0];
    return { x, y, dir: vx >= 0 ? 1 : -1, angle: Math.atan2(vy, Math.abs(vx)) * (vx >= 0 ? 1 : -1) };
}

/** A new ring from a dolphin: { x, y, dir, age }. */
export function blowRing(d) {
    return { x: d.x + d.dir * 60, y: d.y - 10, dir: d.dir, age: 0 };
}

/** Advance a ring by dt s; false when it has burst of old age. */
export function stepRing(r, dt, cfg = DOLPHIN_RINGS) {
    r.age += dt;
    r.x += r.dir * cfg.drift * dt;
    r.y -= cfg.rise * dt;
    return r.age < cfg.life;
}

/** A ring's radius now. */
export const ringRadius = (r, cfg = DOLPHIN_RINGS) => cfg.radius[0] + (cfg.radius[1] - cfg.radius[0]) * Math.min(1, r.age / cfg.life);

/** Did the fish swim through the ring between two places (prev -> cur)? The ring is a hoop standing upright. */
export function throughRing(r, prev, cur, cfg = DOLPHIN_RINGS) {
    if ((prev.x - r.x) * (cur.x - r.x) > 0 || prev.x === cur.x) return false;
    const y = prev.y + (cur.y - prev.y) * (r.x - prev.x) / (cur.x - prev.x);
    return Math.abs(y - r.y) < ringRadius(r, cfg) * cfg.through;
}

/** The biome the spot lies in must be the configured one (a guard for tuning). */
export function spotInBiome(cfg = DOLPHIN_RINGS) {
    const b = BIOMES.find(bi => bi.id === cfg.biome);
    return cfg.x > b.from && cfg.x < b.from + b.width;
}
