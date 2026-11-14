// The sea otter (pure, no Phaser; spec 5.0o): in the kelp forest an otter floats on its back at
// the surface, wrapped in a strand of kelp so it does not drift off, and cracks a shell on its
// belly. Now and then it dives: down to the lane where the fish swims, a look round, and up again.

import { BIOMES } from './biomes.js';

export const SEA_OTTER = {
    biome: 'kelp',
    at: 0.15,            // share of the biome's width where it floats (the long stretch before the side cave)
    floatS: 5,           // s it floats and cracks its shell ...
    diveS: 2.4,          // ... s down ...
    lingerS: 2.6,        // ... s it stays down there, cracking a shell where the fish can watch ...
    riseS: 2.8,          // ... and s up again
    over: 110,           // px over the calm route its dive ends (at the fish's eye height, never on top of it)
    reach: 320,          // px east of its floating place the dive leads when no fish is about ...
    ahead: 300,          // ... with a fish near, the dive ends this far ahead of it in its direction of travel ...
    range: 1100,         // ... but never further than this from its floating place
    look: 60,            // px it drifts to and fro while it looks round
    crackS: 0.42,        // s between two taps on the shell
    taps: 4,             // taps in a row, then a pause as long
    bob: 7,              // px it bobs on the swell
    length: 380,         // px long (over two fish: an otter is a big animal, and it has to read on a phone)
    near: 1700,          // px from the fish within which it exists
    seen: 650            // px at which it goes into the reef book
};

const smooth = v => { const t = v <= 0 ? 0 : v >= 1 ? 1 : v; return t * t * (3 - 2 * t); };

/** Where it floats: { x, x0, x1 }. */
export function otterSpot(cfg = SEA_OTTER) {
    const b = BIOMES.find(bi => bi.id === cfg.biome), x = b.from + b.width * cfg.at;
    return { x, x0: x - 200, x1: x + cfg.reach + 200 };
}

/** Where a dive ends that starts with the fish at `fishX` travelling `dir` (+1 east): ahead of the fish, within range of the floating place `x0`. */
export function diveTo(x0, fishX, dir, cfg = SEA_OTTER) {
    return Math.min(x0 + cfg.range, Math.max(x0 - cfg.range, fishX + dir * cfg.ahead));
}

/** One round of floating and diving lasts this long (s). */
export function roundS(cfg = SEA_OTTER) {
    return cfg.floatS + cfg.diveS + cfg.lingerS + cfg.riseS;
}

/**
 * The otter at time `t` (s): `x0` = its floating place, `surfaceY` = the waterline there,
 * `routeY` = the calm route's depth. Into `out`: { x, y, part ('float' | 'dive' | 'linger' | 'rise'),
 * tap (true in the moment it taps its shell: floating, and down at the lane) }. `diveX` = where this round's dive ends (diveTo).
 */
export function otterAt(t, x0, surfaceY, routeY, out = {}, cfg = SEA_OTTER, diveX = x0 + cfg.reach) {
    const u = ((t % roundS(cfg)) + roundS(cfg)) % roundS(cfg), deep = Math.max(surfaceY + 120, routeY - cfg.over), bx = diveX;
    out.tap = false;
    if (u < cfg.floatS) {
        const beat = Math.floor(u / cfg.crackS);
        out.part = 'float';
        out.x = x0; out.y = surfaceY + Math.sin(t * 1.9) * cfg.bob;
        out.tap = beat % (cfg.taps * 2) < cfg.taps && u - beat * cfg.crackS < cfg.crackS * 0.3;
    } else if (u < cfg.floatS + cfg.diveS) {
        const k = smooth((u - cfg.floatS) / cfg.diveS);
        out.part = 'dive';
        out.x = x0 + (bx - x0) * k; out.y = surfaceY + (deep - surfaceY) * Math.sin(k * Math.PI / 2);      // steep at first, levelling out below
    } else if (u < cfg.floatS + cfg.diveS + cfg.lingerS) {
        const k = (u - cfg.floatS - cfg.diveS) / cfg.lingerS;
        const beat = Math.floor(k * cfg.lingerS / cfg.crackS);
        out.part = 'linger';
        out.x = bx + Math.sin(k * Math.PI) * cfg.look; out.y = deep;
        out.tap = k * cfg.lingerS - beat * cfg.crackS < cfg.crackS * 0.3;
    } else {
        const k = smooth((u - cfg.floatS - cfg.diveS - cfg.lingerS) / cfg.riseS);
        out.part = 'rise';
        out.x = bx + (x0 - bx) * k; out.y = deep + (surfaceY - deep) * (1 - Math.cos(k * Math.PI / 2));      // level at first, then straight up
    }
    return out;
}
