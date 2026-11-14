// Back rock (spec 10.10a/b): rock that goes on behind the play plane under overhangs and
// cave roofs, so rock above open water never looks like it floats. It fades with the
// distance below the rock (per-biome reach `backRock` in biomes.js; 0 = none, the open
// ocean stays endless), and is softened sideways so it never ends in a vertical edge.
// Pure (no Phaser, no DOM): the terrain worker calls it from shade.js. Tested in
// tests/backRock.test.mjs.
import { biomeBlendAt } from './biomes.js';

export const BACK_ROCK = {
    cell: 32,          // world px per coverage cell
    margin: 8,         // cells computed beyond each chunk side (the blur needs them; no seams)
    blur: 4,           // box blur radius in cells (two passes sideways, one down)
    scanStep: 48       // world px between the samples that look for rock above the chunk
};

/** Reach (world px) of back rock at world x, blended across biome borders. */
export function backRockReach(x) {
    const { a, b, t } = biomeBlendAt(x);
    return (a.backRock || 0) * (1 - t) + (b.backRock || 0) * t;
}

/**
 * Coverage 0..1 on a grid of `N`×`N` cells of `C` world px; cell (i, j) has its centre at
 * world (ox + (i - m + 0.5) * C, oy + (j - m + 0.5) * C). 1 in and right below rock,
 * falling off to 0 at `reach` below it.
 */
export function backRockCover(field, threshold, ox, oy, span, cfg = BACK_ROCK) {
    const C = cfg.cell, m = cfg.margin, N = Math.round(span / C) + 2 * m;
    const cov = new Float32Array(N * N);
    const at = k => (k - m + 0.5) * C;
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
        for (let j = 0; j < N; j++) {
            const y = y0 + j * C;
            if (field.density(x, y) > threshold) { rockY = y; cov[j * N + i] = 1; continue; }
            const u = (y - rockY) / R;
            cov[j * N + i] = u >= 1 ? 0 : (1 - u) * (1 - u);
        }
    }
    if (!any) return { cov, N, C, m, any };
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
    return { cov: tmp, N, C, m, any };
}
