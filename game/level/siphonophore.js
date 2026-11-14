// Siphonophore strings (pure, no Phaser; spec 5.0n "no kind twice in a row"): in the deep trench,
// between the glowing jelly fields, long chains of tiny lights drift across the calm route: a
// siphonophore is a colony of many small animals in one string, the longest animal there is.
// They sway slowly, and when the fish comes close a wave of light runs along the string from
// where it passed. Nothing here can hurt.

import { BIOMES } from './biomes.js';
import { BLOOM } from './blooms.js';
import { ventSpot } from './ventField.js';

export const SIPHON = {
    biome: 'trench',
    keep: 4000,          // px a spot stays away from the vent field
    width: 2600,         // px a spot is long
    strings: 4,
    beads: 28,           // lights on a string
    length: [650, 1050], // px a string is long
    spread: 420,         // px above and below the calm route its middle may lie
    lean: 0.5,           // how far a string leans from upright at most (share of its length sideways)
    sway: [46, 0.5, 5],  // px its beads swing sideways, how fast (rad/s), and how many beads one swing spans
    wake: 210,           // px from a bead at which the fish sets off a wave of light ...
    run: 22,             // ... which runs along the string this many beads per second ...
    crest: 3.5,          // ... this many beads wide ...
    rest: 2.2,           // ... and can start again after this many seconds
    dim: 0.3,            // brightness of a bead at rest (1 = in the wave's crest)
    seen: 700            // px from a spot's middle at which it goes into the reef book
};

const hash = (i, k) => { const v = Math.sin(i * 57.3 + k * 173.9) * 43758.5453; return v - Math.floor(v); };

let SPOTS = null;

/** Where the strings drift: [{ x, x0, x1 }], west to east: half way between the trench's glowing jelly fields. */
export function siphonSpots(cfg = SIPHON, bloom = BLOOM) {
    if (cfg === SIPHON && bloom === BLOOM && SPOTS) return SPOTS;
    const t = BIOMES.find(b => b.id === cfg.biome), end = ventSpot().x0 - cfg.keep, out = [];
    for (let x0 = t.from + bloom.deep.first + bloom.deep.every / 2; x0 + cfg.width < end; x0 += bloom.deep.every) out.push({ x: x0 + cfg.width / 2, x0, x1: x0 + cfg.width });
    if (cfg === SIPHON && bloom === BLOOM) SPOTS = out;
    return out;
}

/** String `k` of a spot: { x, dy (px from the route to its middle), length, lean (px its lower end lies east of its upper), phase }. */
export function stringAt(spot, k, cfg = SIPHON) {
    const s = spot.x0 * 0.001 + k * 7.1;
    return {
        x: spot.x0 + (k + 0.25 + 0.5 * hash(s, 1)) * (spot.x1 - spot.x0) / cfg.strings,
        dy: (hash(s, 2) * 2 - 1) * cfg.spread,
        length: cfg.length[0] + (cfg.length[1] - cfg.length[0]) * hash(s, 3),
        lean: (hash(s, 4) * 2 - 1) * cfg.lean,
        phase: hash(s, 5) * 6.283
    };
}

/** Bead `j` of a string at time `t` (s); `routeY` = the route's depth at the string. Into `out` ({ x, y }). */
export function beadAt(str, j, t, routeY, out = {}, cfg = SIPHON) {
    const u = j / (cfg.beads - 1) - 0.5;      // -0.5 at its upper end, 0.5 at its lower
    out.x = str.x + u * str.length * str.lean + Math.sin(t * cfg.sway[1] + str.phase + j / cfg.sway[2]) * cfg.sway[0] * (0.4 + Math.abs(u));      // its ends swing widest
    out.y = routeY + str.dy + u * str.length * Math.sqrt(1 - str.lean * str.lean);
    return out;
}

/**
 * Brightness (dim..1) of bead `j` when a wave of light started `since` seconds ago at bead `from`
 * (`since` < 0 or null: no wave): the crest runs outward both ways and fades as it goes.
 */
export function beadGlow(j, from, since, cfg = SIPHON) {
    if (since === null || since < 0) return cfg.dim;
    const off = Math.abs(Math.abs(j - from) - since * cfg.run), crest = Math.max(0, 1 - off / cfg.crest);
    const fade = Math.max(0, 1 - since * cfg.run / cfg.beads);
    return cfg.dim + (1 - cfg.dim) * crest * fade;
}
