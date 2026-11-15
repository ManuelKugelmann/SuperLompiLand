// The landscape from tiles (user: "optimize landscape. use tilesets"; pure, no Phaser). Per chunk only
// its shape is its own: a small tile of the density field (TILE_TERRAIN.size² texels, 16 KB) that the
// graphics card shades every frame with shared, repeating material tiles (fx/TerrainPipeline.js),
// instead of two pictures painted per chunk in the worker (2 MB, ~80 ms each, then uploaded).
// A texel: R, G = the density, 16 bits (decode: tileDensity); B = how much back rock lies behind
// (backRock.js); A = the distance from the water to the nearest rock (0 at the rock, 255 at SHADE.occlusionReach and
// beyond: the shade next to rock fades by it, as in shade.js, not by the density, which steps where the field lies flat). The tile reaches `border` texels past the chunk on every side, so the
// shader can read its neighbours anywhere inside the chunk and neighbouring chunks meet without a seam.

import { FIELD } from './density.js';
import { backRockCover } from './backRock.js';
import { biomeBlendAt, waterTone } from './biomes.js';
import { SHADE, SAND_SKIN } from './shade.js';
import { BIOME_INDEX } from './materials.js';

export const TILE_TERRAIN = {
    size: 64,       // texels a side
    border: 2,      // of which this many lie beyond the chunk on each side
    range: 1        // density stored: threshold ± this (beyond it the shading no longer changes)
};

/** World px between two texels for a chunk `span` px wide. */
export function texelStep(span, cfg = TILE_TERRAIN) {
    return span / (cfg.size - 2 * cfg.border - 1);
}

/** World x (or y) of texel `i` of a chunk starting at `o`. */
export function texelAt(o, i, span, cfg = TILE_TERRAIN) {
    return o + (i - cfg.border) * texelStep(span, cfg);
}

/** Density -> two bytes. */
export function encodeDensity(d, cfg = TILE_TERRAIN) {
    const e = Math.min(1, Math.max(0, (d - FIELD.threshold) / (2 * cfg.range) + 0.5));
    const v = Math.round(e * 65535);
    return [v >> 8, v & 255];
}

/** Two bytes -> density (what the shader does too). */
export function tileDensity(hi, lo, cfg = TILE_TERRAIN) {
    return FIELD.threshold + ((hi * 256 + lo) / 65535 - 0.5) * 2 * cfg.range;
}

/**
 * The tile of the chunk at (ox, oy), `span` px a side: RGBA bytes, `size`² texels (row-major).
 * `withBack` = also the back rock's cover (the play plane's chunks; rock layers need none).
 */
export function densityTile(field, ox, oy, span, withBack = true, cfg = TILE_TERRAIN) {
    const n = cfg.size, out = new Uint8Array(n * n * 4);
    const br = withBack ? backRockCover(field, FIELD.threshold, ox, oy, span) : null;
    const grid = (q, x, y) => {
        const gx = Math.min(br.N - 1.001, Math.max(0, (x - ox) / br.C + br.m - 0.5)), gy = Math.min(br.N - 1.001, Math.max(0, (y - oy) / br.C + br.m - 0.5));
        const i = Math.floor(gx), j = Math.floor(gy), u = gx - i, v = gy - j, k = j * br.N + i;
        return (q[k] * (1 - u) + q[k + 1] * u) * (1 - v) + (q[k + br.N] * (1 - u) + q[k + br.N + 1] * u) * v;
    };
    const cover = (x, y) => br && br.any ? grid(br.cov, x, y) : 0;
    const away = (x, y) => br ? Math.min(1, grid(br.dist, x, y) / SHADE.occlusionReach) : 1;
    for (let j = 0; j < n; j++) {
        const y = texelAt(oy, j, span, cfg);
        for (let i = 0; i < n; i++) {
            const x = texelAt(ox, i, span, cfg), o = (j * n + i) * 4, [hi, lo] = encodeDensity(field.density(x, y), cfg);
            out[o] = hi; out[o + 1] = lo; out[o + 2] = Math.round(255 * Math.min(1, Math.max(0, cover(x, y)))); out[o + 3] = Math.round(255 * away(x, y));
        }
    }
    return out;
}

const rgb = c => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
const mix3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/**
 * What the terrain shader needs to know about the chunk at ox (`span` wide), at its left and right
 * edges (it blends between them, as shade.js blends per column): the rock palette (rim to core, 0..1),
 * the sand skin (colour, reach in px; and its cover), the back rock's fog colour and the materials.
 */
export function chunkLook(ox, span) {
    const at = x => {
        const { a, b, t } = biomeBlendAt(x);
        const pal = [0, 1, 2, 3, 4].flatMap(k => mix3(rgb(a.rock[k]), rgb(b.rock[k]), t));
        const skin = bm => SAND_SKIN[bm.id] || [(SHADE.sand[0] << 16) | (SHADE.sand[1] << 8) | SHADE.sand[2], SHADE.sandReach, 0.8];
        const sa = skin(a), sb = skin(b);
        const sand = [...mix3(rgb(sa[0]), rgb(sb[0]), t), SHADE.sandReach ? sa[1] * (1 - t) + sb[1] * t : 0];
        const deep = SHADE.deepTint.map(v => v / 255);
        const fog = mix3(rgb(waterTone(a)), rgb(waterTone(b)), t).map((v, i) => (v + deep[i]) / 2);
        const main = t < 0.5 ? a : b, m = BIOME_INDEX[main.id] || BIOME_INDEX.reef;
        return { pal, sand, cover: sa[2] * (1 - t) + sb[2] * t, fog, mats: m };
    };
    const L = at(ox), R = at(ox + span);
    return { palL: new Float32Array(L.pal), palR: new Float32Array(R.pal), sandL: L.sand, sandR: R.sand, sandCover: [L.cover, R.cover],
        fogL: L.fog, fogR: R.fog, mats: [...L.mats, ...R.mats] };
}
