// World event "the hunter passes" (pure, no Phaser; spec 5.0t 1): at fixed places a fast hunter
// (a barracuda) comes through. It is announced, comes in from outside the picture, chases Lompi
// for a few seconds and gives up when he hides behind rock, keeps away or simply lasts it out.
// Reaching him costs one heart at most; then it swims on. One switch turns the event off.

import { BIOMES } from './biomes.js';

export const HUNTER = {
    enabled: true,
    spots: { reef: [0.55], blue: [0.4, 0.8], kelp: [0.6], wreck: [0.5] },   // where in each area (share of its width)
    trigger: 500,        // px from a spot at which it starts
    warnS: 2,            // s between the warning and the hunter setting off
    chaseS: 7,           // s it chases at most
    from: [-1500, -520], // where it sets off, from the fish (px): behind and above, outside the picture
    speed: 620,          // px per s while chasing ...
    turn: 1.5,           // ... turning at most this fast (rad per s): a dodge shakes it off
    catchR: 110,         // px at which it has reached Lompi
    lose: 1900,          // px away at which it gives up
    blindS: 1.2,         // s without seeing Lompi (rock in between) after which it gives up
    leaveSpeed: 820,     // px per s swimming off
    gone: 2400,          // px from Lompi at which it is gone
    size: 420            // px long
};

/** Every place a hunter passes: [{ id, biome, x }]. */
export function hunterSpots(cfg = HUNTER) {
    if (!cfg.enabled) return [];
    const out = [];
    for (const b of BIOMES) (cfg.spots[b.id] || []).forEach((u, k) => out.push({ id: `${b.id}:${k}`, biome: b.id, x: b.from + b.width * u }));
    return out;
}

/** The spot the fish has just come to and has not met yet, or null. `done` = a Set of ids. */
export function spotNear(x, done, cfg = HUNTER, spots = hunterSpots(cfg)) {
    return spots.find(s => !done.has(s.id) && Math.abs(x - s.x) < cfg.trigger) || null;
}

/** A hunter that has just been announced: it waits outside the picture, pointed at the fish. */
export function startHunter(fish, cfg = HUNTER) {
    const x = fish.x + cfg.from[0], y = fish.y + cfg.from[1];
    return { phase: 'warn', t: 0, x, y, angle: Math.atan2(fish.y - y, fish.x - x), blind: 0, result: null };
}

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * One step of the hunter. `fish` = { x, y }, `sees` = can it see the fish, `dt` s.
 * Phases: warn -> chase -> leave -> done; `result` becomes 'caught' or 'escaped' when the chase ends.
 */
export function stepHunter(h, fish, sees, dt, cfg = HUNTER) {
    h.t += dt;
    const dx = fish.x - h.x, dy = fish.y - h.y, dist = Math.hypot(dx, dy);
    if (h.phase === 'warn') {
        // Waiting outside the picture, it keeps its place relative to the fish.
        h.x = fish.x + cfg.from[0]; h.y = fish.y + cfg.from[1]; h.angle = Math.atan2(-cfg.from[1], -cfg.from[0]);
        if (h.t >= cfg.warnS) { h.phase = 'chase'; h.t = 0; }
        return h;
    }
    if (h.phase === 'chase') {
        const turn = wrap(Math.atan2(dy, dx) - h.angle), max = cfg.turn * dt;
        h.angle += Math.max(-max, Math.min(max, turn));
        h.x += Math.cos(h.angle) * cfg.speed * dt; h.y += Math.sin(h.angle) * cfg.speed * dt;
        h.blind = sees ? 0 : h.blind + dt;
        if (dist < cfg.catchR) { h.phase = 'leave'; h.result = 'caught'; }
        else if (h.t >= cfg.chaseS || h.blind >= cfg.blindS || dist > cfg.lose) { h.phase = 'leave'; h.result = 'escaped'; }
        return h;
    }
    if (h.phase === 'leave') {
        // Straight on, a little upward, and away.
        h.angle += wrap((Math.cos(h.angle) >= 0 ? -0.35 : Math.PI + 0.35) - h.angle) * Math.min(1, dt * 1.5);
        h.x += Math.cos(h.angle) * cfg.leaveSpeed * dt; h.y += Math.sin(h.angle) * cfg.leaveSpeed * dt;
        if (dist > cfg.gone) h.phase = 'done';
    }
    return h;
}

/** Is there rock between a and b? `solid(x, y)` is sampled every `step` px along the line. */
export function sightBlocked(solid, ax, ay, bx, by, step = 70) {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let i = 1; i < n; i++) if (solid(ax + (bx - ax) * i / n, ay + (by - ay) * i / n)) return true;
    return false;
}
