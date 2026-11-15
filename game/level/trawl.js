// World event "trawl net" (pure, no Phaser; spec 5.0t 2): along the kelp floor a fishing boat
// tows a wide net over the seabed. The engine is heard and the shoals scatter first; then the net
// comes from behind, faster than a fish cruises. Its headrope reaches just over the calm route:
// rise over it (or sprint ahead) and it passes underneath. Caught, a fish is carried along a short
// way, loses one heart (none in relaxed play) and is let out over the headrope. Further on lies a
// torn panel of an earlier net with a fish in it: a rescue (rescues.js takes `trawlRescues()`), the
// landmark of the longest gap there (the big rescue that stood there gave way).

import { BIOMES } from './biomes.js';

export const TRAWL = {
    enabled: true,
    at: { biome: 'kelp', offset: 27300 },   // where it happens: px after this biome's start
    start: -2600,        // px before `at` where a fish swimming east sets it off
    warnS: 2,            // s of engine and scattering shoals before the net comes
    behind: 1900,        // px behind the fish the net's mouth starts (outside the picture)
    speed: 720,          // px/s it is towed: it reaches a child cruising along (330 px/s) in about 5 s; a fast swimmer outruns it
    run: 9000,           // px it is towed; then it lifts away
    liftS: 2.5,          // s it takes to lift away to the surface
    over: 110,           // px its headrope reaches over the calm route ...
    minHeight: 420,      // ... and it is at least this tall from the seabed
    mouth: 220,          // px behind its front within which a fish is swept in
    carryS: 1.4,         // s a caught fish is carried along
    release: 140,        // px over the headrope a fish is let out
    length: 1500,        // px from the mouth to the cod end (drawn)
    boatAhead: 1700,     // px the towing boat is ahead of the mouth
    panel: 3200          // px after `at` where the torn panel with the trapped fish lies
};

/** Where it happens: { at, startX }, or null when switched off. */
export function trawlSpot(cfg = TRAWL) {
    const b = cfg.enabled && BIOMES.find(bm => bm.id === cfg.at.biome);
    if (!b) return null;
    const at = b.from + cfg.at.offset;
    return { at, startX: at + cfg.start };
}

/** World y of the headrope over x: just over the route, never lower than `minHeight` over the seabed. */
export function headY(x, world, cfg = TRAWL) {
    return Math.min(world.floor(x) - cfg.minHeight, world.route(x) - cfg.over);
}

/** A trawl not yet set off. */
export function createTrawl() {
    return { phase: 'idle', t: 0, mouthX: 0, from: 0, lift: 0, caught: false, carry: 0, event: null };
}

/**
 * One step (dt s). `fish` = { x, y, r }; `world` = { floor(x), route(x) }. Returns the state; `s.event` says what just
 * happened this step: 'warn' (engine heard), 'tow' (the net comes), 'caught', 'released', 'gone'. While `s.carry` > 0
 * the fish is held at `holdAt(s, world)`.
 */
export function stepTrawl(s, dt, fish, world, cfg = TRAWL, spot = trawlSpot(cfg)) {
    s.event = null;
    if (!spot) return s;
    if (s.phase === 'idle') {
        if (fish.x > spot.startX && fish.x < spot.at + cfg.run) { s.phase = 'warn'; s.t = 0; s.event = 'warn'; }
        return s;
    }
    s.t += dt;
    if (s.phase === 'warn') {
        if (s.t >= cfg.warnS) { s.phase = 'tow'; s.t = 0; s.mouthX = s.from = fish.x - cfg.behind; s.event = 'tow'; }
        return s;
    }
    if (s.phase === 'tow' || s.phase === 'lift') {
        s.mouthX += cfg.speed * dt;
        if (s.phase === 'tow' && s.mouthX - s.from > cfg.run) { s.phase = 'lift'; s.t = 0; }
        if (s.phase === 'lift') { s.lift = Math.min(1, s.t / cfg.liftS); if (s.lift >= 1) { s.phase = 'done'; s.event = 'gone'; return s; } }
        if (s.carry > 0) {
            s.carry -= dt;
            if (s.carry <= 0) { s.carry = 0; s.event = 'released'; }
        } else if (!s.caught && s.phase === 'tow' && inMouth(s, fish, world, cfg)) {
            s.caught = true; s.carry = cfg.carryS; s.event = 'caught';
        }
    }
    return s;
}

/** Whether the net's mouth is sweeping over the fish: just behind its front, under its headrope, over the seabed. */
export function inMouth(s, fish, world, cfg = TRAWL) {
    if (fish.x > s.mouthX || fish.x < s.mouthX - cfg.mouth) return false;
    return fish.y + fish.r > headY(s.mouthX, world, cfg) && fish.y < world.floor(fish.x);
}

/** Where a carried fish is held (inside the mouth, halfway down), and where it is let out (over the headrope). */
export function holdAt(s, world, cfg = TRAWL) {
    const top = headY(s.mouthX, world, cfg), x = s.mouthX - cfg.mouth * 0.6;
    return { x, y: (top + world.floor(x)) / 2, outY: top - cfg.release };
}

/** The torn net panel with a trapped fish, as a rescue (rescues.js): on the seabed, the gap's landmark. */
export function trawlRescues(cfg = TRAWL) {
    const spot = trawlSpot(cfg);
    return spot ? [{ id: 'trawl', x: spot.at + cfg.panel, trap: 'panel', art: 'ring', kind: 'friend_parrotfish', ground: true, big: true, event: 'trawl' }] : [];
}
