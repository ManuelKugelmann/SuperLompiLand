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
import { softenLayer } from './layerMath.js';
import { biomeBlendAt, seaShare, waterTone, WORLD_END } from './biomes.js';
import { descentStart } from './setPieces.js';
import { SHADE, shadeChunk } from './shade.js';
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
    // socket: closed share in front of an island at least (its rocky underwater base: no far
    // view right in front of an island, spec 5.0c); it eases off into the open sea.
    // trenchWall: this layer carries the trench wall behind the descent (TRENCH_WALL).
    // rockSize / sharp / shade: the near layer is baked finer, not softened and shaded crisper (user: the near rock read smeared; the far ones may stay soft).
    { id: 'mid', s: 0.6, seed: 101, share: 1, swing: 0.32, scale: 1100, fog: 0.38, dark: 0.8, depth: -9.5, socket: 0.85, trenchWall: true,
        rockSize: 376, shade: { grain: 0.34, bump: 0.45, relief: 1.1 } },      // the rock just behind the play plane reads near: baked finer and crisper too (playtest: "rocky near background too blurry"); still softened, or its chunks met in seams
    { id: 'near', s: 0.82, seed: 202, share: 0.55, open: -0.08, swing: 0.36, scale: 1300, fog: 0.24, dark: 0.86, depth: -7, clearRoute: true, rockSize: 510, sharp: true,
        shade: { grain: 0.42, bump: 0.55, relief: 1.2 } }      // its own crisper shading: playtest "rocky near background too blurry" (the soft look came from low grain and relief, not resolution)
];

