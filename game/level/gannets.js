// Plunging gannets (pure, no Phaser; spec 5.0o): just behind the sea arch, where the calm route
// still runs shallow, a few gannets plunge in near the lane one after the other: a splash, a
// trail of bubbles a few hundred px deep, a turn, and each swims up again with a small fish in
// its bill. Nothing here can hurt: they dive ahead of the fish, never onto it.

import { seaArch } from './seaArch.js';

export const GANNETS = {
    after: 200,          // px east of the sea arch's end where they fish (the route runs just under the surface there, through the arch)
    half: 700,           // px to either side of that within which a volley starts
    birds: 4,            // plunges in a volley ...
    everyS: 0.9,         // ... s apart
    ahead: [260, 190],   // px ahead of the fish the first one comes down, and px further each next one
    depth: [260, 430],   // px under the waterline a plunge reaches
    plungeS: 0.45,       // s down (fast: they hit the water like arrows) ...
    turnS: 0.5,          // ... s turning at the bottom ...
    riseS: 1.7,          // ... and s swimming up again
    drift: 90,           // px it moves on along its way while it comes up
    length: 150,         // px a bird is long
    bubbleS: 0.04,       // s between bubbles of the trail on the way down
    restS: 16,           // s before the next volley
    seen: 550            // px from a plunge at which they go into the reef book
};

const hash = (i, k) => { const v = Math.sin(i * 41.3 + k * 211.7) * 43758.5453; return v - Math.floor(v); };
const smooth = v => { const t = v <= 0 ? 0 : v >= 1 ? 1 : v; return t * t * (3 - 2 * t); };

/** Where they fish: { x, x0, x1 }. */
export function gannetSpot(cfg = GANNETS) {
    const x = seaArch().x1 + cfg.after;
    return { x, x0: x - cfg.half, x1: x + cfg.half };
}

/** A volley that starts with the fish at `fishX` travelling `dir` (+1 east): [{ x, depth, at (s after its start), dir }]. `seed` varies the depths. */
export function volley(fishX, dir, seed = 0, cfg = GANNETS) {
    return Array.from({ length: cfg.birds }, (_, k) => ({
        x: fishX + dir * (cfg.ahead[0] + k * cfg.ahead[1]),
        depth: cfg.depth[0] + (cfg.depth[1] - cfg.depth[0]) * hash(seed + k, 1),
        at: k * cfg.everyS,
        dir
    }));
}

/** How long a volley lasts (s). */
export function volleyS(cfg = GANNETS) {
    return (cfg.birds - 1) * cfg.everyS + cfg.plungeS + cfg.turnS + cfg.riseS;
}

/**
 * One bird `u` seconds after its plunge began; `surfaceY` = the waterline at its place. Into `out`:
 * { x, y, part ('wait' | 'plunge' | 'turn' | 'rise' | 'gone'), angle (rad: the way its bill points), fish (it carries one) }.
 */
export function gannetAt(p, u, surfaceY, out = {}, cfg = GANNETS) {
    const bottom = surfaceY + p.depth;
    out.fish = false; out.x = p.x; out.y = surfaceY; out.angle = Math.PI / 2;
    if (u < 0) { out.part = 'wait'; return out; }
    if (u < cfg.plungeS) {
        out.part = 'plunge';
        out.y = surfaceY + p.depth * (u / cfg.plungeS) ** 0.7;      // fastest at the surface, slowing as it goes deeper
    } else if (u < cfg.plungeS + cfg.turnS) {
        const k = (u - cfg.plungeS) / cfg.turnS;
        out.part = 'turn'; out.fish = k > 0.5;
        out.y = bottom; out.x = p.x + p.dir * 20 * Math.sin(k * Math.PI);
        out.angle = Math.PI / 2 - p.dir * k * Math.PI * 0.85;      // round from pointing down to pointing up along its way
    } else if (u < cfg.plungeS + cfg.turnS + cfg.riseS) {
        const k = smooth((u - cfg.plungeS - cfg.turnS) / cfg.riseS);
        out.part = 'rise'; out.fish = true;
        out.x = p.x + p.dir * cfg.drift * k; out.y = bottom + (surfaceY - bottom) * k;
        out.angle = Math.atan2(-(bottom - surfaceY), p.dir * cfg.drift);
    } else out.part = 'gone';
    return out;
}
