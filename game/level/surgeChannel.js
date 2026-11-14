// The surge channel (pure, no Phaser; spec 5.0o): in the kelp forest, after the side cave, the
// swell runs through a channel between the stalks. It carries the fish forward for a few seconds,
// then draws it back a little, again and again, and the kelp leans with every push. A ride, not a
// danger: on balance it always carries the fish on its way east.

import { BIOMES } from './biomes.js';

export const SURGE_CHANNEL = {
    biome: 'kelp',
    at: 0.717,           // share of the biome's width where the channel begins (after the side cave)
    length: 2800,        // px it is long
    ends: 500,           // px over which the surge builds up and dies down at its ends
    periodS: 5.2,        // s for one push and its draw back ...
    pushShare: 0.62,     // ... this share of it is the push
    forward: 6,          // px/step it carries east at the height of a push (a downwelling pulls 11) ...
    back: 2.4,           // ... and west at the height of the draw back
    half: 600,           // px above and below the calm route it reaches, fading out
    lean: 1.4,           // how far the kelp leans with it (in the same measure as the surf's surge)
    streakMs: 70,        // ms between two specks that show the water's motion
    seen: 600            // px from its middle at which it goes into the reef book
};

const smooth = v => { const t = v <= 0 ? 0 : v >= 1 ? 1 : v; return t * t * (3 - 2 * t); };

/** Where the channel is: { x, x0, x1 }. */
export function channelSpot(cfg = SURGE_CHANNEL) {
    const b = BIOMES.find(bi => bi.id === cfg.biome), x0 = b.from + b.width * cfg.at;
    return { x: x0 + cfg.length / 2, x0, x1: x0 + cfg.length };
}

/** The swell at time `t` (s): +1 at the height of a push east, -1 at the height of the draw back; smooth, and the push lasts longer. */
export function swell(t, cfg = SURGE_CHANNEL) {
    const u = ((t % cfg.periodS) + cfg.periodS) % cfg.periodS / cfg.periodS;
    return u < cfg.pushShare ? Math.sin(Math.PI * u / cfg.pushShare) : -Math.sin(Math.PI * (u - cfg.pushShare) / (1 - cfg.pushShare));
}

/** How much of the surge there is at x: 0 outside the channel, 1 in its middle stretch. */
export function channelShare(x, cfg = SURGE_CHANNEL) {
    const s = channelSpot(cfg);
    return x <= s.x0 || x >= s.x1 ? 0 : smooth(Math.min(x - s.x0, s.x1 - x) / cfg.ends);
}

/** The surge's pull at (x, y) at time `t`: along the channel, into `out` ({ x, y } px/step). `routeY` = the calm route's depth at x. */
export function channelFlow(x, y, t, routeY, out = { x: 0, y: 0 }, cfg = SURGE_CHANNEL) {
    out.x = 0; out.y = 0;
    const k = channelShare(x, cfg);
    if (k <= 0) return out;
    const w = swell(t, cfg), deep = smooth(1 - Math.abs(y - routeY) / cfg.half);
    out.x = (w > 0 ? w * cfg.forward : w * cfg.back) * k * deep;
    return out;
}

/** How far a plant at x leans at time `t` (east positive), for the kelp in the channel. */
export function channelLean(x, t, cfg = SURGE_CHANNEL) {
    const k = channelShare(x, cfg);
    return k <= 0 ? 0 : swell(t, cfg) * k * cfg.lean;
}
