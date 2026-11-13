// Pure terrain math: seeded noise and marching squares. No Phaser, no state —
// everything here is deterministic and unit-tested (tests/terrain.test.mjs).

/** Integer lattice hash -> [0, 1). */
export function hash(ix, iy, seed) {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1), continuous in x and y. */
export function vnoise(x, y, seed) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed);
    const c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/**
 * Marching squares for one cell. `v` = densities at tl, tr, br, bl; a corner is
 * solid when its density is above `t`.
 * Returns the solid polygon (`poly`, points {x, y}) and its outline segments
 * (`edges`, pairs of points where the surface crosses the cell).
 */
export function marchCell(x, y, size, v, t) {
    const corners = [[x, y], [x + size, y], [x + size, y + size], [x, y + size]];
    const poly = [], cut = [];
    for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        const a = corners[i], b = corners[j];
        if (v[i] > t) { poly.push({ x: a[0], y: a[1] }); cut.push(false); }
        if ((v[i] > t) !== (v[j] > t)) {
            const k = (t - v[i]) / (v[j] - v[i]);
            poly.push({ x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k });
            cut.push(true);
        }
    }
    const edges = [];
    for (let i = 0; i < poly.length; i++) {
        const j = (i + 1) % poly.length;
        if (cut[i] && cut[j] && poly.length > 2) edges.push([poly[i], poly[j]]);
    }
    return { poly, edges };
}

/** Run `fn` over every cell of a square grid of corner densities covering `span` px from (ox, oy). */
export function eachCell(grid, ox, oy, span, t, fn) {
    const n = grid.length - 1, size = span / n;
    for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
            fn(marchCell(ox + i * size, oy + j * size, size, [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]], t));
        }
    }
}
