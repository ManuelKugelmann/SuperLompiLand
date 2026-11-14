// Small goals per area (pure, no Phaser; spec 5.0r loop 3): every area hides three pearls in clams on
// the seabed below the calm route. Finding one asks for a small choice (dive down, look around);
// the HUD says "Perlen 2/3" and the count is kept. One switch turns it off.

import { BIOMES } from './biomes.js';

export const SECRETS = {
    enabled: true,
    at: [0.22, 0.5, 0.78],      // where in each area a pearl lies (share of its width) ...
    jitter: 0.06,               // ... give or take this share
    search: 3000,               // px either way to look for seabed the fish can reach, if there is none right there
    reach: 900,                 // px under the calm route the seabed may lie at most (a dive, not an expedition)
    take: 95,                   // px from the clam at which the pearl is taken
    coins: 10,                  // coins a find is worth
    bottleUnder: 380            // where there is no seabed in reach (open sea, deep wreck, trench): a message bottle drifts this far under the route
};

const hash = (i, k) => { const v = Math.sin(i * 51.7 + k * 233.9) * 43758.5453; return v - Math.floor(v); };

/** Every pearl's place: [{ id, biome, x }] (x is where to start looking for its seabed). */
export function secretSpots(cfg = SECRETS) {
    if (!cfg.enabled) return [];
    const out = [];
    BIOMES.forEach((b, bi) => cfg.at.forEach((a, k) => {
        const u = a + (hash(bi, k) - 0.5) * 2 * cfg.jitter;
        out.push({ id: `${b.id}:${k}`, biome: b.id, x: b.from + b.width * u });
    }));
    return out;
}

/** How many of an area's pearls are found: { found, total }. `found` = a Set of ids. */
export function countIn(biomeId, found, cfg = SECRETS) {
    let n = 0;
    for (let k = 0; k < cfg.at.length; k++) if (found.has(`${biomeId}:${k}`)) n++;
    return { found: n, total: cfg.at.length };
}

/**
 * Where on the seabed the pearl lies: try x, then step outward up to `search` px, taking the first
 * place whose seabed is within `reach` under the route. `seabed(x)` = ground y under the route or
 * null; `route(x)` = the route's y. Returns { x, y } or null.
 */
export function placeSecret(x0, seabed, route, cfg = SECRETS) {
    for (let d = 0; d <= cfg.search; d += 150) {
        for (const x of d ? [x0 + d, x0 - d] : [x0]) {
            const g = seabed(x);
            if (g !== null && g - route(x) <= cfg.reach) return { x, y: g };
        }
    }
    return null;
}
