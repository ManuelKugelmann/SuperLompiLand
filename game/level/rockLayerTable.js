// Rock behind the play plane at near and mid range (user 2026-11-14: "near or mid range
// rocky backgrounds, not transparent everywhere, different perceived depths; some areas
// open, some narrow, closed, near wall"). Each layer is a second procedural rock field —
// the same kind of terrain as the play plane, from its own seed — seen at a parallax
// depth s: smaller (its virtual world is scaled by 1/s), darker and fogged toward the
// water, unlit at the rims, so it reads as solid rock further back but never as
// something to bump into. A slow "enclosure" noise opens it up in some stretches and
// closes it into a near wall in others; the open ocean has none.
// Pure (no Phaser): the terrain worker shades the layer chunks, RockLayers.js shows them.
// Tested in tests/rockLayers.test.mjs.
import { vnoise } from './terrain.js';
import { biomeBlendAt } from './biomes.js';
import { SHADE } from './shade.js';


export const ROCK_LAYERS = [
    // s = parallax; seed = field seed offset; open = base bias (negative = more water);
    // swing = how far the enclosure noise opens or closes it; scale = noise period (world px);
    // dark / fog = how much darker and how far toward the water colour; depth = draw order.
    { id: 'mid', s: 0.6, seed: 101, open: -0.06, swing: 0.24, scale: 7000, dark: 0.72, fog: 0.48, depth: -9.5 },
    { id: 'near', s: 0.82, seed: 202, open: -0.12, swing: 0.3, scale: 5200, dark: 0.86, fog: 0.3, depth: -7 }
];

/** Layer chunk size (layer px) and its shading: coarser, no sand, soft rims (far rock is unlit). */
export const LAYER_CHUNK = 960;
export const LAYER_SHADE = { ...SHADE, rockSize: 320, node: 8, backSize: 0, sandReach: 0, relief: 0.6, bump: 0.2, keyStrength: 0.6, bevel: 30, coreShade: 0.45 };

/**
 * Rock never floats: the density of rock above is carried down `steps` x `step` virtual px,
 * losing only `fall` per step, and its foot spreads by `spread` px per step (a slope, not a
 * vertical cut) with a little wobble. A plain maximum of smooth samples: no steps or stairs.
 */
export const SUPPORT = { step: 150, steps: 12, fall: 0.003, spread: 40, wobble: 40 };

/**
 * How closed the rock layers are at world x: -1 = open water, +1 = a wall. Slow noise,
 * scaled by the biome's `backRock` reach (0 in the open ocean = always open).
 */
export function enclosure(x, layer) {
    const { a, b, t } = biomeBlendAt(x);
    const reach = (a.backRock || 0) * (1 - t) + (b.backRock || 0) * t;
    if (reach <= 0) return -1;
    const n = vnoise(x / layer.scale, layer.seed * 0.37, layer.seed) * 2 - 1;     // -1..1
    return Math.max(-1, Math.min(1, n * 1.6 * Math.min(1, reach / 900)));
}

/**
 * The density field of one layer in its own virtual world (world px / s): the terrain
 * field of its seed, pushed toward rock or water by the enclosure, and carried down below
 * any rock (SUPPORT) so islands become pillars and walls standing on the seabed — rock
 * in the background never floats. Open stretches lose their rock entirely; closed ones
 * grow into a wall with a few openings.
 */
export function layerField(base, layer, sup = SUPPORT) {
    return {
        density(x, y) {
            const e = enclosure(x, layer);
            if (e <= -0.999) return -1;                         // open ocean: nothing behind
            let d = base.density(x, y);
            const w = (vnoise(x / 260, y / 260, layer.seed + 5) - 0.5) * sup.wobble;
            for (let k = 1; k <= sup.steps; k++) {
                const yy = y - k * sup.step, dx = k * sup.spread, f = k * sup.fall;
                d = Math.max(d, base.density(x + w, yy) - f, base.density(x + w - dx, yy) - f, base.density(x + w + dx, yy) - f);
            }
            return d + layer.open + layer.swing * e;
        }
    };
}

/** Virtual-world rectangle that layer chunk (cx, cy) shows. */
export function layerChunkRect(layer, cx, cy, span = LAYER_CHUNK) {
    return { ox: cx * span / layer.s, oy: cy * span / layer.s, span: span / layer.s };
}