/** Layer chunk size (layer px) and its shading: coarse (soft), no sand, low contrast, unlit rims. */
export const LAYER_CHUNK = 960;
export const LAYER_SHADE = {
    ...SHADE,
    rockSize: 248,       // not a power of two: the GPU clamps its edges (power-of-two textures repeat: seam lines)
    node: 8, backSize: 0, sandReach: 0, relief: 1.0, bump: 0.3, grain: 0.24,     // enough relief and grain to read as rock, not as haze (lagoon review)
    keyStrength: 0.75, bevel: 40, coreShade: 0.5
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

/**
 * Where a wall stretch begins, the enclosure is read a little to the side, by an amount that
 * changes with depth: its edge meanders down the wall instead of standing as one vertical cut
 * (virtual px: big lazy bends, plus a little rough detail).
 */
export const WALL_EDGE = { bend: 700, bendScale: [600, 450], rough: 120, roughScale: [150, 170] };

/**
 * The trench wall (spec 5.0m): the trench is one carved abyss, so the layer fields are empty there.
 * Behind the descent stands a dark rock face instead: solid from a rim `above` px over the route
 * (wandering between the two values, rough by `rough`) all the way down, so the way down reads as
 * swimming along a wall into the dark. It grows in over `fadeIn` px from the descent's start, has
 * open `windows` (share of stretches, period `windowScale`), and gives way before the grand nest
 * (`reveal`: px before the world's end where it starts and finishes opening) so the beacon and
 * the warm pool come into view. `specks`: faint glowing specks baked into it (share of texels).
 */
export const TRENCH_WALL = {
    above: [250, 900], rimScale: 2600, rough: 140, roughScale: 260, edge: 260,
    fadeIn: 4000, windows: 0.68, windowScale: 7000, reveal: [9000, 4500],   // windows: noise level above which the wall is open (higher = fewer windows)
    relief: [0.16, 0.05, 0.07],   // density bulges (broad, knobs) and ledge step height on the face
    ledge: 460, ledgeBend: 380,   // px between ledges, how far they bend up and down along the wall
    specks: 0.0025, speckPatch: 900, speckColours: [0x7fe8ff, 0xb08cff, 0x8affd0], speckGlow: 0.7   // specks gather in patches (speckPatch px): colonies, not a starfield
};

/**
 * How much the trench wall lifts a layer's field at (x, y) toward rock (0 = not at all, 1 = solid),
 * given the calm route (world x -> y).
 */
export function trenchWallAt(x, y, route, cfg = TRENCH_WALL) {
    const x0 = descentStart(), x1 = WORLD_END - cfg.reveal[1];
    if (x <= x0 || x >= x1) return 0;
    const grow = smooth01((x - x0) / cfg.fadeIn) * smooth01((x1 - x) / (cfg.reveal[0] - cfg.reveal[1]));
    const E = WALL_EDGE, bent = x + (vnoise(x / E.bendScale[0], y / E.bendScale[1], 71) - 0.5) * E.bend * 1.6;   // window edges meander down the wall
    const win = smooth01((cfg.windows - vnoise(bent / cfg.windowScale, 2.9, 61)) / 0.08);
    const [a0, a1] = cfg.above;
    const rim = route(x) - a0 - (a1 - a0) * vnoise(x / cfg.rimScale, 4.3, 63)
        + (vnoise(x / cfg.roughScale, y / cfg.roughScale, 65) - 0.5) * cfg.rough;
    return grow * win * smooth01((y - rim) / cfg.edge);
}

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

/**
 * Slow zones along a long biome, so its background does not look the same for 80 000 px:
 * each layer has its own zone noise (0..1, period about `scale` px). Low zones are open
 * (a far view over sand flats, the ground ridge low), high ones closed (walls near, the ridge
 * high). `socket` / `base`: the range the closed share is scaled through; `lift`: how far
 * the ground ridge rises and sinks.
 */
export const ZONES = { scale: 18000, socket: [0.6, 1.05], base: [0.4, 1.5], lift: 0.16 };

/** A layer's zone at x (0 = open stretch, 1 = closed stretch), smooth. */
export function zoneAt(x, layer, cfg = ZONES) {
    return smooth01(vnoise(x / cfg.scale, 1.3, layer.seed + 51) * 1.4 - 0.2);
}

/**
 * Closed share (0..1) of the rock layers at world x, blended across biome borders; with a
 * layer, its island socket raises it along the coasts (fading out into the open sea), and
 * the layer's zone opens or closes it in long stretches.
 */
export function wallShare(x, layer) {
    const { a, b, t } = biomeBlendAt(x);
    const base = (a.rockWall || 0) * (1 - t) + (b.rockWall || 0) * t;
    if (!layer) return base;
    const z = zoneAt(x, layer), lerp = ([lo, hi]) => lo + (hi - lo) * z;
    return Math.min(1, Math.max(base * lerp(ZONES.base), (layer.socket || 0) * (1 - seaShare(x)) * lerp(ZONES.socket)));
}

/**
 * How closed a layer is at world x: -1 = open water, +1 = a wall. A slow noise is cut at
 * the biome's closed share, so roughly that share of the stretches is wall.
 */
export function enclosure(x, layer) {
    const c = wallShare(x, layer) * layer.share;
    if (c <= 0.001) return -1;
    const n = encNoise(x, layer);
    return Math.max(-1, Math.min(1, (n - noiseQuantile(1 - c)) * 3));   // share c of stretches above the cut (eased: walls give way over a few hundred px)
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
            const E = WALL_EDGE;
            const e = enclosure(x + (vnoise(x / E.bendScale[0], y / E.bendScale[1], layer.seed + 31) - 0.5) * E.bend
                + (vnoise(x / E.roughScale[0], y / E.roughScale[1], layer.seed + 33) - 0.5) * E.rough, layer);
            // Toward fully open the field is pushed far out of rock: walls go, only the deep
            // ground stays (sinking lower), so an open stretch never ends in a straight cut.
            const gone = smooth01((-0.55 - e) / 0.45);
            const shift = layer.swing * e - 0.12 + (layer.open || 0) - gone * 0.9 + ZONES.lift * (zoneAt(x, layer) * 2 - 1);
            // Only rock strong enough to carry a foot is shown: a thin ledge that would not reach
            // the floor is dropped whole. The detail comes from the fine field, but it is capped
            // by the coarse one the feet are carried from — what shows here always has a foot.
            const lo = T + sup.minCarry;
            let d = Math.min(soft.density(x, y) + shift - (sup.minCarry + sup.band * 0.5),
                T + (carry.density(x, y) + shift - lo) * 2);
            // The trench wall: a rock face with its own relief (broad bulges, small knobs, and
            // ledges: a sawtooth in depth, so each step catches the light on its upper edge).
            const tw = layer.trenchWall && route ? trenchWallAt(x, y, route) : 0;
            if (tw > 0) {
                const W = TRENCH_WALL, s = (y + W.ledgeBend * vnoise(x / 1500, 6.1, 73)) / W.ledge;
                d = Math.max(d, T - 0.06 + 0.18 * tw + W.relief[0] * (vnoise(x / 420, y / 360, 67) - 0.5)
                    + W.relief[1] * (vnoise(x / 130, y / 150, 69) - 0.5) + W.relief[2] * (s - Math.floor(s)));
            }
            if (e <= -0.999) return d - surfacePush(x, y);      // open: no walls, so no feet to look for
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
const LIFT_LUMA = 128, FOG_LIFT = 0.35;


/**
 * The rock behind the play plane gets a top skin like the play plane's rock (lookdev1): along
 * every edge that faces up, a band of the biome's top colour (pale sand in the lagoon, bright
 * moss on the reef islands, silt in the harbour, grey in the deep), thinning in from the edge;
 * slow light-and-dark patches across the rock; and tiny coral and shell specks along the rim.
 * Before the fog, so the skin fades with distance like the rest. Pure; baked once per chunk.
 */
export const LIP = {
    texels: [3, 20],    // how deep the skin reaches in from the top edge (layer texels): thin on steep shoulders, thick on flat tops and in dips
    slope: 5,           // texels the top may rise or fall over 4 columns before it counts as steep
    tongues: 0.12,      // share of hollows where the sand pours down further (a tongue up to 1.6x deep)
    ao: [6, 0.18],      // the shade right under the skin: texels deep, how much darker (the top reads as a ledge in front)
    strata: [0.1, 300], // soft horizontal bands through the body: how much lighter or darker, world px apart
    strength: 1,        // how much of the top colour at the very edge
    patches: 0.2,       // light and dark patches across the rock (share of brightness)
    patchScale: 520,    // world px of one patch
    specks: 0.05,       // share of rim texels that carry a speck
    afterFog: 0.5,      // share of the skin laid again after the fog: a lit top keeps some of its own colour at distance
    tops: {             // the top colour per biome, and its specks
        beach: [0xe2d3a2, [0xf2a3b5, 0xffffff]], mangrove: [0x8f9a4a, [0xd8c8a0]], reef: [0x9ed04a, [0xf0609a, 0xb070e0, 0xffffff]],
        kelp: [0x8cc456, [0xf0a040, 0xffffff]], harbour: [0x9a9a7a, [0xd0d0c0]], wreck: [0x8a8a76, [0xc8b090]],
        shore: [0xb7c4a0, [0xf0f0f0, 0x9a7ad0]], blue: [0x9aa890, [0xffffff]], trench: [0x5a6478, [0x8a9ac8]]
    }
};

const LIP_DEFAULT = [0xa8b080, [0xffffff]];
const ch = (c, k) => (c >> (16 - 8 * k)) & 255;

/** Returns the skin: per texel, how much of which top colour ({ k: Float32Array, rgb: Float32Array }), for laying again after the fog. */
export function lipLayer(rgba, size, ox, oy, span, cfg = LIP) {
    const skin = { k: new Float32Array(size * size), rgb: new Float32Array(size * size * 3) };
    const hashAt = (x, y) => { const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return v - Math.floor(v); };
    // The top of the rock in each column (first solid texel from the top; -1 where there is none):
    // its slope says how thick the skin may lie there, its dips are where sand gathers.
    const top = new Int16Array(size).fill(-1);
    for (let px = 0; px < size; px++) for (let py = 0; py < size; py++) if (rgba[(py * size + px) * 4 + 3] >= 40) { top[px] = py; break; }
    const topAt = x => top[Math.min(size - 1, Math.max(0, x))];
    const [t0, t1] = cfg.texels, [aoDeep, aoDark] = cfg.ao, [stAmp, stGap] = cfg.strata;
    // How thick the skin lies in each column: flat tops and dips thick, steep shoulders almost bare,
    // here and there a tongue of sand pouring down into a hollow; smoothed across the columns so
    // the skin's lower edge never combs.
    const raw = new Float32Array(size);
    for (let px = 0; px < size; px++) {
        if (top[px] < 0) { raw[px] = t1; continue; }
        const wx = ox + (px + 0.5) * span / size, l = topAt(px - 3), r = topAt(px + 3), lt = l < 0 ? top[px] : l, rt = r < 0 ? top[px] : r;
        const steep = Math.min(1, Math.abs(lt - rt) / cfg.slope);
        const dip = Math.max(0, top[px] - (lt + rt) / 2);                                 // lower than both sides
        const n = 0.65 + 0.35 * vnoise(wx / 260, 3.1, 91);
        const tongue = 1 + 0.6 * Math.max(0, (vnoise(wx / 140, 5.3, 95) - (1 - cfg.tongues * 3)) / (cfg.tongues * 3)) * Math.min(1, dip);
        raw[px] = Math.max(t0, Math.min(t1 * 1.6, (t0 + (t1 - t0) * (1 - steep) ** 1.5 * n + dip * 2) * tongue));
    }
    const thick = new Float32Array(size);
    for (let px = 0; px < size; px++) {
        let s = 0, w = 0;
        for (let d = -4; d <= 4; d++) { const q = Math.min(size - 1, Math.max(0, px + d)), k = 5 - Math.abs(d); s += raw[q] * k; w += k; }
        thick[px] = s / w;
    }
    for (let px = 0; px < size; px++) {
        const wx = ox + (px + 0.5) * span / size, { a, b, t } = biomeBlendAt(wx);
        const ta = cfg.tops[a.id] || LIP_DEFAULT, tb = cfg.tops[b.id] || LIP_DEFAULT;
        const col = [0, 1, 2].map(k => ch(ta[0], k) * (1 - t) + ch(tb[0], k) * t), specks = t < 0.5 ? ta[1] : tb[1];
        const depth = thick[px];
        let run = t1 * 2;                      // texels since the last open texel above (start: as if deep inside)
        for (let py = 0; py < size; py++) {
            const o = (py * size + px) * 4;
            if (rgba[o + 3] < 40) { run = 0; continue; }
            run++;
            const wy = oy + (py + 0.5) * span / size;
            const patch = 1 + cfg.patches * (vnoise(wx / cfg.patchScale, wy / cfg.patchScale, 77) * 2 - 1);
            const band = 1 + stAmp * Math.sin((wy + 120 * vnoise(wx / 900, 1.7, 93)) / stGap * Math.PI * 2);
            const shade = run > depth && run <= depth + aoDeep ? 1 - aoDark * (1 - (run - depth) / aoDeep) : 1;
            for (let c = 0; c < 3; c++) rgba[o + c] = Math.min(255, rgba[o + c] * patch * band * shade);
            if (run > depth) continue;
            const k = cfg.strength * (1 - (run - 1) / depth) ** 1.4, q = py * size + px;
            for (let c = 0; c < 3; c++) { rgba[o + c] = rgba[o + c] + (col[c] - rgba[o + c]) * k; skin.rgb[q * 3 + c] = col[c]; }
            skin.k[q] = k;
            if (run <= 2 && hashAt(px + ox, py + oy) < cfg.specks) {
                const sc = specks[Math.floor(hashAt(py, px) * specks.length) % specks.length];
                for (let c = 0; c < 3; c++) rgba[o + c] = ch(sc, c);
            }
        }
    }
    return skin;
}

export function fogLayer(rgba, size, ox, oy, span, layer, deepTint = SHADE.deepTint, maxDepth = 5600) {
    const skin = lipLayer(rgba, size, ox, oy, span);
    const fog = layer.fog;
    for (let px = 0; px < size; px++) {
        const { a, b, t } = biomeBlendAt(ox + (px + 0.5) * span / size);
        // The water colour, lifted toward a brighter tone of its own hue: even in the darkest
        // biome the rock behind stays lighter than the play-plane rock, so it never reads as solid.
        const wa = waterTone(a), wb = waterTone(b), ta = waterTone(a, LIFT_LUMA), tb = waterTone(b, LIFT_LUMA);
        const wc = [16, 8, 0].map(sh => {
            const w = ((wa >> sh) & 255) * (1 - t) + ((wb >> sh) & 255) * t;
            const lift = ((ta >> sh) & 255) * (1 - t) + ((tb >> sh) & 255) * t;
            return w + (lift - w) * FOG_LIFT;
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
    for (let q = 0; q < size * size; q++) {          // the top skin again, over the fog (LIP.afterFog)
        const k = skin.k[q] * LIP.afterFog;
        if (k > 0) for (let c = 0; c < 3; c++) rgba[q * 4 + c] += (skin.rgb[q * 3 + c] - rgba[q * 4 + c]) * k;
    }
    if (!layer.sharp) softenLayer(rgba, size);
    trenchSpecks(rgba, size, ox, oy, span);
    return rgba;
}

/** Faint glowing specks on the trench rock (TRENCH_WALL.specks): a bright texel with a soft halo, after the soften so they stay crisp. */
function trenchSpecks(rgba, size, ox, oy, span, cfg = TRENCH_WALL) {
    const hashAt = (x, y) => { const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return v - Math.floor(v); };
    const step = span / size, g = cfg.speckGlow;
    for (let px = 1; px < size - 1; px++) {
        const { a, b, t } = biomeBlendAt(ox + (px + 0.5) * step);
        const share = (a.id === 'trench' ? 1 - t : 0) + (b.id === 'trench' ? t : 0);
        if (share <= 0) continue;
        for (let py = 1; py < size - 1; py++) {
            const o = (py * size + px) * 4;
            // Hashed on the virtual position, so a speck stays put across chunk borders.
            const hx = Math.round(ox / step) + px, hy = Math.round(oy / step) + py;
            const wx = ox + (px + 0.5) * step, wy = oy + (py + 0.5) * step;
            const patch = Math.max(0, vnoise(wx / cfg.speckPatch, wy / cfg.speckPatch, 75) - 0.45) * 4.4;   // 0 in most places, up to ~2.4 in a colony
            if (rgba[o + 3] < 200 || hashAt(hx * 0.37, hy * 0.53) >= cfg.specks * share * patch) continue;
            const c = cfg.speckColours[Math.floor(hashAt(hy, hx) * cfg.speckColours.length)];
            const k = g * (0.5 + 0.5 * hashAt(hx + 3, hy));
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const q = o + (dy * size + dx) * 4, w = k * (dx && dy ? 0.14 : dx || dy ? 0.3 : 1);      // round: corners weaker than the sides (no little crosses)
                if (rgba[q + 3] < 40) continue;
                for (let ci = 0; ci < 3; ci++) rgba[q + ci] += (ch(c, ci) - rgba[q + ci]) * w;
            }
        }
    }
}

/**
 * Bake margin (texels, a multiple of LAYER_SHADE.node so the samples stay on the same world grid):
 * a layer chunk is shaded with this much of its neighbours' rock all round, and its middle kept.
 * Everything that looks across texels (the top skin's search for the rock's top and its smoothing
 * across columns, its shade, the soften pass) then sees the real neighbours: no seam at chunk edges.
 */
export const LAYER_MARGIN = 40;

/**
 * Rock never floats, in any layer (tester: "stones can't float in the water"): a piece of rock in a
 * layer picture smaller than `minArea` texels that touches none of the picture's edges is dropped.
 * Real rock reaches the ground or goes on past the picture; with LAYER_MARGIN of neighbour rock
 * around, a loose piece is seen whole from every chunk it shows in, so all drop it alike.
 */
export const LOOSE_ROCK = { minArea: 2500, alpha: 8 };

/** Clear the loose rock pieces (LOOSE_ROCK) of an RGBA picture `size` texels square, in place. */
export function dropLooseRock(rgba, size, cfg = LOOSE_ROCK) {
    const n = size * size, label = new Int32Array(n), queue = new Int32Array(n);
    let id = 0;
    for (let s = 0; s < n; s++) {
        if (label[s] || rgba[s * 4 + 3] <= cfg.alpha) continue;
        // One piece: flood it, note its size and whether it reaches an edge.
        id++;
        let head = 0, tail = 0, edge = false;
        queue[tail++] = s; label[s] = id;
        while (head < tail) {
            const q = queue[head++], x = q % size, y = (q - x) / size;
            if (x === 0 || y === 0 || x === size - 1 || y === size - 1) edge = true;
            for (const o of [x > 0 ? q - 1 : -1, x < size - 1 ? q + 1 : -1, y > 0 ? q - size : -1, y < size - 1 ? q + size : -1]) {
                if (o < 0 || label[o] || rgba[o * 4 + 3] <= cfg.alpha) continue;
                label[o] = id; queue[tail++] = o;
            }
        }
        if (edge || tail >= cfg.minArea) continue;
        for (let k = 0; k < tail; k++) rgba[queue[k] * 4 + 3] = 0;
    }
    return rgba;
}

/** A layer's picture size (texels per side): its own rockSize (the near layer is baked finer), else LAYER_SHADE's. */
export const layerSize = layer => layer.rockSize || LAYER_SHADE.rockSize;

/** One layer chunk's picture (RGBA, layerSize squared), baked with LAYER_MARGIN. */
export function layerPicture(field, seed, layer, cx, cy, M = LAYER_MARGIN) {
    const S = layerSize(layer), B = S + 2 * M, { ox, oy, span } = layerChunkRect(layer, cx, cy), step = span / S;
    const bx = ox - M * step, by = oy - M * step, bspan = span * B / S;
    const { rock } = shadeChunk(field, seed, bx, by, bspan, { ...LAYER_SHADE, ...layer.shade, rockSize: B, grainAt: [cx * S - M, cy * S - M] });
    fogLayer(rock, B, bx, by, bspan, layer);
    dropLooseRock(rock, B);
    const out = new Uint8ClampedArray(S * S * 4);
    for (let y = 0; y < S; y++) out.set(rock.subarray(((y + M) * B + M) * 4, ((y + M) * B + M + S) * 4), y * S * 4);
    return out;
}
