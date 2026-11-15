// World event "longline" (pure, no Phaser; spec 5.0t 3): a fishing line of baited hooks hangs
// across the water off the kelp coast, held up by floats. Its hooks sway; touching one stings
// (half a heart, at most a heart for the whole line, nothing in relaxed play). On one branch a
// young turtle is hooked: staying next to it for a moment nibbles the line through and frees it
// (a rescue: rescues.js takes `longlineRescues()`, RescueLayer draws the turtle). It stands where
// the way between two landmarks was longest (the big rescue that stood there gave way).

import { BIOMES } from './biomes.js';
import { hash } from './terrain.js';

export const LONGLINE = {
    enabled: true,
    at: { biome: 'kelp', offset: 700 },   // the line's middle: px after this biome's start (just off its coast)
    length: 4200,        // px of main line
    floatEvery: 1400,    // px between two floats at the surface
    depth: 300,          // px the main line hangs below a float ...
    sag: 130,            // ... and how much deeper it sags between two
    branchEvery: 320,    // px between two branch lines (snoods)
    branch: [380, 720],  // px a branch line hangs below the main line
    sway: 38,            // px a hook swings to each side ...
    swayS: 5.2,          // ... once in this many seconds
    hookR: 40,           // px: a fish this much nearer than its own radius touches a hook
    maxHits: 2,          // stings that cost something on one visit (each half a heart: one heart at most)
    stingWait: 1.2,      // s after a sting before a hook can sting again
    cue: 2400,           // px before the line at which the shoals scatter and it is announced
    near: 3200,          // px from the line within which it is built ...
    far: 4600,           // ... and beyond which it is dropped
    turtleHang: 70,      // px the hooked turtle hangs below its hook
    hold: 1,             // s next to the turtle that nibble its line through
    seed: 5150
};

/** The line: { x0, x1, mid } (world px), or null when switched off. */
export function longlineSpan(cfg = LONGLINE) {
    const b = cfg.enabled && BIOMES.find(bm => bm.id === cfg.at.biome);
    if (!b) return null;
    const mid = b.from + cfg.at.offset;
    return { x0: mid - cfg.length / 2, x1: mid + cfg.length / 2, mid };
}

/** Depth (world y) of the main line at x: just under a float, sagging between two. */
export function lineY(x, span, cfg = LONGLINE) {
    const u = ((x - span.x0) / cfg.floatEvery) % 1;
    return cfg.depth + cfg.sag * Math.sin(Math.PI * Math.max(0, u));
}

/** The floats' x, west to east, both ends included. */
export function floats(span, cfg = LONGLINE) {
    const out = [];
    for (let x = span.x0; x <= span.x1 + 1e-6; x += cfg.floatEvery) out.push(x);
    return out;
}

/** The branch lines: [{ i, x (where it hangs from the main line), top, len, caught }], the one nearest the middle with the turtle. */
export function branches(span, cfg = LONGLINE) {
    const out = [];
    for (let x = span.x0 + cfg.branchEvery / 2, i = 0; x < span.x1; x += cfg.branchEvery, i++) {
        out.push({ i, x, top: lineY(x, span, cfg), len: cfg.branch[0] + (cfg.branch[1] - cfg.branch[0]) * hash(i, 91, cfg.seed), caught: false });
    }
    let best = out[0];
    for (const b of out) if (Math.abs(b.x - span.mid) < Math.abs(best.x - span.mid)) best = b;
    if (best) best.caught = true;
    return out;
}

/** Where branch b's hook is at time t (s): it swings like a slow pendulum, each out of step with the next. */
export function hookAt(b, t, cfg = LONGLINE, out = {}) {
    const a = Math.sin(t * Math.PI * 2 / cfg.swayS + b.i * 1.7) * cfg.sway;
    out.x = b.x + a;
    out.y = b.top + Math.sqrt(Math.max(0, b.len * b.len - a * a));
    return out;
}

/** The branch whose hook a fish at (fx, fy) with radius fr touches at time t, or null. The turtle's hook is in the turtle. */
export function hookTouched(list, fx, fy, fr, t, cfg = LONGLINE) {
    const p = {};
    for (const b of list) {
        if (b.caught || Math.abs(b.x - fx) > cfg.sway + cfg.hookR + fr) continue;
        hookAt(b, t, cfg, p);
        if (Math.hypot(p.x - fx, p.y - fy) < cfg.hookR + fr) return b;
    }
    return null;
}

/** Whether a sting costs something: the first `maxHits` of a visit do (and never in relaxed play). */
export function stingCosts(hits, relaxed, cfg = LONGLINE) {
    return !relaxed && hits < cfg.maxHits;
}

/** The hooked turtle as a rescue (rescues.js): its place under the caught branch, never swaying (the line holds it). */
export function longlineRescues(cfg = LONGLINE) {
    const span = longlineSpan(cfg);
    if (!span) return [];
    const b = branches(span, cfg).find(br => br.caught);
    return [{ id: 'longline', x: b.x, y: b.top + b.len + cfg.turtleHang, trap: 'hook', art: 'bag', kind: 'friend_turtle', hold: cfg.hold, event: 'longline' }];
}

/** For the landmark map (worldMap.js): the line's middle. */
export function longlineSpot(cfg = LONGLINE) {
    const s = longlineSpan(cfg);
    return s ? s.mid : null;
}
