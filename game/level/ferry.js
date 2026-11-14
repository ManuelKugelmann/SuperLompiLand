// The ferry passing over (pure, no Phaser; spec 5.0o): in the harbour a ferry comes up from
// behind and passes overhead. Its hull throws a shadow down through the water, and behind its
// stern the propeller wash streams down as a band of bubbles that carries the fish along for a
// few seconds, like the whale's wake. It is far overhead: nothing to bump into.

import { BIOMES } from './biomes.js';

export const FERRY = {
    biome: 'harbour',
    at: 0.26,            // share of the biome's width where it crosses (the stretch before the harbour's friend)
    half: 1400,          // px to either side of that within which a passage starts
    speed: 430,          // px/s (faster than a cruising fish: it overtakes)
    lead: 1900,          // px behind the fish it starts, and ahead of it where it is gone
    hull: [1000, 150],   // px long and deep in the water
    shadow: 0.27,        // how much darker the water is under it, all the way down
    look: { within: 600, max: 400, easeS: 0.8 },   // the camera looks up while the hull is within this many px of the fish (along x): by at most `max` px, eased over `easeS`
    wash: {
        length: 1700,    // px behind the stern the wash reaches
        half: 190,       // px above and below its middle it carries
        slope: 1.6,      // px it sinks per px behind the stern (steeply: most of its length runs along the lane) ...
        under: 40,       // ... down to this far under the calm route, where it runs level
        carry: 7         // px/step it carries along at the stern (a downwelling pulls 11), fading out behind
    },
    restS: 35,           // s before the next passage
    seen: 700            // px from its shadow at which it goes into the reef book
};

const smooth = v => { const t = v <= 0 ? 0 : v >= 1 ? 1 : v; return t * t * (3 - 2 * t); };

/** Where it crosses: { x, x0, x1 }. */
export function ferrySpot(cfg = FERRY) {
    const b = BIOMES.find(bi => bi.id === cfg.biome), x = b.from + b.width * cfg.at;
    return { x, x0: x - cfg.half, x1: x + cfg.half };
}

/** A passage that starts with the fish at `fishX`, travelling `dir` (+1 east): { x0, x1, dir, seconds }. */
export function passage(fishX, dir, cfg = FERRY) {
    return { x0: fishX - dir * cfg.lead, x1: fishX + dir * cfg.lead * 1.6, dir, seconds: cfg.lead * 2.6 / cfg.speed };
}

/** Middle of the hull `u` seconds into a passage (world x). */
export function hullX(pass, u, cfg = FERRY) {
    return pass.x0 + pass.dir * cfg.speed * u;
}

/** Middle depth of the wash `s` px behind the stern. */
export function washY(s, surfaceY, routeY, cfg = FERRY) {
    return Math.min(routeY + cfg.wash.under, surfaceY + cfg.hull[1] + s * cfg.wash.slope);
}

/**
 * The wash's pull at (x, y) with the hull's middle at `hx`: along the ferry's way, strongest at
 * the stern and in the band's middle. Into `out` ({ x, y } px/step; zero outside the band).
 */
export function washAt(x, y, hx, dir, surfaceY, routeY, out = { x: 0, y: 0 }, cfg = FERRY) {
    const W = cfg.wash, s = (hx - dir * cfg.hull[0] / 2 - x) * dir;      // px behind the stern
    out.x = 0; out.y = 0;
    if (s <= 0 || s >= W.length) return out;
    const off = Math.abs(y - washY(s, surfaceY, routeY, cfg));
    if (off >= W.half) return out;
    out.x = dir * W.carry * (1 - s / W.length) * smooth(1 - off / W.half);
    return out;
}

/**
 * How far (px) the camera looks up for the ferry: enough to bring the waterline and the hull into
 * the top of the picture, never more than `look.max`. `viewTop` = world y of the picture's top
 * edge as it would be without the look; `k` = 0..1, how far the look is eased in.
 */
export function lookUp(viewTop, surfaceY, k, cfg = FERRY) {
    return Math.max(0, Math.min(cfg.look.max, viewTop - (surfaceY - 30))) * smooth(k);
}

/** The look's ease a step later: toward 1 while the hull is within `look.within` px of the fish, back to 0 otherwise. */
export function lookEase(k, hullDx, dt, cfg = FERRY) {
    const step = dt / cfg.look.easeS;
    return Math.abs(hullDx) < cfg.look.within ? Math.min(1, k + step) : Math.max(0, k - step);
}
