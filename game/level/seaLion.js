// The sea lion pup (pure, no Phaser; spec 5.0o): on the rocky shore a young sea lion shoots past,
// swims two playful loops round the fish with a trail of bubbles, and goes up for air. Fast and
// curious, never touching. After a rest it comes again while the fish is still about.

import { BIOMES } from './biomes.js';

export const SEA_LION = {
    biome: 'shore',
    at: 0.365,           // share of the biome's width where it plays (the long stretch before the shore's friend)
    half: 1500,          // px to either side of its spot in which it comes to the fish
    from: [1150, -380],  // where it comes from: px ahead of the fish and above it
    passS: 1.3,          // s it takes to shoot in
    laps: 2,             // loops round the fish ...
    lapS: 2.1,           // ... s each
    radius: [270, 180],  // px half width and half height of the loop (never nearer to the fish than the smaller one)
    leaveS: 2.4,         // s up to the surface
    away: 800,           // px ahead of the fish it surfaces
    restS: 22,           // s before it comes again
    length: 290,         // px long (a pup: under two fish lengths)
    bubbleS: 0.12,       // s between bubbles of its trail while it loops
    seen: 500            // px at which it goes into the reef book
};

const smooth = v => { const t = v <= 0 ? 0 : v >= 1 ? 1 : v; return t * t * (3 - 2 * t); };

/** Where it plays: { x, x0, x1 }. */
export function seaLionSpot(cfg = SEA_LION) {
    const b = BIOMES.find(bi => bi.id === cfg.biome), x = b.from + b.width * cfg.at;
    return { x, x0: x - cfg.half, x1: x + cfg.half };
}

/** How long one visit lasts (s). */
export function visitS(cfg = SEA_LION) {
    return cfg.passS + cfg.laps * cfg.lapS + cfg.leaveS;
}

/**
 * The pup `u` seconds into a visit, round a fish at (fx, fy) that travels `dir` (+1 east);
 * `surfaceY` = the waterline. Into `out`: { x, y, part ('pass' | 'loop' | 'leave'), done }.
 * The loop starts and ends ahead of the fish, so the three parts join without a jump.
 */
export function seaLionAt(u, fx, fy, dir, surfaceY, out = {}, cfg = SEA_LION) {
    const [rx, ry] = cfg.radius, ex = fx + dir * rx, loopS = cfg.laps * cfg.lapS;
    out.done = u >= visitS(cfg);
    if (u < cfg.passS) {
        const k = smooth(u / cfg.passS);
        out.part = 'pass';
        out.x = fx + dir * (cfg.from[0] + (rx - cfg.from[0]) * k);
        out.y = Math.max(surfaceY + 30, fy + cfg.from[1] * (1 - k));
    } else if (u < cfg.passS + loopS) {
        const a = (u - cfg.passS) / cfg.lapS * Math.PI * 2;
        out.part = 'loop';
        out.x = fx + dir * Math.cos(a) * rx;
        out.y = Math.max(surfaceY + 30, fy + Math.sin(a) * ry);      // a fish at the surface: the loop's top flattens under the waterline
    } else {
        const k = smooth((u - cfg.passS - loopS) / cfg.leaveS);
        out.part = 'leave';
        out.x = ex + dir * (cfg.away - rx) * k;
        out.y = fy + (surfaceY + 10 - fy) * k;
    }
    return out;
}
