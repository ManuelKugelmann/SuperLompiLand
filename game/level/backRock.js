// What lies behind the play plane, on a coarse grid around one chunk (with margins, so
// neighbouring chunks agree and nothing ends at a chunk border):
//   cover  back rock (spec 10.10a/b): rock that goes on behind the play plane under
//          overhangs and cave roofs, so rock above open water never looks like it floats.
//          It fades with the distance below the rock (per-biome reach `backRock` in
//          biomes.js; 0 = none, the open ocean stays endless) and is softened sideways so
//          it never ends in a vertical edge.
//   dist   world px from each cell to the nearest rock: the soft shade next to rock is
//          made from it, so it follows the real rock and not the density field's slopes.
// Pure (no Phaser, no DOM): the terrain worker calls it from shade.js. Tested in
// tests/backRock.test.mjs.
import { biomeBlendAt } from './biomes.js';

export const BACK_ROCK = {
    cell: 32,          // world px per cell
    margin: 8,         // cells computed beyond each chunk side (the blur needs them; no seams)
    blur: 4,           // box blur radius in cells (two passes sideways, one down)
    scanStep: 48,      // world px between the samples that look for rock above and below the grid
    pillar: 2200,      // under an island, rock below closer than this: the gap between is a pillar
    island: [1100, 1200]   // an island is narrower [0] and thinner [1] than this (world px), with water above
};

/** Reach (world px) of back rock at world x, blended across biome borders. */
export function backRockReach(x) {
    const { a, b, t } = biomeBlendAt(x);
    return (a.backRock || 0) * (1 - t) + (b.backRock || 0) * t;
}

/**
 * Grids of `N`×`N` cells of `C` world px; cell (i, j) has its centre at world
 * (ox + (i - m + 0.5) * C, oy + (j - m + 0.5) * C).
 *   cov   back-rock coverage 0..1 (`any` = false: none anywhere in this grid)
 *   dist  distance to the nearest rock cell (world px; 0 in rock)
 */
export function backRockCover(field, threshold, ox, oy, span, cfg = BACK_ROCK) {
    const C = cfg.cell, m = cfg.margin, N = Math.round(span / C) + 2 * m;
    const at = k => (k - m + 0.5) * C;
    const solid = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) solid[j * N + i] = field.density(ox + at(i), oy + at(j)) > threshold ? 1 : 0;

    // Distance to rock: two-pass chamfer (3-4 weights) over the grid.
    const dist = new Float32Array(N * N);
    for (let k = 0; k < N * N; k++) dist[k] = solid[k] ? 0 : 1e9;
    const d1 = C, d2 = C * Math.SQRT2;
    for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
            const k = j * N + i;
            if (i > 0) dist[k] = Math.min(dist[k], dist[k - 1] + d1);
            if (j > 0) {
                dist[k] = Math.min(dist[k], dist[k - N] + d1);
                if (i > 0) dist[k] = Math.min(dist[k], dist[k - N - 1] + d2);
                if (i < N - 1) dist[k] = Math.min(dist[k], dist[k - N + 1] + d2);
            }
        }
    }
    for (let j = N - 1; j >= 0; j--) {
        for (let i = N - 1; i >= 0; i--) {
            const k = j * N + i;
            if (i < N - 1) dist[k] = Math.min(dist[k], dist[k + 1] + d1);
            if (j < N - 1) {
                dist[k] = Math.min(dist[k], dist[k + N] + d1);
                if (i < N - 1) dist[k] = Math.min(dist[k], dist[k + N + 1] + d2);
                if (i > 0) dist[k] = Math.min(dist[k], dist[k + N - 1] + d2);
            }
        }
    }

    // Width of the horizontal rock run each solid cell belongs to (0 = touches the grid edge:
    // too wide to tell, never an island).
    const runW = new Uint16Array(N * N);
    for (let j = 0; j < N; j++) {
        for (let i = 0; i < N;) {
            if (!solid[j * N + i]) { i++; continue; }
            let e = i;
            while (e < N && solid[j * N + e]) e++;
            const w = i === 0 || e === N ? 0 : e - i;
            for (let k = i; k < e; k++) runW[j * N + k] = w;
            i = e;
        }
    }

    const cov = new Float32Array(N * N);
    let any = false;
    for (let i = 0; i < N; i++) {
        const x = ox + at(i), R = backRockReach(x);
        if (R <= 0) continue;
        any = true;
        const y0 = oy + at(0);
        let rockY = -Infinity;                                   // world y of the nearest rock above
        for (let y = y0 - cfg.scanStep; y >= y0 - R; y -= cfg.scanStep) {
            if (field.density(x, y) > threshold) { rockY = y; break; }
        }
        // Nearest rock below every cell (within the grid, else looked up below it). Under an
        // island — a small piece of rock with water above it (not a cave roof or a big mass) —
        // the gap down to the rock below is a pillar behind, so the island never floats.
        const below = new Float32Array(N);
        let next = Infinity;
        const yEnd = y0 + (N - 1) * C;
        for (let y = yEnd + cfg.scanStep; y <= yEnd + cfg.pillar; y += cfg.scanStep) {
            if (field.density(x, y) > threshold) { next = y; break; }
        }
        for (let j = N - 1; j >= 0; j--) {
            if (solid[j * N + i]) next = y0 + j * C;
            below[j] = next;
        }
        let runTop = -Infinity, island = false;
        for (let j = 0; j < N; j++) {
            const y = y0 + j * C, k = j * N + i;
            if (solid[k]) {
                if (j > 0 && !solid[k - N]) runTop = y;                      // the run starts below water
                else if (j === 0) runTop = -Infinity;                       // runs on above the grid
                rockY = y;
                island = y - runTop < cfg.island[1] && runW[k] > 0 && runW[k] * C < cfg.island[0];
                cov[k] = 1;
                continue;
            }
            if (island && below[j] - rockY <= cfg.pillar) { cov[k] = 1; continue; }
            const u = (y - rockY) / R;
            cov[j * N + i] = u >= 1 ? 0 : (1 - u) * (1 - u);
        }
    }
    if (!any) return { cov, dist, N, C, m, any };
    const tmp = new Float32Array(N * N), r = cfg.blur, w = 1 / (2 * r + 1);
    const pass = (src, dst, dx, dy) => {
        for (let j = 0; j < N; j++) {
            for (let i = 0; i < N; i++) {
                let s = 0;
                for (let k = -r; k <= r; k++) {
                    const ii = Math.min(N - 1, Math.max(0, i + k * dx)), jj = Math.min(N - 1, Math.max(0, j + k * dy));
                    s += src[jj * N + ii];
                }
                dst[j * N + i] = s * w;
            }
        }
    };
    pass(cov, tmp, 1, 0); pass(tmp, cov, 1, 0); pass(cov, tmp, 0, 1);
    return { cov: tmp, dist, N, C, m, any };
}
