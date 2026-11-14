// The shape of the world as a pure function: rock density at any point, where
// the nests lie, and the density grids a chunk is drawn from. No Phaser, no DOM,
// so it runs unchanged on the main thread, in a Web Worker and in the tests.
import { vnoise } from './terrain.js';
import { BIOMES, WORLD_WEST, WORLD_END, ABYSS, biomeBlendAt, biomeIndexAt, floorY, seaShare } from './biomes.js';

export const FIELD = {
    threshold: 0.53,              // density above this is rock
    spawn: { x: 0, y: 420 },      // start pool in the shallow lagoon, kept free of rock
    maxDepth: 5600,               // deepest regular seabed (the abyss goes further)
    nestRadius: 230,              // half width of the sand basin a nest lies in
    nestRim: 16,                  // how far its rim stands above the middle
    seaClear: 1.3,                // how much rock the open sea takes away above its bottom (more than the noise can add)
    seaBottom: 300,               // px above the sea's bottom over which rock comes back
    nestSearch: 16                // a nest may move up to this many steps of 120 px east to find real seabed
};

// The calm main route (spec 5.2c): one lane of open water through the whole journey, from
// the start pool past every nest to the grand nest. It is carved out of the rock, so it
// exists by construction, and hazards keep their distance from it (LevelGenerator).
export const ROUTE = {
    halfWidth: 260,     // the lane is open at least this far above and below its middle
    cruise: 0.5,        // along an island it runs at this share of the way down to the seabed ...
    minY: 320,          // ... but never shallower
    maxY: 2600,         // ... or deeper than this
    seaY: 470,          // across the open sea it stays this close under the surface (spec 5.0c)
    seaFrom: 2700,      // seabed depth from which the water counts as open sea for the route ...
    seaFull: 3700,      // ... and from which the route is fully at `seaY`
    ease: 5, easeStep: 280,   // the cruise depth is averaged over this many steps of this size to either side
    aboveNest: 240,     // it passes this far above every nest
    descent: 1.6,       // px along the way per px of depth when it dips to a nest (gentle slopes)
    clear: 420          // hazards stay at least this far from its middle
};

/**
 * Build the world's density field for a seed.
 * Returns { density(x, y, withNests = true), nests, routeY(x) }.
 */
const smooth01 = v => { const t = v <= 0 ? 0 : v >= 1 ? 1 : v; return t * t * (3 - 2 * t); };

/**
 * The calm route's depth away from any nest: half way down along the coasts, near the surface
 * over deep water. Averaged along the way, so it climbs and sinks gently even where the seabed
 * falls away as a wall.
 */
export function cruiseY(x, cfg = ROUTE) {
    let sum = 0;
    for (let k = -cfg.ease; k <= cfg.ease; k++) {
        const fy = floorY(x + k * cfg.easeStep), coast = Math.min(cfg.maxY, Math.max(cfg.minY, Math.min(fy, cfg.seaFrom) * cfg.cruise));
        sum += coast + (cfg.seaY - coast) * smooth01((fy - cfg.seaFrom) / (cfg.seaFull - cfg.seaFrom));
    }
    return sum / (cfg.ease * 2 + 1);
}

export function createField(seed) {
    let nests = null;

    /** Height of the calm route's middle at world x. */
    const routeCache = new Map();     // grids ask for the same columns again and again
    const routeY = x => {
        let y = routeCache.get(x);
        if (y !== undefined) return y;
        y = cruiseY(x);
        for (const nest of nests) {
            const dx = Math.abs(x - nest.x);
            if (dx < nest.reach) y += (nest.y - ROUTE.aboveNest - y) * smooth01(1 - dx / nest.reach);
        }
        if (routeCache.size > 8192) routeCache.clear();
        routeCache.set(x, y);
        return y;
    };

    const density = (x, y, withNests = true) => {
        // Two broad octaves only: big soft blobs and winding passages, no jagged detail.
        let n = 0.72 * vnoise(x / 1000, y / 1000, seed) + 0.28 * vnoise(x / 420, y / 420, seed + 7);
        const { a, b, t } = biomeBlendAt(x);
        n -= a.open + (b.open - a.open) * t;                             // beach / open sea have less rock
        if (y < 520) n -= ((520 - y) / 520) * 0.6;                       // open water under the surface
        const fy = floorY(x);
        if (y > fy) n += (y - fy) / 380;                                 // the seabed
        else {
            // Open sea: clear water from the surface down to just above the bottom. Rock that
            // hangs in mid-water belongs to the islands' flanks only (spec 5.0c).
            const sea = seaShare(x);
            if (sea > 0) n -= FIELD.seaClear * sea * Math.min(1, (fy - y) / FIELD.seaBottom);
        }
        // Keep the abyss shaft swimmable all the way down.
        if (y > 4200 && y < fy - 150 && Math.abs(x - ABYSS.x) < ABYSS.halfWidth * 0.75) n -= 0.6;
        if (x < WORLD_WEST + 900) n += (WORLD_WEST + 900 - x) / 500;     // western shore
        if (x > WORLD_END + 900) n += (x - WORLD_END - 900) / 500;       // wall behind the grand nest
        const ds = Math.hypot(x - FIELD.spawn.x, y - FIELD.spawn.y);
        if (ds < 900) n -= (1 - ds / 900) * 0.6;                         // clear start pool
        if (withNests && nests) {
            // The calm route: fully open inside its half width, fading back to rock over as much
            // again (a soft edge: no sharp step in the field). Where the lane runs just under the
            // open surface water, everything above it is lane too, so no sliver of rock is left between.
            const ry = routeY(x), shallow = ry - ROUTE.halfWidth * 2 < 620 && y < ry;
            const off = shallow ? 0 : Math.abs(y - ry) / ROUTE.halfWidth;
            if (off < 2 && x > FIELD.spawn.x - 600 && x < WORLD_END) n -= 0.95 * smooth01(2 - off);
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

    // The first nest right under the start pool (in the lagoon), one where every later coast
    // biome begins (the open sea has none: its bottom is far below the way across), the grand
    // nest at the end; each on the real seabed: start inside it and walk up.
    const xs = [FIELD.spawn.x, ...BIOMES.slice(1).filter(b => b.zone === 'island').map(b => b.from + 260)];
    xs.push(WORLD_END - 300);
    const groundAt = x => { let y = floorY(x) + 260; while (y > 400 && density(x, y, false) > FIELD.threshold) y -= 12; return y; };
    nests = xs.map((at, index) => {
        // On the seabed, not on top of a rock that happens to stand there: of the columns
        // close by, the one whose ground lies deepest.
        let x = at, y = groundAt(at);
        if (index > 0 && index < xs.length - 1) {
            for (let k = 1; k <= FIELD.nestSearch; k++) { const gx = at + k * 120, gy = groundAt(gx); if (gy > y) { x = gx; y = gy; } }
        }
        // How far to either side the route's dip to this nest reaches.
        const cruise = cruiseY(x);
        const reach = Math.max(900, Math.abs(y + 12 - ROUTE.aboveNest - cruise) * ROUTE.descent);
        return { x, y: y + 12, index, grand: index === xs.length - 1, reach, biome: biomeIndexAt(x) };
    });

    return { density, nests, routeY };
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
