// Rock behind the play plane at near and mid range (user 2026-11-14: "near or mid range
// rocky backgrounds, not transparent everywhere, different perceived depths; some areas
// open, some narrow, closed, near wall"). Each layer is a second procedural rock field —
// the same kind of terrain as the play plane, from its own seed — seen at a parallax
// depth s: smaller (its virtual world is scaled by 1/s), fogged toward the water and of
// low contrast, unlit at the rims, so it reads as solid rock further back but never as
// something to bump into. A slow "enclosure" noise opens it up in some stretches and
// closes it into a wall in others, to the closed share each biome asks for (`rockWall` in
// biomes.js); the open ocean has none.
// Pure (no Phaser): the terrain worker shades the layer chunks, RockLayers.js shows them.
// Tested in tests/rockLayers.test.mjs.
import { vnoise } from './terrain.js';
import { biomeBlendAt } from './biomes.js';
import { SHADE } from './shade.js';
import { ROUTE } from './density.js';

export const ROCK_LAYERS = [
    // s = parallax; seed = field seed offset; share = how much of the biome's closed share
    // this layer takes (near walls are rarer); swing = how far the enclosure pushes the field;
    // scale = enclosure noise period (world px); fog = share of the water colour baked in;
    // dark = tint multiply on top; depth = draw order.
    // clearRoute: keep the calm main route free (the play field is open water there; a wall
    // drawn over it would read as solid, gamedesigner 2026-11-14).
    { id: 'mid', s: 0.6, seed: 101, share: 1, swing: 0.32, scale: 1700, fog: 0.45, dark: 0.92, depth: -9.5 },
    { id: 'near', s: 0.82, seed: 202, share: 0.55, swing: 0.36, scale: 1300, fog: 0.3, dark: 0.95, depth: -7, clearRoute: true }
];

/** Layer chunk size (layer px) and its shading: coarse (soft), no sand, low contrast, unlit rims. */
export const LAYER_CHUNK = 960;
export const LAYER_SHADE = {
    ...SHADE,
    rockSize: 248,       // not a power of two: the GPU clamps its edges (power-of-two textures repeat: seam lines)
    node: 8, backSize: 0, sandReach: 0, relief: 0.45, bump: 0.12, grain: 0.14,
    keyStrength: 0.55, bevel: 30, coreShade: 0.4
};

/**
 * Rock never floats: the density of rock above is carried down `steps` x `step` virtual px,
 * losing only `fall` per step, and its foot spreads by `spread` px per step (a slope, not a
 * vertical cut) with a little wobble. `grid` is the low-pass cell (virtual px): shapes
 * smaller than about two cells (specks) vanish.
 */
export const SUPPORT = { step: 150, steps: 12, fall: 0.003, spread: 40, wobble: 40, grid: 110 };

/** Around the calm route: no near rock within `half` px of its middle, fading back in over `fade` px. */
export const ROUTE_CLEAR = { half: ROUTE.halfWidth, fade: 220, push: 0.9 };

/** Enclosure noise at world x (0..1): two octaves, so every biome sees many open and closed stretches. */
const encNoise = (x, layer) => 0.62 * vnoise(x / layer.scale, layer.seed * 0.37, layer.seed)
    + 0.38 * vnoise(x / (layer.scale * 0.37), layer.seed * 0.71, layer.seed + 9);

// The noise is middle-heavy: cut it at its own quantiles so a share c really closes c.
const Q = (() => {
    const v = [], probe = { scale: 1, seed: 7 };
    for (let i = 0; i < 6000; i++) v.push(encNoise(i * 0.913, probe));
    return v.sort((a, b) => a - b);
})();
/** The value below which share q (0..1) of the enclosure noise lies. */
export const noiseQuantile = q => Q[Math.min(Q.length - 1, Math.max(0, Math.floor(q * Q.length)))];

/** Closed share (0..1) of the rock layers at world x, blended across biome borders. */
export function wallShare(x) {
    const { a, b, t } = biomeBlendAt(x);
    return (a.rockWall || 0) * (1 - t) + (b.rockWall || 0) * t;
}

