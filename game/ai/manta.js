// The manta (pure, no Phaser; spec 9.1 "a manta glides over", the reef's wonder beat): a big,
// calm animal that cruises to and fro high over the reef, far above anything that matters. It
// does nothing to the player and wants nothing; it is there to be looked up at.

import { BIOMES } from '../level/biomes.js';

export const MANTA = {
    biome: 'reef',
    margin: 1400,       // px it stays away from the biome's ends
    above: 430,         // px over the calm route it glides
    swell: 90,          // px it rises and falls on its way
    speed: 85,          // px per second
    turn: 900,          // px over which it slows, banks and comes about at each end
    width: 620,         // px wing tip to wing tip as drawn
    seen: 560           // px: this close, it goes into the reef book
};

/** The stretch it patrols: { x0, x1 }. */
export function mantaSpan(cfg = MANTA) {
    const b = BIOMES.find(bi => bi.id === cfg.biome);
    return { x0: b.from + cfg.margin, x1: b.from + b.width - cfg.margin };
}

/**
 * Where it is at time t (seconds): { x, y, vx, vy (px per 60 Hz step), dir (1 east, -1 west) }.
 * `routeY(x)` = depth of the calm route. It goes to and fro along its span, easing round at
 * each end (a smooth cosine, so it never stops dead or snaps round).
 */
export function mantaAt(t, routeY, out = {}, cfg = MANTA) {
    const { x0, x1 } = mantaSpan(cfg), len = x1 - x0, period = 2 * len / cfg.speed * (Math.PI / 2);
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
