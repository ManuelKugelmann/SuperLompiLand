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
import { FIELD, ROUTE } from './density.js';

const T = FIELD.threshold;
const smooth01 = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export const ROCK_LAYERS = [
    // s = parallax; seed = field seed offset; share = how much of the biome's closed share
    // this layer takes (near walls are rarer); swing = how far the enclosure pushes the field;
    // scale = enclosure noise period (world px); open = extra push toward water (near walls
    // never fill the frame); fog = share of the water colour baked in;
    // dark = tint multiply on top; depth = draw order.
    // clearRoute: keep the calm main route free (the play field is open water there; a wall
    // drawn over it would read as solid, gamedesigner 2026-11-14).
    { id: 'mid', s: 0.6, seed: 101, share: 1, swing: 0.32, scale: 1700, fog: 0.45, dark: 0.92, depth: -9.5 },
    { id: 'near', s: 0.82, seed: 202, share: 0.55, open: -0.08, swing: 0.36, scale: 1300, fog: 0.3, dark: 0.95, depth: -7, clearRoute: true }
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
 * Rock never floats: anything up to `reach` virtual px below rock is rock too. `grid` is the
 * low-pass cell (virtual px): shapes smaller than about two cells (specks) vanish. What is
 * carried down is the exact maximum of a smoother field (`carryGrid` [x, y]) over the whole
 * stretch above — continuous, so the foot is one piece (no stack of chips under a thin piece)
 * and towers on top don't repeat as battlements. The foot is a little wider than the rock
 * (`spread`, a slope instead of a vertical cut) with a wobble. Rock only just above the
 * threshold is not carried (`minCarry`: a minimum piece size); carried rock saturates
 * `lift` above the threshold within `band`, so it is a flat foot, not a ripple.
 */
export const SUPPORT = { reach: 1800, gap: 60, spread: 120, wobble: 260, grid: 110, carryGrid: [280, 480], minCarry: 0.03, band: 0.06, lift: 0.1 };

/**
 * Near the surface: no layer rock above `below` virtual px, fading back in over `fade` px. The
 * edge wanders by up to `wander` px along x, so rock tops are not cut flat like tables.
 */
export const SURFACE_CLEAR = { below: 300, fade: 420, push: 1.2, wander: 520 };

/**
 * The calm route stays free of near rock: a route-clearing layer shows only rock below
 * `half` px under the route's middle (plus up to `wander` px), fading in over `fade` px.
 */
export const ROUTE_CLEAR = { half: ROUTE.halfWidth, fade: 220, push: 1.2, wander: 260 };

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

/** A low-passed copy of a density field: smooth bilinear over a cached grid (no specks); `g` = px or [x, y]. */
export function lowPass(base, g) {
    const [gx, gy] = Array.isArray(g) ? g : [g, g];
    const cache = new Map();
    const at = (i, j) => {
        const k = i * 73856093 ^ j * 19349663;
        let v = cache.get(k);
        if (v === undefined) {
            if (cache.size > 400000) cache.clear();
            v = base.density(i * gx, j * gy);
            cache.set(k, v);
        }
        return v;
    };
    // The field along x at grid row j (smooth in x), and the field at (x, y).
    const rowAt = (x, j) => {
        const fx = x / gx, i = Math.floor(fx);
        let u = fx - i; u = u * u * (3 - 2 * u);
        return at(i, j) + (at(i + 1, j) - at(i, j)) * u;
    };
    return {
        /** Largest value on the column x between y0 and y1 (exact: between rows it is monotone). */
        columnMax(x, y0, y1) {
            let m = Math.max(this.density(x, y0), this.density(x, y1));
            for (let j = Math.ceil(y0 / gy); j * gy <= y1; j++) m = Math.max(m, rowAt(x, j));
            return m;
        },
        density(x, y) {
            const fx = x / gx, fy = y / gy, i = Math.floor(fx), j = Math.floor(fy);
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
    // The surface clearance acts on the field itself, before the low pass and the carrying:
    // a piece removed near the surface takes its foot with it (no slab left hanging below).
    const surfacePush = (x, y) => {
        const below = SURFACE_CLEAR.below + (0.7 * vnoise(x / 900, 3.7, layer.seed + 11) + 0.3 * vnoise(x / 210, 5.1, layer.seed + 13)) * SURFACE_CLEAR.wander;
        if (y >= below + SURFACE_CLEAR.fade) return 0;
        const t = Math.max(0, (y - below) / SURFACE_CLEAR.fade);
        return SURFACE_CLEAR.push * (1 - t * t * (3 - 2 * t));
    };
    const cleared = { density: (x, y) => base.density(x, y) - surfacePush(x, y) };
    const soft = lowPass(cleared, sup.grid), carry = lowPass(cleared, sup.carryGrid);
    return {
        density(x, y) {
            const e = enclosure(x, layer);
            if (e <= -0.999) return -1;                         // open: nothing behind
            const shift = layer.swing * e - 0.12 + (layer.open || 0);
            // Only rock strong enough to carry a foot is shown: a thin ledge that would not reach
            // the floor is dropped whole. The detail comes from the fine field, but it is capped
            // by the coarse one the feet are carried from — what shows here always has a foot.
            const lo = T + sup.minCarry;
            let d = Math.min(soft.density(x, y) + shift - (sup.minCarry + sup.band * 0.5),
                T + (carry.density(x, y) + shift - lo) * 2);
            // The strongest rock in the stretch above (centre and both sides of the foot): once it
            // is clearly rock, this point is too — a flat foot, smooth in x and y.
            const w = (vnoise(x / 700, y / 380, layer.seed + 5) - 0.5) * sup.wobble + (vnoise(x / 160, y / 260, layer.seed + 8) - 0.5) * sup.wobble * 0.12;   // meandering sides
            let y0 = y - sup.reach;
            const y1 = y - sup.gap;
            // Below the cleared route band, feet come only from rock below it: a foot carried
            // through the band would be cut there and hang below it.
            if (route && layer.clearRoute) {
                const ry = route(x) + clear.half;
                if (y > ry) y0 = Math.max(y0, ry);
            }
            const v = Math.max(carry.columnMax(x + w, y0, y1),
                carry.columnMax(x + w - sup.spread, y0, y1) - 0.02, carry.columnMax(x + w + sup.spread, y0, y1) - 0.02);
            d = Math.max(d, T - 0.05 + (sup.lift + 0.05) * smooth01((v + shift - lo) / sup.band));
            d -= surfacePush(x, y);                             // never up to the surface
            // A route-clearing layer keeps only rock standing below the route band: anything above
            // it would be cut along the band and left hanging (its foot may not cross the band).
            // The edge wanders, so the tops below are not cut flat.
            if (route && layer.clearRoute) {
                const edge = route(x) + clear.half + (0.7 * vnoise(x / 700, 2.3, layer.seed + 21) + 0.3 * vnoise(x / 180, 4.1, layer.seed + 23)) * clear.wander;
                const t = Math.min(1, Math.max(0, (y - edge) / clear.fade));
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
const LIFT_TO = [0x2a, 0x9f, 0xc8], FOG_LIFT = 0.35;

export function fogLayer(rgba, size, ox, oy, span, layer, deepTint = SHADE.deepTint, maxDepth = 5600) {
    const fog = layer.fog;
    for (let px = 0; px < size; px++) {
        const { a, b, t } = biomeBlendAt(ox + (px + 0.5) * span / size);
        // The water colour, lifted toward open-sea blue: even in the darkest biome the rock
        // behind stays lighter than the play-plane rock, so it never reads as solid.
        const wc = [16, 8, 0].map((sh, c) => {
            const w = ((a.water[0] >> sh) & 255) * (1 - t) + ((b.water[0] >> sh) & 255) * t;
            return w + (LIFT_TO[c] - w) * FOG_LIFT;
        });
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
