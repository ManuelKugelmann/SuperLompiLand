// The manta (pure, no Phaser; spec 9.1 "a manta glides over", the reef's wonder beat): a big,
// calm animal that cruises to and fro high over the reef, far above anything that matters. It
// does nothing to the player and wants nothing; it is there to be looked up at.

import { BIOMES } from '../level/biomes.js';
import { SIZES } from '../scale.js';

export const MANTA = {
    biome: 'reef',
    ats: [0.2, 0.5, 0.8],   // where along the biome its stretches lie (share of its width): a manta over every part of the reef (spec 5.0i)
    reach: 5200,        // px its stretch is long
    above: 430,         // px over the calm route it glides
    swell: 90,          // px it rises and falls on its way
    speed: 85,          // px per second
    turn: 900,          // px over which it slows, banks and comes about at each end
    width: SIZES.manta, // px wing tip to wing tip as drawn (the one scale table, game/scale.js)
    seen: 560           // px: this close, it goes into the reef book
};

/** The stretch it patrols nearest to world x `near` (the first one when none is given): { x0, x1 }. */
export function mantaSpan(near, cfg = MANTA) {
    const b = BIOMES.find(bi => bi.id === cfg.biome), mids = cfg.ats.map(at => b.from + b.width * at);
    let mid = mids[0];
    if (near !== undefined) for (const m of mids) if (Math.abs(m - near) < Math.abs(mid - near)) mid = m;
    return { x0: mid - cfg.reach / 2, x1: mid + cfg.reach / 2 };
}

/**
 * Where it is at time t (seconds): { x, y, vx, vy (px per 60 Hz step), dir (1 east, -1 west) }.
 * `routeY(x)` = depth of the calm route. It goes to and fro along its span, easing round at
 * each end (a smooth cosine, so it never stops dead or snaps round). `near` = world x that
 * picks the stretch (the one nearest to it).
 */
export function mantaAt(t, routeY, out = {}, cfg = MANTA, near) {
    const { x0, x1 } = mantaSpan(near, cfg), len = x1 - x0, period = 2 * len / cfg.speed * (Math.PI / 2);
    // A cosine to and fro has the same top speed as a straight run of `speed` when the period is stretched by pi / 2.
    const ph = (t / period) * Math.PI * 2, u = 0.5 - 0.5 * Math.cos(ph);
    out.x = x0 + len * u;
    out.vx = len * 0.5 * Math.sin(ph) * (Math.PI * 2 / period) / 60;
    out.dir = Math.sin(ph) >= 0 ? 1 : -1;
    const sw = Math.sin(t * 0.21) * cfg.swell;
    out.y = routeY(out.x) - cfg.above + sw;
    out.vy = Math.cos(t * 0.21) * 0.21 * cfg.swell / 60;
    return out;
}
