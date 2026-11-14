// Grumpy animals (pure, no Phaser; spec gamedesign §6.2 "Grumpy animals", §7.1).
// A grumpy owns a small territory. It idles there; when the player comes too close it
// warns first (a huff and a colour flush, WARN s), then shoves along a visible arc
// toward where the player was, sulks back home and stays calm for a while. A shove
// that touches the player is reported once ('hit'); the scene decides the damage
// (half a heart, never the last half, never in relaxed play). In a room it warns and swings
// at friends too (env.players), but only a touch on the local fish (env.player) is a 'hit':
// hearts are personal (spec ch.13 "Creatures in a room"). Units: px and s.
// Every move has momentum: steering sets a desired velocity, acceleration is limited.

import { nearestPlayer } from './steering.js';

export const GRUMPY = {
    territory: 300,   // px around home it idles in
    warnR: 230,       // px: closer than this starts a warning
    warnS: 0.5,       // s of huffing before the shove (always readable, never a surprise)
    shoveSpeed: 620,  // px/s at the peak of the shove
    shoveS: 0.45,     // s the shove lasts
    arc: 0.6,         // rad: the shove curves this much (a visible swing, not a straight dart)
    hitR: 95,         // px: touching distance during a shove
    sulkS: 2.2,       // s swimming back home, ignoring the player
    calmS: 3.5,       // s after sulking before it can warn again
    idleSpeed: 45,    // px/s pottering about
    accel: 1400       // px/s² (momentum)
};

/** A grumpy at home (x, y). `opts` override GRUMPY per species. */
export function createGrumpy(x, y, opts = {}, seed = 0) {
    return { ...GRUMPY, ...opts, home: { x, y }, x, y, vx: 0, vy: 0, state: 'idle', timer: 0,
        aim: { x: 0, y: 0, side: 1 }, hit: false, seed, heading: 0 };
}

const len = (x, y) => Math.hypot(x, y) || 1;

function steer(g, tx, ty, speed, dt) {
    const dx = tx - g.x, dy = ty - g.y, d = len(dx, dy);
    const want = Math.min(speed, d * 3);
    const ax = (dx / d * want - g.vx), ay = (dy / d * want - g.vy), a = len(ax, ay);
    const k = Math.min(1, g.accel * dt / a);
    g.vx += ax * k; g.vy += ay * k;
}

/**
 * Advance by dt. env: { isOpen(x, y), player: the local fish | null, players: everyone (optional) }.
 * Returns 'warn' when a warning starts, 'hit' once when a shove touches the player, else null.
 */
export function stepGrumpy(g, dt, env) {
    const p = nearestPlayer(env, g.x, g.y);
    let event = null;
    g.timer += dt;
    const pd = p ? Math.hypot(p.x - g.x, p.y - g.y) : Infinity;
    const pHome = p ? Math.hypot(p.x - g.home.x, p.y - g.home.y) : Infinity;

    if (g.state === 'idle') {
        const t = g.timer * 0.5 + g.seed;
        steer(g, g.home.x + Math.cos(t) * g.territory * 0.4, g.home.y + Math.sin(t * 1.3) * g.territory * 0.15, g.idleSpeed, dt);
        if (pd < g.warnR && pHome < g.territory) { g.state = 'warn'; g.timer = 0; event = 'warn'; }
    } else if (g.state === 'warn') {
        g.vx *= Math.exp(-6 * dt); g.vy *= Math.exp(-6 * dt);       // holds still, puffing up
        if (p) { g.aim.x = p.x; g.aim.y = p.y; g.aim.side = (Math.sin(g.seed * 7.1) >= 0 ? 1 : -1); }
        if (pd > g.warnR * 1.6) { g.state = 'idle'; g.timer = 0; }   // the player backed off: no shove
        else if (g.timer >= g.warnS) { g.state = 'shove'; g.timer = 0; g.hit = false; }
    } else if (g.state === 'shove') {
        // Toward where the player was at the end of the warning, along a curve.
        const dx = g.aim.x - g.x, dy = g.aim.y - g.y, d = len(dx, dy);
        const base = Math.atan2(dy, dx) + g.aim.side * g.arc * (1 - g.timer / g.shoveS);
        const s = g.shoveSpeed * Math.sin(Math.PI * Math.min(1, g.timer / g.shoveS) * 0.5 + Math.PI * 0.25);
        g.vx += (Math.cos(base) * s - g.vx) * Math.min(1, 10 * dt);
        g.vy += (Math.sin(base) * s - g.vy) * Math.min(1, 10 * dt);
        const me = env.player;   // only the local fish loses hearts on this device
        if (!g.hit && me && Math.hypot(me.x - g.x, me.y - g.y) < g.hitR) { g.hit = true; event = 'hit'; }
        if (g.timer >= g.shoveS || d < 20) { g.state = 'sulk'; g.timer = 0; }
    } else if (g.state === 'sulk') {
        steer(g, g.home.x, g.home.y, g.idleSpeed * 2.5, dt);
        if (g.timer >= g.sulkS) { g.state = 'calm'; g.timer = 0; }
    } else if (g.state === 'calm') {
        steer(g, g.home.x, g.home.y, g.idleSpeed, dt);
        if (g.timer >= g.calmS) { g.state = 'idle'; g.timer = 0; }
    }

    const nx = g.x + g.vx * dt, ny = g.y + g.vy * dt;
    if (!env.isOpen || env.isOpen(nx, ny)) { g.x = nx; g.y = ny; }
    else { g.vx *= -0.3; g.vy *= -0.3; if (g.state === 'shove') { g.state = 'sulk'; g.timer = 0; } }   // never into rock
    if (Math.abs(g.vx) > 5) g.heading = g.vx > 0 ? 1 : -1;
    return event;
}

/** A sudden event nearby (a special, a puff-bump): a grumpy backs off and calms down. */
export function calmGrumpy(g) {
    if (g.state === 'warn' || g.state === 'shove' || g.state === 'idle') { g.state = 'sulk'; g.timer = 0; }
}
