// The shape of the world as a pure function: rock density at any point, where
// the nests lie, and the density grids a chunk is drawn from. No Phaser, no DOM,
// so it runs unchanged on the main thread, in a Web Worker and in the tests.
import { vnoise } from './terrain.js';
import { BIOMES, WORLD_WEST, WORLD_END, ABYSS, biomeBlendAt, floorY } from './biomes.js';

export const FIELD = {
    threshold: 0.53,              // density above this is rock
    spawn: { x: 0, y: 700 },      // start pool, kept free of rock
    maxDepth: 5600,               // deepest regular seabed (the abyss goes further)
    nestRadius: 230,              // half width of the sand basin a nest lies in
    nestRim: 16                   // how far its rim stands above the middle
};

/**
 * Build the world's density field for a seed.
 * Returns { density(x, y, withNests = true), nests }.
 */
const smooth01 = v => { const t = v <= 0 ? 0 : v >= 1 ? 1 : v; return t * t * (3 - 2 * t); };

export function createField(seed) {
    let nests = null;

    const density = (x, y, withNests = true) => {
        // Two broad octaves only: big soft blobs and winding passages, no jagged detail.
        let n = 0.72 * vnoise(x / 1000, y / 1000, seed) + 0.28 * vnoise(x / 420, y / 420, seed + 7);
        const { a, b, t } = biomeBlendAt(x);
        n -= a.open + (b.open - a.open) * t;                             // beach / open sea have less rock
        if (y < 520) n -= ((520 - y) / 520) * 0.6;                       // open water under the surface
        const fy = floorY(x);
        if (y > fy) n += (y - fy) / 380;                                 // seabed, deeper toward the east
        // Keep the abyss shaft swimmable all the way down.
        if (y > 4200 && y < fy - 150 && Math.abs(x - ABYSS.x) < ABYSS.halfWidth * 0.75) n -= 0.6;
        if (x < WORLD_WEST + 900) n += (WORLD_WEST + 900 - x) / 500;     // western shore
        if (x > WORLD_END + 900) n += (x - WORLD_END - 900) / 500;       // wall behind the grand nest
        const ds = Math.hypot(x - FIELD.spawn.x, y - FIELD.spawn.y);
        if (ds < 900) n -= (1 - ds / 900) * 0.6;                         // clear start pool
        if (withNests && nests) {
            for (const nest of nests) {
                const dx = Math.abs(x - nest.x);
                if (dx > 520) continue;
                if (y <= nest.y - 30) {                                  // open water above every nest
                    const d = Math.hypot(x - nest.x, y - (nest.y - 260));
                    if (d < 480) n -= (1 - d / 480) * 0.7;
                }
                // The nest lies in a shallow sand basin with a raised rim, levelled into
                // the seabed, so it sits right on any slope instead of floating or sinking.
                const R = FIELD.nestRadius, reach = R + 170;
                if (dx < reach && Math.abs(y - nest.y) < 260) {
                    const u = dx / R;
                    const rim = u < 1 ? u * u : Math.max(0, 1 - (dx - R) / 170);       // 0 in the middle, 1 on the rim, back to 0 outside
                    const ground = nest.y - FIELD.nestRim * rim;
                    const side = dx <= R ? 1 : smooth01(1 - (dx - R) / 170);
                    const w = side * smooth01(1 - Math.abs(y - nest.y) / 260);
                    n += (FIELD.threshold + (y - ground) / 320 - n) * w;
                }
            }
        }
        return n;
    };

    // One nest per biome start (not the beach) plus the grand nest at the end,
    // each sitting on the real seabed: start inside it and walk up to its surface.
    const xs = BIOMES.slice(1).map(b => b.from + 260);
    xs[0] = FIELD.spawn.x;                    // home reef: right under the start pool
    xs.push(WORLD_END - 300);
    nests = xs.map((x, index) => {
        let y = floorY(x) + 260;
        while (y > 400 && density(x, y, false) > FIELD.threshold) y -= 12;
        return { x, y: y + 12, index, grand: index === xs.length - 1 };
    });

    return { density, nests };
}

/**
 * Density samples for one chunk on a (n + 1) x (n + 1) grid, row by row:
 *   fine  the rock density itself
 *   back  density of the "rock wall behind the cave" layer (-1 where there is none)
 */
export function chunkGrids(field, seed, ox, oy, span, n) {
    const side = n + 1, step = span / n;
    const fine = new Float32Array(side * side), back = new Float32Array(side * side);
    for (let j = 0; j < side; j++) {
        for (let i = 0; i < side; i++) {
            const x = ox + i * step, y = oy + j * step;
            const d = field.density(x, y);
            fine[j * side + i] = d;
            back[j * side + i] = vnoise(x / 1500, y / 1500, seed + 31) > 0.56 && y > 600 ? d + 0.05 : -1;
        }
    }
    return { fine, back };
}

/** View a flat row-major grid as an array of rows (no copying). */
export function gridRows(flat, side) {
    return Array.from({ length: side }, (_, j) => flat.subarray(j * side, (j + 1) * side));
}