/**
 * How closed a layer is at world x: -1 = open water, +1 = a wall. A slow noise is cut at
 * the biome's closed share, so roughly that share of the stretches is wall.
 */
export function enclosure(x, layer) {
    const c = wallShare(x) * layer.share;
    if (c <= 0.001) return -1;
    const n = encNoise(x, layer);
    return Math.max(-1, Math.min(1, (n - noiseQuantile(1 - c)) * 6));   // share c of stretches above the cut
}

/** A low-passed copy of a density field: smooth bilinear over a cached `g`-px grid (no specks). */
export function lowPass(base, g) {
    const cache = new Map();
    const at = (i, j) => {
        const k = i * 73856093 ^ j * 19349663;
        let v = cache.get(k);
        if (v === undefined) {
            if (cache.size > 400000) cache.clear();
            v = base.density(i * g, j * g);
            cache.set(k, v);
        }
        return v;
    };
    return {
        density(x, y) {
            const fx = x / g, fy = y / g, i = Math.floor(fx), j = Math.floor(fy);
            let u = fx - i, v = fy - j;
            u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
            const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
            return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
        }
    };
}

/**
 * The density field of one layer in its own virtual world (world px / s): the low-passed
 * terrain field of its seed, pushed toward rock or water by the enclosure, and carried down
 * below any rock (SUPPORT) so pieces become pillars and walls standing on the seabed — rock
 * in the background never floats. With `route` (world x -> y of the calm route), a layer
 * with `clearRoute` stays out of the route band (ROUTE_CLEAR).
 */
export function layerField(base, layer, { route = null, sup = SUPPORT, clear = ROUTE_CLEAR } = {}) {
    const soft = lowPass(base, sup.grid);
    return {
        density(x, y) {
            const e = enclosure(x, layer);
            if (e <= -0.999) return -1;                         // open: nothing behind
            let d = soft.density(x, y);
            const w = (vnoise(x / 260, y / 260, layer.seed + 5) - 0.5) * sup.wobble;
            for (let k = 1; k <= sup.steps; k++) {
                const yy = y - k * sup.step, dx = k * sup.spread, f = k * sup.fall;
                d = Math.max(d, soft.density(x + w, yy) - f, soft.density(x + w - dx, yy) - f, soft.density(x + w + dx, yy) - f);
            }
            d += layer.swing * e - 0.12;
            if (route && layer.clearRoute) {
                const off = Math.abs(y - route(x)), t = Math.min(1, Math.max(0, (off - clear.half) / clear.fade));
                d -= clear.push * (1 - t * t * (3 - 2 * t));
            }
            return d;
        }
    };
}

/** Virtual-world rectangle that layer chunk (cx, cy) shows. */
export function layerChunkRect(layer, cx, cy, span = LAYER_CHUNK) {
    return { ox: cx * span / layer.s, oy: cy * span / layer.s, span: span / layer.s };
}

/**
 * Bake distance into a shaded layer picture (RGBA, size²): every pixel moves `layer.fog`
 * of the way toward the water colour of its biome (mixed with the deep tint by depth), which
 * lifts the darkest values and lowers the contrast. The rock's alpha is kept: solid, not see-through.
 */
export function fogLayer(rgba, size, ox, oy, span, layer, deepTint = SHADE.deepTint, maxDepth = 5600) {
    const fog = layer.fog;
    for (let px = 0; px < size; px++) {
        const { a, b, t } = biomeBlendAt(ox + (px + 0.5) * span / size);
        const wc = [16, 8, 0].map(sh => ((a.water[0] >> sh) & 255) * (1 - t) + ((b.water[0] >> sh) & 255) * t);
        for (let py = 0; py < size; py++) {
            const o = (py * size + px) * 4;
            if (rgba[o + 3] === 0) continue;
            const deep = Math.min(1, (oy + (py + 0.5) * span / size) / maxDepth) * 0.6;
            for (let c = 0; c < 3; c++) {
                const water = wc[c] + (deepTint[c] - wc[c]) * deep;
                rgba[o + c] = rgba[o + c] + (water - rgba[o + c]) * fog;
            }
        }
    }
    return rgba;
}
